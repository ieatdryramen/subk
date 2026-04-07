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
    background: variant === 'primary' ? 'var(--accent)' : variant === 'success' ? 'var(--success-bg)' : variant === 'warning' ? 'var(--warning-bg)' : variant === 'info' ? 'var(--bg3)' : variant === 'danger' ? 'var(--danger-bg)' : 'var(--bg2)',
    color: variant === 'primary' ? '#fff' : variant === 'success' ? 'var(--success)' : variant === 'warning' ? 'var(--warning)' : variant === 'info' ? 'var(--text)' : variant === 'danger' ? 'var(--danger)' : 'var(--text2)',
    border: variant === 'primary' ? 'none' : variant === 'success' ? '1px solid var(--success)' : variant === 'warning' ? '1px solid var(--warning)' : variant === 'danger' ? '1px solid var(--danger)' : '1px solid var(--border)',
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
  cancelBtn: { flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)', cursor: 'pointer' },
  saveBtn: { flex: 1, padding: 10, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, border: 'none', cursor: 'pointer' },
  dropZone: { border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' },
  checkbox: { width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' },
};

export default function LeadListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [leads, setLeads] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [addForm, setAddForm] = useState({ full_name: '', company: '', title: '', email: '', phone: '', linkedin: '', notes: '' });
  const [generating, setGenerating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zohoStatus, setZohoStatus] = useState({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('icp_score');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [icpMin, setIcpMin] = useState('');
  const [icpMax, setIcpMax] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkZohoing, setBulkZohoing] = useState(false);
  const [bulkScoring, setBulkScoring] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateSections, setGenerateSections] = useState({ email1: true, email2: true, email3: true, email4: true, linkedin: true, call_opener: true, objection_handling: true, research: true });
  const [generateSituation, setGenerateSituation] = useState('');
  const fileRef = useRef();
  const pollRef = useRef();

  const [loadError, setLoadError] = useState(null);

  const loadLeads = async () => {
    setLoadError(null);
    try {
      const [listRes, leadsRes] = await Promise.all([
        api.get('/lists').then(r => r.data.find(l => l.id === parseInt(id))),
        api.get(`/lists/${id}/leads`),
      ]);
      setList(listRes);
      setLeads(leadsRes.data);
    } catch (err) {
      console.error(err);
      setLoadError('Failed to load leads');
    }
  };

  useEffect(() => {
    loadLeads();
    api.get('/zoho/status').then(r => setZohoStatus({ connected: r.data.connected })).catch(() => {});
  }, [id]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        setModal(null); setShowUpgradeModal(false); setEditingLead(null);
        setShowGenerateModal(false); setGenerateSituation('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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

  const bulkGenerate = async (sections) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setShowGenerateModal(false);
    setGenerateSituation('');
    setBulkGenerating(true);
    for (const leadId of ids) {
      try {
        setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'generating' } : l));
        await api.post(`/playbooks/generate/${leadId}`, { sections, situation: generateSituation || undefined });
        setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'done' } : l));
      } catch (err) {
        if (err.response?.data?.upgrade) { setShowUpgradeModal(true); break; }
        setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status: 'error' } : l));
      }
    }
    setBulkGenerating(false);
    setSelectedIds(new Set());
    await loadLeads();
  };

  const missingFields = (lead) => {
    const missing = [];
    if (!lead.email) missing.push('email');
    if (!lead.full_name) missing.push('name');
    if (!lead.company) missing.push('company');
    if (!lead.title) missing.push('title');
    return missing;
  };

  const bulkDelete = async () => {
    if (!selectedIds.size || !confirm(`Delete ${selectedIds.size} leads?`)) return;
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map(lid => api.delete(`/lists/${id}/leads/${lid}`)));
    const succeeded = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    const failCount = ids.length - succeeded.size;
    setLeads(ls => ls.filter(l => !succeeded.has(l.id)));
    setSelectedIds(prev => {
      const next = new Set(prev);
      succeeded.forEach(sid => next.delete(sid));
      return next;
    });
    if (failCount > 0) {
      alert(`${failCount} of ${ids.length} leads failed to delete — try again`);
    }
  };

  const toggleSelect = (lid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(lid) ? next.delete(lid) : next.add(lid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkZoho = async () => {
    if (!selectedIds.size) return;
    setBulkZohoing(true);
    let ok = 0, fail = 0;
    for (const lid of [...selectedIds]) {
      try { await api.post(`/zoho/push/${lid}`); ok++; }
      catch { fail++; }
    }
    setBulkZohoing(false);
    setSelectedIds(new Set());
    alert(`Pushed ${ok} to Zoho${fail > 0 ? `, ${fail} failed` : ''}`);
  };

  const bulkScore = async () => {
    if (!selectedIds.size) return;
    setBulkScoring(true);
    for (const lid of [...selectedIds]) {
      try { await api.post(`/scoring/score/${lid}`); }
      catch { /* continue */ }
    }
    setBulkScoring(false);
    setSelectedIds(new Set());
    await loadLeads();
  };

  const exportSelected = () => {
    const token = localStorage.getItem('sumx_token');
    const ids = [...selectedIds].join(',');
    window.open(`/api/export/list/${id}/html?token=${token}&ids=${ids}`, '_blank');
  };

  const cancelAll = async () => {
    try {
      await api.post(`/playbooks/cancel-list/${id}`);
      setGenerating(false); setProgress(0);
      clearInterval(pollRef.current);
      await loadLeads();
    } catch (err) { console.error(err); }
  };

  const openEdit = (lead) => {
    setEditForm({
      full_name: lead.full_name || '',
      company: lead.company || '',
      title: lead.title || '',
      email: lead.email || '',
      phone: lead.phone || '',
      linkedin: lead.linkedin || '',
      notes: lead.notes || '',
    });
    setEditingLead(lead);
  };

  const saveEdit = async () => {
    if (!editingLead) return;
    setSavingEdit(true);
    try {
      await api.put(`/lists/${id}/leads/${editingLead.id}`, editForm);
      setLeads(ls => ls.map(l => l.id === editingLead.id ? { ...l, ...editForm } : l));
      setEditingLead(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally { setSavingEdit(false); }
  };

  const scoreList = async () => {
    setScoring(true); setProgress(0);
    try { await api.post(`/scoring/score-list/${id}`); }
    catch (err) { alert(err.response?.data?.error || 'Scoring failed.'); setScoring(false); }
  };

  const exportList = (format) => {
    const token = localStorage.getItem('sumx_token');
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
      alert(err.response?.data?.error || 'Zoho push failed.');
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

  const sortedLeads = [...leads].sort((a, b) => {
    let aVal = a[sortBy], bVal = b[sortBy];
    if (sortBy === 'icp_score') { aVal = aVal ?? -1; bVal = bVal ?? -1; }
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredLeads = sortedLeads.filter(l => {
    const matchSearch = !search ||
      (l.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchIcpMin = !icpMin || (l.icp_score != null && l.icp_score >= parseInt(icpMin));
    const matchIcpMax = !icpMax || (l.icp_score != null && l.icp_score <= parseInt(icpMax));
    const matchTitle = !titleFilter || (l.title || '').toLowerCase().includes(titleFilter.toLowerCase());
    const matchCompany = !companyFilter || (l.company || '').toLowerCase().includes(companyFilter.toLowerCase());
    return matchSearch && matchStatus && matchIcpMin && matchIcpMax && matchTitle && matchCompany;
  });

  const doneCount = leads.filter(l => l.status === 'done').length;
  const scoredCount = leads.filter(l => l.icp_score != null).length;
  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;
  const activeFilters = [icpMin, icpMax, titleFilter, companyFilter].filter(Boolean).length;

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
          {filteredLeads.length !== leads.length ? ` · ${filteredLeads.length} shown` : ''}
        </div>

        <div style={s.actions} className="pf-list-actions">
          <button style={s.btn('primary')} onClick={() => setModal('add')}>+ Add Lead</button>
          <button style={s.btn('default')} onClick={() => setModal('csv')}>↑ Import CSV</button>
          {leads.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={s.btn('success')} onClick={generateAll} disabled={generating || scoring}>
                {generating ? `Generating... ${progress}%` : `⚡ Generate All (${leads.length})`}
              </button>
              {generating && (
                <button style={s.btn('danger')} onClick={cancelAll}>✕ Cancel</button>
              )}
            </div>
          )}
          {leads.length > 0 && (
            <button style={s.btn('warning')} onClick={scoreList} disabled={scoring || generating}>
              {scoring ? `Scoring... ${progress}%` : `◎ Score ICP Fit`}
            </button>
          )}
          {doneCount > 0 && (
            <div style={{ position: 'relative' }}>
              <button style={s.btn('info')} onClick={() => setShowExportMenu(m => !m)}>↓ Export ▾</button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', zIndex: 50, minWidth: 180 }}>
                  <div style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}
                    onMouseEnter={e => e.target.style.background='var(--bg3)'}
                    onMouseLeave={e => e.target.style.background=''}
                    onClick={() => exportList('html')}>📄 HTML (Print to PDF)</div>
                  <div style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)', borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => e.target.style.background='var(--bg3)'}
                    onMouseLeave={e => e.target.style.background=''}
                    onClick={() => exportList('csv')}>📊 CSV spreadsheet</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Smart stats bar */}
        {!generating && !scoring && leads.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Ready', count: leads.filter(l => l.status === 'done').length, color: 'var(--success)', bg: 'var(--success-bg)', filter: 'done' },
              { label: 'Pending', count: leads.filter(l => l.status === 'pending').length, color: 'var(--text3)', bg: 'var(--bg3)', filter: 'pending' },
              { label: 'High ICP (70+)', count: leads.filter(l => l.icp_score >= 70).length, color: 'var(--accent2)', bg: 'var(--accent-bg)', filter: null },
              { label: 'Errors', count: leads.filter(l => l.status === 'error').length, color: 'var(--danger)', bg: 'var(--danger-bg)', filter: 'error' },
            ].filter(x => x.count > 0).map(x => (
              <div key={x.label} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: x.bg, color: x.color, border: `1px solid ${x.color}`, cursor: 'pointer' }}
                onClick={() => x.filter ? setStatusFilter(prev => prev === x.filter ? 'all' : x.filter) : null}>
                {x.count} {x.label}
              </div>
            ))}
            {leads.filter(l => l.status === 'error').length > 0 && (
              <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, color: 'var(--danger)', cursor: 'pointer' }}
                onClick={() => leads.filter(l => l.status === 'error').forEach(l => generateOne({ stopPropagation: () => {} }, l.id))}>
                ↺ Retry errors
              </div>
            )}
          </div>
        )}

        {(generating || scoring) && (
          <div style={s.progress}><div style={s.progressBar(progress)} /></div>
        )}

        {/* Search + filters */}
        {leads.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, company, title, email..."
                style={{ flex: 1, minWidth: 220, padding: '7px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
                <option value="all">All status</option>
                <option value="done">Ready</option>
                <option value="pending">Pending</option>
                <option value="generating">Generating</option>
                <option value="error">Error</option>
              </select>
              <button
                style={{ ...s.btn(showAdvFilters || activeFilters > 0 ? 'warning' : 'info'), padding: '7px 12px', fontSize: 12 }}
                onClick={() => setShowAdvFilters(v => !v)}>
                {activeFilters > 0 ? `Filters (${activeFilters})` : 'More filters'}
              </button>
              {selectedIds.size > 0 ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selectedIds.size} selected</span>
                  <button style={s.btn('success')} onClick={() => setShowGenerateModal(true)} disabled={bulkGenerating}>
                    {bulkGenerating ? 'Generating...' : `⚡ Generate (${selectedIds.size})`}
                  </button>
                  <button style={s.btn('warning')} onClick={bulkScore} disabled={bulkScoring}>
                    {bulkScoring ? 'Scoring...' : `◎ Score (${selectedIds.size})`}
                  </button>
                  {zohoStatus.connected && (
                    <button style={s.btn('info')} onClick={bulkZoho} disabled={bulkZohoing}>
                      {bulkZohoing ? 'Pushing...' : `→ Zoho (${selectedIds.size})`}
                    </button>
                  )}
                  <button style={s.btn('info')} onClick={exportSelected}>↓ Export</button>
                  <button style={s.btn('danger')} onClick={bulkDelete}>🗑 Delete</button>
                  <button style={s.btn('info')} onClick={clearSelection}>✕ Clear</button>
                </div>
              ) : (
                <>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
                    <option value="icp_score">Sort: ICP Score</option>
                    <option value="company">Sort: Company</option>
                    <option value="title">Sort: Title</option>
                    <option value="status">Sort: Status</option>
                    <option value="full_name">Sort: Name</option>
                  </select>
                  <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    style={{ padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', minWidth: 36 }}>
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </button>
                </>
              )}
            </div>

            {/* Advanced filters panel */}
            {showAdvFilters && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ICP Score Min</label>
                  <input type="number" min="0" max="100" value={icpMin} onChange={e => setIcpMin(e.target.value)}
                    placeholder="0" style={{ width: 80, padding: '5px 8px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ICP Score Max</label>
                  <input type="number" min="0" max="100" value={icpMax} onChange={e => setIcpMax(e.target.value)}
                    placeholder="100" style={{ width: 80, padding: '5px 8px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Title contains</label>
                  <input value={titleFilter} onChange={e => setTitleFilter(e.target.value)}
                    placeholder="VP, Director..." style={{ width: 140, padding: '5px 8px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company contains</label>
                  <input value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                    placeholder="Federal, Gov..." style={{ width: 140, padding: '5px 8px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
                {activeFilters > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button style={{ ...s.btn('danger'), padding: '5px 12px', fontSize: 12 }}
                      onClick={() => { setIcpMin(''); setIcpMax(''); setTitleFilter(''); setCompanyFilter(''); }}>
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loadError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{loadError}</div>
            <button onClick={loadLeads} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
          </div>
        ) : leads.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No leads yet</div>
            <div style={{ fontSize: 13 }}>Add leads manually or import a CSV</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={s.table} className="pf-lead-table">
            <thead>
              <tr>
                <th style={{ ...s.th, width: 36 }}>
                  <input type="checkbox" style={s.checkbox} checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Company</th>
                <th style={s.th}>Title</th>
                <th style={s.th}>ICP Score</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <>
                  <tr key={lead.id} style={{ cursor: 'pointer', background: selectedIds.has(lead.id) ? 'var(--accent-bg)' : '', outline: selectedIds.has(lead.id) ? '1.5px solid var(--accent)' : 'none', outlineOffset: '-1px' }}
                    onClick={() => toggleRow(lead.id)}
                    onMouseEnter={e => { if (!selectedIds.has(lead.id)) e.currentTarget.style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { if (!selectedIds.has(lead.id)) e.currentTarget.style.background = ''; }}>
                    <td style={{ ...s.td, width: 52, padding: '0', textAlign: 'center', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); toggleSelect(lead.id); }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '12px 14px' }}>
                        <input type="checkbox" style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)', pointerEvents: 'none' }}
                          checked={selectedIds.has(lead.id)} onChange={() => {}} />
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500 }}>{lead.full_name || '—'}</div>
                      {missingFields(lead).length > 0 && (
                        <div title={`Missing: ${missingFields(lead).join(', ')}`} style={{ fontSize: 10, color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 10, padding: '1px 7px', display: 'inline-block', marginTop: 3 }}>
                          ⚠ missing {missingFields(lead).join(', ')}
                        </div>
                      )}
                      {lead.engagement_status && lead.engagement_status !== 'active' && (
                        <div style={{ fontSize: 10, borderRadius: 10, padding: '1px 7px', display: 'inline-block', marginTop: 3, marginLeft: missingFields(lead).length > 0 ? 4 : 0,
                          background: lead.engagement_status === 'meeting_booked' ? 'rgba(34,197,94,0.1)' : lead.engagement_status === 'responded' ? 'rgba(0,119,181,0.1)' : lead.engagement_status === 'not_interested' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: lead.engagement_status === 'meeting_booked' ? 'var(--success)' : lead.engagement_status === 'responded' ? '#0077b5' : lead.engagement_status === 'not_interested' ? 'var(--danger)' : '#f59e0b',
                          border: `1px solid currentColor` }}>
                          {lead.engagement_status === 'meeting_booked' ? '🗓 Meeting' : lead.engagement_status === 'responded' ? '💬 Responded' : lead.engagement_status === 'not_interested' ? '🚫 Not interested' : '🌱 Nurture'}
                        </div>
                      )}
                      {lead.snoozed_until && new Date(lead.snoozed_until) > new Date() && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px', display: 'inline-block', marginTop: 3, marginLeft: 4 }}>
                          😴 {new Date(lead.snoozed_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td style={s.td}>{lead.company || '—'}</td>
                    <td style={s.td}>{lead.title || '—'}</td>
                    <td style={s.td}>
                      {lead.icp_score != null ? (
                        <span style={s.scoreBadge(lead.icp_score)} title={lead.icp_reason || ''}>{lead.icp_score}</span>
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
                        <button style={s.smallBtn('default')} onClick={e => { e.stopPropagation(); openEdit(lead); }}>Edit</button>
                        <button style={s.smallBtn('red')} onClick={e => deleteLead(e, lead.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === lead.id && (
                    <tr key={`expand-${lead.id}`}>
                      <td colSpan={7} style={s.rowExpand}>
                        <div style={s.expandInner}>
                          {lead.icp_score != null && lead.icp_reason && (
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${scoreColor(lead.icp_score).color}` }}>
                              <strong>ICP Analysis:</strong> {lead.icp_reason}
                            </div>
                          )}
                          {lead.status === 'done' && (lead.research || lead.email1) ? (
                            <PlaybookViewer playbook={lead} leadId={lead.id} lead={lead} />
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
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {modal === 'add' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} className="pf-modal-card" onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Add lead</div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Full name</label><input autoFocus value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Sarah Chen" /></div>
              <div style={s.field}><label style={s.label}>Company</label><input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Apex Federal" /></div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Title</label><input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="VP of Business Development" /></div>
              <div style={s.field}><label style={s.label}>Email</label><input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="s.chen@apex.com" /></div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Phone</label><input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" /></div>
              <div style={s.field}><label style={s.label}>LinkedIn URL</label><input value={addForm.linkedin} onChange={e => setAddForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
            </div>
            <div style={s.field}><label style={s.label}>Notes (optional)</label><textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Met at conference..." style={{ minHeight: 60 }} /></div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={s.saveBtn} onClick={addLead} disabled={!addForm.full_name && !addForm.company}>Add lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div style={s.modal} onClick={() => setEditingLead(null)}>
          <div style={{ ...s.modalCard, maxWidth: 520 }} className="pf-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1.25rem' }}>Edit lead</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={s.label}>Full name</label><input value={editForm.full_name} onChange={e => setEditForm(f => ({...f, full_name: e.target.value}))} /></div>
              <div><label style={s.label}>Company</label><input value={editForm.company} onChange={e => setEditForm(f => ({...f, company: e.target.value}))} /></div>
              <div><label style={s.label}>Title</label><input value={editForm.title} onChange={e => setEditForm(f => ({...f, title: e.target.value}))} /></div>
              <div><label style={s.label}>Email</label><input value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} /></div>
              <div><label style={s.label}>Phone</label><input value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} placeholder="+1 (555) 000-0000" /></div>
              <div><label style={s.label}>LinkedIn URL</label><input value={editForm.linkedin} onChange={e => setEditForm(f => ({...f, linkedin: e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Notes</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                style={{ width: '100%', minHeight: 60, fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.saveBtn} onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save changes'}</button>
              <button style={{ ...s.saveBtn, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }} onClick={() => setEditingLead(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={s.modal} onClick={() => setShowUpgradeModal(false)}>
          <div style={{ ...s.modalCard, maxWidth: 460, textAlign: "center" }} className="pf-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Playbook limit reached</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              You've used all your free playbooks. Upgrade to keep generating personalized outreach.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
              {[
                { name: 'Starter', price: '$49/mo', detail: '100 playbooks' },
                { name: 'Team', price: '$149/mo', detail: '500 playbooks', featured: true },
                { name: 'Pro', price: '$299/mo', detail: 'Unlimited' },
              ].map(p => (
                <div key={p.name} style={{ padding: 12, background: p.featured ? 'var(--accent-bg)' : 'var(--bg3)', border: p.featured ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
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

      {/* Generate Section Picker Modal */}
      {showGenerateModal && (
        <div style={s.modal} onClick={() => { setShowGenerateModal(false); setGenerateSituation(''); }}>
          <div style={{ ...s.modalCard, maxWidth: 480 }} className="pf-modal-card" onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>⚡ Generate for {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}</div>

            {/* Situation picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...s.label, marginBottom: 6 }}>Situation — improves email relevance</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: '', label: 'Cold outreach' },
                  { key: 'just_won_contract', label: '🏆 Just won a contract' },
                  { key: 'mid_audit', label: '🔍 Mid-DCAA audit' },
                  { key: 'referred', label: '🤝 Was referred' },
                  { key: 'responded_before', label: '💬 Responded before' },
                ].map(sit => (
                  <button key={sit.key} onClick={() => setGenerateSituation(sit.key)}
                    style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', border: 'none',
                      background: generateSituation === sit.key ? 'var(--accent)' : 'var(--bg3)',
                      color: generateSituation === sit.key ? '#fff' : 'var(--text2)',
                      outline: generateSituation === sit.key ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    {sit.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...s.label, marginBottom: 6 }}>Sections to generate</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { key: 'research', label: 'Research Brief' },
                { key: 'email1', label: 'Email 1' },
                { key: 'email2', label: 'Email 2' },
                { key: 'email3', label: 'Email 3' },
                { key: 'email4', label: 'Email 4' },
                { key: 'linkedin', label: 'LinkedIn' },
                { key: 'call_opener', label: 'Call Opener' },
                { key: 'objection_handling', label: 'Objections' },
              ].map(sec => (
                <label key={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 10px', borderRadius: 'var(--radius)', border: `1px solid ${generateSections[sec.key] ? 'var(--accent)' : 'var(--border)'}`, background: generateSections[sec.key] ? 'var(--accent-bg)' : 'var(--bg3)' }}>
                  <input type="checkbox" checked={!!generateSections[sec.key]}
                    onChange={e => setGenerateSections(p => ({ ...p, [sec.key]: e.target.checked }))}
                    style={{ accentColor: 'var(--accent)' }} />
                  {sec.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn('default'), padding: '8px 16px' }} onClick={() => setGenerateSections({ email1: true, email2: true, email3: true, email4: true, linkedin: true, call_opener: true, objection_handling: true, research: true })}>Select all</button>
              <button style={s.cancelBtn} onClick={() => { setShowGenerateModal(false); setGenerateSituation(''); }}>Cancel</button>
              <button style={{ ...s.saveBtn, flex: 'unset', padding: '9px 22px' }}
                disabled={!Object.values(generateSections).some(Boolean)}
                onClick={() => bulkGenerate(generateSections)}>
                Generate →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Modal */}
      {modal === 'csv' && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalCard} className="pf-modal-card" onClick={e => e.stopPropagation()}>
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


