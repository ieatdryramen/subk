import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'in_progress_1', label: 'Day 1 ✉', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'in_progress_2', label: 'Day 3 ✉', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
  { key: 'in_progress_3', label: 'Day 7 ✉', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'in_progress_4', label: 'Day 14 ✉', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { key: 'completed', label: 'Completed ✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

export default function PipelinePage() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('all');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const navigate = useNavigate();

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
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, sequence_stage: newStage } : l));
    try {
      await api.post(`/sequence/${leadId}/stage`, { stage: newStage });
    } catch (err) {
      console.error(err);
    }
  };

  // Drag handlers
  const onDragStart = (e, leadId) => {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    setDraggedId(null);
    setDragOverStage(null);
    e.currentTarget.style.opacity = '1';
  };

  const onDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const onDrop = (e, stageKey) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    if (id && stageKey) moveStage(id, stageKey);
    setDragOverStage(null);
    setDraggedId(null);
  };

  const getStageLeads = (key) => leads.filter(l => (l.sequence_stage || 'not_started') === key);
  const total = leads.length;
  const inProgress = leads.filter(l => l.sequence_stage?.startsWith('in_progress')).length;
  const completed = leads.filter(l => l.sequence_stage === 'completed').length;
  const notStarted = leads.filter(l => !l.sequence_stage || l.sequence_stage === 'not_started').length;

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
          ].map(s => (
            <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: s.n === 0 ? 'Inter, sans-serif' : 'Syne, sans-serif', color: s.c }}>{s.n}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'center' }}>
          <select value={selectedList} onChange={e => setSelectedList(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
            <option value="all">All lists</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {loading ? 'Loading...' : `${total} leads · drag to move between stages`}
          </span>
        </div>

        {/* Kanban board */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, overflowX: 'auto', minWidth: 0 }}>
          {STAGES.map(stage => {
            const stageLeads = getStageLeads(stage.key);
            const isOver = dragOverStage === stage.key;
            return (
              <div key={stage.key}
                style={{ background: isOver ? stage.bg : 'var(--bg2)', border: `1px solid ${isOver ? stage.color : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', minHeight: 200, transition: 'all 0.15s' }}
                onDragOver={e => onDragOver(e, stage.key)}
                onDrop={e => onDrop(e, stage.key)}
                onDragLeave={() => setDragOverStage(null)}>
                {/* Column header */}
                <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 6px', borderRadius: 10 }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stageLeads.map(lead => (
                    <div key={lead.id}
                      draggable
                      onDragStart={e => onDragStart(e, lead.id)}
                      onDragEnd={onDragEnd}
                      style={{ background: draggedId === lead.id ? 'var(--bg3)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 10px', cursor: 'grab', userSelect: 'none', transition: 'opacity 0.15s' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2, color: 'var(--text)', lineHeight: 1.3 }}>
                        {lead.full_name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, lineHeight: 1.3 }}>
                        {lead.company || '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {lead.icp_score != null ? (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: lead.icp_score >= 70 ? 'rgba(34,197,94,0.15)' : lead.icp_score >= 40 ? 'rgba(245,158,11,0.15)' : 'var(--bg3)', color: lead.icp_score >= 70 ? '#22c55e' : lead.icp_score >= 40 ? '#f59e0b' : 'var(--text3)' }}>
                            {lead.icp_score}
                          </span>
                        ) : <span />}
                        <button style={{ fontSize: 10, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                          onClick={() => navigate(`/lists/${lead.list_id}`)}>
                          →
                        </button>
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
