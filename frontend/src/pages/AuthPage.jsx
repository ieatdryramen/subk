import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const s = {
  page: { minHeight: '100vh', display: 'flex', background: 'var(--bg)' },
  left: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem', background: '#0a0a0f', borderRight: '1px solid rgba(255,255,255,0.06)' },
  leftInner: { maxWidth: 420 },
  logoWrap: { marginBottom: '3rem' },
  logo: { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f0f0f5', marginBottom: 6 },
  tagline: { fontSize: 13, color: '#5a5a70' },
  feature: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1.25rem' },
  featureIcon: { fontSize: 18, marginTop: 1, flexShrink: 0 },
  featureText: { fontSize: 13, color: '#9090a8', lineHeight: 1.6 },
  featureTitle: { fontSize: 13, fontWeight: 500, color: '#c0c0d0', marginBottom: 2 },
  right: { width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' },
  card: { width: '100%', maxWidth: 400 },
  heading: { fontSize: 24, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 6 },
  sub: { fontSize: 14, color: 'var(--text2)', marginBottom: '2rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'var(--bg3)', padding: 4, borderRadius: 'var(--radius)' },
  tab: (active) => ({ flex: 1, padding: '8px', textAlign: 'center', borderRadius: 8, background: active ? 'var(--bg2)' : 'transparent', color: active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 500 : 400, cursor: 'pointer', border: active ? '1px solid var(--border)' : '1px solid transparent', fontSize: 13, transition: 'all 0.15s' }),
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  btn: { width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, marginTop: '0.5rem', fontSize: 14, border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' },
  err: { color: 'var(--danger)', fontSize: 13, marginTop: '0.75rem', padding: '10px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--danger)' },
  success: { color: 'var(--success)', fontSize: 13, marginTop: '0.75rem', padding: '10px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--success)' },
  inviteBanner: { background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--success)', marginBottom: '1.25rem' },
  divider: { textAlign: 'center', fontSize: 12, color: 'var(--text3)', margin: '1rem 0', position: 'relative' },
  switchMode: { textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: '1.25rem' },
  link: { color: 'var(--accent2)', cursor: 'pointer', fontWeight: 500 },
  note: { fontSize: 12, color: 'var(--text3)', marginTop: 6 },
};

const FEATURES = [
  { icon: '🔍', title: 'AI prospect research', text: 'Claude researches every lead before writing — company intel, role context, industry pressures.' },
  { icon: '✉️', title: '4-touch email cadence', text: 'Day 1, 3, 7, and 14 emails — each a completely different angle, personalized to the prospect.' },
  { icon: '📞', title: 'Call openers & objection handling', text: 'Exactly what to say in the first 20 seconds, plus 8 callbacks for every objection.' },
  { icon: '⚔️', title: 'Competitive battlecards', text: 'Likely incumbent, their weaknesses, landmine questions, and your winning positioning.' },
  { icon: '📊', title: 'ICP lead scoring', text: 'Score your entire list against your ICP so you work the highest-fit leads first.' },
];

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const [mode, setMode] = useState(inviteCode ? 'register' : 'login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', invite_code: inviteCode || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.password, form.full_name, form.invite_code);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap" rel="stylesheet" />

      {/* Left panel - features */}
      <div style={s.left}>
        <div style={s.leftInner}>
          <div style={s.logoWrap}>
            <div style={s.logo}>ProspectForge</div>
            <div style={s.tagline}>AI-powered sales cadence intelligence</div>
          </div>
          {FEATURES.map(f => (
            <div key={f.title} style={s.feature}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div>
                <div style={s.featureTitle}>{f.title}</div>
                <div style={s.featureText}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div style={s.right}>
        <div style={s.card}>
          <div style={s.heading}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>
          <div style={s.sub}>{mode === 'login' ? 'Sign in to your ProspectForge account' : '10 free playbooks — no credit card required'}</div>

          {inviteCode && (
            <div style={s.inviteBanner}>✓ You have been invited to join a team</div>
          )}

          <div style={s.tabs}>
            <div style={s.tab(mode === 'login')} onClick={() => { setMode('login'); setError(''); }}>Sign in</div>
            <div style={s.tab(mode === 'register')} onClick={() => { setMode('register'); setError(''); }}>Create account</div>
          </div>

          {mode === 'register' && (
            <div style={s.field}>
              <label style={s.label}>Full name</label>
              <input placeholder="Jack Beaver" value={form.full_name} onChange={set('full_name')}
                onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Work email</label>
            <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')}
              onKeyDown={e => e.key === 'Enter' && submit()} autoFocus={mode === 'login'} />
            {mode === 'register' && <div style={s.note}>Personal email addresses (Gmail, Yahoo, etc.) are not accepted</div>}
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {mode === 'register' && !inviteCode && (
            <div style={s.field}>
              <label style={s.label}>Invite code <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
              <input placeholder="Leave blank to create a new team" value={form.invite_code} onChange={set('invite_code')} />
            </div>
          )}

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>

          {error && <div style={s.err}>⚠ {error}</div>}

          <div style={s.switchMode}>
            {mode === 'login' ? (
              <>Don't have an account? <span style={s.link} onClick={() => { setMode('register'); setError(''); }}>Sign up free</span></>
            ) : (
              <>Already have an account? <span style={s.link} onClick={() => { setMode('login'); setError(''); }}>Sign in</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
