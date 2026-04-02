const router = require('express').Router();
const auth = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/scan', auth, async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: 'No image provided' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageData },
          },
          {
            type: 'text',
            text: `Extract all contact information from this business card and return it as a JSON object with these exact keys:
{
  "name": "full name",
  "title": "job title",
  "company": "company name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "linkedin url if present",
  "website": "company website if present",
  "notes": "any other relevant info on the card"
}

Return ONLY the JSON object. Use empty string "" for any fields not found on the card.`,
          }
        ],
      }],
    });

    const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('CardScan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
