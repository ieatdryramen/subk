const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const roleContext = {
  SDR: {
    goal: 'Book a discovery call or meeting. You are NOT trying to close — you are trying to earn 20 minutes.',
    focus: 'Pattern interrupt, create curiosity, low friction ask. Every touchpoint is about getting a reply, not explaining the product.',
    emailStyle: 'Ultra short. 3-5 sentences max per email. No features. No buzzwords. One question or one insight. Make it feel like a human typed it on their phone.',
    callStyle: 'Cold call opener designed to get past "I\'m busy." Permission-based, curiosity-driven. 30 seconds max before asking for time.',
    linkedinStyle: 'Connection request feels like a peer reaching out, not a sales pitch. DMs are conversational, not templated.',
  },
  AE: {
    goal: 'Advance the deal — get to a demo, a proposal conversation, or a business case discussion.',
    focus: 'Business outcomes, ROI, risk of inaction. Connect their company situation to the value you deliver.',
    emailStyle: 'Confident and peer-level. Reference their business specifically. Lead with an insight about their situation. 100-150 words.',
    callStyle: 'Executive-level opener. Quickly establish credibility. Discovery focused on business impact and decision process.',
    linkedinStyle: 'Thoughtful, business-focused. Reference something from their profile or company news.',
  },
  AM: {
    goal: 'Expand the relationship — identify upsell, cross-sell, or renewal opportunities.',
    focus: 'Relationship continuity, proven value, expansion. Low pressure, high trust.',
    emailStyle: 'Warm and consultative. Reference their industry or role context. Focus on growth.',
    callStyle: 'Check-in style opener. Lead with their success or industry context before transitioning to opportunity.',
    linkedinStyle: 'Relationship-building focused. Engage with their content. Feel like a trusted advisor.',
  },
  CSM: {
    goal: 'Drive adoption, retention, and customer health. Focus on onboarding success and long-term partnership.',
    focus: 'Outcomes achieved, risk mitigation, success planning. Time-to-value.',
    emailStyle: 'Helpful and outcome-oriented. Focus on what success looks like for their specific role.',
    callStyle: 'Success-focused opener. Lead with outcomes and what you help customers achieve.',
    linkedinStyle: 'Community and expertise focused. Position as a thought partner.',
  },
  SE: {
    goal: 'Establish technical credibility. Drive POC conversations, integration discussions, or technical discovery.',
    focus: 'Technical pain points, integration complexity, security, scalability.',
    emailStyle: 'Technically credible but not overwhelming. Reference a specific technical challenge relevant to their stack.',
    callStyle: 'Technical peer opener. Establish you understand their environment before pitching.',
    linkedinStyle: 'Technical and substantive. Reference their tech stack or a technical challenge in their space.',
  },
};

const researchLead = async (lead) => {
  const searchPrompt = `You are a B2B sales intelligence researcher. Research this prospect and their company and provide actionable intel for a sales rep about to reach out.

PROSPECT:
- Name: ${lead.full_name}
- Company: ${lead.company}
- Title: ${lead.title}
- Notes: ${lead.notes || 'none'}

Provide a research brief covering:
1. What this company does, their size/stage, and their likely business priorities right now
2. What someone in this person's role (${lead.title}) typically cares about and is measured on
3. Likely operational challenges or technology gaps relevant to their industry
4. Recent trends or pressures in their space that would make them open to a conversation
5. What a cold outreach should reference or avoid

Be specific and actionable. No fluff.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: searchPrompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });
    return message.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  } catch (err) {
    console.log('Web research failed, using base knowledge:', err.message);
    const fallback = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: searchPrompt }],
    });
    return fallback.content[0].text.trim();
  }
};

const generatePlaybook = async (lead, profile) => {
  const role = profile.sender_role || 'AE';
  const ctx = roleContext[role] || roleContext.AE;

  const researchBrief = await researchLead(lead);

  const prompt = `You are an elite B2B sales strategist writing for a ${role} at ${profile.name}.

SELLER CONTEXT:
- Company: ${profile.name}
- Product: ${profile.product}
- Value props: ${profile.value_props}
- ICP: ${profile.icp}
- Tone: ${profile.tone}
- Sender: ${profile.sender_name}, ${role}
- Objections: ${profile.objections}

YOUR ROLE AS ${role}:
- Goal: ${ctx.goal}
- Focus: ${ctx.focus}
- Email style: ${ctx.emailStyle}
- Call style: ${ctx.callStyle}

PROSPECT:
- Name: ${lead.full_name}
- Company: ${lead.company}
- Title: ${lead.title}
- Email: ${lead.email}
- LinkedIn: ${lead.linkedin || 'Not provided'}
- Notes: ${lead.notes || 'None'}

RESEARCH ON THIS PROSPECT:
${researchBrief}

CRITICAL RULES:
- NEVER mention specific competitor or legacy software products by name. Use "your current solution", "existing tools", or "legacy systems".
- Every email must sound like a real human wrote it. No "I hope this finds you well." No "I wanted to reach out." No buzzwords.
- Each of the 4 emails takes a completely different angle. They are not variations of the same message.
- Everything must be grounded in the research above. Generic = failure.

Generate a JSON object with exactly these keys:

{
  "research": "3 paragraphs: (1) Company situation and what matters to them right now based on research. (2) What this specific person in their role cares about, is measured on, and worries about. (3) Your angle — what to lead with, what to avoid, and why they should care about ${profile.name} specifically.",

  "email1": "SUBJECT: [subject]\\n\\nDay 1 cold email. ${ctx.emailStyle} Do NOT start with your name or company. Start with something about THEM from the research. One soft CTA. Sign: ${profile.sender_name}",

  "email2": "SUBJECT: [subject]\\n\\nDay 3. Completely different angle. Lead with a specific insight or industry observation. Connect to ${profile.name} without being salesy. Different CTA. Sign: ${profile.sender_name}",

  "email3": "SUBJECT: [subject]\\n\\nDay 7. Share something genuinely useful — a perspective, a question they should be asking, or a framework. Soft ask. Under 120 words. Sign: ${profile.sender_name}",

  "email4": "SUBJECT: [subject]\\n\\nDay 14 breakup. Short, human, zero pressure. Make THEM feel like they are closing the door. Under 80 words. Sign: ${profile.sender_name}",

  "linkedin": "CONNECTION REQUEST (under 300 chars, peer-to-peer, no pitch):\\n[message]\\n\\nFOLLOW-UP DM 1 (day after connecting):\\n[message]\\n\\nFOLLOW-UP DM 2 (4 days later, provide value):\\n[message]",

  "call_opener": "OPENING (first 20 seconds):\\n[script — ${ctx.callStyle}]\\n\\nIF THEY HAVE 2 MINUTES:\\n[30-second pitch specific to their role and company]\\n\\nDISCOVERY QUESTIONS:\\n1. [business situation question]\\n2. [current state and pain question]\\n3. [impact or priority question]\\n4. [qualify or advance question]\\n\\nBRUSH-OFFS AND RESPONSES:\\n[3 common brush-offs a ${role} gets and natural confident responses]",

  "objection_handling": "Handle each objection the way a confident ${role} would — natural, not scripted:\\n\\n${profile.objections}\\n\\nPLUS 3 objections specific to this prospect's company, industry, or title.\\n\\nFormat: OBJECTION: [their exact words] | RESPONSE: [natural confident rebound]",

  "callbacks": "8 specific callbacks grounded in the research — things to weave into any touchpoint to show you did your homework:\\n\\n1. [specific to their company situation]\\n2. [specific to their role and what they are measured on]\\n3. [industry trend or pressure they are feeling]\\n4. [connects their situation to your value prop]\\n5. [a question that makes them think]\\n6. [risk or cost of inaction specific to their situation]\\n7. [success story angle relevant to their profile]\\n8. [something to reference if conversation goes cold]"
}

Return ONLY the JSON. No markdown, no preamble.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
  return JSON.parse(text);
};

const chatWithPlaybook = async (messages, lead, profile, playbook) => {
  const systemPrompt = `You are a sales coach helping ${profile.sender_name}, a ${profile.sender_role || 'AE'} at ${profile.name}, refine their outreach to ${lead.full_name} at ${lead.company}.

You can rewrite any section of the playbook, suggest new angles, answer questions about the prospect or strategy, or help prep for a specific scenario. Be direct, specific, and actionable. No fluff.

Current playbook context is available if needed.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages,
  });

  return response.content[0].text;
};

module.exports = { generatePlaybook, chatWithPlaybook };
