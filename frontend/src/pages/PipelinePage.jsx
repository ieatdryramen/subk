import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const STAGES = [
  { key: 'not_started', label: 'Not Started', color: 'var(--text3)', bg: 'var(--bg3)' },
  { key: 'in_progress_1', label: 'Day 1 Sent', color: 'var(--accent2)', bg: 'var(--accent-bg)' },
  { key: 'in_progress_2', label: 'Day 3 Sent', color: 'var(--accent2)', bg: 'var(--accent-bg)' },
  { key: 'in_progress_3', label: 'Day 7 Sent', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  { key: 'in_progress_4', label: 'Day 14 Sent', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  { key: 'completed', label: 'Completed', color: 'var(--success)', bg: 'var(--success-bg)' },
];

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1400 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' },
  filters: { display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' },
  filterSelect: { fontSize: 13, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' },
  board: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, overflowX: 'auto' },
  col: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', minWidth: 200 },
  colHead: { padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  colLabel: (color) => ({ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.4px' }),
  colCount: { fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 6px', borderRadius: 10 },
  colBody: { padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 100 },
  card: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.15s' },
  cardName: { fontSize: 13, fontWeight: 500, marginBottom: 2, color: 'var(--text)' },
  cardCompany: { fontSize: 11, color: 'var(--text2)', marginBottom: 6 },
  cardMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  score: (s) => ({ padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: s >= 70 ? 'var(--success-bg)' : s >= 40 ? 'var(--warning-bg)' : 'var(--bg3)', color: s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--text3)' }),
  moveBtn: { fontSize: 10, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' },
  stat: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' },
  statNum: { fontSize: 24, fontWeight: 700, fontFamily: 'Syne, sans-serif' },
  statLabel: { fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 },
};

export default function PipelinePage() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('all');
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/lists').then(r => {
      setLists(r.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const loadLeads = async () => {
      try {
        const listsToLoad = selectedList === 'all'
          ? lists
          : lists.filter(l => l.id === parseInt(selectedList));

        const results = await Promise.all(
          listsToLoad.map(list => api.get(`/lists/${list.id}/leads`).then(r => r.data))
        );
        const all = results.flat().filter(l => l.status === 'done');
        setAllLeads(all);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (lists.length) loadLeads();
  }, [selectedList, lists]);

  const moveStage = async (e, leadId, newStage) => {
    e.stopPropagation();
    try {
      await api.post(`/sequence/${leadId}/stage`, { stage: newStage });
      setAllLeads(ls => ls.map(l => l.id === leadId ? { ...l, sequence_stage: newStage } : l));
    } catch (err) { console.error(err); }
  };

  const getStageLeads = (stageKey) => allLeads.filter(l => (l.sequence_stage || 'not_started') === stageKey);

  const totalLeads = allLeads.length;
  const inProgress = allLeads.filter(l => l.sequence_stage?.startsWith('in_progress')).length;
  const completed = allLeads.filter(l => l.sequence_stage === 'completed').length;
  const notStarted = allLeads.filter(l => !l.sequence_stage || l.sequence_stage === 'not_started').length;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Pipeline</div>
        <div style={s.sub}>Track where every lead is in your cadence</div>

        <div style={s.stats}>
          <div style={s.stat}>
            <div style={s.statNum}>{totalLeads}</div>
            <div style={s.statLabel}>Total leads</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: 'var(--text3)' }}>{notStarted}</div>
            <div style={s.statLabel}>Not started</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: 'var(--accent2)' }}>{inProgress}</div>
            <div style={s.statLabel}>In progress</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: 'var(--success)' }}>{completed}</div>
            <div style={s.statLabel}>Completed</div>
          </div>
        </div>

        <div style={s.filters}>
          <select style={s.filterSelect} value={selectedList} onChange={e => setSelectedList(e.target.value)}>
            <option value="all">All lists</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>
            {loading ? 'Loading...' : `${totalLeads} leads with playbooks`}
          </span>
        </div>

        <div style={s.board}>
          {STAGES.map(stage => {
            const leads = getStageLeads(stage.key);
            const stageIdx = STAGES.findIndex(s => s.key === stage.key);
            return (
              <div key={stage.key} style={s.col}>
                <div style={s.colHead}>
                  <span style={s.colLabel(stage.color)}>{stage.label}</span>
                  <span style={s.colCount}>{leads.length}</span>
                </div>
                <div style={s.colBody}>
                  {leads.map(lead => (
                    <div key={lead.id} style={s.card}
                      onClick={() => navigate(`/lists/${lead.list_id}`)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div style={s.cardName}>{lead.full_name || '—'}</div>
                      <div style={s.cardCompany}>{lead.title ? `${lead.title} · ` : ''}{lead.company || '—'}</div>
                      <div style={s.cardMeta}>
                        {lead.icp_score != null
                          ? <span style={s.score(lead.icp_score)}>{lead.icp_score}</span>
                          : <span />}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {stageIdx > 0 && (
                            <button style={s.moveBtn} onClick={e => moveStage(e, lead.id, STAGES[stageIdx - 1].key)}>←</button>
                          )}
                          {stageIdx < STAGES.length - 1 && (
                            <button style={s.moveBtn} onClick={e => moveStage(e, lead.id, STAGES[stageIdx + 1].key)}>→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {leads.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '1rem 0' }}>Empty</div>
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
