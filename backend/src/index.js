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

app.use('/api/auth', require('./routes/auth'));
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.2.0' }));

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(200).send('API running. Path: ' + frontendDist);
  });
});

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => console.log(`ProspectForge v2.2 running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
