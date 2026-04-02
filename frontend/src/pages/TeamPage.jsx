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
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, email: null });
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: null });
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [savingSlack, setSavingSlack] = useState(false);
  const [zohoClientId, setZohoClientId] = useState('');
  const [zohoClientSecret, setZohoClientSecret] = useState('');
  const [savingZoho, setSavingZoho] = useState(false);

  useEffect(() => {
    api.get('/auth/org').then(r => {
      setOrg(r.data.org);
      setMembers(r.data.members || []);
    }).catch(console.error);
    api.get('/zoho/status').then(r => setZohoConnected(r.data.connected)).catch(() => {});
    api.get('/outlook/status').then(r => setOutlookStatus(r.data)).catch(() => {});
    api.get('/gmail/status').then(r => setGmailStatus(r.data)).catch(() => {});
    api.get('/slack/status').then(r => setSlackConnected(r.data.connected)).catch(() => {});
    // Check if just connected
    const params = new URLSearchParams(window.location.search);
    if (params.get('zoho') === 'connected') {
      setZohoConnected(true);
      window.history.replaceState({}, '', '/team');
    }
    if (params.get('outlook') === 'connected') {
      api.get('/outlook/status').then(r => setOutlookStatus(r.data));
      window.history.replaceState({}, '', '/team');
    }
    if (params.get('gmail') === 'connected') {
      api.get('/gmail/status').then(r => setGmailStatus(r.data));
      window.history.replaceState({}, '', '/team');
    }
  }, []);

  const inviteUrl = org ? `${window.location.origin}/login?invite=${org.invite_code}` : '';

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSlack = async () => {
    if (!slackWebhook) return;
    setSavingSlack(true);
    try {
      await api.post('/slack/configure', { webhook_url: slackWebhook });
      setSlackConnected(true);
      setSlackWebhook('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to connect Slack');
    } finally {
      setSavingSlack(false);
    }
  };

  const connectGmail = async () => {
    try {
      const r = await api.get('/gmail/connect');
      window.location.href = r.data.url;
    } catch (err) {
      alert(err.response?.data?.error || 'Gmail not configured yet. Add GMAIL_CLIENT_ID to Railway environment variables.');
    }
  };

  const connectOutlook = async () => {
    try {
      const r = await api.get('/outlook/connect');
      window.location.href = r.data.url;
    } catch (err) {
      alert(err.response?.data?.error || 'Outlook not configured yet. Add OUTLOOK_CLIENT_ID to Railway environment variables.');
    }
  };

  const connectZoho = async () => {
    setSavingZoho(true);
    try {
      const r = await api.get('/zoho/connect');
      window.location.href = r.data.url;
    } catch (err) {
      alert('Failed to initiate Zoho connection: ' + (err.response?.data?.error || err.message));
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
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12, marginBottom: 12 }}>
                Zoho is connected. You can push leads, sync playbooks, and send tracked emails directly from any playbook.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  '✓ Push contacts to Zoho',
                  '✓ Sync full playbooks as notes',
                  '✓ Send emails with open tracking',
                  '✓ Sequences logged automatically',
                ].map(f => (
                  <span key={f} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>{f}</span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                Connect your Zoho CRM to push contacts and full playbook notes with one click.
              </p>
              <button style={s.connectBtn} onClick={connectZoho} disabled={savingZoho}>
                {savingZoho ? 'Redirecting to Zoho...' : 'Connect Zoho CRM'}
              </button>
            </div>
          )}
        </div>
        {/* Slack */}
        <div style={s.zohoCard}>
          <div style={s.cardTitle}>Slack notifications</div>
          {slackConnected ? (
            <div>
              <span style={s.connectedBadge}>✓ Slack connected</span>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>
                Team activity notifications are being sent to your Slack channel.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                Get notified in Slack when playbooks are generated or touchpoints completed. Create an incoming webhook at <a href="https://api.slack.com/apps" target="_blank" style={{ color: 'var(--accent2)' }}>api.slack.com/apps</a>.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..." style={{ flex: 1 }} />
                <button style={{ ...s.connectBtn, background: '#4A154B', flexShrink: 0 }}
                  onClick={saveSlack} disabled={savingSlack || !slackWebhook}>
                  {savingSlack ? 'Connecting...' : 'Connect Slack'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Gmail */}
        <div style={s.zohoCard}>
          <div style={s.cardTitle}>Gmail</div>
          {gmailStatus.connected ? (
            <div>
              <span style={s.connectedBadge}>✓ Connected — {gmailStatus.email}</span>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>
                Send emails directly from any playbook via Gmail. Each send is logged as a completed touchpoint.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                Connect Gmail to send emails directly from playbooks with one click.
              </p>
              <button style={{ ...s.connectBtn, background: '#EA4335' }} onClick={connectGmail}>
                Connect Gmail
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
