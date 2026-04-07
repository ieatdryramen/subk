import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  statusCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  planBadge: (plan) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 8, background: plan === 'pro' ? 'var(--accent-bg)' : plan === 'team' ? 'var(--success-bg)' : plan === 'starter' ? 'var(--warning-bg)' : 'var(--bg3)', color: plan === 'pro' ? 'var(--accent2)' : plan === 'team' ? 'var(--success)' : plan === 'starter' ? 'var(--warning)' : 'var(--text3)', border: `1px solid ${plan === 'pro' ? 'var(--accent)' : plan === 'team' ? 'var(--success)' : plan === 'starter' ? 'var(--warning)' : 'var(--border)'}` }),
  planName: { fontSize: 18, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 4 },
  planMeta: { fontSize: 13, color: 'var(--text2)', marginBottom: 12 },
  barBg: { height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill: (pct) => ({ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }),
  barLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: '2rem' },
  planCard: (featured, current) => ({ background: current ? 'rgba(30,111,255,0.05)' : 'var(--bg2)', border: current ? '2px solid var(--accent)' : featured ? '1px solid rgba(30,111,255,0.3)' : '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', position: 'relative' }),
  planCardBadge: { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' },
  planTitle: { fontSize: 17, fontWeight: 600, marginBottom: 6 },
  price: { fontSize: 34, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 },
  pricePer: { fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' },
  feature: { fontSize: 13, color: 'var(--text2)', marginBottom: 7, paddingLeft: 18, position: 'relative' },
  featureDot: { position: 'absolute', left: 0, color: 'var(--accent2)', fontWeight: 700 },
  btn: (featured, current) => ({ width: '100%', padding: '11px', marginTop: '1.5rem', background: current ? 'var(--bg3)' : featured ? 'var(--accent)' : 'transparent', border: current ? '1px solid var(--border)' : featured ? 'none' : '1px solid var(--border)', color: current ? 'var(--text3)' : featured ? '#fff' : 'var(--text)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: current ? 'default' : 'pointer' }),
  faqCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' },
  faqItem: { marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' },
  faqQ: { fontSize: 14, fontWeight: 500, marginBottom: 6 },
  faqA: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 },
};

const PLANS = [
  { key: 'starter', name: 'Starter', price: '$99', playbooks: 'Opportunity search + scoring', users: '1 user', featured: false },
  { key: 'team', name: 'Professional', price: '$249', playbooks: 'Unlimited AI proposals', users: '5 users', featured: true },
  { key: 'pro', name: 'Team', price: '$449', playbooks: 'Multi-user collaboration', users: 'Unlimited users', featured: false },
];

const FEATURES = ['Teaming marketplace', 'BD outreach sequences', 'Zoho CRM sync', 'AI GovCon coach', 'Compliance checker', 'Prime tracker'];

export default function BillingPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    api.get('/billing/status').then(r => {
      setStatus(r.data);
    }).catch(console.error);

    // Check if Stripe is configured
    api.get('/billing/plans').then(r => {
      setStripeReady(true);
    }).catch(() => setStripeReady(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      window.history.replaceState({}, '', '/billing');
      setTimeout(() => api.get('/billing/status').then(r => setStatus(r.data)), 2000);
    }
  }, []);

  const upgrade = async (planKey) => {
    if (!stripeReady) {
      alert('Stripe is not configured yet. Add STRIPE_SECRET_KEY and price IDs to Railway environment variables.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/billing/checkout', { plan: planKey });
      if (r.data?.url) {
        window.location.href = r.data.url;
      } else {
        alert('Checkout URL not received — try again');
        setLoading(false);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start checkout. Make sure Stripe env vars are set.');
      setLoading(false);
    }
  };

  const pct = status ? Math.round((status.playbooks_used / status.playbooks_limit) * 100) : 0;
  const remaining = status ? status.playbooks_limit - status.playbooks_used : 0;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Billing & Plan</div>
        <div style={s.sub}>Manage your subscription and track usage</div>

        {status && (
          <div style={s.statusCard}>
            <div style={s.planBadge(status.plan)}>
              {status.plan === 'trial' ? 'Free Trial' : status.plan.charAt(0).toUpperCase() + status.plan.slice(1)}
            </div>
            {status.whitelisted ? (
              <div style={{ fontSize: 13, color: 'var(--success)' }}>✓ Unlimited access — internal account</div>
            ) : (
              <>
                <div style={s.planMeta}>
                  {status.plan === 'trial'
                    ? `${remaining} of 10 free playbooks remaining`
                    : `${status.playbooks_used} of ${status.playbooks_limit} playbooks used this month`}
                </div>
                <div style={s.barLabel}>
                  <span>Usage</span>
                  <span>{status.playbooks_used} / {status.playbooks_limit}</span>
                </div>
                <div style={s.barBg}><div style={s.barFill(pct)} /></div>
                {pct >= 80 && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>
                    ⚠ Running low — upgrade to avoid interruption
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {status?.plan === 'trial' && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: 13, color: 'var(--warning)' }}>
            ⚠ Free trial: {10 - (status.playbooks_used || 0)} playbooks remaining. Upgrade to keep generating.
          </div>
        )}

        <div className="pf-billing-grid" style={s.grid}>
          {PLANS.map(plan => {
            const isCurrent = status?.plan === plan.key || (status?.whitelisted && plan.key === 'pro');
            return (
              <div key={plan.key} style={s.planCard(plan.featured, isCurrent)}>
                {plan.featured && !isCurrent && <div style={s.planCardBadge}>Most popular</div>}
                {isCurrent && <div style={{ ...s.planCardBadge, background: 'var(--success)' }}>Current plan</div>}
                <div style={s.planTitle}>{plan.name}</div>
                <div style={s.price}>{plan.price}</div>
                <div style={s.pricePer}>per month, billed monthly</div>
                <div style={s.feature}><span style={s.featureDot}>✓</span> {plan.playbooks}</div>
                <div style={s.feature}><span style={s.featureDot}>✓</span> {plan.users}</div>
                {FEATURES.map(f => (
                  <div key={f} style={s.feature}><span style={s.featureDot}>✓</span> {f}</div>
                ))}
                <button style={s.btn(plan.featured, isCurrent)} onClick={() => !isCurrent && upgrade(plan.key)} disabled={loading || isCurrent}>
                  {isCurrent ? 'Current plan' : loading ? 'Loading...' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div style={s.faqCard}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1.25rem' }}>Frequently asked questions</div>
          {[
            { q: 'What counts toward my usage?', a: 'AI-generated proposals, opportunity scoring, BD outreach sequences, and prime research each count as one credit. Searching and browsing opportunities is unlimited on all plans.' },
            { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing cycle.' },
            { q: 'What happens when I hit my limit?', a: "You'll see an upgrade prompt and AI generation will be paused. Your existing data, proposals, and pipeline are always accessible." },
            { q: 'Do team members share the limit?', a: 'Yes — your plan limit is shared across your whole team. The Professional plan is designed for teams of up to 5.' },
          ].map(faq => (
            <div key={faq.q} style={s.faqItem}>
              <div style={s.faqQ}>{faq.q}</div>
              <div style={s.faqA}>{faq.a}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
