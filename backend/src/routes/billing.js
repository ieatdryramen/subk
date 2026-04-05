const router = require('express').Router();
const express = require('express');
const auth = require('../middleware/auth');
const { pool } = require('../db');

let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch(e) {
  console.log('Stripe not available:', e.message);
}

const PLANS = {
  starter: { name: 'Starter', price: 4900, playbooks: 100, users: 1 },
  team:    { name: 'Team',    price: 14900, playbooks: 500, users: 5 },
  pro:     { name: 'Pro',     price: 29900, playbooks: 999999, users: 999 },
};

const WHITELISTED_DOMAINS = ['sumxai.com', 'sumx.ai'];

router.get('/status', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    const emailDomain = u.email?.split('@')[1]?.toLowerCase();
    
    // Whitelisted orgs get unlimited pro
    if (WHITELISTED_DOMAINS.includes(emailDomain)) {
      return res.json({ plan: 'pro', playbooks_used: 0, playbooks_limit: 999999, whitelisted: true });
    }

    if (!u.org_id) return res.json({ plan: 'trial', playbooks_used: 0, playbooks_limit: 10 });
    const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [u.org_id]);
    const o = org.rows[0] || {};
    res.json({
      plan: o.plan || 'trial',
      playbooks_used: o.playbooks_used || 0,
      playbooks_limit: o.playbooks_limit || 10,
      trial_ends_at: o.trial_ends_at,
      stripe_subscription_id: o.stripe_subscription_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/checkout', auth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' });
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  const priceIds = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    team: process.env.STRIPE_TEAM_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
  };

  if (!priceIds[plan]) return res.status(400).json({ error: 'Stripe price ID not configured for this plan' });

  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    const appUrl = process.env.APP_URL || 'https://prospectforge-production-1f99.up.railway.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceIds[plan], quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`,
      customer_email: u.email,
      metadata: { userId: String(req.userId), orgId: String(u.org_id || ''), plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.json({ received: true });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { orgId, plan } = session.metadata;
      const planData = PLANS[plan];
      if (orgId && planData) {
        await pool.query(
          'UPDATE organizations SET plan=$1, stripe_customer_id=$2, stripe_subscription_id=$3, playbooks_limit=$4 WHERE id=$5',
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
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  res.json({ received: true });
});

router.get('/plans', (req, res) => {
  res.json(Object.entries(PLANS).map(([key, val]) => ({ key, ...val })));
});

module.exports = router;
