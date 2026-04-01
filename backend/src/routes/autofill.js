const router = require('express').Router();
const auth = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    // Fetch the website content
    let pageContent = '';
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProspectForge/1.0)' },
        maxContentLength: 500000,
      });
      // Strip HTML tags and get text
      pageContent = response.data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);
    } catch (fetchErr) {
      pageContent = `Could not fetch page directly. Use your knowledge about ${url} to fill in the profile.`;
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are filling out a sales profile for a company based on their website content.

WEBSITE URL: ${url}

WEBSITE CONTENT:
${pageContent}

Based on the above, extract the following information and return it as a JSON object with exactly these keys:
{
  "name": "company name",
  "product": "one clear sentence describing what they sell",
  "value_props": "4-5 specific value propositions, one per line",
  "icp": "description of their ideal customer profile",
  "target_titles": "likely buyer titles, one per line"
}

Return ONLY the JSON object, no markdown fences, no explanation.`,
      }],
    });

    const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('Autofill error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
