const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const withTimeout = (promise, ms, label) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${label} took over ${ms/1000}s`)), ms)
  );
  return Promise.race([promise, timeout]);
};

// Deep research — this sets the foundation for everything else
const researchLead = async (lead) => {
  const prompt = `You are a sharp B2B sales researcher preparing a rep for outreach. Be specific and opinionated — no hedging, no "likely" or "probably."

Prospect: ${lead.full_name || 'Unknown'}, ${lead.title || 'Unknown'} at ${lead.company || 'Unknown'}

Write exactly 3 paragraphs:

1. COMPANY REALITY: What does this company actually do and who are their customers? What is their business model? What is their growth stage and what pressure does that create right now? Be specific — name their actual market, not a generic description.

2. ROLE REALITY: What does someone with this exact title actually do all day? What are they measured on, what keeps them up at night, and what would make them look good to their boss or board? What do they personally care about vs what they say they care about?

3. ANGLE OF ATTACK: Given this specific person at this specific company right now, what's the single most compelling reason they'd take a meeting? What do you lead with? What do you NOT bring up? What's the one thing that would make them feel like this rep did their homework?

No fluff. No hedging. Under 220 words total.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
};

// Role strategies — these define fundamentally different approaches, not just tone
const roleStrategy = {
  SDR: {
    mission: 'Get 20 minutes on the calendar. Your only job is to create enough curiosity that they say yes to a call.',
    emailApproach: 'Short, pattern-interrupting, one question at the end. Never more than 5 sentences. Sounds like a text message from a smart person, not a sales email.',
    callApproach: 'Lead with a specific observation about them, ask for permission, then shut up and listen. Your goal is discovery, not pitching.',
    linkedinApproach: 'Connect request with a one-liner observation. DM should be 2-3 sentences max — a genuine question, not a pitch.',
    winningMove: 'Make them feel like you noticed something specific about them. Curiosity beats features every time.',
  },
  AE: {
    mission: 'Get to a business case conversation. Establish peer credibility, uncover the real problem, connect it to business outcomes.',
    emailApproach: 'Peer-level executive communication. 80-120 words. One specific insight about their business or situation. One question that makes them think.',
    callApproach: 'Establish credibility in 30 seconds, then ask questions. The best AE calls are 80% prospect talking.',
    linkedinApproach: 'Thoughtful, business-level observation. Reference something specific from their profile or recent company news.',
    winningMove: 'Show you understand their business better than they expected. That earns the conversation.',
  },
  AM: {
    mission: 'Expand the relationship. Protect and grow the account. Lead with their success before you ever mention new products.',
    emailApproach: 'Warm and consultative. Reference something they told you or something you know about their situation. Expansion framing, not upsell pressure.',
    callApproach: 'Check-in first. Ask how things are going. Listen. Only pivot to growth conversation when they\'ve confirmed things are working.',
    linkedinApproach: 'Trusted advisor. Engage with their content genuinely. Share things that are useful to them specifically.',
    winningMove: 'Remind them of the wins you\'ve already had together. That makes expansion feel natural, not pushy.',
  },
  CSM: {
    mission: 'Drive adoption, prove ROI, secure renewal. Be the person they call when something goes wrong AND when they want to grow.',
    emailApproach: 'Helpful and specific. What outcomes have they achieved? What\'s the next milestone? Frame everything around their success.',
    callApproach: 'Lead with their outcomes, not your product. Ask what\'s working, what\'s not. Be the person who solves problems, not just checks in.',
    linkedinApproach: 'Thought partner, not vendor. Share insights that are relevant to their role and challenges.',
    winningMove: 'Make them look good to their boss. If you can connect what they\'re doing with business outcomes their leadership cares about, you own the renewal.',
  },
  SE: {
    mission: 'Establish technical credibility, understand their environment, drive a POC or technical evaluation.',
    emailApproach: 'Technically credible without being jargon-heavy. Reference a specific technical challenge that\'s real for their stack or architecture.',
    callApproach: 'Technical peer energy. Ask about their environment before pitching. They can smell a feature dump from a mile away.',
    linkedinApproach: 'Reference something technical — a paper they wrote, a stack they use, a challenge their company faces at their scale.',
    winningMove: 'Show you understand their technical constraints, not just your product\'s features.',
  },
};

const generatePlaybook = async (lead, profile) => {
  const role = profile.sender_role || 'AE';
  const strategy = roleStrategy[role] || roleStrategy.AE;

  let researchBrief = '';
  try {
    researchBrief = await withTimeout(researchLead(lead), 12000, 'research');
  } catch (err) {
    console.log('Research skipped:', err.message);
    researchBrief = `${lead.full_name || 'This person'} is a ${lead.title || 'professional'} at ${lead.company || 'their company'}.`;
  }

  const senderName = profile.sender_name || 'Your name';
  const tone = profile.tone === 'custom' && profile.custom_tone ? profile.custom_tone : (profile.tone || 'professional');

  const prompt = `You are writing a sales playbook for ${senderName}, a ${role} at ${profile.name}.

ABOUT ${profile.name.toUpperCase()}:
Product: ${profile.product}
What makes them different: ${profile.value_props}
Who they sell to: ${profile.icp}
Target titles: ${profile.target_titles || 'not specified'}
Communication tone: ${tone}
Objections they hear constantly: ${profile.objections}

ABOUT THE PROSPECT:
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

HARD RULES — THESE ARE NON-NEGOTIABLE:
1. BANNED OPENER: Never start any email with "I've been working with X companies/firms/clients who..." — this is the most overused AI sales opener. It will be rejected.
2. BANNED METRICS STYLE: Never stack multiple statistics. One concrete, believable number per email if needed. "15-20 hours saved" type language is weak — it's vague and everyone says it.
3. BANNED PHRASES: "touch base," "circle back," "synergies," "solution," "hope this finds you well," "I wanted to reach out," "just following up," "I know you're busy," "game-changing," "best-in-class"
4. BANNED APPROACH: Don't lead with your product. Lead with their situation.
5. EMAIL STRUCTURE RULES:
   - Email 1: Start with a specific observation about THEIR company or role. One question at the end. 4-6 sentences. Signed: ${senderName}
   - Email 2: Completely different angle. Could be a short story, a provocative insight, or a contrarian take. No pitch. End with curiosity or a question. Signed: ${senderName}
   - Email 3: Ultra short. Under 75 words. One thing you noticed or learned. One question. Nothing else. Signed: ${senderName}
   - Email 4: Honest 3-4 sentence breakup. Don't guilt-trip. Leave the door open genuinely. Under 55 words. Signed: ${senderName}
6. CALL OPENER: Must be sayable in under 18 seconds. No stats in the opener. Specific reason why you're calling them specifically.
7. VOICE: Write in a voice that sounds like ${tone}. This is ${senderName}'s personality coming through — not generic "sales rep" energy.
8. OBJECTIONS: Sound like a confident, smart person talking — not a script. Natural pushback, not rehearsed rebuttals.
9. CALLBACKS: These are actual things to SAY in a conversation — not bullet points summarizing the pitch. Specific hooks, questions, or angles that keep a conversation going.
10. Each section must be genuinely different from the others — don't just rephrase the same point.

Return ONLY valid JSON (no markdown, no backticks):
{
  "research": "The research brief reformatted as 3 clean readable paragraphs for the rep",
  "email1": "SUBJECT: [specific subject — not a question, not clever, just clear]\\n\\n[email body — starts with specific observation, ends with one question]\\n\\n${senderName}",
  "email2": "SUBJECT: [different approach subject]\\n\\n[email body — completely different angle, story or insight, no feature pitch]\\n\\n${senderName}",
  "email3": "SUBJECT: [short subject]\\n\\n[Under 75 words. One thing. One question.]\\n\\n${senderName}",
  "email4": "SUBJECT: [subject]\\n\\n[Under 55 words. Honest breakup. No guilt trip. Leave door open.]\\n\\n${senderName}",
  "linkedin": "CONNECTION REQUEST (under 300 chars, no pitch):\\n[specific reason to connect]\\n\\nFOLLOW-UP DM (after they accept):\\n[2-3 sentences, genuine question, no pitch]\\n\\nIF NO RESPONSE DM:\\n[final short message, adds value or asks a different question]",
  "call_opener": "OPENING (say this in under 18 seconds):\\n[Your name, company, one specific reason you're calling THEM — tied to something about their company or role]\\n[Natural permission ask or question]\\n\\nIF THEY HAVE 2 MINUTES — REAL DISCOVERY QUESTIONS:\\n1. [Open question about their current situation]\\n2. [Question that surfaces a real problem]\\n3. [Question about impact or cost of that problem]\\n\\nWHEN THEY BRUSH YOU OFF:\\n'Not interested' → [Natural 2-sentence response that earns 30 more seconds without being pushy]\\n'Send me an email' → [Response that validates but keeps the conversation]\\n'We already have something' → [Response that plants doubt without being combative]",
  "objection_handling": "OBJECTION: [exact words they'd use] | RESPONSE: [conversational, confident response that doesn't sound scripted]\\n\\n[Cover: ${profile.objections}\\nPlus 2-3 objections specific to this person's title/company/situation]\\n\\nNote: every response should sound like a smart colleague talking, not a trained closer.",
  "callbacks": "CONVERSATION HANDLES — specific things to say to keep a call alive:\\n\\n1. [Specific observation about their company/market that creates conversation]\\n2. [A question that makes them think — not a leading question, a genuine one]\\n3. [A provocation or contrarian view relevant to their industry]\\n4. [A 'have you tried...' or 'I've noticed companies like yours...' angle that's genuinely insightful]\\n5. [A reason to follow up — something that creates a natural next step]\\n6. [If they go quiet — a question that re-engages without being pushy]\\n7. [A story setup: 'One of your competitors did X and saw Y — curious if that resonates']\\n8. [A value-add: something you can offer even if they don't buy — a resource, insight, or intro]"
}`;

  const message = await withTimeout(
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
    45000,
    'playbook generation'
  );

  const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
  return JSON.parse(text);
};

const chatWithPlaybook = async (messages, lead, profile, playbook) => {
  const playbookContext = playbook ? `
FULL PLAYBOOK FOR THIS LEAD:

RESEARCH BRIEF:
${playbook.research || 'Not generated'}

EMAIL 1 (Day 1):
${playbook.email1 || 'Not generated'}

EMAIL 2 (Day 3):
${playbook.email2 || 'Not generated'}

EMAIL 3 (Day 7):
${playbook.email3 || 'Not generated'}

EMAIL 4 (Day 14):
${playbook.email4 || 'Not generated'}

LINKEDIN MESSAGES:
${playbook.linkedin || 'Not generated'}

CALL OPENER:
${playbook.call_opener || 'Not generated'}

OBJECTION HANDLING:
${playbook.objection_handling || 'Not generated'}

CALLBACKS:
${playbook.callbacks || 'Not generated'}` : 'No playbook generated yet for this lead.';

  const systemPrompt = `You are an expert sales coach helping ${profile.sender_name || 'a rep'} (${profile.sender_role || 'AE'}) at ${profile.name} with their outreach to ${lead.full_name || 'this prospect'} (${lead.title || 'unknown title'}) at ${lead.company || 'their company'}.

SELLER CONTEXT:
- Company: ${profile.name}
- Product: ${profile.product}
- Sender: ${profile.sender_name}, ${profile.sender_role || 'AE'}

PROSPECT:
- Name: ${lead.full_name}
- Title: ${lead.title}
- Company: ${lead.company}
- Email: ${lead.email || 'unknown'}

${playbookContext}

You have the FULL playbook above. When asked to rewrite something, rewrite it directly and completely — do not ask the rep to paste it in. Be direct, specific, and immediately useful. When rewriting emails, produce the complete ready-to-send version. When giving coaching advice, be honest — if something is weak, say so and show them better. You're a trusted advisor, not a cheerleader.`;

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
