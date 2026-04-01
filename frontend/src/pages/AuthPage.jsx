import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' },
  card: { width: '100%', maxWidth: 420, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem' },
  logo: { fontFamily: 'Syne', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' },
  sub: { fontSize: 13, color: 'var(--text2)', marginBottom: '2rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'var(--bg3)', padding: 4, borderRadius: 'var(--radius)' },
  tab: (active) => ({ flex: 1, padding: '8px', textAlign: 'center', borderRadius: 8, background: active ? 'var(--bg2)' : 'transparent', color: active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 500 : 400, cursor: 'pointer', border: active ? '1px solid var(--border)' : '1px solid transparent', fontSize: 13 }),
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' },
  btn: { width: '100%', padding: '11px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, marginTop: '0.5rem', fontSize: 14, border: 'none', cursor: 'pointer' },
  err: { color: 'var(--danger)', fontSize: 13, marginTop: '0.75rem', textAlign: 'center' },
  inviteBanner: { background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--success)', marginBottom: '1rem' },
};

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
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>ProspectForge</div>
        <div style={styles.sub}>AI-powered sales cadence intelligence</div>
        {inviteCode && <div style={styles.inviteBanner}>✓ You have been invited to join a team</div>}
        <div style={styles.tabs}>
          <div style={styles.tab(mode === 'login')} onClick={() => setMode('login')}>Sign in</div>
          <div style={styles.tab(mode === 'register')} onClick={() => setMode('register')}>Create account</div>
        </div>
        {mode === 'register' && (
          <div style={styles.field}>
            <label style={styles.label}>Full name</label>
            <input placeholder="Jack Daniels" value={form.full_name} onChange={set('full_name')} />
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {mode === 'register' && !inviteCode && (
          <div style={styles.field}>
            <label style={styles.label}>Invite code (optional — if joining a team)</label>
            <input placeholder="Leave blank to create a new team" value={form.invite_code} onChange={set('invite_code')} />
          </div>
        )}
        <button style={styles.btn} onClick={submit} disabled={loading}>
          {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        {error && <div style={styles.err}>{error}</div>}
      </div>
    </div>
  );
}
