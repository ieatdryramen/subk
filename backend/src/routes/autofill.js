const router = require('express').Router();
const auth = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Visit this company website and extract information to fill a sales profile: ${url}

Return a JSON object with exactly these keys:
{
  "name": "company name",
  "product": "one clear sentence describing what they sell",
  "value_props": "4-5 specific value propositions, one per line",
  "icp": "description of their ideal customer based on the website",
  "target_titles": "likely buyer titles, one per line"
}

Return ONLY the JSON object, no markdown.`,
      }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
      .replace(/^```json|^```|```$/gm, '')
      .trim();

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('Autofill error:', err.message);
    res.status(500).json({ error: 'Could not read site: ' + err.message });
  }
});

module.exports = router;
