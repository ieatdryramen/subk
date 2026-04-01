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

const s = {
  page: { padding: '2rem 2.5rem' },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.25rem' },
  back: { fontSize: 13, color: 'var(--text2)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  heading: { fontSize: 24, fontWeight: 700 },
  sub: { color: 'var(--text2)', fontSize: 13, marginBottom: '1.5rem' },
  actions: { display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' },
  btn: (variant) => ({
    padding: '9px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'success' ? 'var(--success-bg)' : 'var(--bg2)',
    color: variant === 'primary' ? '#fff' : variant === 'success' ? 'var(--success)' : 'var(--text2)',
    border: variant === 'primary' ? 'none' : variant === 'success' ? '1px solid var(--success)' : '1px solid var(--border)',
    cursor: 'pointer',
  }),
  progress: { height: 3, background: 'var(--bg3)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' },
  progressBar: (pct) => ({ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }),
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' },
  td: { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  badge: (status) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: statusColors[status]?.bg || statusColors.pending.bg, color: statusColors[status]?.color || statusColors.pending.color }),
  rowExpand: { background: 'var(--bg)', borderBottom: '1px solid var(--border)' },
  expandInner: { padding: '1rem 1.5rem 1.5rem' },
  genBtn: { padding: '5px 12px', fontSize: 12, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer' },
  regenBtn: { padding: '5px 12px', fontSize: 12, background: 'transparent', color: 'var(--text2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer' },
  delRowBtn: { padding: '5px 8px', fontSize: 12, background: 'transparent', color: 'var(--text3)', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text2)' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 600, marginBottom: '1.25rem' },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  modalBtns: { display: 'flex', gap: 8, marginTop: '1.25rem' },
  cancelBtn: { flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)' },
  saveBtn: { flex: 1, padding: 10, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500 },
  dropZone: { border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' },
  dropText: { fontSize: 14, color: 'var(--text2)', marginBottom: 4 },
  dropHint: { fontSize: 12, color: 'var(--text3)' },
};

export default function LeadListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [leads, setLeads] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal] = useState(null); // 'add' | 'csv'
  const [addForm, setAddForm] = useState({ full_name: '', company: '', title: '', email: '', linkedin: '', notes: '' });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
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

  useEffect(() => { loadLeads(); }, [id]);

  // Poll for status updates while generating
  useEffect(() => {
    if (generating) {
      pollRef.current = setInterval(() => {
        api.get(`/lists/${id}/leads`).then(r => {
          setLeads(r.data);
          const total = r.data.length;
          const done = r.data.filter(l => l.status === 'done' || l.status === 'error').length;
          setProgress(total ? Math.round((done / total) * 100) : 0);
          if (done === total) {
            setGenerating(false);
            setProgress(100);
            clearInterval(pollRef.current);
          }
        });
      }, 2500);
    }
    return () => clearInterval(pollRef.current);
  }, [generating, id]);

  const generateAll = async () => {
    setGenerating(true);
    setProgress(0);
    try {
      await api.post(`/playbooks/generate-list/${id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Generation failed. Make sure your company profile is saved.');
      setGenerating(false);
    }
  };

  const generateOne = async (e, leadId) => {
    e.stopPropagation();
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'generating' } : l));
    try {
      const r = await api.post(`/playbooks/generate/${leadId}`);
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'done', ...r.data } : l));
    } catch (err) {
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'error' } : l));
      alert(err.response?.data?.error || 'Generation failed');
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
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed');
    }
  };

  const toggleRow = (leadId) => setExpandedId(prev => prev === leadId ? null : leadId);

  const doneCount = leads.filter(l => l.status === 'done').length;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.back} onClick={() => navigate('/lists')}>← Lists</button>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 14, color: 'var(--text2)' }}>{list?.name || '...'}</span>
        </div>
        <div style={{ ...s.heading, marginBottom: 4 }}>{list?.name || 'Loading...'}</div>
        <div style={s.sub}>{leads.length} lead{leads.length !== 1 ? 's' : ''} · {doneCount} playbook{doneCount !== 1 ? 's' : ''} generated</div>

        <div style={s.actions}>
          <button style={s.btn('primary')} onClick={() => setModal('add')}>+ Add Lead</button>
          <button style={s.btn('default')} onClick={() => setModal('csv')}>↑ Import CSV</button>
          {leads.length > 0 && (
            <button style={s.btn('success')} onClick={generateAll} disabled={generating}>
              {generating ? `Generating... ${progress}%` : `⚡ Generate All Playbooks (${leads.length})`}
            </button>
          )}
        </div>

        {generating && (
          <div style={s.progress}>
            <div style={s.progressBar(progress)} />
          </div>
        )}

        {leads.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No leads yet</div>
            <div style={{ fontSize: 13 }}>Add leads manually or import a CSV to get started</div>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Company</th>
                <th style={s.th}>Title</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <>
                  <tr key={lead.id} style={{ cursor: 'pointer' }}
                    onClick={() => toggleRow(lead.id)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500 }}>{lead.full_name || '—'}</div>
                    </td>
                    <td style={s.td}>{lead.company || '—'}</td>
                    <td style={s.td}>{lead.title || '—'}</td>
                    <td style={s.td}>{lead.email || '—'}</td>
                    <td style={s.td}>
                      <span style={s.badge(lead.status)}>
                        {statusColors[lead.status]?.label || 'Pending'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {lead.status === 'done' ? (
                          <button style={s.regenBtn} onClick={e => generateOne(e, lead.id)}>Regen</button>
                        ) : lead.status === 'generating' ? (
                          <span style={{ fontSize: 12, color: 'var(--warning)' }}>Working...</span>
                        ) : (
                          <button style={s.genBtn} onClick={e => generateOne(e, lead.id)}>Generate</button>
                        )}
                        <button style={s.delRowBtn} onClick={e => deleteLead(e, lead.id)} title="Remove lead">✕</button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === lead.id && (
                    <tr key={`expand-${lead.id}`}>
                      <td colSpan={6} style={s.rowExpand}>
                        <div style={s.expandInner}>
                          {lead.status === 'done' && (lead.research || lead.email1) ? (
                            <PlaybookViewer playbook={lead} leadId={lead.id} />
                          ) : lead.status === 'generating' ? (
                            <div style={{ color: 'var(--text2)', fontSize: 13, padding: '1rem 0' }}>Building playbook — this takes about 15 seconds...</div>
                          ) : lead.status === 'error' ? (
                            <div style={{ color: 'var(--danger)', fontSize: 13, padding: '1rem 0' }}>Generation failed. Check your company profile is complete, then try again.</div>
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

      {/* Add Lead Modal */}
      {modal === 'add' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Add lead</div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Full name</label>
                <input autoFocus value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Sarah Chen" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Company</label>
                <input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Apex Federal Solutions" />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Title</label>
                <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="VP of Business Development" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="s.chen@apex.com" />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>LinkedIn URL (optional)</label>
              <input value={addForm.linkedin} onChange={e => setAddForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div style={s.field}>
              <label style={s.label}>Notes (optional)</label>
              <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Met at GovCon Summit, interested in 8(a) compliance module" style={{ minHeight: 60 }} />
            </div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={s.saveBtn} onClick={addLead} disabled={!addForm.full_name && !addForm.company}>Add lead</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {modal === 'csv' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Import from CSV</div>
            <div style={s.dropZone} onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importCsv(f); }}>
              <div style={s.dropText}>Drop your CSV here or click to browse</div>
              <div style={s.dropHint}>Columns: name, company, title, email, linkedin (optional), notes (optional)</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) importCsv(e.target.files[0]); }} />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              Column headers are flexible — the importer will match variations like "Full Name", "Company", "Email Address", etc.
            </div>
            <div style={s.modalBtns}>
              <button style={{ ...s.cancelBtn, flex: 'unset', padding: '9px 20px' }} onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
