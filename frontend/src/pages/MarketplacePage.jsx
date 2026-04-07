import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const CERT_OPTIONS = ['Small Business', '8(a)', 'HUBZone', 'SDVOSB', 'VOSB', 'WOSB', 'EDWOSB', 'SDB'];

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1100 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  tab: (active) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', color: active ? 'var(--accent2)' : 'var(--text2)', marginBottom: -1 }),
  filters: { display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' },
  filterInput: { padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 200 },
  certBtn: (active) => ({ padding: '5px 12px', fontSize: 11, fontWeight: 500, borderRadius: 20, cursor: 'pointer', background: active ? 'var(--accent-bg)' : 'var(--bg3)', color: active ? 'var(--accent2)' : 'var(--text2)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }),
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 10, transition: 'border-color 0.15s' },
  cardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  cardSub: { fontSize: 12, color: 'var(--text2)', marginBottom: 10 },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  tag: (color) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: color === 'green' ? 'var(--success-bg)' : color === 'blue' ? 'var(--accent-bg)' : 'var(--bg3)', color: color === 'green' ? 'var(--success)' : color === 'blue' ? 'var(--accent2)' : 'var(--text3)', border: '1px solid currentColor' }),
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  btn: (v) => ({ padding: '7px 16px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', background: v === 'primary' ? 'var(--accent)' : v === 'success' ? 'var(--success-bg)' : 'var(--bg3)', color: v === 'primary' ? '#fff' : v === 'success' ? 'var(--success)' : 'var(--text2)' }),
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' },
  modalCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 600, marginBottom: '1.25rem' },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 },
  postBanner: { background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
};

// ── Loading Skeletons ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="pf-skeleton" style={{ height: 140, marginBottom: 10 }} />
  );
}

function SkeletonLine() {
  return (
    <div className="pf-skeleton" style={{ height: 16, marginBottom: 8 }} />
  );
}

function SubDirectory() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [naics, setNaics] = useState('');
  const [cert, setCert] = useState('');
  const [selected, setSelected] = useState(null);
  const [teamingModal, setTeamingModal] = useState(null);
  const [teamingMsg, setTeamingMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [addingTracker, setAddingTracker] = useState({});
  const toast = useToast();

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (naics) params.set('naics', naics);
    if (cert) params.set('cert', cert);
    api.get('/marketplace/subs?' + params).then(r => { setSubs(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [q, naics, cert]);

  const sendTeaming = async () => {
    if (!teamingMsg.trim()) return;
    setSending(true);
    try {
      await api.post('/marketplace/teaming', { to_user_id: teamingModal.user_id, message: teamingMsg, from_type: 'sub' });
      setTeamingModal(null);
      setTeamingMsg('');
      toast.addToast('Teaming request sent!');
    } catch (e) { toast.addToast(e.response?.data?.error || 'Failed to send'); }
    finally { setSending(false); }
  };

  const addToTracker = async (sub) => {
    setAddingTracker(p => ({ ...p, [sub.id]: true }));
    try {
      const subProfile = await api.get('/profile').catch(() => null);
      await api.post('/subk-primes', {
        company_name: sub.company_name,
        naics_codes: sub.naics_codes,
        website: sub.website_url,
        certifications: sub.certifications,
        size_category: 'small_business'
      });
      toast.addToast('Sub added to tracker!');
    } catch (e) {
      toast.addToast(e.response?.data?.error || 'Failed to add to tracker');
    } finally {
      setAddingTracker(p => ({ ...p, [sub.id]: false }));
    }
  };

  return (
    <>
      <div style={s.filters}>
        <input style={s.filterInput} placeholder="Search capabilities..." value={q} onChange={e => setQ(e.target.value)} />
        <input style={{ ...s.filterInput, width: 140 }} placeholder="NAICS code..." value={naics} onChange={e => setNaics(e.target.value)} />
        {CERT_OPTIONS.slice(0, 5).map(c => (
          <button key={c} style={s.certBtn(cert === c)} onClick={() => setCert(cert === c ? '' : c)}>{c}</button>
        ))}
        {cert && <button style={s.certBtn(false)} onClick={() => setCert('')}>✕ Clear</button>}
      </div>

      {loading ? (
        <div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : subs.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No public sub profiles yet</div>
          <div style={{ fontSize: 13 }}>Subs need to opt-in to the marketplace from their Profile page</div>
        </div>
      ) : subs.map(sub => (
        <div key={sub.id} style={s.card} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <div style={s.cardTitle}>{sub.company_name}</div>
              <div style={s.cardSub}>{sub.state && `${sub.state} · `}{sub.tagline || ''}</div>
              <div style={s.tags}>
                {sub.certifications?.split(',').filter(Boolean).map(c => (
                  <span key={c} style={s.tag('green')}>{c.trim()}</span>
                ))}
                {sub.naics_codes?.split(',').filter(Boolean).slice(0, 3).map(n => (
                  <span key={n} style={s.tag('blue')}>{n.trim()}</span>
                ))}
              </div>
              {sub.capabilities && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{sub.capabilities.substring(0, 180)}{sub.capabilities.length > 180 ? '...' : ''}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button style={s.btn('primary')} onClick={() => setTeamingModal(sub)}>→ Request Teaming</button>
              <button style={s.btn('default')} onClick={() => addToTracker(sub)} disabled={addingTracker[sub.id]}>
                {addingTracker[sub.id] ? 'Adding...' : '⭐ Add to Tracker'}
              </button>
              <button style={s.btn('default')} onClick={() => setSelected(selected?.id === sub.id ? null : sub)}>
                {selected?.id === sub.id ? 'Hide' : 'Full Profile'}
              </button>
            </div>
          </div>
          {selected?.id === sub.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                {sub.target_agencies && <div><span style={{ color: 'var(--text3)', fontSize: 11 }}>AGENCIES</span><br />{sub.target_agencies}</div>}
                {sub.website_url && <div><span style={{ color: 'var(--text3)', fontSize: 11 }}>WEBSITE</span><br /><a href={sub.website_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>{sub.website_url}</a></div>}
              </div>
            </div>
          )}
        </div>
      ))}

      {teamingModal && (
        <div style={s.modal} onClick={() => setTeamingModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Request Teaming — {teamingModal.company_name}</div>
            <div style={s.field}>
              <label style={s.label}>Your message</label>
              <textarea value={teamingMsg} onChange={e => setTeamingMsg(e.target.value)}
                placeholder="Introduce your firm, describe the opportunity or contract vehicle, explain what you're looking for in a sub-partner..."
                style={{ minHeight: 140, width: '100%', fontSize: 13, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btn('default')} onClick={() => setTeamingModal(null)}>Cancel</button>
              <button style={s.btn('primary')} onClick={sendTeaming} disabled={!teamingMsg.trim() || sending}>
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Shared Opportunities Tab ───────────────────────────────────────────────
function SharedOpportunities({ myUserId }) {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPost, setShowPost] = useState(false);
  const [interestModal, setInterestModal] = useState(null);
  const [interestMsg, setInterestMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', naics_codes: '', set_aside: '', agency: '', response_deadline: '', value_min: '', value_max: '', roles_needed: '', requirements: '' });
  const [posting, setPosting] = useState(false);
  const [addingTracker, setAddingTracker] = useState({});
  const toast = useToast();
  const [interestList, setInterestList] = useState(null);
  const [searchQ, setSearchQ] = useState('');

  const load = () => {
    api.get('/marketplace/opportunities').then(r => { setOpps(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    try {
      await api.post('/marketplace/opportunities', form);
      setShowPost(false);
      setForm({ title: '', description: '', naics_codes: '', set_aside: '', agency: '', response_deadline: '', value_min: '', value_max: '', roles_needed: '', requirements: '' });
      load();
    } catch (e) { toast.addToast(e.response?.data?.error || 'Failed to post'); }
    finally { setPosting(false); }
  };

  const expressInterest = async () => {
    setSending(true);
    try {
      await api.post(`/marketplace/opportunities/${interestModal.id}/interest`, { message: interestMsg });
      setInterestModal(null);
      setInterestMsg('');
      toast.addToast('Interest submitted! The prime will be notified.');
    } catch (e) { toast.addToast(e.response?.data?.error || 'Failed to submit'); }
    finally { setSending(false); }
  };

  const addPrimeToTracker = async (opp) => {
    setAddingTracker(p => ({ ...p, [opp.id]: true }));
    try {
      await api.post('/subk-primes', {
        company_name: opp.prime_company || opp.prime_name,
        naics_codes: opp.naics_codes,
        agency_focus: opp.agency,
        size_category: 'prime'
      });
      toast.addToast('Prime added to tracker!');
    } catch (e) {
      toast.addToast(e.response?.data?.error || 'Failed to add prime to tracker');
    } finally {
      setAddingTracker(p => ({ ...p, [opp.id]: false }));
    }
  };

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });

  return (
    <>
      {interestList && (
        <div style={s.modal} onClick={() => setInterestList(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Interest — {interestList.title}</div>
            {interestList.interests.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No interest yet.</div>
            ) : interestList.interests.map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < interestList.interests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.company_name || item.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{item.message || 'No message'}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button style={s.btn('default')} onClick={() => setInterestList(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div style={s.postBanner}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent2)' }}>Are you a prime looking for subs?</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Post your teaming opportunity and let qualified subs find you.</div>
        </div>
        <button style={s.btn('primary')} onClick={() => setShowPost(true)}>+ Post Opportunity</button>
      </div>

      {/* Search bar */}
      {!loading && opps.length > 3 && (
        <div style={{ marginBottom: '1rem' }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search opportunities, agencies, NAICS..."
            style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 300 }} />
          {searchQ && <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{opps.filter(o => {
            const q = searchQ.toLowerCase();
            return (o.title || '').toLowerCase().includes(q) || (o.agency || '').toLowerCase().includes(q) || (o.naics_codes || '').toLowerCase().includes(q) || (o.roles_needed || '').toLowerCase().includes(q);
          }).length} matches</span>}
        </div>
      )}

      {loading ? (
        <div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : opps.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No shared opportunities yet</div>
          <div style={{ fontSize: 13 }}>Primes post teaming opportunities here for subs to find and express interest.</div>
        </div>
      ) : opps.filter(opp => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return (opp.title || '').toLowerCase().includes(q) || (opp.agency || '').toLowerCase().includes(q) || (opp.naics_codes || '').toLowerCase().includes(q) || (opp.roles_needed || '').toLowerCase().includes(q) || (opp.description || '').toLowerCase().includes(q);
      }).map(opp => {
        const isOwn = opp.prime_user_id === myUserId;
        const deadline = opp.response_deadline ? new Date(opp.response_deadline) : null;
        const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
        return (
          <div key={opp.id} style={s.card}>
            <div style={s.row}>
              <div style={{ flex: 1 }}>
                <div style={s.cardTitle}>{opp.title}</div>
                <div style={s.cardSub}>
                  {opp.prime_company || opp.prime_name}
                  {opp.agency && ` · ${opp.agency}`}
                  {daysLeft !== null && <span style={{ color: daysLeft <= 7 ? 'var(--danger)' : 'var(--text3)', marginLeft: 8 }}>· {daysLeft}d left</span>}
                </div>
                <div style={s.tags}>
                  {opp.set_aside && <span style={s.tag('green')}>{opp.set_aside}</span>}
                  {opp.naics_codes?.split(',').filter(Boolean).map(n => <span key={n} style={s.tag('blue')}>{n.trim()}</span>)}
                  {(opp.value_min || opp.value_max) && (
                    <span style={s.tag('default')}>
                      ${opp.value_min ? (opp.value_min / 1e6).toFixed(1) + 'M' : '?'} – ${opp.value_max ? (opp.value_max / 1e6).toFixed(1) + 'M' : '?'}
                    </span>
                  )}
                </div>
                {opp.roles_needed && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}><strong>Looking for:</strong> {opp.roles_needed}</div>}
                {opp.description && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{opp.description.substring(0, 200)}{opp.description.length > 200 ? '...' : ''}</div>}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {isOwn ? (
                  <button style={s.btn('default')} onClick={async () => {
                    const r = await api.get(`/marketplace/opportunities/${opp.id}/interests`).catch(() => ({ data: [] }));
                    setInterestList({ title: opp.title, interests: r.data });
                  }}>View Interest</button>
                ) : (
                  <>
                    <button style={s.btn('primary')} onClick={() => setInterestModal(opp)}>Express Interest</button>
                    <button style={s.btn('default')} onClick={() => addPrimeToTracker(opp)} disabled={addingTracker[opp.id]}>
                      {addingTracker[opp.id] ? 'Adding...' : '⭐ Add Prime'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Post Opportunity Modal */}
      {showPost && (
        <div style={s.modal} onClick={() => setShowPost(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Post a Teaming Opportunity</div>
            <div style={s.field}><label style={s.label}>Opportunity Title *</label><input {...f('title')} placeholder="Navy IDIQ — Cybersecurity Support Services" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
            <div style={s.field}><label style={s.label}>Description</label><textarea {...f('description')} placeholder="Describe the solicitation, scope, and what you're looking for in a sub..." style={{ minHeight: 80, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={s.field}><label style={s.label}>NAICS Codes</label><input {...f('naics_codes')} placeholder="541512, 541519" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
              <div style={s.field}><label style={s.label}>Set-Aside</label><input {...f('set_aside')} placeholder="Small Business" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
              <div style={s.field}><label style={s.label}>Agency</label><input {...f('agency')} placeholder="Department of Navy" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
              <div style={s.field}><label style={s.label}>Response Deadline</label><input type="date" {...f('response_deadline')} style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
              <div style={s.field}><label style={s.label}>Min Value ($)</label><input type="number" {...f('value_min')} placeholder="500000" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
              <div style={s.field}><label style={s.label}>Max Value ($)</label><input type="number" {...f('value_max')} placeholder="5000000" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
            </div>
            <div style={s.field}><label style={s.label}>Roles / Capabilities Needed</label><input {...f('roles_needed')} placeholder="Penetration testing, cloud architecture, cleared personnel" style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
            <div style={s.field}><label style={s.label}>Requirements</label><textarea {...f('requirements')} placeholder="Must have active TS/SCI clearances, CMMC Level 2..." style={{ minHeight: 60, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%', fontSize: 13 }} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={s.btn('default')} onClick={() => setShowPost(false)}>Cancel</button>
              <button style={s.btn('primary')} onClick={post} disabled={!form.title.trim() || posting}>{posting ? 'Posting...' : 'Post Opportunity'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Express Interest Modal */}
      {interestModal && (
        <div style={s.modal} onClick={() => setInterestModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Express Interest — {interestModal.title}</div>
            <div style={s.field}>
              <label style={s.label}>Your message to the prime</label>
              <textarea value={interestMsg} onChange={e => setInterestMsg(e.target.value)}
                placeholder="Briefly describe your firm's relevant capabilities, certifications, and why you're a strong teaming partner for this opportunity..."
                style={{ minHeight: 120, width: '100%', fontSize: 13, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btn('default')} onClick={() => setInterestModal(null)}>Cancel</button>
              <button style={s.btn('primary')} onClick={expressInterest} disabled={!interestMsg.trim() || sending}>{sending ? 'Submitting...' : 'Submit Interest'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Marketplace Page ──────────────────────────────────────────────────
export default function MarketplacePage() {
  const [tab, setTab] = useState('opportunities');
  const [myUserId, setMyUserId] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('sumx_user') || '{}');
    setMyUserId(user?.id);
  }, []);

  return (
    <Layout>
      <div style={s.page}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={s.heading}>Marketplace</div>
            <div style={s.sub}>Find teaming partners, post opportunities, connect with primes and subs</div>
          </div>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(tab === 'opportunities')} onClick={() => setTab('opportunities')}>📋 Teaming Opportunities</button>
          <button style={s.tab(tab === 'subs')} onClick={() => setTab('subs')}>🏢 Sub Directory</button>
        </div>

        {tab === 'opportunities' && <SharedOpportunities myUserId={myUserId} />}
        {tab === 'subs' && <SubDirectory />}
      </div>
    </Layout>
  );
}
