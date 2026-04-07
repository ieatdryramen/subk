const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const withTimeout = (promise, ms, label) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${label} took over ${ms/1000}s`)), ms)
  );
  return Promise.race([promise, timeout]);
};

// ─────────────────────────────────────────────────────────────
// SUMX GOVCON CONTEXT — baked into every generation
// Sourced from real demo transcripts and discovery calls
// ─────────────────────────────────────────────────────────────
const SUMX_CONTEXT = `
WHAT SUMX ACTUALLY IS:
SumX is a modern ERP built specifically for government contractors (GovCon). It replaces legacy systems like Costpoint, Deltek Vision, and Unanet. The tagline that lands in demos: "What if QuickBooks and Costpoint had a baby." It is genuinely easy to use — prospects consistently say "intuitive" and "user friendly" when they see it for the first time. It is also fully DCAA-compliant and built for the GovCon billing and labor environment from the ground up.

THE CORE THING THAT MAKES IT DIFFERENT:
Everything lives with the record it belongs to. In Costpoint, you touch 3-4 different screens to do one thing. Security settings for an employee? Three different places. Posting a bill? You print it, save it to a folder, hope you find it during an audit. Wage determination rates? Four screens just to add someone to a workforce. In SumX, every piece of information — the employee's role, their salary, their security permissions, their leave — lives on the employee record itself. Every billing document, its backup, its approval, its audit trail — lives on the bill. You don't hunt. You don't print and file. You open the record and everything is there.

THE SPECIFIC PAINS PROSPECTS DESCRIBE IN THEIR OWN WORDS:
1. "I have to go to three different screens just to set up security for one employee — you've got to do it on this side, then this side, then somewhere else in Costpoint"
2. "When I get an audit, I have to go hunt for the posting in a folder I hopefully saved it to — I can't just pull it up"
3. "Wage determination is so painful to maintain — four screens just to add workforce rates"
4. "I'm limited to 30 characters for project numbers and 25 for project names — I have to get really creative"
5. "I pull data out of Costpoint into Excel, run a VLOOKUP against the budget, just to see an income statement vs budget — it should just be there"
6. "Something goes wrong and Janet and I have to bend our brain waves to figure out where we even start looking"
7. "Those import templates when we moved to Costpoint — they were so painful. She broke bones." (referring to the data migration)
8. "I have to run through build, compute, update the project — just to see a report. In SumX you just click Update Report"
9. "I don't want Janet to lose her mind switching systems" — the migration fear is real, especially for controllers and finance staff
10. "It was easier to put a satellite into orbit than to use Costpoint" — direct quote from a prospect

THE FOUR DISTINCT PAIN ANGLES — USE THESE TO VARY EMAIL HOOKS:
Each angle is a real, standalone pain. Do NOT stack all four into one sequence. Pick the most credible one for Email 1 based on the prospect's title, then rotate to a different angle for each subsequent email.

ANGLE 1 — KEY PERSON RISK: One person knows where everything lives. If they leave, take a vacation, or get sick, billing stops and audit prep becomes a crisis. Works for: any title that owns finance or operations.

ANGLE 2 — BILLING VELOCITY / CASH FLOW LAG: Government pays net-30 (or slower). Every day of delay between approved timesheets and invoice-out-the-door is a day of cash collection lost. Multi-screen approval workflows add days to a process that should take minutes. Works best for: CFO, VP Finance, COO, President/CEO.

ANGLE 3 — AUDIT DOCUMENTATION HUNT: When DCAA shows up, your team spends more time finding documents than explaining the work. The backup should live with the bill record — instead it's in folders, printouts, and emails across multiple systems. Works best for: CFO, Controller, Compliance leads.

ANGLE 4 — REPORTING THAT REQUIRES EXCEL: To see budget vs. actual, your team exports data out of the ERP and builds it in a spreadsheet. The system that should give you visibility requires you to leave the system to get it. Works best for: CFO, Controller, Program Manager, COO.

ANGLE 5 — SSO / AZURE MIGRATION FORCING FUNCTION: Many GovCon firms are being pushed to migrate to Azure AD or implement SSO as part of CMMC or IT modernization. When that happens, legacy ERP systems that don't support modern auth become a forcing function to evaluate everything. Works best for: COO, CIO, IT-adjacent ops leaders, CEOs at firms actively pursuing CMMC compliance. Use this angle when the prospect's company name or notes suggest IT/systems focus.

WHAT ACTUALLY GETS PROSPECTS TO BUY:
- They see the billing screen and realize they can approve and send a bill without touching anything outside the system
- The audit trail living with the record — DCAA compliance without the manual filing
- "If Janet retired, her replacement could actually learn this" — retention and hiring risk from Costpoint complexity
- Single sign-on pressure / Azure migration creating a natural forcing function to switch
- Seeing that the implementation is a third the size of what they went through with Costpoint

WHAT NOT TO SAY OR DO:
- Never invent percentages or statistics about their business — you don't know their numbers
- Never say "streamline" or "optimize" or "leverage"
- Never name a competitor ERP in outbound copy — you don't know what they use. Not in emails, not in DMs, not in call openers. Never.
- Never lead with SumX features — lead with their workflow pain
- Never assume they're fully replacing — sometimes it starts as just timesheets for 1099s, or AP integration
- The real objection is almost never price — it's timing, migration fear, and "we just got through implementing the last thing"

BUYER PERSONAS IN GOVCON:
- Controller / Accounting Manager (often named Janet in demos): Does the actual work in the system every day. Fears migration, values stability, will be the one who has to learn it. Win her over and you win the deal. Lead with "your day gets easier, not harder."
- CFO / CEO: Cares about DCAA compliance, audit risk, cash flow velocity, and not being dependent on one finance person who knows the arcane Costpoint workarounds
- Contracts Manager: Cares about project setup, workforce assignments, billing accuracy, and having mods attached to the right contract record
- Program Managers: Care about timesheet approval, project visibility, and not getting surprised by billing issues at the end of the month
`;

// Pull real company data from USASpending + Anthropic web search
const webResearch = async (company, personName) => {
  const facts = [];

  // 1. USASpending — recent federal awards
  try {
    const spending = await axios.post('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      filters: {
        time_period: [{ start_date: '2022-01-01', end_date: new Date().toISOString().split('T')[0] }],
        award_type_codes: ['A','B','C','D'],
        recipient_search_text: [company],
      },
      fields: ['Award ID','Recipient Name','Award Amount','Awarding Agency Name','Award Type','Description','Period of Performance Start Date'],
      sort: 'Award Amount',
      order: 'desc',
      limit: 5,
      page: 1,
    }, { timeout: 8000 });

    const awards = spending.data?.results || [];
    if (awards.length) {
      const total = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
      facts.push(`USASpending federal contract awards: ${awards.length} found, totaling $${(total/1000000).toFixed(1)}M`);
      awards.slice(0, 4).forEach(a => {
        facts.push(`- ${a['Description']?.substring(0, 80) || 'N/A'} | ${a['Awarding Agency Name']} | $${((a['Award Amount']||0)/1000000).toFixed(2)}M`);
      });
    } else {
      facts.push('No federal contract awards found in USASpending.');
    }
  } catch (e) {
    facts.push('USASpending lookup failed.');
  }

  // 2. Anthropic web search for company + person intel
  try {
    const searchResult = await withTimeout(client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search for "${company}" government contractor. Find: what agencies they work with, their size/revenue if available, any recent news or contract wins, and anything about ${personName || 'their leadership'}. Return only factual findings in bullet points, no speculation.`
      }]
    }), 15000, 'web search');

    const textBlocks = searchResult.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (textBlocks.trim()) facts.push('Web search findings:\n' + textBlocks.substring(0, 800));
  } catch (e) {
    // Web search optional — continue without it
  }

  return facts.join('\n');
};

// Research that actually synthesizes rather than hallucinating
const researchLead = async (lead, profile) => {
  const legacySystem = profile.legacy_system || 'Costpoint or a similar legacy ERP';

  // Pull real data first
  let realData = '';
  if (lead.company) {
    try {
      realData = await withTimeout(webResearch(lead.company, lead.full_name), 10000, 'web research');
    } catch (e) {
      realData = 'Real-time research unavailable.';
    }
  }

  const prompt = `You are preparing a GovCon sales rep for outreach to this prospect. Use the REAL DATA below where available. Do NOT invent statistics not supported by the data.

PROSPECT: ${lead.full_name || 'Unknown'}, ${lead.title || 'Unknown'} at ${lead.company || 'Unknown'}
NOTES: ${lead.notes || 'none'}
THEY LIKELY USE: ${legacySystem}

REAL RESEARCH DATA:
${realData || 'No real data available — infer from company name only.'}

${SUMX_CONTEXT}

Write exactly 3 paragraphs — under 250 words total. Be direct and specific. Use the REAL DATA above where available:

1. COMPANY REALITY: What does this company actually do? Reference real contract awards, agencies they work with, and contract types if data is available. If no real data, infer from the name honestly. Do NOT invent numbers not in the data.

2. THIS PERSON'S WORLD: What does someone with this exact title actually do every day in a GovCon company of this type? What keeps them up at night — compliance, audit risk, cash flow, billing accuracy, key-person dependency? Be specific to their actual company size and contract mix if known.

3. THE ANGLE: Given what you know about this specific company and person, what is the single most credible opening? Reference a specific pain — their agency focus, contract type, or scale — if you have real data to back it. What should the rep NOT assume?

HARD RULES FOR THIS OUTPUT:
- Never mention Costpoint, Deltek, Unanet, or any ERP by name — you don't know what they use
- Never invent statistics, firm counts, or percentages ("200+ firms", "40% of companies")
- Never say "probably" more than once per paragraph
- Under 200 words total`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
};

const roleStrategy = {
  SDR: {
    mission: 'Get 20 minutes on the calendar. Create enough curiosity that they say yes to a call.',
    emailApproach: 'Short, pattern-interrupting, one question at the end. Never more than 5 sentences. Sounds like a text from a smart person who actually knows GovCon, not a sales email.',
    callApproach: 'Lead with a specific observation about their system or workflow pain, ask for permission, then shut up and listen.',
    linkedinApproach: 'Connect request with a one-liner that shows you know their world. DM should be 2-3 sentences max.',
    winningMove: 'Show you know what GovCon finance teams deal with in legacy ERPs. Do not name their system — ask about the pain instead.',
  },
  AE: {
    mission: 'Get to a business case conversation. Show you understand their ERP pain better than their current vendor does.',
    emailApproach: 'Peer-level. 80-120 words. One specific observation about a workflow that is painful in their current system. One question that makes them think about the cost of that pain.',
    callApproach: 'Establish credibility in 30 seconds by naming something specific about their world, then ask questions. The best calls are 80% them talking.',
    linkedinApproach: 'Thoughtful, business-level observation. Reference something real about GovCon or their specific situation.',
    winningMove: 'Show you understand their current system\'s pain better than they expected. That earns the demo.',
  },
  AM: {
    mission: 'Expand the relationship. Protect and grow the account.',
    emailApproach: 'Warm and consultative. Reference what is working. Expansion framing, not upsell pressure.',
    callApproach: 'Check in first. Ask how the transition went. Listen. Only pivot to growth when they confirm things are working.',
    linkedinApproach: 'Trusted advisor. Engage genuinely. Share things that are useful to them specifically.',
    winningMove: 'Remind them of the specific pain they no longer have. That makes expansion feel natural.',
  },
  CSM: {
    mission: 'Drive adoption, prove ROI, secure renewal.',
    emailApproach: 'Helpful and specific. Frame everything around their outcomes since going live.',
    callApproach: 'Lead with their wins. Ask what\'s working, what\'s not. Be the person who solves problems.',
    linkedinApproach: 'Thought partner. Share insights relevant to their role.',
    winningMove: 'Connect what they are doing in SumX to outcomes their leadership cares about.',
  },
  SE: {
    mission: 'Establish technical credibility, understand their environment, drive a POC.',
    emailApproach: 'Technically credible without jargon. Reference a specific integration challenge or data architecture question.',
    callApproach: 'Technical peer energy. Ask about their environment before anything else.',
    linkedinApproach: 'Reference something technical — their stack, their compliance architecture, their reporting setup.',
    winningMove: 'Show you understand their current system\'s technical constraints, not just SumX features.',
  },
};

const generatePlaybook = async (lead, profile, sections, situation) => {
  const role = profile.sender_role || 'AE';
  const strategy = roleStrategy[role] || roleStrategy.AE;
  const senderName = profile.sender_name || 'Jack';
  const emailSignature = profile.email_signature ? `\n${profile.email_signature}` : '';
  const tone = profile.tone === 'custom' && profile.custom_tone ? profile.custom_tone : (profile.tone || 'direct and confident, like a peer in the GovCon industry');
  const legacySystem = profile.legacy_system || 'Costpoint';
  const complianceContext = profile.compliance_focus || '';
  const workflowPains = profile.workflow_pains || '';
  const buyerPersonaContext = profile.buyer_personas || '';
  const migrationContext = profile.migration_notes || '';

  // Situation context — changes the email architecture
  const situationMap = {
    just_won_contract: `SITUATION: This prospect just won a new government contract. Open Email 1 by acknowledging the win specifically — congratulate them, then pivot to the fact that new contracts mean new billing complexity, new CLIN structures, more audit exposure. Don't lead with pain — lead with momentum and then introduce the risk.`,
    mid_audit: `SITUATION: This prospect is currently in the middle of a DCAA audit. Do NOT congratulate or open with good news. Open with empathy for the audit crunch — the document hunt, the pressure, the distraction from actual work. Position SumX as what prevents this from happening again after the audit is over.`,
    referred: `SITUATION: The rep was referred to this prospect by someone they know. Open Email 1 by mentioning the referral directly — "I was speaking with [mutual connection] and your name came up." Make it warm and specific, not generic. The referral is the hook — use it.`,
    responded_before: `SITUATION: This prospect responded to outreach before but didn't convert. Don't rehash the previous conversation. Open with something new — a different angle, a new data point, or a changed circumstance. Acknowledge implicitly that they've heard from you before by being fresher and more specific this time.`,
  };
  const situationContext = situation && situationMap[situation] ? situationMap[situation] : '';

  let researchBrief = '';
  try {
    researchBrief = await withTimeout(researchLead(lead, profile), 25000, 'research');
  } catch (err) {
    console.log('Research skipped:', err.message);
    researchBrief = `${lead.full_name || 'This person'} is a ${lead.title || 'professional'} at ${lead.company || 'their company'}.`;
  }

  const prompt = `You are writing a GovCon sales playbook for ${senderName}, a ${role} at ${profile.name || 'SumX'}.

${SUMX_CONTEXT}

SELLER CONTEXT:
Sender: ${senderName}, ${role} at ${profile.name || 'SumX'}
Product: ${profile.product || 'SumX — modern ERP for government contractors'}
What makes it different: ${profile.value_props || 'Everything lives with the record. No more hunting across screens.'}
Who they sell to: ${profile.icp || 'Government contractors using Costpoint, Deltek, or similar legacy ERPs'}
Target titles: ${profile.target_titles || 'CFO, Controller, Contracts Manager, CEO'}
Legacy system this prospect likely uses: ${legacySystem}
Compliance context: ${complianceContext || 'DCAA compliance, CMMC, government contract billing'}
Additional workflow pains for this org: ${workflowPains || 'see SUMX CONTEXT above'}
Buyer persona notes: ${buyerPersonaContext || 'see SUMX CONTEXT above'}
Migration / timing notes: ${migrationContext || ''}
Objections they hear constantly: ${profile.objections || 'We just implemented Costpoint / Bad timing / Our controller knows all the workarounds'}
Tone: ${tone}

PROSPECT:
Name: ${lead.full_name || 'Unknown'}
Title: ${lead.title || 'Unknown'}
Company: ${lead.company || 'Unknown'}
Email: ${lead.email || 'unknown'}
Notes: ${lead.notes || 'none'}

RESEARCH BRIEF:
${researchBrief}

${situationContext ? `OUTREACH SITUATION — READ THIS FIRST:\n${situationContext}\n` : ''}
${senderName.toUpperCase()}'S ROLE AS ${role}:
Mission: ${strategy.mission}
Email approach: ${strategy.emailApproach}
Call approach: ${strategy.callApproach}
LinkedIn approach: ${strategy.linkedinApproach}
Winning move: ${strategy.winningMove}

═══════════════════════════════════════════════
ABSOLUTE BANNED LIST — VIOLATION = REWRITE FROM SCRATCH

BANNED OPENERS — first sentence cannot contain:
✗ "I've been working with / helping"
✗ "I work with [X] companies/firms who..."
✗ "I noticed that" / "I came across" / "I wanted to reach out"
✗ "Hope this finds you" / "I know you're busy"
✗ "Just following up" / "Quick question" / "Touching base" / "Checking in"
✗ "I was doing some research and"

BANNED PHRASES — cannot appear anywhere in ANY section of output:
✗ Any statistic or percentage you cannot verify — NO "X% of companies" or "saves Y hours"
✗ Costpoint, Deltek, Unanet, or ANY competitor ERP name — not in emails, not in brush-offs, not in callbacks, not even as a question like "are you using Costpoint?" You do not know what system they use. NEVER NAME IT.
✗ "Janet" or any placeholder first name used generically — ALWAYS say "your controller" or "your finance person" instead
✗ "streamline" / "optimize" / "optimized" / "leverage" / "utilize"
✗ "touch base" / "circle back" / "synergies" / "game-changing" / "best-in-class"
✗ "solution" — use "SumX" or be specific about what it does
✗ "pain points" — name the actual problem
✗ "value proposition" — show it, don't name it
✗ "move the needle" / "low-hanging fruit" / "at the end of the day"
✗ Generic subjects: "Quick question" / "Following up" / "Introduction"
✗ Unverifiable assertions dressed as facts — if you cannot prove it, ask it as a question instead

BANNED STRUCTURES:
✗ Starting Email 1 talking about yourself or SumX
✗ Any email that reads like a feature list
✗ Objection responses starting with "Great question!" or "I understand your concern"
✗ More than one statistic in any single email (and only use verified ones — if unsure, use zero)
═══════════════════════════════════════════════

HARD RULES:
1. Every email opens with a specific observation about THEIR world — their title, their role in GovCon finance, what someone in their position is responsible for. Not about SumX. Not about you.
2. Lead with process pain framed as a question or observation — never an assumption. "Most GovCon finance teams deal with X" is better than "your team probably has X problem."
3. Do NOT name Costpoint, Deltek, Unanet, or any ERP vendor anywhere in emails — you do not know what they use.
4. Do NOT use "Janet" or ANY placeholder first name as a generic stand-in anywhere in the output — in emails, brush-offs, callbacks, or objection handling. Always say "your controller" or "your finance person" or "that person."
5. Do NOT make unverifiable assertions dressed as facts — "government contractors lose more deals to back-office capacity than pricing" is invented. If you cannot verify it, make it a question instead.
6. USE THE RESEARCH DATA: If the research brief contains real contract amounts, agencies, or contract types — USE them. A specific dollar amount or agency name in an email is 10x more compelling than a generic observation. "Managing $47M across DHS and DoD contracts" beats "running a GovCon firm" every time.
7. Email 1: 4-6 sentences max. One role-specific observation grounded in real research data if available, one implication, one question. Signed: ${senderName}${emailSignature}
8. Email 2: Completely different angle — key-person risk, a specific workflow scenario, or a peer observation. Reference their specific agency mix or contract type if known. No product pitch. Signed: ${senderName}${emailSignature}
9. Email 3: Under 75 words total. One tight observation using a specific data point if available. One question. Nothing else. Signed: ${senderName}${emailSignature}
10. Email 4: Under 55 words. Honest warm close. Leave door open. No guilt trip. Signed: ${senderName}${emailSignature}
11. Call opener: 15 seconds MAX when read aloud at a natural pace. One role-based observation, permission ask, done. Reference their contract scale or agency focus if known.
12. Write in the voice of: ${tone}
13. Objections: Sound like a confident peer who has heard this before. Never start a response with "That makes sense" or "I understand your concern."
14. Each email takes a genuinely different angle — use the FIVE DISTINCT PAIN ANGLES defined in SUMX_CONTEXT. Email 1 picks the single most credible angle for this prospect's title. Email 2 picks a DIFFERENT named angle. Email 3 picks yet another. Never use the same angle twice in one sequence. Key person risk is ONE of five options — do not make it the default for every email. Angle 5 (SSO/Azure) should only be used when the prospect's company name or notes suggest IT/systems work or CMMC pursuit.
15. Final check: does any email start with "I"? Rewrite it. Does it name a specific ERP? Remove it. Does it assert something as fact you cannot verify? Make it a question. Did you use any specific data from the research brief? If not — rewrite using it.

SELF-CHECK:
- First word of each email: if "I" → rewrite
- Any banned phrase present → rewrite that section
- Email 3 over 75 words → cut it
- Email 4 over 55 words → cut it
- Any invented statistic about their specific company → remove it

Return ONLY valid JSON (no markdown, no backticks):
{
  "research": "The research brief as 3 clean paragraphs for the rep — what the rep needs to know walking into this call",
  "email1": "SUBJECT: [specific to their world — not a question, not clever, just clear]\\n\\n[Opens with observation about their daily reality or current system pain. Ends with one question that makes them think about the cost of that pain.]\\n\\n${senderName}",
  "email2": "SUBJECT: [different angle]\\n\\n[Completely different — a specific workflow scenario they deal with, a consequence of their current system, or something their peers in GovCon are dealing with. No product pitch. Just something that makes them say 'yeah, that's actually true.']\\n\\n${senderName}",
  "email3": "SUBJECT: [short]\\n\\n[Under 75 words TOTAL. One workflow observation. One question. Nothing else.]\\n\\n${senderName}",
  "email4": "SUBJECT: [subject]\\n\\n[Under 55 words. Honest. No guilt trip. Leave door open for when timing is right.]\\n\\n${senderName}",
  "linkedin": "CONNECTION REQUEST (under 300 chars, no pitch):\\n[One line that shows you know their world — their title, their system, their industry. Not a pitch.]\\n\\nFOLLOW-UP DM (after they accept):\\n[2-3 sentences. A genuine question about their current workflow or system situation. No pitch.]\\n\\nIF NO RESPONSE DM:\\n[Final short message. Adds something genuinely useful about GovCon or their role. Different question.]",
  "call_opener": "OPENING (under 18 seconds):\\n[Name, SumX, one specific reason you're calling THIS person based on their title and likely system. No stats. No pitch. A real observation about their world.]\\n[Natural permission ask]\\n\\nIF THEY HAVE 2 MIN — DISCOVERY:\\n1. [Question about their current system and how they handle a specific workflow]\\n2. [Question that surfaces the real cost of that workflow]\\n3. [Question about what happens when something goes wrong — audit, billing error, key person leaving]\\n\\nWHEN THEY BRUSH YOU OFF:\\n'Not interested' → [2 sentences that earn 30 more seconds without being pushy — reference a specific workflow pain]\\n'Send me an email' → [Validates but keeps the conversation — asks one quick diagnostic question]\\n'We already have something' → [Plants a seed about the specific pain their current system causes — no argument]\\n'Bad timing' → [Acknowledges timing, plants the seed for when it makes sense — asks what would need to change]",
  "objection_handling": "OBJECTION: [exact words] | RESPONSE: [conversational, confident — sounds like someone who has heard this 100 times and still believes in what they are selling]\\n\\n[Cover: migration fear, timing, 'our controller knows all the workarounds', 'we just implemented Costpoint', DCAA compliance concern, cost, 'we're too small']\\n\\nNever start with 'Great question' or 'I understand your concern'.",
  "callbacks": "CONVERSATION HANDLES — things to say to keep the call alive:\\n\\n1. [A specific ERP workflow pain stated as a question about their experience — do NOT name Costpoint or assume their system]\\n2. [A question about their audit prep or DCAA compliance that makes them think]\\n3. [A scenario: 'what happens when your controller is out and someone else has to figure out where the billing is'] \\n4. [A question about their timesheet process and how long approval takes]\\n5. [A natural next step — 'would it be worth 20 minutes to see what this looks like for your specific setup']\\n6. [If they go quiet — a re-engagement question about a specific pain, not a pitch]\\n7. [A peer reference setup: 'one of your counterparts at a similar-sized GovCon firm said X — does that resonate']\\n8. [A value-add: something genuinely useful about GovCon compliance or billing even if they don't buy]"
}`;

  const message = await withTimeout(
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
    50000,
    'playbook generation'
  );

  const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
  return JSON.parse(text);
};

const chatWithPlaybook = async (messages, lead, profile, playbook) => {
  const playbookContext = playbook ? `
FULL PLAYBOOK FOR THIS LEAD:
RESEARCH: ${playbook.research || 'Not generated'}
EMAIL 1: ${playbook.email1 || 'Not generated'}
EMAIL 2: ${playbook.email2 || 'Not generated'}
EMAIL 3: ${playbook.email3 || 'Not generated'}
EMAIL 4: ${playbook.email4 || 'Not generated'}
LINKEDIN: ${playbook.linkedin || 'Not generated'}
CALL OPENER: ${playbook.call_opener || 'Not generated'}
OBJECTION HANDLING: ${playbook.objection_handling || 'Not generated'}
CALLBACKS: ${playbook.callbacks || 'Not generated'}` : 'No playbook generated yet.';

  const systemPrompt = `You are an expert sales coach helping ${profile.sender_name || 'a rep'} (${profile.sender_role || 'AE'}) at ${profile.name || 'SumX'} with their outreach to ${lead.full_name || 'this prospect'} (${lead.title || 'unknown title'}) at ${lead.company || 'their company'}.

${SUMX_CONTEXT}

SELLER: ${profile.sender_name}, ${profile.sender_role || 'AE'} at ${profile.name || 'SumX'}
PROSPECT: ${lead.full_name}, ${lead.title} at ${lead.company}

${playbookContext}

You have the full playbook. When asked to rewrite something, rewrite it completely — do not ask the rep to paste it in. Be direct. If something is weak, say so and show better. Never invent statistics. Never use banned phrases. You are a trusted advisor, not a cheerleader.`;

  const response = await withTimeout(
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    }),
    30000,
    'chat'
  );

  return response.content[0].text;
};

// ─────────────────────────────────────────────────────────────
// SubK AI Functions (opportunity scoring, prime outreach, cap statements, coach)
// ─────────────────────────────────────────────────────────────

// Score an opportunity against a sub's profile — structured match first, AI for nuance
const scoreOpportunity = async (opportunity, subProfile) => {
  let structuredScore = 0;
  const reasons = [];

  const subNaics = (subProfile.naics_codes || '').split(',').map(n => n.trim()).filter(Boolean);
  const oppNaics = opportunity.naics_code?.trim();
  if (oppNaics && subNaics.length) {
    const exact = subNaics.includes(oppNaics);
    const prefix3 = subNaics.some(n => n.substring(0, 3) === oppNaics.substring(0, 3));
    if (exact) { structuredScore += 40; reasons.push(`Exact NAICS match (${oppNaics})`); }
    else if (prefix3) { structuredScore += 20; reasons.push(`Partial NAICS match (${oppNaics.substring(0, 3)}xx)`); }
    else { reasons.push(`NAICS mismatch — they want ${oppNaics}, you have ${subNaics.slice(0, 2).join(', ')}`); }
  }

  const subCerts = (subProfile.certifications || '').toLowerCase();
  const setAside = (opportunity.set_aside || '').toLowerCase();
  const certMap = [
    { key: '8(a)', label: '8(a)' }, { key: 'hubzone', label: 'HUBZone' },
    { key: 'sdvosb', label: 'SDVOSB' }, { key: 'vosb', label: 'VOSB' },
    { key: 'wosb', label: 'WOSB' }, { key: 'edwosb', label: 'EDWOSB' },
    { key: 'small business', label: 'Small Business' },
  ];
  if (!setAside || setAside === 'none' || setAside.includes('full and open')) {
    structuredScore += 15; reasons.push('Full & open — no set-aside restriction');
  } else {
    const match = certMap.find(c => setAside.includes(c.key) && subCerts.includes(c.key));
    if (match) { structuredScore += 30; reasons.push(`${match.label} set-aside — you qualify`); }
    else {
      const req = certMap.find(c => setAside.includes(c.key));
      reasons.push(`Set-aside requires ${req?.label || setAside} — verify eligibility`);
    }
  }

  const subAgencies = (subProfile.target_agencies || '').toLowerCase();
  const oppAgency = (opportunity.agency || '').toLowerCase();
  if (subAgencies && oppAgency) {
    const agencyMatch = subAgencies.split(',').some(a => oppAgency.includes(a.trim()) || a.trim().includes(oppAgency.split(' ')[0]));
    if (agencyMatch) { structuredScore += 15; reasons.push(`Target agency match (${opportunity.agency})`); }
  }

  const minV = subProfile.contract_min || 0;
  const maxV = subProfile.contract_max || 999999999;
  const oppMin = opportunity.value_min || 0;
  const oppMax = opportunity.value_max || oppMin;
  if (oppMin || oppMax) {
    const inRange = oppMin <= maxV && (oppMax === 0 || oppMax >= minV);
    if (inRange) { structuredScore += 15; reasons.push('Contract value in range'); }
    else { reasons.push('Contract value outside your range'); }
  } else {
    structuredScore += 8;
  }

  structuredScore = Math.min(structuredScore, 100);

  if (structuredScore >= 30 && structuredScore <= 70 && subProfile.capabilities) {
    try {
      const msg = await withTimeout(
        client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{ role: 'user', content: `Adjust this opportunity fit score (currently ${structuredScore}/100) up or down by max 15 points based on capabilities match only. Return JSON: {"adjustment": -10, "reason": "one sentence"}\n\nSub capabilities: ${subProfile.capabilities?.substring(0, 300)}\nOpportunity: ${opportunity.title} — ${opportunity.description?.substring(0, 200)}` }],
        }),
        6000, 'score adjustment'
      );
      const parsed = JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());
      structuredScore = Math.min(100, Math.max(0, structuredScore + (parsed.adjustment || 0)));
      if (parsed.reason) reasons.push(parsed.reason);
    } catch (_) { /* skip AI adjustment on timeout */ }
  }

  return { score: structuredScore, reason: reasons.slice(0, 3).join('. ') + '.' };
};

const generatePrimeOutreach = async (prime, subProfile) => {
  const researchPrompt = `You are a GovCon business development expert researching a prime contractor for teaming outreach.

PRIME CONTRACTOR: ${prime.company_name}
Recent Awards: ${JSON.stringify(prime.recent_awards?.slice(0, 3) || [])}
Agency Focus: ${prime.agency_focus}
Total Awards Value: $${(prime.total_awards_value || 0).toLocaleString()}
Award Count: ${prime.award_count}
NAICS Codes: ${prime.naics_codes}

Write a sharp 3-paragraph research brief:
1. WHO THEY ARE: What kind of prime are they? What's their bread and butter? What agencies do they dominate?
2. WHY THEY NEED SUBS: What gaps do they likely have? What capabilities are they always looking to sub out? What certifications would make them more competitive?
3. TEAMING ANGLE: How should this specific sub approach them? What's the hook?

Be specific. Under 200 words. No fluff.`;

  const outreachPrompt = `You are writing teaming outreach for a subcontractor targeting a prime contractor.

SUBCONTRACTOR:
Company: ${subProfile.company_name}
Certifications: ${subProfile.certifications}
Capabilities: ${subProfile.capabilities}
NAICS Codes: ${subProfile.naics_codes}
Past Performance highlights: ${subProfile.past_performance}

TARGET PRIME: ${prime.company_name}
Agency Focus: ${prime.agency_focus}
Recent Win: ${prime.recent_awards?.[0] ? `$${prime.recent_awards[0].amount?.toLocaleString()} from ${prime.recent_awards[0].agency}` : 'Recent federal award'}

HARD RULES:
- Never start any email with "I" as the first word
- No generic buzzwords: synergies, leverage, value-add, best-in-class
- Lead with THEIR recent win or agency focus, not your company
- Sound like a peer in the industry, not a vendor pitching
- Email 1: 4-5 sentences. One specific hook about their recent work. End with one question.
- Email 2: Completely different angle. Short story or contrarian insight. Under 100 words.
- Email 3: Under 60 words. One thing. One question. Done.
- Call opener: Sayable in 15 seconds. Specific. No stats in opening line.

Return ONLY valid JSON:
{
  "teaming_pitch": "2 paragraph capability statement pitch specific to this prime",
  "email1": "SUBJECT: [subject]\\n\\n[body]\\n\\n[sender name]",
  "email2": "SUBJECT: [subject]\\n\\n[body]\\n\\n[sender name]",
  "email3": "SUBJECT: [subject]\\n\\n[body]\\n\\n[sender name]",
  "call_opener": "OPENING (15 sec):\\n[opener]\\n\\nIF THEY HAVE 2 MIN:\\n1. [question]\\n2. [question]\\n3. [question]"
}`;

  try {
    const [researchMsg, outreachMsg] = await Promise.all([
      withTimeout(client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: researchPrompt }] }), 12000, 'prime research'),
      withTimeout(client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: outreachPrompt }] }), 30000, 'outreach generation'),
    ]);
    const research = researchMsg.content[0].text.trim();
    const outreachText = outreachMsg.content[0].text.trim().replace(/```json|```/g, '').trim();
    const outreach = JSON.parse(outreachText);
    return { research, ...outreach };
  } catch (err) { console.error('AI generation error:', err.message); throw err; }
};

const generateCapabilityStatement = async (subProfile, opportunity) => {
  const prompt = `Write a professional capability statement for a government contractor responding to a specific opportunity.

SUBCONTRACTOR:
Company: ${subProfile.company_name}
NAICS Codes: ${subProfile.naics_codes}
Certifications: ${subProfile.certifications}
Capabilities: ${subProfile.capabilities}
Past Performance: ${subProfile.past_performance}
CAGE Code: ${subProfile.cage_code || 'TBD'}
UEI: ${subProfile.uei || 'TBD'}

TARGET OPPORTUNITY:
${opportunity ? `Title: ${opportunity.title}\nAgency: ${opportunity.agency}\nNAICS: ${opportunity.naics_code}` : 'General federal market'}

Write a one-page capability statement with:
1. Core Competencies (4-6 bullet points specific to the opportunity)
2. Differentiators (what sets them apart)
3. Past Performance highlights (3 brief examples)
4. Contact/Company info placeholder

Professional, government contracting tone. Specific. No buzzwords.
Return as plain text, formatted for a Word doc.`;

  const msg = await withTimeout(
    client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    20000, 'capability statement'
  );
  return msg.content[0].text.trim();
};

const chatWithCoach = async (messages, context) => {
  const systemPrompt = `You are an expert GovCon business development coach helping a subcontractor win teaming agreements and federal opportunities.

SUBCONTRACTOR CONTEXT:
Company: ${context.subProfile?.company_name || 'Unknown'}
Certifications: ${context.subProfile?.certifications || 'Not specified'}
Capabilities: ${context.subProfile?.capabilities || 'Not specified'}
NAICS Codes: ${context.subProfile?.naics_codes || 'Not specified'}

${context.prime ? `PRIME BEING TARGETED:\nCompany: ${context.prime.company_name}\nAgency Focus: ${context.prime.agency_focus}\nRecent Awards: $${(context.prime.total_awards_value || 0).toLocaleString()} across ${context.prime.award_count} awards\nResearch: ${context.prime.research || 'Not yet researched'}` : ''}

${context.opportunity ? `OPPORTUNITY BEING PURSUED:\nTitle: ${context.opportunity.title}\nAgency: ${context.opportunity.agency}\nDeadline: ${context.opportunity.response_deadline}\nFit Score: ${context.opportunity.fit_score}/100` : ''}

You are direct, specific, and practical. You know GovCon inside out. Be the most useful BD advisor they've ever talked to.`;

  const response = await withTimeout(
    client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages }),
    25000, 'coach chat'
  );
  return response.content[0].text;
};

module.exports = { generatePlaybook, chatWithPlaybook, scoreOpportunity, generatePrimeOutreach, generateCapabilityStatement, chatWithCoach };

