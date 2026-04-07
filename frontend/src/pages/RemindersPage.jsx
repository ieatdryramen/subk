import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const TYPE_ICONS = { email: '✉', call: '📞', linkedin: '🔗', mefu: '📅' };

const TYPE_COLORS = {
  email:    { bg: 'var(--accent-bg)',        color: 'var(--accent2)', border: 'var(--accent)' },
  call:     { bg: 'rgba(34,197,94,0.08)',    color: 'var(--success)', border: 'var(--success)' },
  linkedin: { bg: 'var(--teal-bg)',          color: 'var(--teal)',    border: 'var(--teal)' },
  mefu:     { bg: 'rgba(245,158,11,0.08)',   color: 'var(--warning)', border: 'var(--warning)' },
};

const CALL_OUTCOMES = [
  { key: 'voicemail',        label: '📨 Voicemail' },
  { key: 'connected_followup', label: '📞 Connected' },
  { key: 'meeting_booked',   label: '🗓 Meeting!' },
  { key: 'not_interested',   label: '🚫 No' },
];

export default function RemindersPage() {
  const [data, setData]       = useState({ overdue: [], due: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [marking, setMarking] = useState({});
  const [showOutcome, setShowOutcome] = useState({});
  const [goalData, setGoalData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoadError(null);
    Promise.all([
      api.get('/sequence/due/today'),
      api.get('/goals/my'),
    ]).then(([dueR, goalR]) => {
      setData(dueR.data);
      setGoalData(goalR.data);
      setLoading(false);
    }).catch(err => {
      setLoadError('Failed to load touches');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const markDone = async (e, lead, touchpoint, call_outcome) => {
    e.stopPropagation();
    const key = `${lead.id}-${touchpoint}`;
    setMarking(m => ({ ...m, [key]: true }));
    setShowOutcome(s => ({ ...s, [key]: false }));
    try {
      await api.post(`/sequence/${lead.id}/touch`, { touchpoint, status: 'done', notes: '', call_outcome });
      load(); // reloads both leads and goals
    } catch (err) {
      console.error(err);
      alert('Failed to mark touch as done — please try again');
    }
    finally { setMarking(m => ({ ...m, [key]: false })); }
  };

  const filterLeads = (leads) => filter === 'all' ? leads : leads.filter(l => l.next_touch_type === filter);
  const allLeads = [...data.overdue, ...data.due];
  const filtered = filterLeads(allLeads);
  const overdueFiltered = filterLeads(data.overdue);
  const dueFiltered = filterLeads(data.due);
  const typeCounts = {
    email:    allLeads.filter(l => l.next_touch_type === 'email').length,
    call:     allLeads.filter(l => l.next_touch_type === 'call').length,
    linkedin: allLeads.filter(l => l.next_touch_type === 'linkedin').length,
  };

  const GoalBar = ({ label, actual, goal, color }) => {
    const pct = Math.min(Math.round((actual / Math.max(goal, 1)) * 100), 100);
    return (
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
          <span style={{ color: pct >= 100 ? 'var(--success)' : 'var(--text)', fontWeight: 600 }}>{actual}/{goal}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
  };

  const LeadRow = ({ lead, urgency }) => {
    const key = `${lead.id}-${lead.next_touch}`;
    const isMarking = marking[key];
    const isCall = lead.next_touch_type === 'call';
    const tc = TYPE_COLORS[lead.next_touch_type] || TYPE_COLORS.email;
    const urgencyBorder = urgency === 'overdue' ? '2px solid var(--danger)' : '1px solid var(--border)';

    return (
      <div style={{ background: 'var(--bg2)', border: urgencyBorder, borderRadius: 'var(--radius)', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
          onClick={() => navigate(`/lists/${lead.list_id}`)}>
          {/* Type icon */}
          <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: tc.bg, border: `1px solid ${tc.border}`, flexShrink: 0 }}>
            {TYPE_ICONS[lead.next_touch_type] || '•'}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {lead.full_name || lead.company}
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>{lead.company}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: tc.color, fontWeight: 500 }}>{lead.next_touch_label}</span>
              {urgency === 'overdue' && lead.days_overdue > 0 && (
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>· {lead.days_overdue}d overdue</span>
              )}
            </div>
          </div>
          {/* ICP score */}
          {lead.icp_score != null && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
              background: lead.icp_score >= 70 ? 'var(--success-bg)' : lead.icp_score >= 40 ? 'var(--warning-bg)' : 'var(--bg3)',
              color: lead.icp_score >= 70 ? 'var(--success)' : lead.icp_score >= 40 ? 'var(--warning)' : 'var(--text3)' }}>
              {lead.icp_score}
            </span>
          )}
          {/* Done button — call gets outcome picker, others mark directly */}
          {isCall ? (
            <button onClick={e => { e.stopPropagation(); setShowOutcome(s => ({ ...s, [key]: !s[key] })); }}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', cursor: 'pointer', flexShrink: 0 }}>
              {isMarking ? '...' : '✓ Done'}
            </button>
          ) : (
            <button onClick={e => markDone(e, lead, lead.next_touch, null)}
              disabled={isMarking}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', cursor: 'pointer', flexShrink: 0, opacity: isMarking ? 0.6 : 1 }}>
              {isMarking ? '...' : '✓ Done'}
            </button>
          )}
        </div>
        {/* Call outcome picker — expands below */}
        {isCall && showOutcome[key] && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            {CALL_OUTCOMES.map(o => (
              <button key={o.key} onClick={e => markDone(e, lead, lead.next_touch, o.key)}
                style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', background: o.key === 'meeting_booked' ? 'var(--success-bg)' : 'var(--bg3)', color: o.key === 'meeting_booked' ? 'var(--success)' : 'var(--text2)', fontWeight: o.key === 'meeting_booked' ? 600 : 400 }}>
                {o.label}
              </button>
            ))}
            <button onClick={e => { e.stopPropagation(); setShowOutcome(s => ({ ...s, [key]: false })); }}
              style={{ padding: '5px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)' }}>✕</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 860 }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Today's Touches</div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          {data.overdue.length > 0 ? `${data.overdue.length} overdue · ${data.due.length} due today` : `${data.due.length} due today`}
        </div>

        {/* Goal progress */}
        {goalData && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Today's Activity</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <GoalBar label="Calls" actual={goalData.today.calls} goal={goalData.goals.daily_calls} color="var(--success)" />
              <GoalBar label="Emails" actual={goalData.today.emails} goal={goalData.goals.daily_emails} color="var(--accent)" />
              {goalData.goals.daily_linkedin > 0 && (
                <GoalBar label="LinkedIn" actual={goalData.today.linkedin} goal={goalData.goals.daily_linkedin} color="var(--teal)" />
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',      label: `All (${allLeads.length})` },
            { key: 'call',     label: `📞 Calls (${typeCounts.call})` },
            { key: 'email',    label: `✉ Emails (${typeCounts.email})` },
            { key: 'linkedin', label: `🔗 LinkedIn (${typeCounts.linkedin})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer',
                background: filter === f.key ? 'var(--accent)' : 'var(--bg2)',
                color: filter === f.key ? '#fff' : 'var(--text2)',
                border: filter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{loadError}</div>
            <button onClick={load} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>You're all caught up</div>
            <div style={{ fontSize: 13 }}>No touches due right now.</div>
          </div>
        ) : (
          <>
            {overdueFiltered.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  ⚠ Overdue ({overdueFiltered.length})
                </div>
                {overdueFiltered.map(l => <LeadRow key={`${l.id}-${l.next_touch}`} lead={l} urgency="overdue" />)}
              </div>
            )}
            {dueFiltered.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Due Today ({dueFiltered.length})
                </div>
                {dueFiltered.map(l => <LeadRow key={`${l.id}-${l.next_touch}`} lead={l} urgency="due" />)}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
