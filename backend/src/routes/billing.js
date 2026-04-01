const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PLANS = {
  starter: { name: 'Starter', price: 4900, priceId: process.env.STRIPE_STARTER_PRICE_ID, playbooks: 100, users: 1 },
  team:    { name: 'Team',    price: 14900, priceId: process.env.STRIPE_TEAM_PRICE_ID,    playbooks: 500, users: 5 },
  pro:     { name: 'Pro',     price: 29900, priceId: process.env.STRIPE_PRO_PRICE_ID,     playbooks: 999999, users: 999 },
};

// Get current billing status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    if (!u.org_id) return res.json({ plan: 'trial', playbooks_used: 0, playbooks_limit: 10 });

    const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [u.org_id]);
    const o = org.rows[0];
    res.json({
      plan: o.plan || 'trial',
      playbooks_used: o.playbooks_used || 0,
      playbooks_limit: o.playbooks_limit || 10,
      trial_ends_at: o.trial_ends_at,
      stripe_subscription_id: o.stripe_subscription_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Stripe checkout session
router.post('/checkout', auth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const { plan } = req.body;
  const planData = PLANS[plan];
  if (!planData) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planData.priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'https://prospectforge-production-1f99.up.railway.app'}/billing?success=true`,
      cancel_url: `${process.env.APP_URL || 'https://prospectforge-production-1f99.up.railway.app'}/billing`,
      customer_email: u.email,
      metadata: { userId: req.userId, orgId: u.org_id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.json({ received: true });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orgId, plan } = session.metadata;
    const planData = PLANS[plan];
    if (orgId && planData) {
      await pool.query(
        `UPDATE organizations SET plan=$1, stripe_customer_id=$2, stripe_subscription_id=$3, playbooks_limit=$4 WHERE id=$5`,
        [plan, session.customer, session.subscription, planData.playbooks, orgId]
      );
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await pool.query(
      'UPDATE organizations SET plan=$1, playbooks_limit=$2 WHERE stripe_subscription_id=$3',
      ['trial', 10, sub.id]
    );
  }

  res.json({ received: true });
});

// Check and increment usage
router.post('/use-playbook', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    if (!u.org_id) return res.status(403).json({ error: 'No organization', upgrade: true });

    const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [u.org_id]);
    const o = org.rows[0];
    const used = o.playbooks_used || 0;
    const limit = o.playbooks_limit || 10;

    if (used >= limit) {
      return res.status(403).json({ 
        error: `Playbook limit reached (${used}/${limit})`, 
        upgrade: true,
        plan: o.plan 
      });
    }

    await pool.query('UPDATE organizations SET playbooks_used = playbooks_used + 1 WHERE id=$1', [u.org_id]);
    res.json({ allowed: true, used: used + 1, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PLANS_PUBLIC = Object.entries(PLANS).map(([key, val]) => ({ key, ...val }));
router.get('/plans', (req, res) => res.json(PLANS_PUBLIC));

module.exports = router;
