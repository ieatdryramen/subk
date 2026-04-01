require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/playbooks', require('./routes/playbooks'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
console.log('Serving frontend from:', frontendDist);
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(200).send('API running. Path: ' + frontendDist);
  });
});

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => console.log(`ProspectForge running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
