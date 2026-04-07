require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();

// Stripe webhook needs raw body - must come BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

// Simple in-memory rate limiter for auth endpoints
const authAttempts = new Map();
const authRateLimit = (req, res, next) => {
  const key = req.ip + ':' + req.path;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 20;
  const attempts = authAttempts.get(key) || [];
  const recent = attempts.filter(t => now - t < windowMs);
  if (recent.length >= maxAttempts) {
    return res.status(429).json({ error: 'Too many attempts — try again in 15 minutes' });
  }
  recent.push(now);
  authAttempts.set(key, recent);
  next();
};
// Clean up old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of authAttempts) {
    const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
    if (recent.length === 0) authAttempts.delete(key);
    else authAttempts.set(key, recent);
  }
}, 30 * 60 * 1000);

app.use('/api/auth', authRateLimit, require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/playbooks', require('./routes/playbooks'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/zoho', require('./routes/zoho'));
app.use('/api/scoring', require('./routes/scoring'));
app.use('/api/export', require('./routes/export'));
app.use('/api/autofill', require('./routes/autofill'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/sequence', require('./routes/sequence'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/outlook', require('./routes/outlook'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/battlecard', require('./routes/battlecard'));
app.use('/api/slack', require('./routes/slack'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/cardscan', require('./routes/cardscan'));

// ── SubK Routes (teaming, marketplace, opportunities) ──
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/sub-profile', require('./routes/sub-profile'));
app.use('/api/subk-primes', require('./routes/subk-primes'));
app.use('/api/subk-dashboard', require('./routes/subk-dashboard'));
app.use('/api/autosearch', require('./routes/autosearch'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/public', require('./routes/public'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '3.0.0', app: 'SumX CRM' }));

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(200).send('API running. Path: ' + frontendDist);
  });
});

const PORT = process.env.PORT || 3001;

initDb().then(async () => {
  // Clean up any leads stuck in 'generating' state from previous crashes
  const { pool } = require('./db');
  try {
    const result = await pool.query(
      "UPDATE leads SET status='pending' WHERE status='generating'"
    );
    if (result.rowCount > 0) {
      console.log(`Reset ${result.rowCount} stuck generating leads`);
    }
  } catch(e) { console.error('Cleanup error:', e.message); }

  app.listen(PORT, () => console.log(`ProspectForge v2.4 running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

