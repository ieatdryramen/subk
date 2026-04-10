import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const OUTREACH_STATUSES = ['not_contacted', 'contacted', 'responded', 'meeting_set', 'teaming_agreement'];
const STATUS_COLORS = {
  not_contacted: 'var(--text3)', contacted: 'var(--accent2)', responded: 'var(--warning)',
  meeting_set: 'var(--success)', teaming_agreement: 'var(--gold)',
};

const KANBAN_STAGES = [
  { key: 'not_contacted', label: 'Not Contacted', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'contacted', label: 'Contacted', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'responded', label: 'Responded', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'meeting_set', label: 'Meeting Set', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'teaming_agreement', label: 'Teaming Agreement', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
];

const TOUCHPOINT_ICONS = { email1: '✉', email2: '✉', email3: '✉', linkedin_connect: '🔗', linkedin_dm: '💬', call: '📞', breakup: '✉' };

const scoreColor = (score) => {
  if (!score) return { color: 'var(--text3)', bg: 'var(--bg3)' };
  if (score >= 70) return { color: 'var(--success)', bg: 'var(--success-bg)' };
  if (score >= 40) return { color: 'var(--warning)', bg: 'var(--warning-bg)' };
  return { color: 'var(--text3)', bg: 'var(--bg3)' };
};

const formatMoney = (n) => {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};

const PrimeDetailPanel = ({ prime, onClose, onPrimeUpdated, orgNaics }) => {
  const { addToast } = useToast();
  const [panelVisible, setPanelVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [sequence, setSequence] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [outreachTimeline, setOutreachTimeline] = useState([]);
  const [capabilityScore, setCapabilityScore] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setPanelVisible(true));
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!prime) return;
    loadSequence();
    loadNotes();
    calculateCapabilityMatch();
  }, [prime?.id]);

  const loadSequence = async () => {
    try {
      const r = await api.get(`/primes/${prime.id}/sequence`);
      setSequence(Array.isArray(r.data) ? r.data : []);
    } catch {
      setSequence([]);
    }
  };

  const loadNotes = async () => {
    try {
      const r = await api.get(`/primes/${prime.id}/notes`);
      setNotes(Array.isArray(r.data) ? r.data : []);
    } catch {
      setNotes([]);
    }
  };

  const calculateCapabilityMatch = () => {
    if (!prime.naics_codes || !orgNaics) {
      setCapabilityScore(0);
      return;
    }
    const primeNaics = prime.naics_codes.split(',').map(n => n.trim());
    const orgNaicsArr = orgNaics.split(',').map(n => n.trim());
    const overlap = primeNaics.filter(n => orgNaicsArr.includes(n)).length;
    const score = primeNaics.length > 0 ? Math.round((overlap / primeNaics.length) * 100) : 0;
    setCapabilityScore(score);
  };

  const handleClose = () => {
    setPanelVisible(false);
    setTimeout(onClose, 200);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/primes/${prime.id}/notes`, { content: noteText });
      setNoteText('');
      addToast('Note added', 'success');
      await loadNotes();
    } catch {
      addToast('Failed to add note', 'error');
    }
  };

  const updatePrimeStatus = async (status) => {
    try {
      await api.put(`/primes/${prime.id}`, { outreach_status: status });
      onPrimeUpdated({ ...prime, outreach_status: status });
      addToast('Status updated', 'success');
    } catch {
      addToast('Failed to update status', 'error');
    }
  };

  const generateOutreach = async () => {
    setGenerating(true);
    try {
      const r = await api.post(`/primes/${prime.id}/generate`);
      onPrimeUpdated(r.data);
      addToast('Outreach generated', 'success');
    } catch {
      addToast('Generation failed — complete your profile first', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const startSequence = async () => {
    try {
      await api.post(`/primes/${prime.id}/start-sequence`);
      addToast('Sequence started', 'success');
      await loadSequence();
    } catch {
      addToast('Failed to start sequence', 'error');
    }
  };

  const markTouchpointDone = async (touchpoint) => {
    try {
      await api.post(`/primes/${prime.id}/complete-touchpoint`, { touchpoint });
      await loadSequence();
      addToast('Touchpoint marked', 'success');
    } catch {
      addToast('Failed to update touchpoint', 'error');
    }
  };

  const capabilityColor = capabilityScore >= 70 ? 'var(--success)' : capabilityScore >= 40 ? 'var(--warning)' : 'var(--text3)';

  const inputStyle = { width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)' };

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        opacity: panelVisible ? 1 : 0, transition: 'opacity 0.2s',
        pointerEvents: panelVisible ? 'auto' : 'none',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)', zIndex: 201, overflowY: 'auto',
        transform: panelVisible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{prime.company_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{prime.agency_focus || 'Federal'} • {formatMoney(prime.total_awards_value)} awarded</div>
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
          {/* Capability Match Badge */}
          {prime.naics_codes && (
            <div style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12, color: capabilityColor, fontWeight: 600, marginBottom: 12 }}>
              Capability Match: {capabilityScore}%
            </div>
          )}
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { key: 'info', label: '📋 Info' },
              { key: 'timeline', label: '📅 Timeline' },
              { key: 'notes', label: '📝 Notes' },
            ].map(t => (
              <button key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)',
                  background: activeTab === t.key ? 'var(--accent)' : 'var(--bg3)',
                  color: activeTab === t.key ? '#fff' : 'var(--text2)',
                  border: activeTab === t.key ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Company Info */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company Info</div>
                {prime.cage_code && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>CAGE Code</div>
                    <div>{prime.cage_code}</div>
                  </div>
                )}
                {prime.uei && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>UEI</div>
                    <div>{prime.uei}</div>
                  </div>
                )}
                {prime.naics_codes && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>NAICS Codes</div>
                    <div>{prime.naics_codes}</div>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Contact</div>
                {prime.contact_name && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>Name</div>
                    <div>{prime.contact_name}</div>
                  </div>
                )}
                {prime.contact_email && (
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>Email</div>
                    <div style={{ wordBreak: 'break-all' }}>{prime.contact_email}</div>
                  </div>
                )}
                {prime.contact_title && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>Title</div>
                    <div>{prime.contact_title}</div>
                  </div>
                )}
              </div>

              {/* Status & Actions */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</div>
                <select value={prime.outreach_status || 'not_contacted'} onChange={e => updatePrimeStatus(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}>
                  {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>

                {!prime.email1 ? (
                  <button onClick={generateOutreach} disabled={generating}
                    style={{
                      width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
                      background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                    }}>
                    {generating ? '⚡ Generating...' : '⚡ Generate Outreach'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {prime.outreach_status === 'not_contacted' && (
                      <button onClick={startSequence}
                        style={{
                          flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
                          background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)',
                          cursor: 'pointer',
                        }}>
                        Start Sequence
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Outreach Timeline</div>
              {sequence.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>
                  {!prime.email1 ? 'Generate outreach to see timeline' : 'No touchpoints yet'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sequence.map(tp => (
                    <div key={tp.id} style={{
                      padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                      background: tp.status === 'done' ? 'var(--success-bg)' : 'var(--bg3)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: tp.status === 'done' ? 'var(--success)' : 'var(--text)' }}>
                            {tp.touchpoint.replace(/_/g, ' ')}
                          </div>
                          {tp.completed_at && (
                            <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                              ✓ {new Date(tp.completed_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {tp.status !== 'done' && (
                          <button onClick={() => markTouchpointDone(tp.touchpoint)}
                            style={{
                              padding: '4px 8px', fontSize: 11, borderRadius: 'var(--radius)',
                              background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)',
                              cursor: 'pointer',
                            }}>
                            Mark Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notes</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addNote}
                  style={{
                    padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
                    background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>
                  Add
                </button>
              </div>
              {notes.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>No notes yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notes.map(note => (
                    <div key={note.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)' }}>
                      <div style={{ fontSize: 13 }}>{note.content}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        {note.full_name} • {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default function PrimesPage() {
  const { addToast } = useToast();
  const [primes, setPrimes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState('primes');
  const [expanded, setExpanded] = useState(null);
  const [loadingPrimes, setLoadingPrimes] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [searchForm, setSearchForm] = useState({ naics_codes: '', agency: '' });
  const [draggedPrime, setDraggedPrime] = useState(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [generating, setGenerating] = useState({});
  const [orgNaics, setOrgNaics] = useState('');

  useEffect(() => {
    loadPrimes();
    loadOrgNaics();
  }, []);

  const loadPrimes = async () => {
    setLoadingPrimes(true);
    try {
      const r = await api.get('/subk-primes');
      setPrimes(Array.isArray(r.data) ? r.data : []);
    } catch {
      setPrimes([]);
    } finally {
      setLoadingPrimes(false);
    }
  };

  const loadOrgNaics = async () => {
    try {
      const r = await api.get('/sub-profile');
      if (r.data?.naics_codes) {
        setOrgNaics(r.data.naics_codes);
      }
    } catch {
      // Silently fail
    }
  };

  const searchPrimes = async () => {
    setSearching(true);
    try {
      const r = await api.post('/subk-primes/search', searchForm);
      const results = Array.isArray(r.data) ? r.data : [];
      setSearchResults(results);
      if (results.length > 0) {
        setTab('results');
        addToast(`Found ${results.length} prime awardees`, 'success');
      } else {
        addToast('No prime awardees found — try different NAICS codes', 'success');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const trackPrime = async (prime) => {
    try {
      const r = await api.post('/subk-primes', prime);
      setPrimes(p => [r.data, ...p]);
      setTab('primes');
      addToast('Prime added to tracker', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add prime', 'error');
    }
  };

  const bulkImportPrimes = async () => {
    if (!bulkImportText.trim()) return;
    setBulkImporting(true);
    const names = bulkImportText.split('\n').filter(n => n.trim()).slice(0, 10);
    try {
      for (const name of names) {
        try {
          const r = await api.post('/subk-primes', {
            company_name: name.trim(),
            uei: '',
            cage_code: '',
            website: '',
            naics_codes: '',
          });
          setPrimes(p => [r.data, ...p]);
        } catch {
          // Continue with next
        }
      }
      addToast(`Imported ${names.length} primes`, 'success');
      setBulkImportText('');
    } catch {
      addToast('Bulk import failed', 'error');
    } finally {
      setBulkImporting(false);
    }
  };

  const deletePrime = async (id) => {
    if (!confirm('Remove this prime?')) return;
    try {
      await api.delete(`/primes/${id}`);
      setPrimes(ps => ps.filter(p => p.id !== id));
      if (expanded === id) setExpanded(null);
      addToast('Prime removed', 'success');
    } catch {
      addToast('Failed to remove prime', 'error');
    }
  };

  const handleDragStart = (prime) => {
    setDraggedPrime(prime);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropOnStage = async (stageKey) => {
    if (!draggedPrime) return;
    try {
      await api.put(`/primes/${draggedPrime.id}`, { outreach_status: stageKey });
      setPrimes(ps => ps.map(p => p.id === draggedPrime.id ? { ...p, outreach_status: stageKey } : p));
      addToast('Prime moved', 'success');
    } catch {
      addToast('Failed to move prime', 'error');
    } finally {
      setDraggedPrime(null);
    }
  };

  const exportCSV = async () => {
    try {
      const r = await api.get('/subk-primes/export/csv', { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'subk-primes.csv';
      a.click();
      addToast('CSV exported', 'success');
    } catch {
      addToast('Export failed', 'error');
    }
  };

  const filteredPrimes = primes.filter(p => {
    const statusMatch = statusFilter === 'all' || p.outreach_status === statusFilter;
    const nameMatch = !searchQ || p.company_name?.toLowerCase().includes(searchQ.toLowerCase());
    return statusMatch && nameMatch;
  });

  const displayPrimes = tab === 'results' ? searchResults : filteredPrimes;

  // Helper to normalize outreach_status to a valid kanban stage key
  const getKanbanStage = (prime) => {
    const status = prime.outreach_status || 'not_contacted';
    return KANBAN_STAGES.some(s => s.key === status) ? status : 'not_contacted';
  };

  // Calculate stats
  const stats = {
    total: filteredPrimes.length,
    contacted: filteredPrimes.filter(p => p.outreach_status === 'contacted').length,
    responded: filteredPrimes.filter(p => p.outreach_status === 'responded').length,
    meetings: filteredPrimes.filter(p => p.outreach_status === 'meeting_set').length,
    teaming: filteredPrimes.filter(p => p.outreach_status === 'teaming_agreement').length,
  };

  const contactedPct = stats.total > 0 ? Math.round((stats.contacted / stats.total) * 100) : 0;
  const responseRate = stats.contacted > 0 ? Math.round((stats.responded / stats.contacted) * 100) : 0;

  const s = {
    page: { padding: '2rem 2.5rem' },
    heading: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
    sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
    tabs: { display: 'flex', gap: 6, marginBottom: '1.5rem' },
    tabBtn: (active) => ({ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)', border: active ? 'none' : '1px solid var(--border)' }),
    statBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', background: 'var(--bg3)', borderRadius: 'var(--radius)', minWidth: 110 },
    card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 8 },
    kanbanCol: { flex: 1, minWidth: 280, background: 'var(--bg3)', borderRadius: 'var(--radius-lg)', padding: 12, minHeight: 500 },
  };

  return (
    <Layout>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .kanban-card {
          cursor: grab;
          transition: box-shadow 0.2s;
        }
        .kanban-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .kanban-card:active {
          cursor: grabbing;
        }
      `}</style>

      {expanded && <PrimeDetailPanel prime={primes.find(p => p.id === expanded)} onClose={() => setExpanded(null)} onPrimeUpdated={(updated) => setPrimes(ps => ps.map(p => p.id === updated.id ? updated : p))} orgNaics={orgNaics} />}

      <div style={s.page}>
        <div style={s.heading}>Prime Tracker</div>
        <div style={s.sub}>Track federal prime contractors and manage outreach</div>

        {/* Main tabs */}
        <div style={s.tabs}>
          {[
            { key: 'primes', label: `📊 Dashboard (${primes.length})` },
            { key: 'search', label: '🔍 Find Primes' },
            ...(searchResults.length ? [{ key: 'results', label: `Results (${searchResults.length})` }] : []),
          ].map(t => (
            <button key={t.key} style={s.tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Search tab */}
        {tab === 'search' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Find Prime Awardees from USASpending.gov</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>NAICS Codes</label>
                <input value={searchForm.naics_codes} onChange={e => setSearchForm(f => ({ ...f, naics_codes: e.target.value }))} placeholder="541512, 541511" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Agency Focus</label>
                <input value={searchForm.agency} onChange={e => setSearchForm(f => ({ ...f, agency: e.target.value }))} placeholder="Department of Defense" />
              </div>
            </div>
            <button onClick={searchPrimes} disabled={searching}
              style={{ padding: '10px 24px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' }}>
              {searching ? 'Searching USASpending...' : '🔍 Find prime awardees'}
            </button>

            {/* Bulk Import */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Or Bulk Import by Company Name</div>
              <textarea value={bulkImportText} onChange={e => setBulkImportText(e.target.value)}
                placeholder="Paste company names (one per line, max 10)..."
                style={{ width: '100%', height: 120, padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', fontSize: 12 }} />
              <button onClick={bulkImportPrimes} disabled={bulkImporting}
                style={{ marginTop: 12, padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' }}>
                {bulkImporting ? 'Importing...' : '📥 Import'}
              </button>
            </div>
          </div>
        )}

        {/* Search results */}
        {tab === 'results' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add primes to track</div>
            {searchResults.map((prime, i) => (
              <div key={i} style={{ ...s.card, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{prime.company_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12 }}>
                    <span>{prime.agency_focus}</span>
                    <span>{formatMoney(prime.total_awards_value)} awarded</span>
                  </div>
                </div>
                <button onClick={() => trackPrime(prime)}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                  + Track
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dashboard tab */}
        {tab === 'primes' && (
          <>
            {/* Stats Bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={s.statBox}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{stats.total}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Total Primes</div>
                </div>
                <div style={s.statBox}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{contactedPct}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Contacted</div>
                </div>
                <div style={s.statBox}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{responseRate}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Response Rate</div>
                </div>
                <div style={s.statBox}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{stats.meetings}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Meetings</div>
                </div>
                <div style={s.statBox}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{stats.teaming}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Teaming</div>
                </div>
              </div>
              <button onClick={exportCSV}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)' }}>
                📥 Export CSV
              </button>
            </div>

            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
              <button onClick={() => setViewMode('list')}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent)' : 'var(--bg2)', color: viewMode === 'list' ? '#fff' : 'var(--text2)', border: viewMode === 'list' ? 'none' : '1px solid var(--border)' }}>
                📋 List
              </button>
              <button onClick={() => setViewMode('kanban')}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--accent)' : 'var(--bg2)', color: viewMode === 'kanban' ? '#fff' : 'var(--text2)', border: viewMode === 'kanban' ? 'none' : '1px solid var(--border)' }}>
                🎯 Kanban
              </button>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name..." style={{ flex: 1, fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)' }} />
              {viewMode === 'list' && (
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ fontSize: 13, padding: '8px 12px', width: 'auto', minWidth: 160, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>
                  <option value="all">All statuses</option>
                  {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
            </div>

            {loadingPrimes ? (
              <div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ ...s.card, padding: '1rem 1.25rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', height: 10, width: '60%', marginBottom: 10 }} />
                      <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', height: 10, width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayPrimes.length === 0 ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>No primes to show</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                  {searchQ ? 'No primes match your search' : 'Use Find Primes to discover prime contractors in your NAICS codes'}
                </div>
                <button onClick={() => setTab('search')}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' }}>
                  🔍 Find Primes
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <div>
                {displayPrimes.map(prime => (
                  <div key={prime.id} style={s.card} onClick={() => setExpanded(prime.id)}>
                    <div style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏢</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{prime.company_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span>{prime.agency_focus || 'Federal'}</span>
                          <span>{formatMoney(prime.total_awards_value)} awarded</span>
                          {prime.naics_codes && <span>NAICS {prime.naics_codes}</span>}
                        </div>
                        {prime.contact_name && <div style={{ fontSize: 11, color: 'var(--text3)' }}>POC: {prime.contact_name}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {prime.fit_score && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, ...scoreColor(prime.fit_score) }}>{prime.fit_score}</span>}
                        <select value={prime.outreach_status || 'not_contacted'} onChange={e => { e.stopPropagation(); api.put(`/primes/${prime.id}`, { outreach_status: e.target.value }).then(() => setPrimes(ps => ps.map(p => p.id === prime.id ? { ...p, outreach_status: e.target.value } : p))); }}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, padding: '4px 8px', width: 'auto', color: STATUS_COLORS[prime.outreach_status] || 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button style={{ fontSize: 11, padding: '5px 8px', borderRadius: 'var(--radius)', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--danger)', cursor: 'pointer' }}
                          onClick={e => { e.stopPropagation(); deletePrime(prime.id); }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Kanban view */
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
                {KANBAN_STAGES.map(stage => (
                  <div key={stage.key} style={s.kanbanCol} onDragOver={handleDragOver} onDrop={() => handleDropOnStage(stage.key)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: stage.color, marginBottom: 12 }}>
                      {stage.label} ({displayPrimes.filter(p => getKanbanStage(p) === stage.key).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {displayPrimes.filter(p => getKanbanStage(p) === stage.key).map(prime => (
                        <div key={prime.id}
                          draggable onDragStart={() => handleDragStart(prime)}
                          onClick={() => setExpanded(prime.id)}
                          className="kanban-card"
                          style={{
                            padding: '12px', borderRadius: 'var(--radius)', background: 'var(--bg2)', border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{prime.company_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{formatMoney(prime.total_awards_value)}</div>
                          {prime.contact_name && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>POC: {prime.contact_name}</div>}
                          {prime.fit_score && <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, ...scoreColor(prime.fit_score) }}>{prime.fit_score}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
