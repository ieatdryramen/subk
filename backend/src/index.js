require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDb } = require('./db');
const { authLimiter, apiLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrf');
const { auditMiddleware } = require('./middleware/audit');

const app = express();

// Trust first proxy (Railway) so req.ip reads X-Forwarded-For correctly
app.set('trust proxy', 1);

// ── Security Headers ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.anthropic.com", "https://sam.gov", "https://js.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin images
  permissionsPolicy: {
    features: {
      camera: [],           // Disable camera
      microphone: [],       // Disable microphone
      geolocation: [],      // Disable geolocation
      payment: ["'self'"],  // Allow Stripe payments
    },
  },
}));

// Stripe webhook needs raw body - must come BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ── CORS: fail closed ──
app.use(cors({
  origin: process.env.FRONTEND_URL || false,
  credentials: true,
}));

// ── Request Size Limits ──
// Routes that need larger payloads (PDF cap statements, base64 images)
app.use('/api/sub-profile', express.json({ limit: '10mb' }));
app.use('/api/cardscan', express.json({ limit: '10mb' }));
// Default: 1MB for everything else
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── CSRF Protection (state-changing requests) ──
app.use(csrfProtection);

// ── General API rate limit (100/min per user) ──
app.use('/api', apiLimiter);

// ── Routes ──
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/auth/2fa', authLimiter, require('./routes/twofa'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/lists', auditMiddleware('list'), require('./routes/lists'));
app.use('/api/playbooks', aiLimiter, require('./routes/playbooks'));
app.use('/api/chat', aiLimiter, require('./routes/chat'));
app.use('/api/zoho', require('./routes/zoho'));
app.use('/api/scoring', require('./routes/scoring'));
app.use('/api/export', require('./routes/export'));
app.use('/api/autofill', aiLimiter, require('./routes/autofill'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/sequence', require('./routes/sequence'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/outlook', require('./routes/outlook'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/notes', auditMiddleware('note'), require('./routes/notes'));
app.use('/api/battlecard', require('./routes/battlecard'));
app.use('/api/slack', require('./routes/slack'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/cardscan', aiLimiter, require('./routes/cardscan'));

// ── SubK Routes ──
app.use('/api/opportunities', aiLimiter, auditMiddleware('opportunity'), require('./routes/opportunities'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/sub-profile', require('./routes/sub-profile'));
app.use('/api/subk-primes', require('./routes/subk-primes'));
app.use('/api/subk-dashboard', require('./routes/subk-dashboard'));
app.use('/api/autosearch', require('./routes/autosearch'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/public', require('./routes/public'));
app.use('/api/seed', require('./routes/seed'));
app.use('/api/search', require('./routes/search'));
app.use('/api/proposals', auditMiddleware('proposal'), require('./routes/proposals'));
app.use('/api/competitive', auditMiddleware('competitive_intel'), require('./routes/competitive'));
app.use('/api/awards', require('./routes/awards'));
app.use('/api/spending', require('./routes/spending'));
app.use('/api/forecast', require('./routes/forecast'));
app.use('/api/capture', require('./routes/capture'));

// BATCH 2: Differentiators
app.use('/api/rate-benchmarks', require('./routes/rate-benchmarks'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/partner-match', require('./routes/partner-match'));
app.use('/api/narratives', aiLimiter, require('./routes/narratives'));
app.use('/api/foia', require('./routes/foia'));
app.use('/api/subcon-plan', aiLimiter, require('./routes/subcon-plan'));

// BATCH 3: Nice-to-Have Features
app.use('/api/events', require('./routes/events'));
app.use('/api/doc-collab', require('./routes/doc-collab'));
app.use('/api/market-research', aiLimiter, require('./routes/market-research'));
app.use('/api/contract-vehicles', require('./routes/contract-vehicles'));
app.use('/api/gov-contacts', require('./routes/gov-contacts'));
app.use('/api/bid-decision', require('./routes/bid-decision'));
app.use('/api/revenue-forecast', require('./routes/revenue-forecast'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '3.30.0', app: 'SumX CRM', uptime: process.uptime() }));

// ── Global Error Handler ──
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  console.error(`[ERROR] ${req.method} ${req.path} - ${status}: ${err.message}`);
  if (status === 500) console.error(err.stack);
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  setTimeout(() => process.exit(1), 1000);
});

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(200).send('API running. Path: ' + frontendDist);
  });
});

const PORT = process.env.PORT || 3001;

initDb().then(async () => {
  const { pool } = require('./db');
  try {
    const result = await pool.query("UPDATE leads SET status='pending' WHERE status='generating'");
    if (result.rowCount > 0) console.log(`Reset ${result.rowCount} stuck generating leads`);
  } catch(e) { console.error('Cleanup error:', e.message); }

  app.listen(PORT, () => {
    console.log(`SumX CRM v3.30.0 running on port ${PORT}`);
    console.log(`SAM_API_KEY: ${process.env.SAM_API_KEY ? 'configured (' + process.env.SAM_API_KEY.substring(0, 6) + '...)' : 'NOT SET — using mock data'}`);
    console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'NOT SET'}`);
    console.log(`STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'NOT SET'}`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
