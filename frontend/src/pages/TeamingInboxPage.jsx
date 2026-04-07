import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 13, marginBottom: '1.5rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' },
  tab: (a) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent',
    color: a ? 'var(--accent2)' : 'var(--text2)', marginBottom: -1,
  }),
  card: (status) => ({
    background: 'var(--bg2)', border: `1px solid ${status === 'accepted' ? 'var(--success)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 10,
    transition: 'border-color 0.15s',
  }),
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 15, fontWeight: 600, marginBottom: 3 },
  meta: { fontSize: 12, color: 'var(--text2)', marginBottom: 8 },
  msg: {
    fontSize: 13, color: 'var(--text)', lineHeight: 1.6, padding: '10px 14px',
    background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  },
  statusBadge: (status) => ({
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
    background: status === 'pending' ? 'var(--warning-bg)' : status === 'accepted' ? 'var(--success-bg)' : 'var(--danger-bg)',
    color: status === 'pending' ? 'var(--warning)' : status === 'accepted' ? 'var(--success)' : 'var(--danger)',
    border: '1px solid currentColor',
  }),
  btn: (v) => ({
    padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: v === 'accept' ? 'var(--success)' : v === 'decline' ? 'var(--danger-bg)' : v === 'primary' ? 'var(--accent)' : 'var(--bg3)',
    color: v === 'accept' ? '#fff' : v === 'decline' ? 'var(--danger)' : v === 'primary' ? '#fff' : 'var(--text2)',
  }),
  empty: {
    textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)',
    border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
  },
};

export default function TeamingInboxPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [myUserId, setMyUserId] = useState(null);
  const [updating, setUpdating] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

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
    } finally { setUpdating(u => ({ ...u, [id]: false })); }
  };

  const received = requests.filter(r => r.to_user_id === myUserId);
  const sent = requests.filter(r => r.from_user_id === myUserId);
  const current = tab === 'received' ? received : sent;

  const pendingCount = received.filter(r => r.status === 'pending').length;
  const acceptedCount = requests.filter(r => r.status === 'accepted').length;

  // Apply filters
  const filtered = current.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const isReceived = r.to_user_id === myUserId;
      const company = (isReceived ? r.from_company : r.to_company || '').toLowerCase();
      const name = (isReceived ? r.from_name : r.to_name || '').toLowerCase();
      const msg = (r.message || '').toLowerCase();
      if (!company.includes(q) && !name.includes(q) && !msg.includes(q)) return false;
    }
    return true;
  });

  const RequestCard = ({ req }) => {
    const isReceived = req.to_user_id === myUserId;
    const otherCompany = isReceived ? req.from_company : req.to_company;
    const otherName = isReceived ? req.from_name : req.to_name;
    const otherEmail = isReceived ? req.from_email : req.to_email;

    return (
      <div style={s.card(req.status)}
        onMouseEnter={e => { if (req.status !== 'accepted') e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={e => { if (req.status !== 'accepted') e.currentTarget.style.borderColor = 'var(--border)'; }}>
        <div style={s.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: req.status === 'accepted' ? 'var(--success-bg)' : 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                color: req.status === 'accepted' ? 'var(--success)' : 'var(--accent2)',
                border: `1px solid ${req.status === 'accepted' ? 'var(--success)' : 'var(--accent)'}`,
              }}>
                {(otherCompany || otherName || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={s.name}>{otherCompany || otherName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {isReceived ? 'Request from' : 'Sent to'} {otherName} · {timeAgo(req.created_at)}
                </div>
              </div>
            </div>
            {req.message && (
              <div style={{ ...s.msg, marginTop: 8 }}>{req.message}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span style={s.statusBadge(req.status)}>{req.status}</span>
            {isReceived && req.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.btn('accept')} onClick={() => respond(req.id, 'accepted')} disabled={updating[req.id]}>
                  {updating[req.id] ? '...' : '✓ Accept'}
                </button>
                <button style={s.btn('decline')} onClick={() => respond(req.id, 'declined')} disabled={updating[req.id]}>
                  ✕ Decline
                </button>
              </div>
            )}
            {req.status === 'accepted' && otherEmail && (
              <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
                <a href={`mailto:${otherEmail}`}
                  style={{
                    fontSize: 12, color: 'var(--accent2)', textDecoration: 'none',
                    padding: '5px 12px', border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius)', display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  📧 Email {otherName?.split(' ')[0] || 'them'}
                </a>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{otherEmail}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={s.heading}>Teaming Inbox</div>
            <div style={s.sub}>Manage teaming requests from primes and subs</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>{pendingCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Pending</div>
              </div>
            )}
            {acceptedCount > 0 && (
              <>
                <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{acceptedCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Partners</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(tab === 'received')} onClick={() => setTab('received')}>
            📥 Received {pendingCount > 0 && (
              <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--warning)', color: '#fff' }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button style={s.tab(tab === 'sent')} onClick={() => setTab('sent')}>
            📤 Sent ({sent.length})
          </button>
        </div>

        {/* Search and filters */}
        {current.length > 3 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or message..."
              style={{ padding: '7px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 220 }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 'auto' }}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{filtered.length} results</span>
          </div>
        )}

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...s.card('pending'), opacity: 0.5 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg3)' }} />
                  <div>
                    <div style={{ width: 180, height: 14, background: 'var(--bg3)', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ width: 120, height: 10, background: 'var(--bg3)', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ width: '100%', height: 50, background: 'var(--bg3)', borderRadius: 'var(--radius)' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{tab === 'received' ? '📥' : '📤'}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              {search || statusFilter !== 'all' ? 'No matching requests' : `No ${tab} requests yet`}
            </div>
            <div style={{ fontSize: 14, maxWidth: 450, margin: '0 auto 20px', color: 'var(--text2)' }}>
              {search || statusFilter !== 'all' ? 'Try adjusting your filters.' : (
                tab === 'received'
                  ? 'When primes and subs reach out to partner with you, requests will appear here.'
                  : 'Teaming requests you send will be tracked here. Start by exploring the Marketplace.'
              )}
            </div>
            {!search && statusFilter === 'all' && (
              <button onClick={() => navigate('/marketplace')}
                style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                Go to Marketplace
              </button>
            )}
          </div>
        ) : filtered.map(req => <RequestCard key={req.id} req={req} />)}
      </div>
    </Layout>
  );
}
