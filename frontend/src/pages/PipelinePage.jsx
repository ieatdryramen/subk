import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const EMAIL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'email1_sent', label: 'Email 1 Sent', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'email2_sent', label: 'Email 2 Sent', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'email3_sent', label: 'Email 3 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'email4_sent', label: 'Email 4 Sent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'replied', label: 'Replied ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const CALL_STAGES = [
  { key: 'not_started', label: 'Not Called', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'call_attempted', label: 'Attempted', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'call_connected', label: 'Connected', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'call_voicemail', label: 'Voicemail', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { key: 'call_booked', label: 'Meeting Booked', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const LINKEDIN_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'linkedin_connected', label: 'Connected', color: '#0077b5', bg: 'rgba(0,119,181,0.1)' },
  { key: 'linkedin_dm_sent', label: 'DM Sent', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'linkedin_replied', label: 'Replied', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const ALL_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'in_progress_1', label: 'Day 1 ✉', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'in_progress_2', label: 'Day 3 ✉', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'in_progress_3', label: 'Day 7 ✉', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'in_progress_4', label: 'Day 14 ✉', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
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
  const navigate = useNavigate();

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
    Promise.all(toLoad.map(list => api.get(`/lists/${list.id}/leads`).then(r => r.data)))
      .then(results => { setLeads(results.flat().filter(l => l.status === 'done')); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedList, lists]);

  const moveStage = async (leadId, newStage) => {
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, [stageField]: newStage, sequence_stage: viewMode === 'all' ? newStage : l.sequence_stage } : l));
    try {
      if (viewMode === 'all') {
        await api.post(`/sequence/${leadId}/stage`, { stage: newStage });
      } else {
        await api.post(`/sequence/${leadId}/stage`, { stage: newStage, field: stageField });
      }
    } catch (err) { console.error(err); }
  };

  const onDragStart = (e, leadId) => {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
    e.currentTarget.style.opacity = '0.5';
  };
  const onDragEnd = (e) => { setDraggedId(null); setDragOverStage(null); e.currentTarget.style.opacity = '1'; };
  const onDragOver = (e, stageKey) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stageKey); };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    const lid = parseInt(e.dataTransfer.getData('text/plain'));
    if (lid && stageKey) moveStage(lid, stageKey);
    setDragOverStage(null); setDraggedId(null);
  };

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search || (l.full_name || '').toLowerCase().includes(search.toLowerCase()) || (l.company || '').toLowerCase().includes(search.toLowerCase());
    const matchIcp = icpFilter === 'all' || (icpFilter === 'high' && l.icp_score >= 70) || (icpFilter === 'mid' && l.icp_score >= 40 && l.icp_score < 70) || (icpFilter === 'low' && (l.icp_score == null || l.icp_score < 40));
    return matchSearch && matchIcp;
  });

  const getStageLeads = (key) => filteredLeads.filter(l => (l[stageField] || l.sequence_stage || 'not_started') === key);

  const total = filteredLeads.length;
  const inProgress = filteredLeads.filter(l => (l[stageField] || l.sequence_stage || '').includes('in_progress') || ['email1_sent','email2_sent','email3_sent','call_attempted','call_connected','call_voicemail','linkedin_connected','linkedin_dm_sent'].includes(l[stageField] || l.sequence_stage || '')).length;
  const completed = filteredLeads.filter(l => ['completed','replied','call_booked','linkedin_replied'].includes(l[stageField] || l.sequence_stage || '')).length;
  const notStarted = filteredLeads.filter(l => !l[stageField] && (!l.sequence_stage || l.sequence_stage === 'not_started')).length;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem' }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Pipeline</div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          Drag leads between stages to track your cadence
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
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
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer', border: viewMode === v.key ? '1px solid var(--accent)' : '1px solid var(--border)', background: viewMode === v.key ? 'var(--accent)' : 'var(--bg2)', color: viewMode === v.key ? '#fff' : 'var(--text2)', transition: 'all 0.15s' }}
              onClick={() => setViewMode(v.key)}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
            style={{ fontSize: 13, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: 200 }} />
          <select value={selectedList} onChange={e => setSelectedList(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
            <option value="all">All lists</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={icpFilter} onChange={e => setIcpFilter(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
            <option value="all">All ICP scores</option>
            <option value="high">High ICP (70+)</option>
            <option value="mid">Mid ICP (40-69)</option>
            <option value="low">Low / Unscored</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {loading ? 'Loading...' : `${total} leads · drag to move`}
          </span>
        </div>

        {/* Kanban board */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 10, overflowX: 'auto', minWidth: 0 }}>
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
                  <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 6px', borderRadius: 10 }}>{stageLeads.length}</span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stageLeads.map(lead => (
                    <div key={lead.id} draggable onDragStart={e => onDragStart(e, lead.id)} onDragEnd={onDragEnd}
                      style={{ background: draggedId === lead.id ? 'var(--bg3)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 10px', cursor: 'grab', userSelect: 'none', transition: 'opacity 0.15s' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2, color: 'var(--text)', lineHeight: 1.3 }}>{lead.full_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, lineHeight: 1.3 }}>{lead.company || '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {lead.icp_score != null ? (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: lead.icp_score >= 70 ? 'rgba(34,197,94,0.15)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.15)' : 'var(--bg3)', color: lead.icp_score >= 70 ? '#22c55e' : lead.icp_score >= 40 ? '#f59e0b' : 'var(--text3)' }}>
                            {lead.icp_score}
                          </span>
                        ) : <span />}
                        <button style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                          onClick={() => navigate(`/lists/${lead.list_id}`)}>→</button>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div style={{ fontSize: 11, color: isOver ? stage.color : 'var(--text3)', textAlign: 'center', padding: '20px 0', opacity: 0.7 }}>
                      {isOver ? 'Drop here' : 'Empty'}
                    </div>
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
