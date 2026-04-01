import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 800 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' },
  inviteBox: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  inviteUrl: { fontSize: 13, color: 'var(--accent2)', fontFamily: 'var(--font-mono)', flex: 1, marginRight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: { padding: '7px 14px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', flexShrink: 0 },
  memberRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  memberName: { fontSize: 14, fontWeight: 500 },
  memberEmail: { fontSize: 12, color: 'var(--text2)' },
  badge: (role) => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
    background: role === 'admin' ? 'var(--accent-bg)' : 'var(--bg3)',
    color: role === 'admin' ? 'var(--accent2)' : 'var(--text2)',
    border: role === 'admin' ? '1px solid var(--accent)' : '1px solid var(--border)',
  }),
  zohoCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
  connectBtn: { padding: '10px 20px', background: '#e74c3c', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' },
  connectedBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500 },
};

export default function TeamPage() {
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [zohoConnected, setZohoConnected] = useState(false);
  const [zohoClientId, setZohoClientId] = useState('');
  const [zohoClientSecret, setZohoClientSecret] = useState('');
  const [savingZoho, setSavingZoho] = useState(false);

  useEffect(() => {
    api.get('/auth/org').then(r => {
      setOrg(r.data.org);
      setMembers(r.data.members || []);
    }).catch(console.error);
    api.get('/zoho/status').then(r => setZohoConnected(r.data.connected)).catch(() => {});
  }, []);

  const inviteUrl = org ? `${window.location.origin}/login?invite=${org.invite_code}` : '';

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connectZoho = async () => {
    if (!zohoClientId) { alert('Enter your Zoho Client ID first'); return; }
    setSavingZoho(true);
    try {
      await api.post('/profile', { zoho_client_id: zohoClientId, zoho_client_secret: zohoClientSecret });
      const redirectUri = `${window.location.origin}/api/zoho/callback`;
      const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.notes.ALL&client_id=${zohoClientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;
      window.location.href = authUrl;
    } catch (err) {
      alert('Failed to save Zoho credentials');
    } finally {
      setSavingZoho(false);
    }
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Team & Integrations</div>
        <div style={s.sub}>Manage your team and connect external tools</div>

        {/* Team */}
        <div style={s.card}>
          <div style={s.cardTitle}>Team members ({members.length})</div>
          {org && (
            <div style={s.inviteBox}>
              <span style={s.inviteUrl}>{inviteUrl}</span>
              <button style={s.copyBtn} onClick={copyInvite}>{copied ? '✓ Copied' : 'Copy invite link'}</button>
            </div>
          )}
          {members.map(m => (
            <div key={m.id} style={s.memberRow}>
              <div>
                <div style={s.memberName}>{m.full_name || m.email}</div>
                <div style={s.memberEmail}>{m.email}</div>
              </div>
              <span style={s.badge(m.role)}>{m.role}</span>
            </div>
          ))}
          {members.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No team members yet — share the invite link above</div>
          )}
        </div>

        {/* Zoho CRM */}
        <div style={s.zohoCard}>
          <div style={s.cardTitle}>Zoho CRM</div>
          {zohoConnected ? (
            <div>
              <span style={s.connectedBadge}>✓ Connected to Zoho CRM</span>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>
                You can now push leads and playbooks to Zoho directly from any lead list.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                Connect your Zoho CRM to push contacts and playbook notes directly. You'll need a Zoho API client — create one at <a href="https://api-console.zoho.com" target="_blank">api-console.zoho.com</a>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Client ID</label>
                  <input value={zohoClientId} onChange={e => setZohoClientId(e.target.value)} placeholder="1000.XXXX..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Client Secret</label>
                  <input type="password" value={zohoClientSecret} onChange={e => setZohoClientSecret(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <button style={s.connectBtn} onClick={connectZoho} disabled={savingZoho}>
                {savingZoho ? 'Connecting...' : 'Connect Zoho CRM'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
