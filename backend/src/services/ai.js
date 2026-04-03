const Anthropic = require('@anthropic-ai/sdk');
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

// Research that actually synthesizes rather than hallucinating
const researchLead = async (lead, profile) => {
  const legacySystem = profile.legacy_system || 'Costpoint or a similar legacy ERP';
  const prompt = `You are preparing a GovCon sales rep for outreach to this prospect. Do NOT invent statistics or percentages about their specific business. Only state things you can reasonably infer from their title, company, and the GovCon world they operate in.

PROSPECT: ${lead.full_name || 'Unknown'}, ${lead.title || 'Unknown'} at ${lead.company || 'Unknown'}
NOTES: ${lead.notes || 'none'}
THEY LIKELY USE: ${legacySystem}

${SUMX_CONTEXT}

Write exactly 3 paragraphs — under 200 words total. Be direct, no hedging words like "probably" or "likely" more than once per paragraph:

1. COMPANY REALITY: What does this company do based on their name and what you can reasonably infer? What kind of GovCon work — prime, sub, T&M, fixed price? Be honest about what you don't know. Do NOT invent revenue numbers, headcount, or contract counts. Do NOT name any specific ERP system they use — you don't know what they run.

2. THIS PERSON'S WORLD: What does someone with this exact title actually do every day in a GovCon company? What are they responsible for and what keeps them up at night — compliance, audit risk, cash flow, billing accuracy, key-person dependency? Focus on role-based reality, not invented specifics.

3. THE ANGLE: What is the single most credible opening question or observation for this person? Frame it around a workflow pain that is genuinely common in GovCon finance — NOT naming a specific ERP system. Do NOT mention Costpoint, Deltek, or any vendor. What should the rep absolutely NOT assume or bring up first?

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

const generatePlaybook = async (lead, profile) => {
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

  let researchBrief = '';
  try {
    researchBrief = await withTimeout(researchLead(lead, profile), 12000, 'research');
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
6. Email 1: 4-6 sentences max. One role-specific observation about GovCon finance reality, one implication, one question. Signed: ${senderName}${emailSignature}
7. Email 2: Completely different angle — key-person risk, a specific workflow scenario, or a peer observation. No product pitch. No unverifiable assertions. Signed: ${senderName}${emailSignature}
8. Email 3: Under 75 words total. One tight observation. One question. Nothing else. Signed: ${senderName}${emailSignature}
9. Email 4: Under 55 words. Honest warm close. Leave door open. No guilt trip. Signed: ${senderName}${emailSignature}
10. Call opener: 15 seconds MAX when read aloud at a natural pace. One role-based observation, permission ask, done.
11. Write in the voice of: ${tone}
12. Objections: Sound like a confident peer who has heard this before. Never start a response with "That makes sense" or "I understand your concern."
13. Each email takes a genuinely different angle — use the FIVE DISTINCT PAIN ANGLES defined in SUMX_CONTEXT. Email 1 picks the single most credible angle for this prospect's title. Email 2 picks a DIFFERENT named angle. Email 3 picks yet another. Never use the same angle twice in one sequence. Key person risk is ONE of five options — do not make it the default for every email. Angle 5 (SSO/Azure) should only be used when the prospect's company name or notes suggest IT/systems work or CMMC pursuit.
14. Final check: does any email start with "I"? Rewrite it. Does it name a specific ERP? Remove it. Does it assert something as fact you cannot verify? Make it a question.

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
      max_tokens: 3000,
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

module.exports = { generatePlaybook, chatWithPlaybook };

