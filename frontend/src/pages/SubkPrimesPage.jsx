import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const OUTREACH_STATUSES = ['not_contacted', 'in_sequence', 'responded', 'meeting_set', 'teaming_agreement', 'sequence_complete', 'no_interest'];
const STATUS_COLORS = {
  not_contacted: 'var(--text3)', in_sequence: 'var(--accent2)', responded: 'var(--warning)',
  meeting_set: 'var(--success)', teaming_agreement: 'var(--gold)', sequence_complete: 'var(--text3)', no_interest: 'var(--danger)',
};

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

function PrimesToast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '12px 20px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <span>{message}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
      </div>
    </div>
  );
}

export default function PrimesPage() {
  const [primes, setPrimes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState('tracked');
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState({});
  const [generating, setGenerating] = useState({});
  const [sequence, setSequence] = useState({});
  const [notes, setNotes] = useState({});
  const [noteInput, setNoteInput] = useState({});
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState({});
  const [chatLoading, setChatLoading] = useState({});
  const [searchForm, setSearchForm] = useState({ naics_codes: '', agency: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState({});

  useEffect(() => {
    api.get('/subk-primes').then(r => setPrimes(r.data)).catch(() => {});
  }, []);

  const loadSequence = async (primeId) => {
    try {
      const r = await api.get(`/primes/${primeId}/outreach`);
      setSequence(s => ({ ...s, [primeId]: Array.isArray(r.data) ? r.data : [] }));
    } catch { setSequence(s => ({ ...s, [primeId]: [] })); }
  };

  const loadNotes = async (primeId) => {
    try {
      const r = await api.get(`/primes/${primeId}/notes`);
      setNotes(n => ({ ...n, [primeId]: Array.isArray(r.data) ? r.data : [] }));
    } catch { setNotes(n => ({ ...n, [primeId]: [] })); }
  };

  const expandPrime = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setActiveSubTab(t => ({ ...t, [id]: 'outreach' }));
    await Promise.all([loadSequence(id), loadNotes(id)]);
  };

  const searchPrimes = async () => {
    setSearching(true);
    try {
      const r = await api.post('/subk-primes/search', searchForm);
      setSearchResults(r.data);
      setTab('results');
    } catch (err) {
      setToast(err.response?.data?.error || 'Search failed');
    } finally { setSearching(false); }
  };

  const trackPrime = async (prime) => {
    try {
      const r = await api.post('/subk-primes', prime);
      setPrimes(p => [r.data, ...p]);
      setTab('tracked');
    } catch (err) {
      setToast(err.response?.data?.error || 'Failed to add prime');
    }
  };

  const generate = async (primeId) => {
    setGenerating(g => ({ ...g, [primeId]: true }));
    try {
      const r = await api.post(`/primes/${primeId}/generate`);
      setPrimes(ps => ps.map(p => p.id === primeId ? r.data : p));
    } catch (err) {
      setToast(err.response?.data?.error || 'Generation failed — complete your profile first');
    } finally { setGenerating(g => ({ ...g, [primeId]: false })); }
  };

  const markTouchpoint = async (primeId, touchpoint, status) => {
    await api.post(`/primes/${primeId}/outreach`, { touchpoint, status, notes: '' });
    await loadSequence(primeId);
    const r = await api.get('/subk-primes');
    setPrimes(r.data);
  };

  const updateStatus = async (primeId, status) => {
    await api.put(`/primes/${primeId}`, { outreach_status: status });
    setPrimes(ps => ps.map(p => p.id === primeId ? { ...p, outreach_status: status } : p));
  };

  const addNote = async (primeId) => {
    const content = noteInput[primeId]?.trim();
    if (!content) return;
    await api.post(`/primes/${primeId}/notes`, { content });
    setNoteInput(n => ({ ...n, [primeId]: '' }));
    await loadNotes(primeId);
  };

  const deletePrime = async (id) => {
    if (!confirm('Remove this prime?')) return;
    await api.delete(`/primes/${id}`);
    setPrimes(ps => ps.filter(p => p.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const sendChat = async (primeId) => {
    const msg = chatInput[primeId]?.trim();
    if (!msg || chatLoading[primeId]) return;
    setChatInput(c => ({ ...c, [primeId]: '' }));
    const prev = chatMessages[primeId] || [];
    const newMsgs = [...prev, { role: 'user', content: msg }];
    setChatMessages(c => ({ ...c, [primeId]: newMsgs }));
    setChatLoading(c => ({ ...c, [primeId]: true }));
    try {
      const r = await api.post(`/chat/prime/${primeId}`, { messages: newMsgs });
      setChatMessages(c => ({ ...c, [primeId]: [...newMsgs, { role: 'assistant', content: r.data.reply }] }));
    } catch {
      setChatMessages(c => ({ ...c, [primeId]: [...newMsgs, { role: 'assistant', content: 'Error — try again' }] }));
    } finally { setChatLoading(c => ({ ...c, [primeId]: false })); }
  };

  const copy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [key]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 1500);
  };

  const exportCSV = async () => {
    try {
      const r = await api.get('/subk-primes/export/csv', { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'subk-primes.csv';
      a.click();
    } catch (e) {
      setToast('Export failed');
    }
  };

  const filteredPrimes = primes.filter(p => statusFilter === 'all' || p.outreach_status === statusFilter);
  const displayPrimes = tab === 'results' ? [] : filteredPrimes;

  const s = {
    page: { padding: '2rem 2.5rem' },
    heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
    tabs: { display: 'flex', gap: 6, marginBottom: '1.5rem' },
    tabBtn: (active) => ({ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)', border: active ? 'none' : '1px solid var(--border)' }),
    card: (active) => ({ background: 'var(--bg2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', marginBottom: 8, overflow: 'hidden' }),
    cardHeader: { padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' },
    btn: (v) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: v === 'primary' ? 'var(--accent)' : v === 'success' ? 'var(--success-bg)' : 'var(--bg3)', color: v === 'primary' ? '#fff' : v === 'success' ? 'var(--success)' : 'var(--text2)', borderColor: v === 'success' ? 'var(--success)' : 'var(--border)' }),
    subTab: (active) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid transparent' }),
    pre: { whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.75, color: 'var(--text)' },
    msgStyle: (role) => ({ padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, maxWidth: '85%', whiteSpace: 'pre-wrap', alignSelf: role === 'user' ? 'flex-end' : 'flex-start', background: role === 'user' ? 'var(--accent)' : 'var(--bg3)', color: role === 'user' ? '#fff' : 'var(--text)', border: role === 'user' ? 'none' : '1px solid var(--border)' }),
  };

  return (
    <Layout>
      {toast && <PrimesToast message={toast} onClose={() => setToast(null)} />}
      <div style={s.page}>
        <div style={s.heading}>Prime Tracker</div>
        <div style={s.sub}>Find primes winning federal contracts in your NAICS codes — then get AI-powered teaming outreach</div>

        <div style={s.tabs}>
          {[
            { key: 'tracked', label: `Tracking (${primes.length})` },
            { key: 'search', label: '🔍 Find Primes' },
            ...(searchResults.length ? [{ key: 'results', label: `Results (${searchResults.length})` }] : []),
          ].map(t => (
            <button key={t.key} style={s.tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Search form */}
        {tab === 'search' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: '1.25rem' }}>Find Prime Awardees — from USASpending.gov</div>
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
            <button style={{ ...s.btn('primary'), padding: '10px 24px', fontSize: 13 }} onClick={searchPrimes} disabled={searching}>
              {searching ? 'Searching USASpending...' : '🔍 Find prime awardees'}
            </button>
          </div>
        )}

        {/* Search results */}
        {tab === 'results' && searchResults.map((prime, i) => (
          <div key={i} style={{ ...s.card(false), padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{prime.company_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12 }}>
                <span>{prime.agency_focus}</span>
                <span>{formatMoney(prime.total_awards_value)} in awards</span>
                <span>{prime.award_count} contracts</span>
              </div>
            </div>
            <button style={s.btn('success')} onClick={() => trackPrime(prime)}>+ Track</button>
          </div>
        ))}

        {/* Filters for tracked */}
        {tab === 'tracked' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: 13, padding: '7px 10px', width: 'auto', minWidth: 160 }}>
              <option value="all">All statuses</option>
              {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>{filteredPrimes.length} primes</span>
            <button onClick={exportCSV} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', marginLeft: 'auto' }}>
              📥 Export CSV
            </button>
          </div>
        )}

        {/* Prime cards */}
        {tab === 'tracked' && displayPrimes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text2)' }}>
            No primes tracked yet — use Find Primes to discover who's winning in your NAICS codes
          </div>
        )}

        {tab === 'tracked' && displayPrimes.map(prime => (
          <div key={prime.id} style={s.card(expanded === prime.id)}>
            <div style={s.cardHeader} onClick={() => expandPrime(prime.id)}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                🏢
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{prime.company_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{prime.agency_focus || 'Federal'}</span>
                  <span>{formatMoney(prime.total_awards_value)} awarded</span>
                  {prime.naics_codes && <span>NAICS {prime.naics_codes}</span>}
                </div>
                {prime.fit_reason && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{prime.fit_reason}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {prime.fit_score && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, ...scoreColor(prime.fit_score) }}>{prime.fit_score}</span>}
                <select value={prime.outreach_status || 'not_contacted'} onChange={e => { e.stopPropagation(); updateStatus(prime.id, e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, padding: '4px 8px', width: 'auto', color: STATUS_COLORS[prime.outreach_status] || 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                {!prime.email1 && (
                  <button style={{ ...s.btn('primary'), padding: '5px 10px', fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); generate(prime.id); }}
                    disabled={generating[prime.id]}>
                    {generating[prime.id] ? '...' : '⚡ Generate'}
                  </button>
                )}
                <button style={{ ...s.btn(), fontSize: 11, padding: '5px 8px', color: 'var(--danger)' }}
                  onClick={e => { e.stopPropagation(); deletePrime(prime.id); }}>✕</button>
              </div>
            </div>

            {expanded === prime.id && (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                {/* Sub-tabs */}
                <div style={{ display: 'flex', gap: 4, padding: '0.75rem 1.25rem', background: 'var(--bg3)', flexWrap: 'wrap' }}>
                  {[
                    { key: 'outreach', label: '📋 Sequence' },
                    { key: 'emails', label: '✉ Emails' },
                    { key: 'call', label: '📞 Call Opener' },
                    { key: 'pitch', label: '📄 Teaming Pitch' },
                    { key: 'research', label: '🔍 Research' },
                    { key: 'notes', label: '📝 Notes' },
                    { key: 'chat', label: '💬 AI Coach' },
                  ].map(t => (
                    <button key={t.key} style={s.subTab(activeSubTab[prime.id] === t.key)}
                      onClick={() => setActiveSubTab(st => ({ ...st, [prime.id]: t.key }))}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: '1.25rem' }}>
                  {/* Sequence tracker */}
                  {activeSubTab[prime.id] === 'outreach' && (
                    <div>
                      {!prime.email1 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                          <div style={{ marginBottom: 12 }}>Generate outreach first to activate the sequence tracker</div>
                          <button style={s.btn('primary')} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Generating...' : '⚡ Generate outreach'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(Array.isArray(sequence[prime.id]) ? sequence[prime.id] : []).map(tp => (
                            <div key={tp.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: tp.status === 'done' ? 'var(--success-bg)' : 'var(--bg)', border: `1px solid ${tp.status === 'done' ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
                              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{TOUCHPOINT_ICONS[tp.key] || '•'}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: tp.status === 'done' ? 'var(--success)' : 'var(--text)', textDecoration: tp.status === 'skipped' ? 'line-through' : 'none' }}>{tp.label}</div>
                                {tp.completed_at && <div style={{ fontSize: 11, color: 'var(--success)' }}>✓ {new Date(tp.completed_at).toLocaleDateString()}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {tp.status === 'pending' && (
                                  <>
                                    <button style={s.btn('success')} onClick={() => markTouchpoint(prime.id, tp.key, 'done')}>✓ Done</button>
                                    <button style={s.btn()} onClick={() => markTouchpoint(prime.id, tp.key, 'skipped')}>Skip</button>
                                  </>
                                )}
                                {tp.status === 'done' && (
                                  <button style={s.btn()} onClick={() => markTouchpoint(prime.id, tp.key, 'pending')}>Undo</button>
                                )}
                                {tp.status === 'skipped' && (
                                  <button style={s.btn()} onClick={() => markTouchpoint(prime.id, tp.key, 'pending')}>Restore</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Emails */}
                  {activeSubTab[prime.id] === 'emails' && (
                    <div>
                      {!prime.email1 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                          <button style={s.btn('primary')} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Generating...' : '⚡ Generate outreach emails'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {[
                            { key: 'email1', label: 'Email 1 — Day 1' },
                            { key: 'email2', label: 'Email 2 — Day 4' },
                            { key: 'email3', label: 'Email 3 — Day 10 (Breakup)' },
                          ].map(e => (
                            <div key={e.key} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{e.label}</div>
                                <button style={{ ...s.btn(), fontSize: 11, padding: '4px 10px' }} onClick={() => copy(`${prime.id}-${e.key}`, prime[e.key])}>
                                  {copied[`${prime.id}-${e.key}`] ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                              <pre style={s.pre}>{prime[e.key]}</pre>
                            </div>
                          ))}
                          <button style={{ ...s.btn('primary'), width: 'fit-content' }} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Regenerating...' : '↺ Regenerate'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Call opener */}
                  {activeSubTab[prime.id] === 'call' && (
                    <div>
                      {!prime.call_opener ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                          <button style={s.btn('primary')} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Generating...' : '⚡ Generate call opener'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                            <button style={{ ...s.btn(), fontSize: 11, padding: '4px 10px' }} onClick={() => copy(`${prime.id}-call`, prime.call_opener)}>
                              {copied[`${prime.id}-call`] ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre style={s.pre}>{prime.call_opener}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Teaming pitch */}
                  {activeSubTab[prime.id] === 'pitch' && (
                    <div>
                      {!prime.teaming_pitch ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                          <button style={s.btn('primary')} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Generating...' : '⚡ Generate teaming pitch'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                            <button style={{ ...s.btn(), fontSize: 11, padding: '4px 10px' }} onClick={() => copy(`${prime.id}-pitch`, prime.teaming_pitch)}>
                              {copied[`${prime.id}-pitch`] ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre style={s.pre}>{prime.teaming_pitch}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Research */}
                  {activeSubTab[prime.id] === 'research' && (
                    <div>
                      {!prime.research ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                          <button style={s.btn('primary')} onClick={() => generate(prime.id)} disabled={generating[prime.id]}>
                            {generating[prime.id] ? 'Researching...' : '🔍 Research this prime'}
                          </button>
                        </div>
                      ) : <pre style={s.pre}>{prime.research}</pre>}
                    </div>
                  )}

                  {/* Notes */}
                  {activeSubTab[prime.id] === 'notes' && (
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <input value={noteInput[prime.id] || ''} onChange={e => setNoteInput(n => ({ ...n, [prime.id]: e.target.value }))}
                          placeholder="Add a note..." style={{ flex: 1 }}
                          onKeyDown={e => e.key === 'Enter' && addNote(prime.id)} />
                        <button style={s.btn('primary')} onClick={() => addNote(prime.id)}>Add</button>
                      </div>
                      {(Array.isArray(notes[prime.id]) ? notes[prime.id] : []).map(note => (
                        <div key={note.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 13 }}>{note.content}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{note.full_name} · {new Date(note.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                      {!(notes[prime.id]?.length) && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No notes yet</div>}
                    </div>
                  )}

                  {/* AI Coach */}
                  {activeSubTab[prime.id] === 'chat' && (
                    <div>
                      <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {!(chatMessages[prime.id]?.length) && (
                          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ask anything about teaming strategy, how to approach this prime, what to say on a call...</div>
                        )}
                        {(Array.isArray(chatMessages[prime.id]) ? chatMessages[prime.id] : []).map((m, i) => (
                          <div key={i} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, maxWidth: '85%', whiteSpace: 'pre-wrap', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? 'var(--accent)' : 'var(--bg3)', color: m.role === 'user' ? '#fff' : 'var(--text)', border: m.role === 'user' ? 'none' : '1px solid var(--border)' }}>
                            {m.content}
                          </div>
                        ))}
                        {chatLoading[prime.id] && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Thinking...</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={chatInput[prime.id] || ''} onChange={e => setChatInput(c => ({ ...c, [prime.id]: e.target.value }))}
                          placeholder="How do I approach their BD team? What should I lead with?..."
                          style={{ flex: 1 }}
                          onKeyDown={e => e.key === 'Enter' && sendChat(prime.id)} />
                        <button style={s.btn('primary')} onClick={() => sendChat(prime.id)} disabled={chatLoading[prime.id]}>Send</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
