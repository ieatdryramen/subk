import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 860 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' },
  tab: (a) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', color: a ? 'var(--accent2)' : 'var(--text2)', marginBottom: -1 }),
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 15, fontWeight: 600, marginBottom: 3 },
  meta: { fontSize: 12, color: 'var(--text2)', marginBottom: 8 },
  msg: { fontSize: 13, color: 'var(--text)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  statusBadge: (status) => ({
    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
    background: status === 'pending' ? 'var(--warning-bg)' : status === 'accepted' ? 'var(--success-bg)' : 'var(--danger-bg)',
    color: status === 'pending' ? 'var(--warning)' : status === 'accepted' ? 'var(--success)' : 'var(--danger)',
    border: '1px solid currentColor',
  }),
  btn: (v) => ({ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', background: v === 'accept' ? 'var(--success-bg)' : v === 'decline' ? 'var(--danger-bg)' : 'var(--bg3)', color: v === 'accept' ? 'var(--success)' : v === 'decline' ? 'var(--danger)' : 'var(--text2)' }),
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' },
  skeleton: { background: 'var(--bg3)', borderRadius: 'var(--radius)', animation: 'pulse 2s ease-in-out infinite', marginBottom: 10 },
  skeletonLine: { height: 16, borderRadius: 4, marginBottom: 8 },
};

export default function TeamingInboxPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [myUserId, setMyUserId] = useState(null);
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('sumx_user') || '{}');
    setMyUserId(user?.id);
    api.get('/marketplace/teaming').then(r => { setRequests(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const respond = async (id, status) => {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      await api.patch(`/marketplace/teaming/${id}`, { status });
      setRequests(rs => rs.map(r => r.id === id ? { ...r, status } : r));
      toast.addToast(`Request ${status === 'accepted' ? 'accepted' : 'declined'}`, 'success');
    } catch (e) {
      toast.addToast('Failed to update request', 'error');
    }
    finally { setUpdating(u => ({ ...u, [id]: false })); }
  };

  const received = requests.filter(r => r.to_user_id === myUserId);
  const sent = requests.filter(r => r.from_user_id === myUserId);
  const current = tab === 'received' ? received : sent;

  const RequestCard = ({ req }) => {
    const isReceived = req.to_user_id === myUserId;
    const otherCompany = isReceived ? req.from_company : req.to_company;
    const otherName = isReceived ? req.from_name : req.to_name;
    const date = new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
      <div style={s.card}>
        <div style={s.row}>
          <div style={{ flex: 1 }}>
            <div style={s.name}>{otherCompany || otherName}</div>
            <div style={s.meta}>{isReceived ? 'Teaming request from' : 'Request sent to'} {otherName} · {date}</div>
            {req.message && <div style={s.msg}>{req.message}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span style={s.statusBadge(req.status)}>{req.status}</span>
            {isReceived && req.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.btn('accept')} onClick={() => respond(req.id, 'accepted')} disabled={updating[req.id]}>✓ Accept</button>
                <button style={s.btn('decline')} onClick={() => respond(req.id, 'declined')} disabled={updating[req.id]}>✕ Decline</button>
              </div>
            )}
            {req.status === 'accepted' && (
              <a href={`mailto:${isReceived ? req.from_email : req.to_email}`}
                style={{ fontSize: 12, color: 'var(--accent2)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
                📧 Email them
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div style={s.page}>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>
        <div style={s.heading}>Teaming Inbox</div>
        <div style={s.sub}>Manage teaming requests from primes and subs</div>

        <div style={s.tabs}>
          <button style={s.tab(tab === 'received')} onClick={() => setTab('received')}>
            Received {received.filter(r => r.status === 'pending').length > 0 && `(${received.filter(r => r.status === 'pending').length} pending)`}
          </button>
          <button style={s.tab(tab === 'sent')} onClick={() => setTab('sent')}>Sent</button>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={s.card}>
                <div style={{ ...s.skeleton, ...s.skeletonLine, width: '40%' }} />
                <div style={{ ...s.skeleton, ...s.skeletonLine, width: '60%', marginBottom: 12 }} />
                <div style={{ ...s.skeleton, ...s.skeletonLine, width: '100%' }} />
                <div style={{ ...s.skeleton, ...s.skeletonLine, width: '100%' }} />
              </div>
            ))}
          </div>
        ) : current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{tab === 'received' ? '📥' : '📤'}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>No {tab} requests yet</div>
            <div style={{ fontSize: 14, marginBottom: 20, maxWidth: 450, margin: '0 auto', marginBottom: 20 }}>
              {tab === 'received'
                ? 'When primes and subs reach out to partner with you, requests will appear here. Accept or decline and connect.'
                : 'Teaming requests you send will be tracked here. Start by exploring the Marketplace to find partners.'}
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              Go to Marketplace
            </button>
          </div>
        ) : current.map(req => <RequestCard key={req.id} req={req} />)}
      </div>
    </Layout>
  );
}
