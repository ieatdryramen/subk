import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

// Win Probability Gauge Component
const WinProbabilityGauge = ({ probability }) => {
  const cx = 60, cy = 60, r = 50;
  const angle = (probability / 100) * 180; // 0-180 degrees (semicircle)
  const rad = (angle * Math.PI) / 180;
  const x = cx + r * Math.cos(rad - Math.PI / 2);
  const y = cy + r * Math.sin(rad - Math.PI / 2);

  const color = probability >= 70 ? 'var(--success)' : probability >= 40 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="120" height="70" viewBox="0 0 120 70" style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path
          d={`M 10 60 A 50 50 0 0 1 110 60`}
          stroke="var(--bg3)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 10 60 A 50 50 0 ${angle > 90 ? 1 : 0} 1 ${x} ${y}`}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Center percentage text */}
        <text x="60" y="40" fontSize="20" fontWeight="700" textAnchor="middle" fill={color}>
          {Math.round(probability)}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 500 }}>
        Win Probability
      </span>
    </div>
  );
};

// Opportunity Detail Drawer Component
const OpportunityDetailDrawer = ({ opp, linkedLeads, recentActivity, winProbability, onClose, notes, onAddNote, addToast }) => {
  const [noteInput, setNoteInput] = useState('');

  if (!opp) return null;

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    onAddNote(opp.id, noteInput.trim());
    setNoteInput('');
    addToast('Note added', 'success');
  };

  const statusColors = {
    new: 'var(--text3)', reviewing: 'var(--accent2)', pursuing: 'var(--warning)',
    teaming: 'var(--accent2)', submitted: 'var(--warning)', won: 'var(--success)',
    lost: 'var(--danger)', no_bid: 'var(--text3)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 600,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text)', margin: 0 }}>
              {opp.title}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                background: statusColors[opp.status] ? `${statusColors[opp.status]}22` : 'var(--bg3)',
                color: statusColors[opp.status] || 'var(--text2)',
              }}>
                {(opp.status || 'new').replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{opp.agency}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text2)',
              padding: '4px 8px',
              marginLeft: 8,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* Key Fields */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
              Opportunity Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {opp.sam_notice_id && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Notice ID
                  </div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text)', wordBreak: 'break-all' }}>
                    {opp.sam_notice_id}
                  </div>
                </div>
              )}
              {opp.posted_date && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Posted Date
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    {new Date(opp.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}
              {opp.response_deadline && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Response Deadline
                  </div>
                  <div style={{ fontSize: 13, color: (() => {
                    const days = Math.ceil((new Date(opp.response_deadline) - new Date()) / 86400000);
                    return days <= 7 ? 'var(--danger)' : days <= 14 ? 'var(--warning)' : 'var(--text)';
                  })() }}>
                    {new Date(opp.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}
              {opp.set_aside && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Set-Aside Type
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{opp.set_aside}</div>
                </div>
              )}
              {opp.naics_code && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    NAICS Code
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{opp.naics_code}</div>
                </div>
              )}
              {(opp.value_min || opp.value_max) && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Estimated Value
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    {opp.value_min ? `$${(opp.value_min / 1000000).toFixed(1)}M` : ''}
                    {opp.value_min && opp.value_max ? ' - ' : ''}
                    {opp.value_max ? `$${(opp.value_max / 1000000).toFixed(1)}M` : ''}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked Leads Section */}
          {linkedLeads && linkedLeads.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
                Linked Leads ({linkedLeads.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {linkedLeads.map(lead => (
                  <div key={lead.id} style={{
                    padding: '10px 12px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      {lead.full_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {lead.company} {lead.title && `· ${lead.title}`}
                    </div>
                    {lead.activity_count > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 4 }}>
                        {lead.activity_count} activity {lead.activity_count === 1 ? 'item' : 'items'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {recentActivity && recentActivity.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
                Recent Activity
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentActivity.map(activity => (
                  <div key={activity.id} style={{
                    padding: '10px 12px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                      {activity.full_name}: {activity.touchpoint}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {activity.completed_at
                        ? new Date(activity.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : new Date(activity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
              Notes
            </h3>
            {notes && notes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {notes.map((note, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                      {note.text}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                      {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Add a note..."
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: 12,
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text)',
                }}
              />
              <button
                onClick={handleAddNote}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>

          {/* Win Probability Gauge */}
          <div style={{ marginBottom: '1.5rem' }}>
            <WinProbabilityGauge probability={winProbability || 0} />
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
              }}>
                Start Sequence
              </button>
              <button style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text2)',
                cursor: 'pointer',
              }}>
                Add to Pipeline
              </button>
              <button style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text2)',
                cursor: 'pointer',
              }}>
                Generate Playbook
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const scoreColor = (score) => {
  if (!score) return { color: 'var(--text3)', bg: 'var(--bg3)' };
  if (score >= 70) return { color: 'var(--success)', bg: 'var(--success-bg)' };
  if (score >= 40) return { color: 'var(--warning)', bg: 'var(--warning-bg)' };
  return { color: 'var(--danger)', bg: 'var(--danger-bg)' };
};

const STATUS_OPTIONS = ['new', 'reviewing', 'pursuing', 'teaming', 'submitted', 'won', 'lost', 'no_bid'];
const STATUS_COLORS = {
  new: 'var(--text3)', reviewing: 'var(--accent2)', pursuing: 'var(--warning)',
  teaming: 'var(--accent2)', submitted: 'var(--warning)', won: 'var(--success)',
  lost: 'var(--danger)', no_bid: 'var(--text3)',
};

const SET_ASIDES = ['all', 'Small Business Set-Aside', '8(a)', 'HUBZone', 'SDVOSB', 'WOSB'];

export default function OpportunitiesPage() {
  const { addToast } = useToast();
  const [opps, setOpps] = useState([]);
  const [savedOpps, setSavedOpps] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState('tracked'); // tracked | search | saved
  const [searchResults, setSearchResults] = useState([]);
  const [searchForm, setSearchForm] = useState({
    naics_codes: '', keywords: '', agency: '', set_aside: 'all',
    save_search: true, search_name: '',
  });
  const [scoreFilter, setScoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chatOpen, setChatOpen] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});
  const [autoSearchConfigs, setAutoSearchConfigs] = useState([]);
  const [loadingAutoSearch, setLoadingAutoSearch] = useState(false);
  const [lastSearched, setLastSearched] = useState(null);
  const [primes, setPrimes] = useState([]);
  const [primesLoaded, setPrimesLoaded] = useState(false);
  const [oppNotes, setOppNotes] = useState({});
  const [noteInput, setNoteInput] = useState('');
  const [noteOpen, setNoteOpen] = useState(null);
  const [proposalLoading, setProposalLoading] = useState(null);
  const [proposalResult, setProposalResult] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.get('/opportunities').then(r => {
      const data = r.data;
      setOpps(Array.isArray(data) ? data : data.opportunities || []);
    }).catch(() => {});
    api.get('/opportunities/saved').then(r => {
      const data = Array.isArray(r.data) ? r.data : r.data.opportunities || [];
      setSavedOpps(data);
      const map = {};
      data.forEach(o => { map[o.id] = true; });
      setSavedMap(map);
    }).catch(() => {});
    api.get('/autosearch').then(r => setAutoSearchConfigs(r.data || [])).catch(() => {});
    // Load notes from localStorage
    try { const n = JSON.parse(localStorage.getItem('sumx_opp_notes') || '{}'); setOppNotes(n); } catch {}
  }, []);

  // Fetch primes when an opportunity is expanded
  useEffect(() => {
    if (expanded && !primesLoaded) {
      api.get('/primes').then(r => { setPrimes(Array.isArray(r.data) ? r.data : r.data.primes || []); setPrimesLoaded(true); }).catch(() => setPrimesLoaded(true));
    }
  }, [expanded]);

  const saveOppNote = (oppId) => {
    if (!noteInput.trim()) return;
    const updated = { ...oppNotes, [oppId]: [...(oppNotes[oppId] || []), { text: noteInput.trim(), date: new Date().toISOString() }] };
    setOppNotes(updated);
    localStorage.setItem('sumx_opp_notes', JSON.stringify(updated));
    setNoteInput('');
    setNoteOpen(null);
    addToast('Note saved', 'success');
  };

  const generateProposal = async (oppId) => {
    setProposalLoading(oppId);
    try {
      const r = await api.post(`/chat/opportunity/${oppId}`, {
        messages: [{ role: 'user', content: 'Generate a proposal outline for this opportunity. Include: Executive Summary, Technical Approach, Management Plan, Past Performance, Staffing Plan, and Key Differentiators. Keep each section to 2-3 bullet points.' }]
      });
      setProposalResult(prev => ({ ...prev, [oppId]: r.data.reply }));
    } catch { addToast('Failed to generate proposal outline', 'error'); }
    finally { setProposalLoading(null); }
  };

  // Open drawer with opportunity detail
  const openDrawer = async (oppId) => {
    setDrawerOpen(oppId);
    try {
      const r = await api.get(`/opportunities/${oppId}/detail`);
      setDrawerData(r.data);
    } catch (err) {
      addToast('Failed to load opportunity details', 'error');
      setDrawerOpen(null);
    }
  };

  // Add note to opportunity
  const addDrawerNote = (oppId, noteText) => {
    const updated = { ...oppNotes, [oppId]: [...(oppNotes[oppId] || []), { text: noteText, date: new Date().toISOString() }] };
    setOppNotes(updated);
    localStorage.setItem('sumx_opp_notes', JSON.stringify(updated));
    if (drawerData) {
      setDrawerData(prev => ({ ...prev, notes: updated[oppId] || [] }));
    }
  };

  const [samError, setSamError] = useState(null);
  const search = async () => {
    setSearching(true);
    setSamError(null);
    try {
      const r = await api.post('/opportunities/search', searchForm);
      setSearchResults(Array.isArray(r.data) ? r.data : r.data.opportunities || []);
      if (r.data.sam_error) {
        setSamError(r.data.sam_error);
        addToast(r.data.sam_error, 'error');
      } else {
        addToast(`Found ${r.data.count || 0} opportunities`, 'success');
      }
      if (searchForm.save_search) {
        api.get('/opportunities').then(r2 => setOpps(Array.isArray(r2.data) ? r2.data : r2.data.opportunities || []));
      }
      setLastSearched(Date.now());
      setTab('results');
    } catch (err) {
      if (err.response?.data?.upgrade) {
        addToast('Search limit reached. Upgrade your plan to continue.', 'error');
      } else {
        addToast(err.response?.data?.error || 'Search failed', 'error');
      }
    } finally { setSearching(false); }
  };

  const refreshFromSam = async () => {
    setRefreshing(true);
    try {
      const r = await api.post('/opportunities/refresh');
      const { added, updated, errors } = r.data;
      if (added > 0 || updated > 0) {
        addToast(`SAM.gov refresh: ${added} new, ${updated} updated`, 'success');
        // Reload opportunities
        const r2 = await api.get('/opportunities');
        setOpps(Array.isArray(r2.data) ? r2.data : r2.data.opportunities || []);
      } else if (errors?.length) {
        addToast(errors[0], 'error');
      } else {
        addToast('No new opportunities found', 'info');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'SAM.gov refresh failed', 'error');
    } finally { setRefreshing(false); }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/opportunities/${id}/status`, { status });
    setOpps(os => os.map(o => o.id === id ? { ...o, status } : o));
    setSearchResults(rs => rs.map(r => r.id === id ? { ...r, status } : r));
  };

  const deleteOpp = async (id) => {
    await api.delete(`/opportunities/${id}`);
    setOpps(os => os.filter(o => o.id !== id));
  };

  const toggleSaveOpp = async (id) => {
    try {
      if (savedMap[id]) {
        await api.delete(`/opportunities/save/${id}`);
        setSavedMap(m => ({ ...m, [id]: false }));
        setSavedOpps(os => os.filter(o => o.id !== id));
      } else {
        await api.post(`/opportunities/save/${id}`);
        setSavedMap(m => ({ ...m, [id]: true }));
      }
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to save opportunity', 'error');
    }
  };

  const sendChat = async (oppId) => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const r = await api.post(`/chat/opportunity/${oppId}`, { messages: newMessages });
      setChatMessages([...newMessages, { role: 'assistant', content: r.data.reply }]);
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Error — try again' }]);
    } finally { setChatLoading(false); }
  };

  const toggleAutoSearch = async (searchId, frequency) => {
    setLoadingAutoSearch(true);
    try {
      if (frequency) {
        await api.post(`/autosearch/enable/${searchId}`, { frequency });
      } else {
        await api.delete(`/autosearch/disable/${searchId}`);
      }
      const r = await api.get('/autosearch');
      setAutoSearchConfigs(r.data || []);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update auto-search', 'error');
    } finally {
      setLoadingAutoSearch(false);
    }
  };

  const exportCSV = async () => {
    try {
      const r = await api.get('/opportunities/export/csv', { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'subk-opportunities.csv';
      a.click();
    } catch (e) {
      addToast('Export failed', 'error');
    }
  };

  const runAutoSearch = async (searchId) => {
    setLoadingAutoSearch(true);
    try {
      await api.post(`/autosearch/run/${searchId}`);
      api.get('/opportunities').then(r => setOpps(Array.isArray(r.data) ? r.data : r.data.opportunities || []));
      addToast('Search completed! New opportunities have been added.', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to run search', 'error');
    } finally {
      setLoadingAutoSearch(false);
    }
  };

  const filteredOpps = opps.filter(o => {
    const matchScore = scoreFilter === 'all' || (scoreFilter === 'high' && o.fit_score >= 70) || (scoreFilter === 'mid' && o.fit_score >= 40 && o.fit_score < 70) || (scoreFilter === 'low' && (!o.fit_score || o.fit_score < 40));
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchScore && matchStatus;
  });

  const displayOpps = tab === 'results' ? searchResults : tab === 'saved' ? savedOpps : filteredOpps;

  const s = {
    page: { padding: '2rem 2.5rem' },
    heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
    tabs: { display: 'flex', gap: 6, marginBottom: '1.5rem' },
    tab: (active) => ({ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#FFFFFF' : 'var(--text2)', border: active ? 'none' : '1px solid var(--border)' }),
    searchCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' },
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
    label: { display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, fontWeight: 500 },
    oppCard: (active) => ({ background: 'var(--bg2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', marginBottom: 8, overflow: 'hidden', transition: 'border-color 0.15s' }),
    oppHeader: { padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' },
    scoreBadge: (score) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, fontSize: 14, fontWeight: 700, flexShrink: 0, ...scoreColor(score) }),
    btn: (v) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: v === 'primary' ? 'var(--accent)' : 'var(--bg3)', color: v === 'primary' ? '#FFFFFF' : 'var(--text2)' }),
    chatWrap: { borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--bg)' },
    chatMsgs: { maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 },
    msgStyle: (role) => ({ padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, maxWidth: '85%', whiteSpace: 'pre-wrap', alignSelf: role === 'user' ? 'flex-end' : 'flex-start', background: role === 'user' ? 'var(--accent)' : 'var(--bg3)', color: role === 'user' ? '#FFFFFF' : 'var(--text)', border: role === 'user' ? 'none' : '1px solid var(--border)' }),
  };

  // Deadline urgency helper
  const deadlineUrgency = (deadline) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (days < 0) return { label: 'Expired', color: 'var(--text3)', bg: 'var(--bg3)' };
    if (days <= 3) return { label: `${days}d left`, color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)' };
    if (days <= 7) return { label: `${days}d left`, color: 'var(--warning)', bg: 'var(--warning-bg)' };
    if (days <= 14) return { label: `${days}d left`, color: 'var(--accent2)', bg: 'var(--accent-bg)' };
    return { label: new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--text3)', bg: 'var(--bg3)' };
  };

  // Stats for tracked tab
  const highFit = opps.filter(o => o.fit_score >= 70).length;
  const pursuing = opps.filter(o => ['pursuing', 'teaming', 'submitted'].includes(o.status)).length;
  const closingSoon = opps.filter(o => {
    if (!o.response_deadline) return false;
    const days = Math.ceil((new Date(o.response_deadline) - new Date()) / 86400000);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <Layout>
      <div style={s.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={s.heading}>Opportunities</div>
            <div style={{ color: 'var(--text2)', fontSize: 13 }}>Live federal contract opportunities scored against your profile</div>
          </div>
          {tab === 'tracked' && opps.length > 0 && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{highFit}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>High Fit</div>
              </div>
              <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{pursuing}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Pursuing</div>
              </div>
              {closingSoon > 0 && (
                <>
                  <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{closingSoon}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Due 7d</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={s.tabs}>
          {[
            { key: 'tracked', label: `Tracked (${opps.length})` },
            { key: 'saved', label: `Saved (${savedOpps.length})` },
            { key: 'search', label: '🔍 New Search' },
            ...(searchResults.length ? [{ key: 'results', label: `Results (${searchResults.length})` }] : []),
          ].map(t => (
            <button key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Search form */}
        {tab === 'search' && (
          <div style={s.searchCard}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: '1.25rem' }}>Search SAM.gov — Live Opportunities</div>
            {lastSearched && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }}>
                Last searched: {new Date(lastSearched).toLocaleTimeString()}
              </div>
            )}
            <div style={s.row2}>
              <div>
                <label style={s.label}>NAICS Codes</label>
                <input value={searchForm.naics_codes} onChange={e => setSearchForm(f => ({ ...f, naics_codes: e.target.value }))} placeholder="541512, 541511" />
              </div>
              <div>
                <label style={s.label}>Keywords</label>
                <input value={searchForm.keywords} onChange={e => setSearchForm(f => ({ ...f, keywords: e.target.value }))} placeholder="cybersecurity, cloud, DevSecOps" />
              </div>
              <div>
                <label style={s.label}>Agency</label>
                <input value={searchForm.agency} onChange={e => setSearchForm(f => ({ ...f, agency: e.target.value }))} placeholder="Department of Defense" />
              </div>
              <div>
                <label style={s.label}>Set-Aside</label>
                <select value={searchForm.set_aside} onChange={e => setSearchForm(f => ({ ...f, set_aside: e.target.value }))}>
                  {SET_ASIDES.map(s => <option key={s} value={s}>{s === 'all' ? 'All types' : s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={searchForm.save_search} onChange={e => setSearchForm(f => ({ ...f, save_search: e.target.checked }))} style={{ width: 'auto' }} />
                Save this search
              </label>
              {searchForm.save_search && (
                <input value={searchForm.search_name} onChange={e => setSearchForm(f => ({ ...f, search_name: e.target.value }))}
                  placeholder="Search name (e.g. DoD Cyber Q2)" style={{ flex: 1, fontSize: 13 }} />
              )}
            </div>
            <button style={{ ...s.btn('primary'), padding: '10px 24px', fontSize: 13 }} onClick={search} disabled={searching}>
              {searching ? '🔍 Searching SAM.gov...' : '🔍 Search live opportunities'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: '1rem', textAlign: 'center' }}>
              ⌘K to navigate
            </div>
          </div>
        )}

        {/* Auto-Search Section for Tracked Tab */}
        {tab === 'tracked' && autoSearchConfigs.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤖 Saved Searches</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {autoSearchConfigs.map(config => (
                <div key={config.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{config.search_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {config.naics_codes && `NAICS: ${config.naics_codes}`}
                      {config.keywords && ` · Keywords: ${config.keywords}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {config.auto_frequency && (
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {config.auto_frequency}ly
                      </div>
                    )}
                    <select
                      value={config.auto_frequency ? config.auto_frequency : ''}
                      onChange={e => {
                        if (e.target.value) {
                          toggleAutoSearch(config.id, e.target.value);
                        } else {
                          toggleAutoSearch(config.id, null);
                        }
                      }}
                      disabled={loadingAutoSearch}
                      style={{ fontSize: 11, padding: '4px 8px', width: 'auto', minWidth: 100, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)' }}
                    >
                      <option value="">Disable auto-search</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <button
                      onClick={() => runAutoSearch(config.id)}
                      disabled={loadingAutoSearch}
                      style={{ fontSize: 11, padding: '4px 12px', background: 'var(--accent)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {loadingAutoSearch ? '...' : 'Run'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters for tracked */}
        {(tab === 'tracked' || tab === 'results') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', width: 'auto', minWidth: 140 }}>
              <option value="all">All fit scores</option>
              <option value="high">High fit (70+)</option>
              <option value="mid">Mid fit (40-69)</option>
              <option value="low">Low / unscored</option>
            </select>
            {tab === 'tracked' && (
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', width: 'auto', minWidth: 140 }}>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            )}
            <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>{displayOpps.length} results</span>
            {tab === 'tracked' && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={refreshFromSam} disabled={refreshing}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius)', cursor: refreshing ? 'wait' : 'pointer', border: 'none', background: 'var(--accent)', color: '#FFFFFF', opacity: refreshing ? 0.7 : 1 }}>
                  {refreshing ? 'Refreshing...' : 'Refresh from SAM.gov'}
                </button>
                <button onClick={exportCSV} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)' }}>
                  Export CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* Opportunity cards */}
        {tab !== 'search' && displayOpps.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text2)' }}>
            {tab === 'tracked' && 'No opportunities tracked yet — run a search to get started'}
            {tab === 'saved' && 'No saved opportunities yet — star opportunities to save them'}
            {tab === 'results' && (
              <div>
                {samError ? (
                  <>
                    <div style={{ fontSize: 15, marginBottom: 8, color: 'var(--danger)' }}>SAM.gov API Error</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>{samError}</div>
                    <a href="https://sam.gov/alerts" target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: 'var(--accent2)' }}>Check SAM.gov System Alerts →</a>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 15, marginBottom: 8 }}>No results found on SAM.gov</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                      Try broadening your search — use fewer keywords, remove agency filters, or try different NAICS codes.
                      {!searchForm.naics_codes && !searchForm.keywords && ' Enter at least a NAICS code or keyword to search.'}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab !== 'search' && displayOpps.map(opp => (
          <div key={opp.id || opp.sam_notice_id} style={s.oppCard(expanded === (opp.id || opp.sam_notice_id))}>
            <div style={s.oppHeader} onClick={() => {
              // If opportunity has an ID, open drawer; otherwise expand inline
              if (opp.id) {
                openDrawer(opp.id);
              } else {
                setExpanded(prev => prev === (opp.id || opp.sam_notice_id) ? null : (opp.id || opp.sam_notice_id));
              }
            }}>
              <div style={s.scoreBadge(opp.fit_score)}>{opp.fit_score || '—'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{opp.title}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)', alignItems: 'center' }}>
                  <span>{opp.agency}</span>
                  {opp.naics_code && <span style={{ color: 'var(--text3)' }}>NAICS {opp.naics_code}</span>}
                  {opp.set_aside && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: 'var(--accent-bg)', color: 'var(--accent2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{opp.set_aside}</span>}
                  {opp.response_deadline && (() => {
                    const urg = deadlineUrgency(opp.response_deadline);
                    return urg && (
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: urg.bg, color: urg.color }}>
                        {urg.label}
                      </span>
                    );
                  })()}
                </div>
                {opp.fit_reason && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{opp.fit_reason}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {opp.id && (
                  <select value={opp.status || 'new'} onChange={e => { e.stopPropagation(); updateStatus(opp.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, padding: '4px 8px', width: 'auto', color: STATUS_COLORS[opp.status] || 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                )}
                {opp.id && (
                  <button style={{ ...s.btn(), fontSize: 11, padding: '4px 8px', color: savedMap[opp.id] ? 'var(--warning)' : 'var(--text3)' }}
                    onClick={e => { e.stopPropagation(); toggleSaveOpp(opp.id); }}
                    title={savedMap[opp.id] ? 'Remove from saved' : 'Save opportunity'}>
                    {savedMap[opp.id] ? '★' : '☆'}
                  </button>
                )}
                {(() => {
                  // Real SAM.gov notice IDs are 32-char hex strings
                  const hasValidUrl = opp.opportunity_url && /\/opp\/[a-f0-9]{20,}\/view/.test(opp.opportunity_url);
                  const searchUrl = opp.solicitation_number
                    ? `https://sam.gov/search/?keywords=${encodeURIComponent(opp.solicitation_number)}&sort=-modifiedDate&index=opp`
                    : opp.title ? `https://sam.gov/search/?keywords=${encodeURIComponent(opp.title.substring(0, 80))}&sort=-modifiedDate&index=opp` : null;
                  const url = hasValidUrl ? opp.opportunity_url : searchUrl;
                  return url && (
                    <a href={url} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--accent2)', whiteSpace: 'nowrap' }}>
                      {hasValidUrl ? 'View on SAM.gov ↗' : 'Search SAM.gov ↗'}
                    </a>
                  );
                })()}
                {opp.id && (
                  <button style={{ ...s.btn(), fontSize: 11, padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
                    onClick={e => { e.stopPropagation(); deleteOpp(opp.id); }}>✕</button>
                )}
              </div>
            </div>

            {expanded === (opp.id || opp.sam_notice_id) && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '1.25rem', background: 'var(--bg2)' }}>
                {/* Fit Analysis Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Fit Analysis</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(opp.fit_score).color }}>{opp.fit_score || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>Fit Score</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: opp.naics_code ? 'var(--accent2)' : 'var(--text3)' }}>{opp.naics_code || 'N/A'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>NAICS Match</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: opp.set_aside ? 'var(--success)' : 'var(--text3)' }}>{opp.set_aside ? 'Restricted' : 'Full & Open'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>Competition</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      {(() => {
                        const days = opp.response_deadline ? Math.ceil((new Date(opp.response_deadline) - new Date()) / 86400000) : null;
                        return <>
                          <div style={{ fontSize: 14, fontWeight: 600, color: days !== null && days <= 7 ? 'var(--danger)' : days !== null && days <= 14 ? 'var(--warning)' : 'var(--text2)' }}>
                            {days !== null ? (days < 0 ? 'Expired' : `${days}d`) : 'N/A'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>Timeline</div>
                        </>;
                      })()}
                    </div>
                  </div>
                  {(opp.fit_reason || opp.fit_score) && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                      {opp.fit_reason || (opp.fit_score >= 70 ? 'Strong alignment with your company profile, NAICS codes, and capabilities.' : opp.fit_score >= 40 ? 'Moderate alignment — review requirements to determine fit.' : 'Low alignment with current profile. May require teaming.')}
                    </div>
                  )}
                </div>

                {/* Description */}
                {opp.description && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.7 }}>{opp.description}</div>
                )}

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Place of Performance', val: opp.place_of_performance },
                    { label: 'Solicitation #', val: opp.solicitation_number },
                    { label: 'Set-Aside', val: opp.set_aside },
                    { label: 'Point of Contact', val: opp.primary_contact_name ? `${opp.primary_contact_name}${opp.primary_contact_email ? ` · ${opp.primary_contact_email}` : ''}` : null },
                    { label: 'Response Deadline', val: opp.response_deadline ? new Date(opp.response_deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null },
                    { label: 'Agency', val: opp.agency },
                  ].filter(x => x.val).map(x => (
                    <div key={x.label}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{x.label}</div>
                      <div style={{ fontSize: 13 }}>{x.val}</div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  {opp.id && (
                    <button onClick={() => toggleSaveOpp(opp.id)}
                      style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: savedMap[opp.id] ? 'var(--warning-bg)' : 'var(--bg)', color: savedMap[opp.id] ? 'var(--warning)' : 'var(--text2)', cursor: 'pointer' }}>
                      {savedMap[opp.id] ? '★ Saved' : '☆ Save'}
                    </button>
                  )}
                  {opp.id && STATUS_OPTIONS.filter(st => ['new','pursuing','won','lost'].includes(st)).map(st => (
                    <button key={st} onClick={() => updateStatus(opp.id, st)}
                      style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer',
                        border: `1px solid ${opp.status === st ? STATUS_COLORS[st] : 'var(--border)'}`,
                        background: opp.status === st ? STATUS_COLORS[st] : 'var(--bg)',
                        color: opp.status === st ? '#fff' : 'var(--text2)',
                      }}>
                      {st.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                    </button>
                  ))}
                  <button onClick={() => setNoteOpen(noteOpen === opp.id ? null : opp.id)}
                    style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer' }}>
                    📝 Notes
                  </button>
                  <button onClick={() => generateProposal(opp.id)}
                    disabled={proposalLoading === opp.id}
                    style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    {proposalLoading === opp.id ? '⏳ Generating...' : '📋 Proposal Outline'}
                  </button>
                </div>

                {/* Notes */}
                {noteOpen === opp.id && (
                  <div style={{ marginBottom: '1.25rem', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    {(oppNotes[opp.id] || []).map((n, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '4px 0', borderBottom: i < (oppNotes[opp.id] || []).length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{new Date(n.date).toLocaleDateString()}</span> — {n.text}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add a note..."
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
                        onKeyDown={e => e.key === 'Enter' && saveOppNote(opp.id)} />
                      <button onClick={() => saveOppNote(opp.id)}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Save</button>
                    </div>
                  </div>
                )}

                {/* Proposal Outline Result */}
                {proposalResult[opp.id] && (
                  <div style={{ marginBottom: '1.25rem', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>📋 Proposal Outline</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposalResult[opp.id]}</div>
                  </div>
                )}

                {/* Related Primes */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Potential Teaming Partners</div>
                  {!primesLoaded ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading primes...</div>
                  ) : primes.length === 0 ? (
                    <div style={{ padding: '12px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                      No primes tracked yet — add primes in the Prime Tracker
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {primes.slice(0, 6).map(p => (
                        <div key={p.id} style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent2)', flexShrink: 0 }}>
                            {(p.company_name || p.name || '?')[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company_name || p.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.naics_codes || p.status || 'Prime'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SAM.gov Link */}
                {(() => {
                  const hasValidUrl = opp.opportunity_url && /\/opp\/[a-f0-9]{20,}\/view/.test(opp.opportunity_url);
                  const searchUrl = opp.solicitation_number
                    ? `https://sam.gov/search/?keywords=${encodeURIComponent(opp.solicitation_number)}&sort=-modifiedDate&index=opp`
                    : opp.title ? `https://sam.gov/search/?keywords=${encodeURIComponent(opp.title.substring(0, 80))}&sort=-modifiedDate&index=opp` : null;
                  const url = hasValidUrl ? opp.opportunity_url : searchUrl;
                  return url && (
                    <a href={url} target="_blank" rel="noreferrer"
                      style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--accent)', color: 'var(--accent2)', textDecoration: 'none', marginBottom: '1.25rem' }}>
                      {hasValidUrl ? '🔗 View Full Listing on SAM.gov ↗' : '🔍 Search on SAM.gov ↗'}
                    </a>
                  );
                })()}

                {/* AI Coach */}
                {opp.id && (
                  <>
                    <button style={{ ...s.btn(), fontSize: 12 }}
                      onClick={() => { setChatOpen(chatOpen === opp.id ? null : opp.id); setChatMessages([]); }}>
                      {chatOpen === opp.id ? '✕ Close AI Coach' : '💬 Ask AI Coach'}
                    </button>

                    {chatOpen === opp.id && (
                      <div style={s.chatWrap}>
                        <div style={s.chatMsgs}>
                          {chatMessages.length === 0 && (
                            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ask about teaming strategy, how to respond, who to partner with...</div>
                          )}
                          {chatMessages.map((m, i) => <div key={i} style={s.msgStyle(m.role)}>{m.content}</div>)}
                          {chatLoading && <div style={{ ...s.msgStyle('assistant'), opacity: 0.6 }}>Thinking...</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                            placeholder="Who should I team with for this? How should I respond?..."
                            style={{ flex: 1, fontSize: 13 }}
                            onKeyDown={e => e.key === 'Enter' && sendChat(opp.id)} />
                          <button style={{ ...s.btn('primary'), padding: '8px 16px' }} onClick={() => sendChat(opp.id)} disabled={chatLoading}>Send</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Opportunity Detail Drawer */}
        {drawerOpen && drawerData && (
          <OpportunityDetailDrawer
            opp={drawerData.opportunity}
            linkedLeads={drawerData.linked_leads}
            recentActivity={drawerData.recent_activity}
            winProbability={drawerData.win_probability}
            notes={oppNotes[drawerOpen] || []}
            onAddNote={addDrawerNote}
            onClose={() => setDrawerOpen(null)}
            addToast={addToast}
          />
        )}
      </div>
    </Layout>
  );
}
