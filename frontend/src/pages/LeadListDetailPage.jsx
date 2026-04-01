import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import PlaybookViewer from '../components/PlaybookViewer';

const statusColors = {
  pending: { bg: 'var(--bg3)', color: 'var(--text3)', label: 'Pending' },
  generating: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Generating...' },
  done: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'Ready' },
  error: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Error' },
};

const scoreColor = (score) => {
  if (!score) return { bg: 'var(--bg3)', color: 'var(--text3)' };
  if (score >= 70) return { bg: 'var(--success-bg)', color: 'var(--success)' };
  if (score >= 40) return { bg: 'var(--warning-bg)', color: 'var(--warning)' };
  return { bg: 'var(--danger-bg)', color: 'var(--danger)' };
};

const s = {
  page: { padding: '2rem 2.5rem' },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.25rem' },
  back: { fontSize: 13, color: 'var(--text2)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 13, marginBottom: '1.5rem' },
  actions: { display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' },
  btn: (variant) => ({
    padding: '9px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'success' ? 'var(--success-bg)' : variant === 'warning' ? 'var(--warning-bg)' : variant === 'info' ? 'var(--bg3)' : 'var(--bg2)',
    color: variant === 'primary' ? '#fff' : variant === 'success' ? 'var(--success)' : variant === 'warning' ? 'var(--warning)' : variant === 'info' ? 'var(--text)' : 'var(--text2)',
    border: variant === 'primary' ? 'none' : variant === 'success' ? '1px solid var(--success)' : variant === 'warning' ? '1px solid var(--warning)' : '1px solid var(--border)',
    cursor: 'pointer',
  }),
  progress: { height: 3, background: 'var(--bg3)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' },
  progressBar: (pct) => ({ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }),
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' },
  td: { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  badge: (status) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: statusColors[status]?.bg || statusColors.pending.bg, color: statusColors[status]?.color || statusColors.pending.color }),
  scoreBadge: (score) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...scoreColor(score) }),
  rowExpand: { background: 'var(--bg)', borderBottom: '1px solid var(--border)' },
  expandInner: { padding: '1rem 1.5rem 1.5rem' },
  actionBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  smallBtn: (c) => ({ padding: '5px 10px', fontSize: 11, borderRadius: 'var(--radius)', border: `1px solid ${c === 'green' ? 'var(--success)' : c === 'blue' ? 'var(--accent)' : c === 'red' ? 'var(--danger)' : 'var(--border)'}`, background: c === 'green' ? 'var(--success-bg)' : c === 'blue' ? 'var(--accent-bg)' : c === 'red' ? 'var(--danger-bg)' : 'transparent', color: c === 'green' ? 'var(--success)' : c === 'blue' ? 'var(--accent2)' : c === 'red' ? 'var(--danger)' : 'var(--text2)', cursor: 'pointer' }),
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text2)' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 600, marginBottom: '1.25rem' },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  modalBtns: { display: 'flex', gap: 8, marginTop: '1.25rem' },
  cancelBtn: { flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)' },
  saveBtn: { flex: 1, padding: 10, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, border: 'none' },
  dropZone: { border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' },
};

export default function LeadListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [leads, setLeads] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [addForm, setAddForm] = useState({ full_name: '', company: '', title: '', email: '', linkedin: '', notes: '' });
  const [generating, setGenerating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zohoStatus, setZohoStatus] = useState({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileRef = useRef();
  const pollRef = useRef();

  const loadLeads = async () => {
    try {
      const [listRes, leadsRes] = await Promise.all([
        api.get('/lists').then(r => r.data.find(l => l.id === parseInt(id))),
        api.get(`/lists/${id}/leads`),
      ]);
      setList(listRes);
      setLeads(leadsRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { 
    loadLeads(); 
    api.get('/zoho/status').then(r => setZohoStatus({ connected: r.data.connected })).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (generating || scoring) {
      pollRef.current = setInterval(() => {
        api.get(`/lists/${id}/leads`).then(r => {
          setLeads(r.data);
          const total = r.data.length;
          const done = r.data.filter(l => l.status === 'done' || l.status === 'error').length;
          if (generating) {
            setProgress(total ? Math.round((done / total) * 100) : 0);
            if (done === total) { setGenerating(false); setProgress(100); clearInterval(pollRef.current); }
          }
          if (scoring) {
            const scored = r.data.filter(l => l.icp_score != null).length;
            setProgress(total ? Math.round((scored / total) * 100) : 0);
            if (scored === total) { setScoring(false); setProgress(100); clearInterval(pollRef.current); }
          }
        });
      }, 2500);
    }
    return () => clearInterval(pollRef.current);
  }, [generating, scoring, id]);

  const generateAll = async () => {
    setGenerating(true); setProgress(0);
    try { await api.post(`/playbooks/generate-list/${id}`); }
    catch (err) { alert(err.response?.data?.error || 'Generation failed. Check your company profile.'); setGenerating(false); }
  };

  const scoreList = async () => {
    setScoring(true); setProgress(0);
    try { await api.post(`/scoring/score-list/${id}`); }
    catch (err) { alert(err.response?.data?.error || 'Scoring failed.'); setScoring(false); }
  };

  const exportList = (format) => {
    const token = localStorage.getItem('pf_token');
    window.open(`/api/export/list/${id}/${format}?token=${token}`, '_blank');
    setShowExportMenu(false);
  };

  const generateOne = async (e, leadId) => {
    e.stopPropagation();
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'generating' } : l));
    try {
      const r = await api.post(`/playbooks/generate/${leadId}`);
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'done', ...r.data } : l));
    } catch (err) {
      if (err.response?.data?.upgrade) {
        setShowUpgradeModal(true);
        setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'pending' } : l));
      } else {
        setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'error' } : l));
      }
    }
  };

  const pushToZoho = async (e, leadId) => {
    e.stopPropagation();
    try {
      const r = await api.post(`/zoho/push/${leadId}`);
      alert(r.data.message);
    } catch (err) {
      alert(err.response?.data?.error || 'Zoho push failed. Check your connection in Team & Integrations.');
    }
  };

  const deleteLead = async (e, leadId) => {
    e.stopPropagation();
    if (!confirm('Remove this lead?')) return;
    await api.delete(`/lists/${id}/leads/${leadId}`);
    setLeads(ls => ls.filter(l => l.id !== leadId));
    if (expandedId === leadId) setExpandedId(null);
  };

  const addLead = async () => {
    if (!addForm.full_name && !addForm.company) return;
    try {
      const r = await api.post(`/lists/${id}/leads`, { leads: [addForm] });
      setLeads(ls => [...ls, ...r.data]);
      setAddForm({ full_name: '', company: '', title: '', email: '', linkedin: '', notes: '' });
      setModal(null);
    } catch (err) { console.error(err); }
  };

  const importCsv = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post(`/lists/${id}/import`, fd);
      await loadLeads();
      setModal(null);
      alert(`Imported ${r.data.imported} leads`);
    } catch (err) { alert(err.response?.data?.error || 'Import failed'); }
  };

  const toggleRow = (leadId) => setExpandedId(prev => prev === leadId ? null : leadId);

  const doneCount = leads.filter(l => l.status === 'done').length;
  const scoredCount = leads.filter(l => l.icp_score != null).length;

  // Sort by ICP score if scored
  const sortedLeads = scoredCount > 0
    ? [...leads].sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0))
    : leads;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.back} onClick={() => navigate('/lists')}>← Lists</button>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 14, color: 'var(--text2)' }}>{list?.name || '...'}</span>
        </div>
        <div style={{ ...s.heading, marginBottom: 4 }}>{list?.name || 'Loading...'}</div>
        <div style={s.sub}>
          {leads.length} lead{leads.length !== 1 ? 's' : ''} · {doneCount} playbook{doneCount !== 1 ? 's' : ''} ready
          {scoredCount > 0 ? ` · ${scoredCount} scored` : ''}
        </div>

        <div style={s.actions}>
          <button style={s.btn('primary')} onClick={() => setModal('add')}>+ Add Lead</button>
          <button style={s.btn('default')} onClick={() => setModal('csv')}>↑ Import CSV</button>
          {leads.length > 0 && (
            <button style={s.btn('success')} onClick={generateAll} disabled={generating || scoring}>
              {generating ? `Generating... ${progress}%` : `⚡ Generate All (${leads.length})`}
            </button>
          )}
          {leads.length > 0 && (
            <button style={s.btn('warning')} onClick={scoreList} disabled={scoring || generating}>
              {scoring ? `Scoring... ${progress}%` : `◎ Score ICP Fit`}
            </button>
          )}
          {doneCount > 0 && (
            <div style={{ position: 'relative' }}>
              <button style={s.btn('info')} onClick={() => setShowExportMenu(m => !m)}>↓ Export Playbooks ▾</button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', zIndex: 50, minWidth: 180 }}>
                  <div style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}
                    onMouseEnter={e => e.target.style.background='var(--bg3)'}
                    onMouseLeave={e => e.target.style.background=''}
                    onClick={() => exportList('html')}>
                    📄 HTML (Print to PDF)
                  </div>
                  <div style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)', borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => e.target.style.background='var(--bg3)'}
                    onMouseLeave={e => e.target.style.background=''}
                    onClick={() => exportList('csv')}>
                    📊 CSV spreadsheet
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {(generating || scoring) && (
          <div style={s.progress}><div style={s.progressBar(progress)} /></div>
        )}

        {leads.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No leads yet</div>
            <div style={{ fontSize: 13 }}>Add leads manually or import a CSV</div>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Company</th>
                <th style={s.th}>Title</th>
                <th style={s.th}>ICP Score</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeads.map(lead => (
                <>
                  <tr key={lead.id} style={{ cursor: 'pointer' }}
                    onClick={() => toggleRow(lead.id)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={s.td}><div style={{ fontWeight: 500 }}>{lead.full_name || '—'}</div></td>
                    <td style={s.td}>{lead.company || '—'}</td>
                    <td style={s.td}>{lead.title || '—'}</td>
                    <td style={s.td}>
                      {lead.icp_score != null ? (
                        <span style={s.scoreBadge(lead.icp_score)} title={lead.icp_reason || ''}>
                          {lead.icp_score}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(lead.status)}>{statusColors[lead.status]?.label || 'Pending'}</span>
                    </td>
                    <td style={s.td}>
                      <div style={s.actionBtns}>
                        {lead.status === 'done' ? (
                          <button style={s.smallBtn('default')} onClick={e => generateOne(e, lead.id)}>Regen</button>
                        ) : lead.status === 'generating' ? (
                          <span style={{ fontSize: 11, color: 'var(--warning)' }}>Working...</span>
                        ) : (
                          <button style={s.smallBtn('blue')} onClick={e => generateOne(e, lead.id)}>Generate</button>
                        )}
                        {zohoStatus.connected && lead.status === 'done' && (
                          <button style={s.smallBtn('green')} onClick={e => pushToZoho(e, lead.id)}>
                            {lead.zoho_contact_id ? '↻ Zoho' : '→ Zoho'}
                          </button>
                        )}
                        <button style={s.smallBtn('red')} onClick={e => deleteLead(e, lead.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === lead.id && (
                    <tr key={`expand-${lead.id}`}>
                      <td colSpan={6} style={s.rowExpand}>
                        <div style={s.expandInner}>
                          {lead.icp_score != null && lead.icp_reason && (
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${scoreColor(lead.icp_score).color}` }}>
                              <strong>ICP Analysis:</strong> {lead.icp_reason}
                            </div>
                          )}
                          {lead.status === 'done' && (lead.research || lead.email1) ? (
                            <PlaybookViewer playbook={lead} leadId={lead.id} />
                          ) : lead.status === 'generating' ? (
                            <div style={{ color: 'var(--text2)', fontSize: 13, padding: '1rem 0' }}>Building playbook — about 20 seconds...</div>
                          ) : lead.status === 'error' ? (
                            <div style={{ color: 'var(--danger)', fontSize: 13, padding: '1rem 0' }}>Generation failed. Make sure your company profile is complete.</div>
                          ) : (
                            <div style={{ color: 'var(--text2)', fontSize: 13, padding: '1rem 0' }}>
                              Click <strong>Generate</strong> to build a personalized playbook for {lead.full_name || 'this lead'}.
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'add' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Add lead</div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Full name</label><input autoFocus value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Sarah Chen" /></div>
              <div style={s.field}><label style={s.label}>Company</label><input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Apex Federal" /></div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Title</label><input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="VP of Business Development" /></div>
              <div style={s.field}><label style={s.label}>Email</label><input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="s.chen@apex.com" /></div>
            </div>
            <div style={s.field}><label style={s.label}>LinkedIn URL (optional)</label><input value={addForm.linkedin} onChange={e => setAddForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
            <div style={s.field}><label style={s.label}>Notes (optional)</label><textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Met at conference, interested in compliance module" style={{ minHeight: 60 }} /></div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={s.saveBtn} onClick={addLead} disabled={!addForm.full_name && !addForm.company}>Add lead</button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div style={s.modal} onClick={() => setShowUpgradeModal(false)}>
          <div style={{ ...s.modalCard, maxWidth: 460, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, fontFamily: 'Syne, sans-serif' }}>Playbook limit reached</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              You've used all your free playbooks. Upgrade to keep generating personalized outreach for your leads.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
              {[
                { name: 'Starter', price: '$49/mo', detail: '100 playbooks' },
                { name: 'Team', price: '$149/mo', detail: '500 playbooks', featured: true },
                { name: 'Pro', price: '$299/mo', detail: 'Unlimited' },
              ].map(p => (
                <div key={p.name} style={{ padding: '12px', background: p.featured ? 'var(--accent-bg)' : 'var(--bg3)', border: p.featured ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                  onClick={() => { setShowUpgradeModal(false); window.location.href = '/billing'; }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: p.featured ? 'var(--accent2)' : 'var(--text2)' }}>{p.price}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.detail}</div>
                </div>
              ))}
            </div>
            <button style={{ ...s.saveBtn, width: '100%' }} onClick={() => { setShowUpgradeModal(false); window.location.href = '/billing'; }}>
              View plans & upgrade →
            </button>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, cursor: 'pointer' }} onClick={() => setShowUpgradeModal(false)}>Maybe later</div>
          </div>
        </div>
      )}

      {modal === 'csv' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Import from CSV</div>
            <div style={s.dropZone} onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importCsv(f); }}>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>Drop CSV here or click to browse</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Supports standard CSV and ZoomInfo exports</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) importCsv(e.target.files[0]); }} />
            <div style={s.modalBtns}>
              <button style={{ ...s.cancelBtn, flex: 'unset', padding: '9px 20px' }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
