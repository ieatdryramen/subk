import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
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

const getCertIcon = (cert) => {
  const map = { '8(a)': '🏆', 'HUBZone': '🗺️', 'WOSB': '👩', 'SDVOSB': '🎖️', 'MBE': '🤝', 'WBE': '👱' };
  return map[cert] || '✓';
};

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1100 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 13, marginBottom: '1.5rem' },
  statsBar: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: '2rem',
    padding: '1rem', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
  },
  stat: {
    textAlign: 'center', padding: '10px 0',
  },
  statValue: { fontSize: 20, fontWeight: 700, color: 'var(--accent)' },
  statLabel: { fontSize: 11, color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase' },
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
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', fontSize: 11,
    borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', marginRight: 6, marginBottom: 4,
  },
  certBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', fontSize: 11,
    borderRadius: 6, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', marginRight: 6, marginBottom: 4,
  },
  empty: {
    textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)',
    border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
  },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', marginBottom: '1rem',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', marginBottom: '1rem',
    boxSizing: 'border-box', minHeight: 100, fontFamily: 'inherit', resize: 'vertical',
  },
};

export default function TeamingInboxPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [myUserId, setMyUserId] = useState(null);
  const [updating, setUpdating] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [searchCompanies, setSearchCompanies] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [sendMessage, setSendMessage] = useState('');
  const [sendLooading, setSendLoading] = useState(false);

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
      addToast(`Request ${status === 'accepted' ? 'accepted' : 'declined'}`, 'success');
    } catch (e) {
      addToast('Failed to update request', 'error');
    } finally { setUpdating(u => ({ ...u, [id]: false })); }
  };

  const searchForCompanies = async (q) => {
    if (!q.trim()) { setSearchCompanies([]); return; }
    setSearchLoading(true);
    try {
      const r = await api.get('/marketplace/subs', { params: { q } });
      setSearchCompanies(r.data || []);
    } catch (e) {
      addToast('Failed to search companies', 'error');
    } finally { setSearchLoading(false); }
  };

  const sendTeamingRequest = async () => {
    if (!selectedCompany || !sendMessage.trim()) {
      addToast('Please select a company and write a message', 'error');
      return;
    }
    setSendLoading(true);
    try {
      await api.post('/marketplace/teaming', {
        to_user_id: selectedCompany.user_id,
        message: sendMessage.trim(),
      });
      addToast('Teaming request sent successfully', 'success');
      setSendModalOpen(false);
      setSelectedCompany(null);
      setSendMessage('');
      setSearchCompanies([]);
      api.get('/marketplace/teaming').then(r => setRequests(r.data)).catch(() => {});
    } catch (e) {
      addToast('Failed to send request', 'error');
    } finally { setSendLoading(false); }
  };

  const received = requests.filter(r => r.to_user_id === myUserId);
  const sent = requests.filter(r => r.from_user_id === myUserId);
  const accepted = requests.filter(r => r.status === 'accepted');
  const current = tab === 'received' ? received : tab === 'sent' ? sent : accepted;

  const pendingCount = received.filter(r => r.status === 'pending').length;
  const responseRate = received.length > 0 ? Math.round(((received.length - pendingCount) / received.length) * 100) : 0;

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

  const parseCerts = (certs) => {
    if (!certs) return [];
    if (typeof certs === 'string') return certs.split(',').map(c => c.trim()).filter(Boolean);
    return [];
  };

  const RequestCard = ({ req }) => {
    const isReceived = req.to_user_id === myUserId;
    const otherCompany = isReceived ? req.from_company : req.to_company;
    const otherName = isReceived ? req.from_name : req.to_name;
    const otherEmail = isReceived ? req.from_email : req.to_email;
    const certs = parseCerts(isReceived ? req.from_certifications : req.to_certifications);
    const naicsStr = isReceived ? req.from_naics : req.to_naics;

    // Simple match score: 50 base + 30 if has certs + 20 if message included
    const matchScore = 50 + (certs.length > 0 ? 30 : 0) + (req.message ? 20 : 0);

    return (
      <div style={s.card(req.status)}
        onMouseEnter={e => { if (req.status !== 'accepted') e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={e => { if (req.status !== 'accepted') e.currentTarget.style.borderColor = 'var(--border)'; }}>
        <div style={s.row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: req.status === 'accepted' ? 'var(--success-bg)' : 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
                color: req.status === 'accepted' ? 'var(--success)' : 'var(--accent2)',
                border: `2px solid ${req.status === 'accepted' ? 'var(--success)' : 'var(--accent)'}`,
              }}>
                {(otherCompany || otherName || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={s.name}>{otherCompany || otherName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                  {isReceived ? 'Request from' : 'Sent to'} {otherName} · {timeAgo(req.created_at)}
                </div>
                {/* NAICS badges */}
                {naicsStr && (
                  <div style={{ marginBottom: 6 }}>
                    {naicsStr.split(',').slice(0, 3).map(n => (
                      <span key={n} style={s.badge}>{n.trim()}</span>
                    ))}
                  </div>
                )}
                {/* Certification badges */}
                {certs.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {certs.slice(0, 4).map(c => (
                      <span key={c} style={s.certBadge}>{getCertIcon(c)} {c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {req.message && (
              <div style={{ ...s.msg, marginTop: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Message:</strong>
                {req.message}
              </div>
            )}
            {/* Match score */}
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
              Match Score: <strong style={{ color: 'var(--accent)' }}>{matchScore}%</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span style={s.statusBadge(req.status)}>{req.status}</span>
            {isReceived && req.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.btn('accept')} onClick={() => setConfirmModal({ id: req.id, action: 'accepted', name: otherName })} disabled={updating[req.id]}>
                  {updating[req.id] ? '...' : '✓ Accept'}
                </button>
                <button style={s.btn('decline')} onClick={() => setConfirmModal({ id: req.id, action: 'declined', name: otherName })} disabled={updating[req.id]}>
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
                  📧 Email
                </a>
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
            <div style={s.heading}>Teaming Hub</div>
            <div style={s.sub}>Manage partnerships and build your teaming network</div>
          </div>
          <button
            onClick={() => setSendModalOpen(true)}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            + Send Teaming Request
          </button>
        </div>

        {/* Stats bar */}
        <div style={s.statsBar}>
          <div style={s.stat}>
            <div style={s.statValue}>{requests.length}</div>
            <div style={s.statLabel}>Total Requests</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statValue, color: 'var(--warning)' }}>{pendingCount}</div>
            <div style={s.statLabel}>Pending</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statValue, color: 'var(--success)' }}>{accepted.length}</div>
            <div style={s.statLabel}>Partnerships</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statValue, color: 'var(--accent2)' }}>{responseRate}%</div>
            <div style={s.statLabel}>Response Rate</div>
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
          <button style={s.tab(tab === 'partners')} onClick={() => setTab('partners')}>
            🤝 Active Partnerships ({accepted.length})
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

        {/* Search and filters - show if enough requests */}
        {(tab !== 'partners' && current.length > 3) && (
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
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg3)' }} />
                  <div style={{ flex: 1 }}>
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
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {tab === 'received' ? '📥' : tab === 'sent' ? '📤' : '🤝'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              {search || statusFilter !== 'all' ? 'No matching requests' : (
                tab === 'partners' ? 'No active partnerships yet' : `No ${tab} requests yet`
              )}
            </div>
            <div style={{ fontSize: 14, maxWidth: 450, margin: '0 auto 20px', color: 'var(--text2)' }}>
              {search || statusFilter !== 'all' ? 'Try adjusting your filters.' : (
                tab === 'received'
                  ? 'When primes and subs reach out to partner with you, requests will appear here.'
                  : tab === 'sent'
                    ? 'Teaming requests you send will be tracked here. Click "Send Teaming Request" to get started.'
                    : 'Once you accept teaming requests, active partnerships will appear here.'
              )}
            </div>
            {!search && statusFilter === 'all' && (
              <button onClick={() => tab === 'sent' ? setSendModalOpen(true) : navigate('/marketplace')}
                style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                {tab === 'sent' ? 'Send Teaming Request' : 'Go to Marketplace'}
              </button>
            )}
          </div>
        ) : filtered.map(req => <RequestCard key={req.id} req={req} />)}
      </div>

      {/* Send Teaming Request Modal */}
      <Modal isOpen={sendModalOpen} onClose={() => { setSendModalOpen(false); setSelectedCompany(null); setSendMessage(''); }} title="Send Teaming Request">
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text2)' }}>
            Search for a company
          </label>
          <input
            type="text"
            placeholder="Search by company name or NAICS..."
            onChange={(e) => searchForCompanies(e.target.value)}
            style={s.input}
          />

          {searchLoading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text3)' }}>Searching...</div>
          )}

          {selectedCompany ? (
            <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius)', marginBottom: '1rem', border: '2px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedCompany.company_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                    Contact: {selectedCompany.full_name}
                  </div>
                  {selectedCompany.naics_codes && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                      NAICS: {selectedCompany.naics_codes}
                    </div>
                  )}
                  {selectedCompany.certifications && (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      Certifications: {selectedCompany.certifications}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCompany(null)}
                  style={{
                    background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none',
                    borderRadius: 'var(--radius)', padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                  }}>
                  ✕ Change
                </button>
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: '1rem' }}>
              {searchCompanies.map(company => (
                <div
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  style={{
                    padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg2)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{company.company_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {company.full_name} • {company.state || 'Location unknown'}
                  </div>
                </div>
              ))}
              {searchCompanies.length === 0 && !searchLoading && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text3)', fontSize: 12 }}>
                  Start typing to search for companies
                </div>
              )}
            </div>
          )}

          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text2)' }}>
            Your message
          </label>
          <textarea
            value={sendMessage}
            onChange={(e) => setSendMessage(e.target.value)}
            placeholder="Introduce yourself and explain why you'd be a great partner..."
            style={s.textarea}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={sendTeamingRequest}
              disabled={!selectedCompany || !sendMessage.trim() || sendLooading}
              style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius)', cursor: 'pointer', opacity: (!selectedCompany || !sendMessage.trim() || sendLooading) ? 0.5 : 1,
              }}>
              {sendLooading ? 'Sending...' : 'Send Request'}
            </button>
            <button
              onClick={() => { setSendModalOpen(false); setSelectedCompany(null); setSendMessage(''); }}
              style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
                background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      {confirmModal && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          title={`${confirmModal.action === 'accepted' ? 'Accept' : 'Decline'} request?`}>
          <div>
            <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: '1.5rem' }}>
              {confirmModal.action === 'accepted'
                ? `Accept teaming request from ${confirmModal.name}? You'll be able to contact them directly.`
                : `Are you sure you want to decline this request from ${confirmModal.name}?`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  respond(confirmModal.id, confirmModal.action);
                  setConfirmModal(null);
                }}
                disabled={updating[confirmModal.id]}
                style={{
                  flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
                  background: confirmModal.action === 'accepted' ? 'var(--success)' : 'var(--danger)',
                  color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                }}>
                {updating[confirmModal.id] ? '...' : (confirmModal.action === 'accepted' ? 'Accept' : 'Decline')}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
                  background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                }}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
