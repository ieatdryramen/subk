import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

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
  }, []);

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

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Opportunities</div>
        <div style={s.sub}>Live federal contract opportunities scored against your profile</div>

        <div style={s.tabs}>
          {[
            { key: 'tracked', label: `Tracked (${opps.length})` },
            { key: 'saved', label: `💾 Saved (${savedOpps.length})` },
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
              <button onClick={exportCSV} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', marginLeft: 'auto' }}>
                📥 Export CSV
              </button>
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
            <div style={s.oppHeader} onClick={() => setExpanded(prev => prev === (opp.id || opp.sam_notice_id) ? null : (opp.id || opp.sam_notice_id))}>
              <div style={s.scoreBadge(opp.fit_score)}>{opp.fit_score || '—'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{opp.title}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
                  <span>{opp.agency}</span>
                  {opp.naics_code && <span>NAICS {opp.naics_code}</span>}
                  {opp.set_aside && <span style={{ color: 'var(--accent2)' }}>{opp.set_aside}</span>}
                  {opp.response_deadline && (
                    <span style={{ color: new Date(opp.response_deadline) < new Date(Date.now() + 14*24*60*60*1000) ? 'var(--warning)' : 'var(--text3)' }}>
                      Due {new Date(opp.response_deadline).toLocaleDateString()}
                    </span>
                  )}
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
                {(opp.opportunity_url || opp.solicitation_number) && (
                  <a href={opp.opportunity_url || `https://sam.gov/search/?keywords=${encodeURIComponent(opp.solicitation_number || opp.title)}&sort=-modifiedDate&index=opp`}
                    target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--accent2)', whiteSpace: 'nowrap' }}>
                    SAM.gov ↗
                  </a>
                )}
                {opp.id && (
                  <button style={{ ...s.btn(), fontSize: 11, padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
                    onClick={e => { e.stopPropagation(); deleteOpp(opp.id); }}>✕</button>
                )}
              </div>
            </div>

            {expanded === (opp.id || opp.sam_notice_id) && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--bg2)' }}>
                {opp.description && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem', lineHeight: 1.7 }}>{opp.description}</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
                  {[
                    { label: 'Place of Performance', val: opp.place_of_performance },
                    { label: 'Solicitation #', val: opp.solicitation_number },
                    { label: 'Point of Contact', val: opp.primary_contact_name ? `${opp.primary_contact_name}${opp.primary_contact_email ? ` · ${opp.primary_contact_email}` : ''}` : null },
                  ].filter(x => x.val).map(x => (
                    <div key={x.label}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{x.label}</div>
                      <div style={{ fontSize: 13 }}>{x.val}</div>
                    </div>
                  ))}
                </div>

                {/* AI Coach */}
                {opp.id && (
                  <>
                    <button style={{ ...s.btn(), fontSize: 12, marginBottom: chatOpen === opp.id ? 0 : 0 }}
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
      </div>
    </Layout>
  );
}
