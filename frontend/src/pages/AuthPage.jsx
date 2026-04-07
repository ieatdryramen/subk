import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const s = {
  page: { minHeight: '100vh', background: '#F4F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  card: { width: '100%', maxWidth: 420, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '2.5rem', boxShadow: '0 24px 48px rgba(0,0,0,0.08)' },
  logo: { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#1A202C', marginBottom: 8 },
  tagline: { fontSize: 13, color: '#6060788', marginBottom: '2rem' },
  heading: { fontSize: 22, fontWeight: 600, fontFamily: 'Syne, sans-serif', marginBottom: 6, color: '#1A202C' },
  sub: { fontSize: 13, color: '#6B7280', marginBottom: '1.75rem' },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', background: '#F4F7FA', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#1A202C', fontSize: 14, outline: 'none' },
  btn: { width: '100%', padding: '11px', background: '#08A5BF', border: 'none', color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 6 },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171', marginBottom: 14 },
  success: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#4ade80', marginBottom: 14 },
  switch: { textAlign: 'center', marginTop: '1.5rem', fontSize: 13, color: '#6B7280' },
  switchLink: { color: '#0CC0DB', cursor: 'pointer', fontWeight: 500 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '1.25rem 0', color: '#4040508' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' },
  dividerText: { fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' },
  inviteNote: { background: 'rgba(8,165,191,0.1)', border: '1px solid rgba(8,165,191,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#0CC0DB', marginBottom: 14 },
};

export default function AuthPage({ mode: initialMode }) {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const [mode, setMode] = useState(initialMode || (inviteCode ? 'register' : 'login'));
  const [form, setForm] = useState({ email: '', password: '', fullName: '', inviteCode: inviteCode || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!form.email || !form.password) return setError('Email and password are required');
    if (mode === 'register' && !form.fullName) return setError('Full name is required');
    if (mode === 'register' && form.password.length < 8) return setError('Password must be at least 8 characters');

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/dashboard');
      } else {
        await register(form.email, form.password, form.fullName, form.inviteCode);
        setSuccessMsg('Account created! Redirecting...');
        setTimeout(() => navigate('/profile'), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.error || (mode === 'login' ? 'Invalid email or password' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@600;700&display=swap" rel="stylesheet" />
      <div style={s.card}>
        <div style={s.logo} onClick={() => navigate('/')} role="button">SumX CRM</div>

        <div style={s.heading}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>
        <div style={s.sub}>
          {mode === 'login' ? 'Sign in to your account to continue' : 'Start your free trial — 10 playbooks included'}
        </div>

        {inviteCode && mode === 'register' && (
          <div style={s.inviteNote}>🎉 You've been invited to join a team</div>
        )}

        {error && <div style={s.error}>⚠ {error}</div>}
        {successMsg && <div style={s.success}>✓ {successMsg}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div style={s.field}>
              <label style={s.label}>Full name</label>
              <input style={s.input} type="text" value={form.fullName}
                onChange={e => set('fullName', e.target.value)}
                placeholder="Jack Beaver" autoComplete="name" autoFocus />
            </div>
          )}
          <div style={s.field}>
            <label style={s.label}>Work email</label>
            <input style={s.input} type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="jack@company.com" autoComplete="email"
              autoFocus={mode === 'login'} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {mode === 'register' && !inviteCode && (
            <div style={s.field}>
              <label style={s.label}>Invite code <span style={{ color: '#9CA3AF' }}>(optional)</span></label>
              <input style={s.input} type="text" value={form.inviteCode}
                onChange={e => set('inviteCode', e.target.value)}
                placeholder="Team invite code" />
            </div>
          )}
          <button type="submit" style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        {mode === 'register' && (
          <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            Personal email addresses (Gmail, Yahoo, etc.) are not accepted.
          </div>
        )}

        <div style={s.switch}>
          {mode === 'login' ? (
            <>Don't have an account? <span style={s.switchLink} onClick={() => { setMode('register'); setError(''); }}>Sign up free</span></>
          ) : (
            <>Already have an account? <span style={s.switchLink} onClick={() => { setMode('login'); setError(''); }}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  );
}
