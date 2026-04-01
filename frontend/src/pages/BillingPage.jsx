import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  statusCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 18, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 4 },
  planMeta: { fontSize: 13, color: 'var(--text2)' },
  usageBar: { marginTop: 12 },
  usageLabel: { fontSize: 12, color: 'var(--text2)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' },
  barBg: { height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' },
  barFill: (pct) => ({ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  planCard: (featured) => ({ background: 'var(--bg2)', border: featured ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', position: 'relative' }),
  planBadge: { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' },
  planTitle: { fontSize: 17, fontWeight: 600, marginBottom: 4 },
  price: { fontSize: 32, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 },
  pricePer: { fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' },
  feature: { fontSize: 13, color: 'var(--text2)', marginBottom: 6, paddingLeft: 16, position: 'relative' },
  featureDot: { position: 'absolute', left: 0, color: 'var(--accent2)' },
  btn: (featured) => ({ width: '100%', padding: '10px', marginTop: '1.25rem', background: featured ? 'var(--accent)' : 'transparent', border: featured ? 'none' : '1px solid var(--border)', color: featured ? '#fff' : 'var(--text2)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }),
};

const PLANS = [
  { key: 'starter', name: 'Starter', price: '$49', playbooks: '100 playbooks/mo', users: '1 user', featured: false },
  { key: 'team', name: 'Team', price: '$149', playbooks: '500 playbooks/mo', users: '5 users', featured: true },
  { key: 'pro', name: 'Pro', price: '$299', playbooks: 'Unlimited', users: 'Unlimited users', featured: false },
];

export default function BillingPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/billing/status').then(r => setStatus(r.data)).catch(console.error);
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      window.history.replaceState({}, '', '/billing');
      setTimeout(() => api.get('/billing/status').then(r => setStatus(r.data)), 2000);
    }
  }, []);

  const upgrade = async (planKey) => {
    setLoading(true);
    try {
      const r = await api.post('/billing/checkout', { plan: planKey });
      window.location.href = r.data.url;
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start checkout');
      setLoading(false);
    }
  };

  const pct = status ? Math.round((status.playbooks_used / status.playbooks_limit) * 100) : 0;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Billing & Plan</div>
        <div style={s.sub}>Manage your subscription and usage</div>

        {status && (
          <div style={s.statusCard}>
            <div style={{ flex: 1 }}>
              <div style={s.planName}>
                {status.plan === 'trial' ? 'Free Trial' : status.plan.charAt(0).toUpperCase() + status.plan.slice(1) + ' Plan'}
              </div>
              <div style={s.planMeta}>
                {status.plan === 'trial' ? `${10 - status.playbooks_used} free playbooks remaining` : `${status.playbooks_used} of ${status.playbooks_limit} playbooks used this month`}
              </div>
              <div style={s.usageBar}>
                <div style={s.usageLabel}>
                  <span>Playbook usage</span>
                  <span>{status.playbooks_used} / {status.playbooks_limit}</span>
                </div>
                <div style={s.barBg}><div style={s.barFill(pct)} /></div>
              </div>
            </div>
          </div>
        )}

        {status?.plan === 'trial' && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: 13, color: 'var(--warning)' }}>
            ⚠ You're on the free trial ({status.playbooks_used}/10 playbooks used). Upgrade to keep generating playbooks.
          </div>
        )}

        <div style={s.grid}>
          {PLANS.map(plan => (
            <div key={plan.key} style={s.planCard(plan.featured)}>
              {plan.featured && <div style={s.planBadge}>Most popular</div>}
              <div style={s.planTitle}>{plan.name}</div>
              <div style={s.price}>{plan.price}</div>
              <div style={s.pricePer}>per month</div>
              {[plan.playbooks, plan.users, 'PDF exports', 'Zoho CRM sync', 'AI sales coach'].map(f => (
                <div key={f} style={s.feature}><span style={s.featureDot}>✓</span> {f}</div>
              ))}
              <button style={s.btn(plan.featured)} onClick={() => upgrade(plan.key)} disabled={loading || status?.plan === plan.key}>
                {status?.plan === plan.key ? 'Current plan' : loading ? 'Loading...' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
