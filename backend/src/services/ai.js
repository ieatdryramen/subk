const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const roleContext = {
  SDR: {
    goal: 'Book a discovery call. Earn 20 minutes.',
    focus: 'Pattern interrupt, curiosity, one low-friction ask.',
    emailStyle: '3-5 sentences max. No features. One question. Feels like a human on their phone.',
    callStyle: 'Permission-based, curiosity-driven. 30 seconds before asking for time.',
    linkedinStyle: 'Peer outreach, not a pitch. Conversational DMs.',
  },
  AE: {
    goal: 'Get to a demo or business case conversation.',
    focus: 'Business outcomes, ROI, risk of inaction.',
    emailStyle: 'Peer-level, insight-led, 80-120 words. Reference their business specifically.',
    callStyle: 'Executive opener. Credibility fast. Discovery on business impact.',
    linkedinStyle: 'Thoughtful, business-focused. Reference their profile or company news.',
  },
  AM: {
    goal: 'Expand the relationship. Upsell or renewal.',
    focus: 'Proven value, expansion, low pressure high trust.',
    emailStyle: 'Warm, consultative. Growth-focused.',
    callStyle: 'Check-in style. Lead with their success before transitioning.',
    linkedinStyle: 'Trusted advisor tone. Engage with their content.',
  },
  CSM: {
    goal: 'Drive adoption, retention, long-term partnership.',
    focus: 'Outcomes, risk mitigation, time-to-value.',
    emailStyle: 'Helpful, outcome-oriented. What success looks like for their role.',
    callStyle: 'Lead with outcomes and what you help customers achieve.',
    linkedinStyle: 'Thought partner, not vendor.',
  },
  SE: {
    goal: 'Technical credibility. Drive POC or integration discussion.',
    focus: 'Technical pain, integration complexity, security, scalability.',
    emailStyle: 'Technically credible. Reference a specific challenge for their stack.',
    callStyle: 'Technical peer. Understand their environment before pitching.',
    linkedinStyle: 'Reference their tech stack or a technical challenge in their space.',
  },
};

const withTimeout = (promise, ms, label) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${label} took over ${ms/1000}s`)), ms)
  );
  return Promise.race([promise, timeout]);
};

const researchLead = async (lead) => {
  const prompt = `You are a B2B sales researcher. In 3 concise paragraphs, provide intel on this prospect for a sales rep about to reach out.

Prospect: ${lead.full_name || 'Unknown'}, ${lead.title || 'Unknown'} at ${lead.company || 'Unknown'}

Paragraph 1: What this company does, their size/stage, and what likely matters to them right now.
Paragraph 2: What someone in this exact role cares about, is measured on, and worries about.
Paragraph 3: The best angle of attack — what to lead with, what to avoid, why they'd care.

Be specific. No fluff. Max 200 words total.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
};

const generatePlaybook = async (lead, profile) => {
  const role = profile.sender_role || 'AE';
  const ctx = roleContext[role] || roleContext.AE;

  // Research with timeout - use fast Haiku model, 10s timeout
  let researchBrief = '';
  try {
    researchBrief = await withTimeout(researchLead(lead), 10000, 'research');
  } catch (err) {
    console.log('Research skipped:', err.message);
    researchBrief = `${lead.full_name || 'This person'} is a ${lead.title || 'professional'} at ${lead.company || 'their company'}. Use your general knowledge about their role and industry.`;
  }

  const prompt = `You are writing a B2B sales playbook for ${profile.sender_name || 'a rep'} (${role}) at ${profile.name}.

SELLER:
- Product: ${profile.product}
- Value props: ${profile.value_props}
- ICP: ${profile.icp}
- Tone: ${profile.tone}
- Known objections: ${profile.objections}

PROSPECT:
- Name: ${lead.full_name || 'this person'}
- Company: ${lead.company}
- Title: ${lead.title}
- Notes: ${lead.notes || 'none'}

INTEL:
${researchBrief}

ROLE CONTEXT (${role}):
Goal: ${ctx.goal}
Focus: ${ctx.focus}
Email approach: ${ctx.emailStyle}
Call approach: ${ctx.callStyle}

WRITING RULES — READ CAREFULLY:
1. NEVER open with "I've been working with X firms/companies/clients who..." — this is the most overused AI sales email opener and immediately signals automation. Find a different way in.
2. NEVER stack multiple statistics in one email. One specific, believable number is more powerful than four vague percentages.
3. NEVER use "hours saved," "time savings," or "efficiency gains" as the lead value prop — these feel generic. Lead with business outcomes: revenue, risk, competitive position, or a problem they haven't solved.
4. Each email must take a STRUCTURALLY different approach:
   - Email 1: Lead with a specific observation about THEIR company or situation. Ask one question.
   - Email 2: Share a short story or insight from a similar company. No pitch. End with curiosity.
   - Email 3: Ultra short. One sentence observation, one question. Under 75 words total.
   - Email 4: Honest breakup. Acknowledge the silence. Leave the door open. Under 50 words.
5. Call opener must be under 20 seconds to say out loud. No statistics in the opener.
6. Sound like a smart human who did research — not a bot that scraped data.
7. Never say "I hope this finds you well," "touch base," "circle back," "synergy," or "solution."
8. No competitor names. Say "your current approach" or "how you do this today."
9. Sign every email with just the sender's first name on its own line.
10. Objection responses should feel conversational, not scripted.

Return ONLY a JSON object:
{
  "research": "The intel brief above, formatted as 3 clean paragraphs",
  "email1": "SUBJECT: [subject line — specific, not clever]\\n\\n[Email body. 4-6 sentences max. One question at the end.]\\n\\n${profile.sender_name || 'Your name'}",
  "email2": "SUBJECT: [different subject — could be a story angle]\\n\\n[Email body. Different structure than email 1. Story or insight, not pitch.]\\n\\n${profile.sender_name || 'Your name'}",
  "email3": "SUBJECT: [short subject]\\n\\n[Under 75 words. One observation. One question. Nothing else.]\\n\\n${profile.sender_name || 'Your name'}",
  "email4": "SUBJECT: [subject]\\n\\n[Under 50 words. Honest, human breakup. No guilt trip.]\\n\\n${profile.sender_name || 'Your name'}",
  "linkedin": "CONNECTION REQUEST:\\n[under 300 chars, peer tone]\\n\\nDM 1 (after connecting):\\n[conversational]\\n\\nDM 2 (4 days later):\\n[value-add]",
  "call_opener": "OPENING (20 sec):\\n[${ctx.callStyle}]\\n\\nIF THEY HAVE 2 MIN:\\n[tight pitch]\\n\\nDISCOVERY QUESTIONS:\\n1. [situation]\\n2. [pain]\\n3. [impact]\\n4. [qualify]\\n\\nBRUSH-OFF RESPONSES:\\n[3 common ones with natural responses]",
  "objection_handling": "OBJECTION: [their words] | RESPONSE: [natural confident rebound]\\n\\n[Cover each of: ${profile.objections}\\nPlus 2 specific to this prospect]",
  "callbacks": "1. [company-specific talking point]\\n2. [role-specific pain]\\n3. [industry trend]\\n4. [value prop connection]\\n5. [provocative question]\\n6. [cost of inaction]\\n7. [success story angle]\\n8. [conversation recovery]"
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

You have the FULL playbook above. When asked to rewrite something, rewrite it directly — do not ask the rep to paste it in, you already have it. Be direct, specific, and immediately useful. When rewriting emails, produce the complete rewritten version ready to copy and send.`;

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
