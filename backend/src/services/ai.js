const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generatePlaybook = async (lead, profile) => {
  const prompt = `You are an expert B2B sales strategist. Using the company profile and lead info below, create a fully personalized sales playbook.

SELLER PROFILE:
- Company: ${profile.name}
- Product: ${profile.product}
- Value props: ${profile.value_props}
- ICP: ${profile.icp}
- Target titles: ${profile.target_titles}
- Tone: ${profile.tone}
- Common objections: ${profile.objections}
- Sender name/role: ${profile.sender_name}

PROSPECT:
- Name: ${lead.full_name}
- Company: ${lead.company}
- Title: ${lead.title}
- Email: ${lead.email}
- LinkedIn: ${lead.linkedin || 'Not provided'}
- Notes: ${lead.notes || 'None'}

Generate a complete, highly personalized sales playbook as a JSON object with exactly these keys:

{
  "research": "2-3 paragraph research brief on this company and person. Their likely pain points, company stage, what matters to them at their level. Be specific and strategic — this is the intel brief before every touchpoint.",
  "email1": "Subject line on first line, blank line, then full email body. Day 1 cold outreach. Under 150 words. Reference something specific about their company or role. End with a single, low-friction CTA.",
  "email2": "Subject line on first line, blank line, then full email body. Day 3 follow-up. Completely different angle than email 1. Lead with value or a relevant insight. Under 120 words.",
  "email3": "Subject line on first line, blank line, then full email body. Day 7 breakup email. Short, human, low pressure. Leave the door open.",
  "linkedin": "CONNECTION REQUEST (under 300 chars):\\n[message]\\n\\nFOLLOW-UP DM 1 (after connecting):\\n[message]\\n\\nFOLLOW-UP DM 2 (3 days later):\\n[message]",
  "call_opener": "OPENING (first 30 seconds):\\n[exactly what to say — natural, not robotic]\\n\\nDISCOVERY QUESTIONS:\\n1. [question]\\n2. [question]\\n3. [question]\\n\\nIF THEY SAY THEY HAVE 2 MINUTES:\\n[tight pitch]",
  "objection_handling": "For each objection below plus 2 likely ones specific to this prospect, give a natural rebound:\\n\\n${profile.objections}\\n\\n[Format each as: OBJECTION: ... | REBOUND: ...]",
  "callbacks": "7 specific conversation callbacks and talking points tailored to this exact prospect — things to reference, connect back to, or bring up naturally across any touchpoint. Be specific to their company, title, and likely situation.\\n\\n1. ...\\n2. ...\\n3. ...\\n4. ...\\n5. ...\\n6. ...\\n7. ..."
}

Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
  return JSON.parse(text);
};

module.exports = { generatePlaybook };
