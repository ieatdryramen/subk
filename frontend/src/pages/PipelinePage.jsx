import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const EMAIL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'email1_sent', label: 'Email 1 Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'email2_sent', label: 'Email 2 Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'email3_sent', label: 'Email 3 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'email4_sent', label: 'Email 4 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'replied', label: 'Replied ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const CALL_STAGES = [
  { key: 'not_started', label: 'Not Called', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'call_attempted', label: 'Attempted', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'call_connected', label: 'Connected', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'call_voicemail', label: 'Voicemail', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { key: 'call_booked', label: 'Meeting Booked', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const LINKEDIN_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'linkedin_connected', label: 'Connected', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'linkedin_dm_sent', label: 'DM Sent', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'linkedin_replied', label: 'Replied', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const ALL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'in_progress_1', label: 'Touch 1 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_2', label: 'Touch 2 🔗', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'in_progress_3', label: 'Touch 3 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_4', label: 'Touch 4 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_5', label: 'Touch 5 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_6', label: 'Touch 6 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_7', label: 'Touch 7 💬', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'in_progress_8', label: 'Touch 8 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'in_progress_9', label: 'Touch 9 ✉', color: '#08A5BF', bg: 'rgba(8,165,191,0.1)' },
  { key: 'in_progress_10', label: 'Touch 10 📞', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  { key: 'mefu', label: 'MEFU 📅', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'meeting_booked', label: '🗓 Meeting Booked', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { key: 'completed', label: 'Completed ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const VIEW_MODES = [
  { key: 'all', label: '📋 All', stages: ALL_STAGES, stageField: 'sequence_stage' },
  { key: 'email', label: '✉ Email', stages: EMAIL_STAGES, stageField: 'email_stage' },
  { key: 'call', label: '📞 Calls', stages: CALL_STAGES, stageField: 'call_stage' },
  { key: 'linkedin', label: '🔗 LinkedIn', stages: LINKEDIN_STAGES, stageField: 'linkedin_stage' },
];

export default function PipelinePage() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('all');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [viewMode, setViewMode] = useState('all');
  const [search, setSearch] = useState('');
  const [icpFilter, setIcpFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkMoveProgress, setBulkMoveProgress] = useState(0);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentView = VIEW_MODES.find(v => v.key === viewMode);
  const STAGES = currentView.stages;
  const stageField = currentView.stageField;

  useEffect(() => {
    api.get('/lists').then(r => setLists(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!lists.length) return;
    setLoading(true);
    const toLoad = selectedList === 'all' ? lists : lists.filter(l => String(l.id) === selectedList);
    Promise.all(toLoad.map(list => api.get(`/lists/${list.id}/leads`).then(r => Array.isArray(r.data) ? r.data : r.data.leads || [])))
      .then(results => { setLeads(results.flat().filter(l => l.status === 'done')); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedList, lists]);

  // Clear selection when view changes
  useEffect(() => { setSelectedIds(new Set()); setBulkStage(''); }, [viewMode]);

  const moveStage = async (leadId, newStage) => {
    const prev = leads.find(l => l.id === leadId);
    const prevStage = prev ? prev[stageField] : null;
    const prevSeqStage = prev ? prev.sequence_stage : null;
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, [stageField]: newStage, sequence_stage: viewMode === 'all' ? newStage : l.sequence_stage } : l));
    try {
      await api.post(`/sequence/${leadId}/stage`, { stage: newStage, field: stageField });
    } catch (err) {
      console.error(err);
      // Rollback optimistic update
      setLeads(ls => ls.map(l => l.id === leadId ? { ...l, [stageField]: prevStage, sequence_stage: prevSeqStage } : l));
      showToast('Failed to move lead — reverted', 'error');
    }
  };

  const bulkMove = async () => {
    if (!bulkStage || !selectedIds.size) return;
    setBulkMoving(true);
    setBulkMoveProgress(0);
    setMoveError(null);
    const ids = [...selectedIds];
    const total = ids.length;
    // Snapshot for rollback
    const snapshot = leads.filter(l => selectedIds.has(l.id)).map(l => ({ id: l.id, [stageField]: l[stageField], sequence_stage: l.sequence_stage }));
    // Optimistic update
    setLeads(ls => ls.map(l => selectedIds.has(l.id) ? { ...l, [stageField]: bulkStage, sequence_stage: viewMode === 'all' ? bulkStage : l.sequence_stage } : l));
    let failed = 0;
    try {
      const batchSize = 10;
      let done = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(id =>
          api.post(`/sequence/${id}/stage`, { stage: bulkStage, field: stageField })
        ));
        failed += results.filter(r => r.status === 'rejected').length;
        done += batch.length;
        setBulkMoveProgress(Math.round((done / total) * 100));
      }
    } catch (err) {
      console.error(err);
      failed = total;
    }
    if (failed > 0) {
      // Rollback all on any failure
      setLeads(ls => ls.map(l => {
        const snap = snapshot.find(s => s.id === l.id);
        return snap ? { ...l, [stageField]: snap[stageField], sequence_stage: snap.sequence_stage } : l;
      }));
      showToast(`${failed} of ${total} leads failed to move — reverted`, 'error');
    } else {
      showToast(`${total} leads moved successfully`, 'success');
    }
    setBulkMoving(false);
    setBulkMoveProgress(0);
    setSelectedIds(new Set());
    setBulkStage('');
  };

  const toggleSelect = (e, leadId) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStage(''); };

  const onDragStart = (e, leadId) => {
    if (selectedIds.size === 0) {
      setDraggedId(leadId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', leadId);
      e.currentTarget.style.opacity = '0.5';
    }
  };
  const onDragEnd = (e) => { setDraggedId(null); setDragOverStage(null); e.currentTarget.style.opacity = '1'; };
  const onDragOver = (e, stageKey) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stageKey); };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    const lid = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(lid) && lid && stageKey) moveStage(lid, stageKey);
    setDragOverStage(null); setDraggedId(null);
  };

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search || (l.full_name || '').toLowerCase().includes(search.toLowerCase()) || (l.company || '').toLowerCase().includes(search.toLowerCase());
    const matchIcp = icpFilter === 'all' || (icpFilter === 'high' && l.icp_score >= 70) || (icpFilter === 'mid' && l.icp_score >= 40 && l.icp_score < 70) || (icpFilter === 'low' && (l.icp_score == null || l.icp_score < 40));
    return matchSearch && matchIcp;
  });

  const getStageLeads = (key) => filteredLeads.filter(l => (l[stageField] || l.sequence_stage || 'not_started') === key);

  const total = filteredLeads.length;
  const inProgress = filteredLeads.filter(l => {
    const s = l[stageField] || l.sequence_stage || '';
    return s.includes('in_progress') || ['email1_sent','email2_sent','email3_sent','call_attempted','call_connected','call_voicemail','linkedin_connected','linkedin_dm_sent'].includes(s);
  }).length;
  const completed = filteredLeads.filter(l => ['completed','replied','call_booked','linkedin_replied'].includes(l[stageField] || l.sequence_stage || '')).length;
  const notStarted = filteredLeads.filter(l => !l[stageField] && (!l.sequence_stage || l.sequence_stage === 'not_started')).length;

  const btnBase = { padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem' }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Pipeline</div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          Drag leads between stages · check boxes for bulk actions
        </div>

        {/* Stats */}
        <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
          {[
            { n: total, l: 'Total leads', c: 'var(--text)' },
            { n: notStarted, l: 'Not started', c: 'var(--text3)' },
            { n: inProgress, l: 'In progress', c: 'var(--accent2)' },
            { n: completed, l: 'Completed', c: 'var(--success)' },
          ].map(x => (
            <div key={x.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: x.c }}>{x.n}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>{x.l}</div>
            </div>
          ))}
        </div>

        {/* View mode tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
          {VIEW_MODES.map(v => (
            <button key={v.key}
              style={{ ...btnBase, background: viewMode === v.key ? 'var(--accent)' : 'var(--bg2)', color: viewMode === v.key ? '#fff' : 'var(--text2)', borderColor: viewMode === v.key ? 'var(--accent)' : 'var(--border)' }}
              onClick={() => setViewMode(v.key)}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: selectedIds.size > 0 ? 8 : '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
            style={{ fontSize: 13, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 200 }} />
          <select value={selectedList} onChange={e => setSelectedList(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 'auto' }}>
            <option value="all">All lists</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={icpFilter} onChange={e => setIcpFilter(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', width: 'auto' }}>
            <option value="all">All ICP scores</option>
            <option value="high">High ICP (70+)</option>
            <option value="mid">Mid ICP (40-69)</option>
            <option value="low">Low / Unscored</option>
          </select>
          <button style={{ ...btnBase, background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, padding: '7px 12px' }} onClick={selectAll}>
            Select all ({filteredLeads.length})
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {loading ? 'Loading...' : `${total} leads`}
          </span>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'center', padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent2)' }}>{selectedIds.size} selected</span>
            <span style={{ color: 'var(--border)', fontSize: 13 }}>·</span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Move to:</span>
            <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
              style={{ fontSize: 13, padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
              <option value="">— pick a stage —</option>
              {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
            </select>
            <button
              style={{ ...btnBase, background: bulkStage ? 'var(--accent)' : 'var(--bg3)', color: bulkStage ? '#fff' : 'var(--text3)', borderColor: bulkStage ? 'var(--accent)' : 'var(--border)', padding: '5px 14px', fontSize: 12 }}
              onClick={bulkMove} disabled={!bulkStage || bulkMoving}>
              {bulkMoving ? `Moving... ${bulkMoveProgress}%` : '→ Move'}
            </button>
            <button style={{ ...btnBase, background: 'transparent', color: 'var(--text3)', padding: '5px 10px', fontSize: 12 }} onClick={clearSelection}>
              ✕ Clear
            </button>
          </div>
        )}


        {/* Kanban board */}
        <div className="pf-kanban" style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.map(stage => {
            const stageLeads = getStageLeads(stage.key);
            const isOver = dragOverStage === stage.key;
            return (
              <div key={stage.key}
                style={{ background: isOver ? stage.bg : 'var(--bg2)', border: `1px solid ${isOver ? stage.color : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', minHeight: 200, transition: 'all 0.15s' }}
                onDragOver={e => onDragOver(e, stage.key)}
                onDrop={e => onDrop(e, stage.key)}
                onDragLeave={() => setDragOverStage(null)}>
                <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stage.label}</span>
                  <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 6px', borderRadius: 10 }}>{loading ? '—' : stageLeads.length}</span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {loading ? (
                    <>
                      {[1, 2, 3].map(i => (
                        <div key={`skeleton-${i}`}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 10px', height: 70, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      {stageLeads.map(lead => {
                        const isSelected = selectedIds.has(lead.id);
                        return (
                          <div key={lead.id}
                            draggable={selectedIds.size === 0}
                            onDragStart={e => onDragStart(e, lead.id)}
                            onDragEnd={onDragEnd}
                            style={{ background: isSelected ? 'var(--accent-bg)' : draggedId === lead.id ? 'var(--bg3)' : 'var(--bg)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '9px 10px', cursor: selectedIds.size > 0 ? 'pointer' : 'grab', userSelect: 'none', transition: 'all 0.15s' }}
                            onClick={e => selectedIds.size > 0 && toggleSelect(e, lead.id)}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => toggleSelect(e, lead.id)}
                                onClick={e => e.stopPropagation()}
                                style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer', width: 14, height: 14 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {lead.full_name || lead.email || '—'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {lead.company || lead.title || '—'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  {lead.icp_score != null ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: lead.icp_score >= 70 ? 'rgba(34,197,94,0.15)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.15)' : 'var(--bg3)', color: lead.icp_score >= 70 ? '#22c55e' : lead.icp_score >= 40 ? '#f59e0b' : 'var(--text3)' }}>
                                      {lead.icp_score}
                                    </span>
                                  ) : <span />}
                                  <button style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                                    onClick={e => { e.stopPropagation(); navigate(`/lists/${lead.list_id}`); }}>→</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {stageLeads.length === 0 && (
                        <div style={{ fontSize: 11, color: isOver ? stage.color : 'var(--text3)', textAlign: 'center', padding: '20px 0', opacity: 0.7 }}>
                          {isOver ? 'Drop here' : 'Empty'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

