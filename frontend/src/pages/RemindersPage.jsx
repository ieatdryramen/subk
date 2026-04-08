import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const TYPE_ICONS = { email: '✉', call: '📞', linkedin: '🔗', mefu: '📅' };

const TYPE_COLORS = {
  email:    { bg: 'var(--accent-bg)',        color: 'var(--accent2)', border: 'var(--accent)' },
  call:     { bg: 'rgba(34,197,94,0.08)',    color: 'var(--success)', border: 'var(--success)' },
  linkedin: { bg: 'var(--accent-bg)',         color: 'var(--accent)',  border: 'var(--accent)' },
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

  // Power features state
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('default');
  const [bulkActing, setBulkActing] = useState(null);
  const [doneModal, setDoneModal] = useState(null);
  const [doneNotes, setDoneNotes] = useState('');

  // BD Calendar state
  const [viewMode, setViewMode] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState({ touches: {}, opportunities: {} });
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [stats, setStats] = useState({ overdue: 0, today: 0, this_week: 0, upcoming_opportunities: 0 });

  const navigate = useNavigate();
  const { showToast } = useToast();

  const PER_PAGE = 20;

  const load = () => {
    setLoadError(null);
    Promise.all([
      api.get('/sequence/due/today'),
      api.get('/goals/my'),
      api.get('/reminders/summary'),
    ]).then(([dueR, goalR, statsR]) => {
      setData(dueR.data);
      setGoalData(goalR.data);
      setStats(statsR.data);
      setLoading(false);
    }).catch(err => {
      setLoadError('Failed to load touches');
      setLoading(false);
    });
  };

  const loadCalendar = (date = currentMonth) => {
    setCalendarLoading(true);
    const monthStr = date.toISOString().slice(0, 7);
    api.get(`/reminders/calendar?month=${monthStr}`)
      .then(res => {
        setCalendarData(res.data);
        setCalendarLoading(false);
      })
      .catch(err => {
        console.error(err);
        setCalendarLoading(false);
      });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCalendar(currentMonth); }, [currentMonth]);

  const markDone = async (e, lead, touchpoint, call_outcome) => {
    if (e) e.stopPropagation();
    const key = `${lead.id}-${touchpoint}`;

    if (call_outcome === undefined && lead.next_touch_type === 'call') {
      setShowOutcome(s => ({ ...s, [key]: !s[key] }));
      return;
    }

    setMarking(m => ({ ...m, [key]: true }));
    setShowOutcome(s => ({ ...s, [key]: false }));
    try {
      await api.post(`/sequence/${lead.id}/touch`, { touchpoint, status: 'done', call_outcome });
      showToast('Touch completed!', 'success');
      load();
      loadCalendar(currentMonth);
    } catch (err) {
      console.error(err);
      showToast('Failed to mark touch as done — please try again', 'error');
    }
    finally { setMarking(m => ({ ...m, [key]: false })); }
  };

  const handleSnooze = async (e, lead) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/engagement/${lead.id}/snooze`, { days: 1 });
      showToast('Touch snoozed until tomorrow', 'success');
      load();
      loadCalendar(currentMonth);
    } catch (err) {
      console.error(err);
      showToast('Failed to snooze — please try again', 'error');
    }
  };

  const bulkMarkDone = async () => {
    setBulkActing('done');
    try {
      for (const lead of overdueFiltered) {
        await api.post(`/sequence/${lead.id}/touch`, {
          touchpoint: lead.next_touch,
          status: 'done',
          notes: 'Bulk completed'
        });
      }
      showToast(`Marked ${overdueFiltered.length} items as done!`, 'success');
      load();
      loadCalendar(currentMonth);
    } catch (err) {
      console.error(err);
      showToast('Failed to mark items as done', 'error');
    } finally {
      setBulkActing(null);
    }
  };

  const bulkReschedule = async () => {
    setBulkActing('reschedule');
    try {
      for (const lead of overdueFiltered) {
        await api.post(`/engagement/${lead.id}/snooze`, { days: 1 });
      }
      showToast(`Rescheduled ${overdueFiltered.length} items!`, 'success');
      load();
      loadCalendar(currentMonth);
    } catch (err) {
      console.error(err);
      showToast('Failed to reschedule items', 'error');
    } finally {
      setBulkActing(null);
    }
  };

  const bulkSkip = async () => {
    setBulkActing('skip');
    try {
      for (const lead of overdueFiltered) {
        await api.post(`/sequence/${lead.id}/touch`, {
          touchpoint: lead.next_touch,
          status: 'skipped'
        });
      }
      showToast(`Skipped ${overdueFiltered.length} items!`, 'success');
      load();
      loadCalendar(currentMonth);
    } catch (err) {
      console.error(err);
      showToast('Failed to skip items', 'error');
    } finally {
      setBulkActing(null);
    }
  };

  const filterLeads = (leads) => filter === 'all' ? leads : leads.filter(l => l.next_touch_type === filter);

  const sortLeads = (leads) => {
    if (sortBy === 'company') return [...leads].sort((a, b) => (a.company || '').localeCompare(b.company || ''));
    if (sortBy === 'name') return [...leads].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    if (sortBy === 'overdue') return [...leads].sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
    return leads;
  };

  const allLeads = [...data.overdue, ...data.due];
  const filtered = filterLeads(allLeads);
  let overdueFiltered = filterLeads(data.overdue);
  let dueFiltered = filterLeads(data.due);

  overdueFiltered = sortLeads(overdueFiltered);
  dueFiltered = sortLeads(dueFiltered);

  const paginatedOverdue = overdueFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalOverduePages = Math.ceil(overdueFiltered.length / PER_PAGE);
  const paginatedDue = dueFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalDuePages = Math.ceil(dueFiltered.length / PER_PAGE);

  const typeCounts = {
    email:    allLeads.filter(l => l.next_touch_type === 'email').length,
    call:     allLeads.filter(l => l.next_touch_type === 'call').length,
    linkedin: allLeads.filter(l => l.next_touch_type === 'linkedin').length,
  };
  const completedToday = goalData ? (goalData.today.calls + goalData.today.emails + (goalData.today.linkedin || 0)) : 0;
  const totalTouchesRemaining = filtered.length;

  const bulkBtn = {
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 'var(--radius)',
    background: 'var(--success-bg)',
    color: 'var(--success)',
    border: '1px solid var(--success)',
    cursor: 'pointer',
    opacity: bulkActing ? 0.6 : 1,
  };

  const bulkBtn2 = {
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 'var(--radius)',
    background: 'var(--bg3)',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    opacity: bulkActing ? 0.6 : 1,
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const today = new Date();
  const isToday = (date) => date.toDateString() === today.toDateString();
  const isSelectedDate = (date) => selectedDate && date.toDateString() === selectedDate.toDateString();

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const daysArray = [];

  for (let i = 0; i < firstDay; i++) {
    daysArray.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    daysArray.push(date);
  }

  const getDateEvents = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const touches = calendarData.touches[dateKey] || [];
    const opps = calendarData.opportunities[dateKey] || [];
    return { touches, opps };
  };

  const selectedDateEvents = selectedDate ? getDateEvents(selectedDate) : { touches: [], opps: [] };

  const SummaryBar = ({ completed, total }) => {
    const pct = Math.min(Math.round((completed / Math.max(total, 1)) * 100), 100);
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {completed}/{total} touches completed today
            {completed > 0 && (
              <span style={{ fontSize: 12, color: 'var(--warning)', marginLeft: 8 }}>🔥 {completed} done</span>
            )}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: pct >= 100 ? 'var(--success)' : 'var(--text2)' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
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
        {actual > 0 && goal > 0 && (
          <div style={{ fontSize: 10, color: pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--text3)' : 'var(--warning)', marginTop: 2 }}>
            {pct >= 100 ? '✓ Goal met!' : pct >= 50 ? 'On pace' : 'Behind pace'}
          </div>
        )}
      </div>
    );
  };

  const SkeletonRow = () => (
    <div className="pf-skeleton" style={{ height: 72, borderRadius: 'var(--radius)', marginBottom: 6, background: 'var(--bg3)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
  );

  const Pagination = ({ current, total, onChange }) => {
    if (total <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '1rem 0' }}>
        <button onClick={() => onChange(Math.max(1, current - 1))} disabled={current === 1}
          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: current === 1 ? 'var(--text3)' : 'var(--text)', cursor: current === 1 ? 'default' : 'pointer' }}>
          ← Prev
        </button>
        <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text2)' }}>
          Page {current} of {total}
        </span>
        <button onClick={() => onChange(Math.min(total, current + 1))} disabled={current === total}
          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: current === total ? 'var(--text3)' : 'var(--text)', cursor: current === total ? 'default' : 'pointer' }}>
          Next →
        </button>
      </div>
    );
  };

  const LeadRow = ({ lead, urgency }) => {
    const key = `${lead.id}-${lead.next_touch}`;
    const isMarking = marking[key];
    const isCall = lead.next_touch_type === 'call';
    const tc = TYPE_COLORS[lead.next_touch_type] || TYPE_COLORS.email;
    const urgencyBorder = urgency === 'overdue' ? '2px solid var(--danger)' : '1px solid var(--border)';
    const showingOutcome = showOutcome[key];

    return (
      <div style={{ background: 'var(--bg2)', border: urgencyBorder, borderRadius: 'var(--radius)', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
          onClick={() => navigate(`/lists/${lead.list_id}`)}>
          <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: tc.bg, border: `1px solid ${tc.border}`, flexShrink: 0 }}>
            {TYPE_ICONS[lead.next_touch_type] || '•'}
          </div>
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
          {lead.icp_score != null && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
              background: lead.icp_score >= 70 ? 'var(--success-bg)' : lead.icp_score >= 40 ? 'var(--warning-bg)' : 'var(--bg3)',
              color: lead.icp_score >= 70 ? 'var(--success)' : lead.icp_score >= 40 ? 'var(--warning)' : 'var(--text3)' }}>
              {lead.icp_score}
            </span>
          )}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={e => handleSnooze(e, lead)}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 500, borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              ⏱ Reschedule
            </button>
            <button onClick={e => { e.stopPropagation(); if (isCall) { markDone(e, lead, lead.next_touch, undefined); } else { setDoneModal({ lead, touchpoint: lead.next_touch }); setDoneNotes(''); } }}
              disabled={isMarking}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', cursor: 'pointer', opacity: isMarking ? 0.6 : 1 }}>
              {isMarking ? '...' : '✓ Done'}
            </button>
          </div>
        </div>

        {isCall && showingOutcome && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>Outcome:</span>
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

        {isCall && showingOutcome && (
          <div style={{ padding: '0 16px 12px' }} onClick={e => e.stopPropagation()}>
            <textarea
              placeholder="Add a quick note (optional)..."
              value={''}
              onChange={() => {}}
              style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'inherit', minHeight: 60, resize: 'none' }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>BD Calendar</div>
              <div style={{ color: 'var(--text2)', fontSize: 14 }}>Manage touches and track opportunity deadlines</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setViewMode('calendar')}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', background: viewMode === 'calendar' ? 'var(--accent)' : 'var(--bg2)', color: viewMode === 'calendar' ? '#fff' : 'var(--text2)', border: `1px solid ${viewMode === 'calendar' ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                📅 Calendar
              </button>
              <button onClick={() => setViewMode('list')}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', background: viewMode === 'list' ? 'var(--accent)' : 'var(--bg2)', color: viewMode === 'list' ? '#fff' : 'var(--text2)', border: `1px solid ${viewMode === 'list' ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                📋 List
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '1rem', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'center', flex: '1 1 auto', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{stats.overdue}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 500 }}>Overdue</div>
            </div>
            <div style={{ textAlign: 'center', flex: '1 1 auto', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{stats.today}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 500 }}>Due Today</div>
            </div>
            <div style={{ textAlign: 'center', flex: '1 1 auto', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{stats.this_week}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 500 }}>This Week</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center', flex: '1 1 auto', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{stats.upcoming_opportunities}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 500 }}>Opportunities</div>
            </div>
          </div>
        </div>

        {viewMode === 'calendar' && (
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>
                  ← Prev
                </button>
                <div style={{ fontSize: 16, fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={() => setCurrentMonth(new Date())}
                  style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>
                  Today
                </button>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  style={{ padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>
                  Next →
                </button>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', padding: '12px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', flexWrap: 'wrap', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent2)' }} />
                  <span>Email</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                  <span>Call</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span>LinkedIn</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 0 2px var(--bg2), 0 0 0 3px var(--danger)' }} />
                  <span>Deadline</span>
                </div>
              </div>

              {calendarLoading ? (
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Loading calendar...</div>
              ) : (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} style={{ padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                        {day}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
                    {daysArray.map((date, idx) => {
                      if (!date) {
                        return <div key={`empty-${idx}`} style={{ minHeight: 100, background: 'var(--bg3)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />;
                      }

                      const { touches, opps } = getDateEvents(date);
                      const dayIsToday = isToday(date);
                      const dayIsSelected = isSelectedDate(date);

                      return (
                        <div
                          key={date.toISOString()}
                          onClick={() => setSelectedDate(dayIsSelected ? null : date)}
                          style={{
                            minHeight: 100,
                            padding: '8px',
                            borderRight: '1px solid var(--border)',
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            background: dayIsSelected ? 'var(--bg3)' : dayIsToday ? 'rgba(104, 211, 145, 0.05)' : 'transparent',
                            position: 'relative',
                          }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: dayIsToday ? 'var(--accent)' : 'var(--text)', paddingBottom: 4, borderBottom: dayIsToday ? '2px solid var(--accent)' : 'none' }}>
                            {date.getDate()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {touches.length > 0 && (
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                {touches.slice(0, 4).map((touch, i) => {
                                  const dotColor = touch.touch_type === 'email' ? 'var(--accent2)' : touch.touch_type === 'call' ? 'var(--success)' : 'var(--accent)';
                                  return <span key={i} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: dotColor }} />;
                                })}
                                {touches.length > 4 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{touches.length - 4}</span>}
                              </div>
                            )}
                            {opps.length > 0 && (
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                {opps.slice(0, 4).map((opp, i) => (
                                  <span key={i} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 0 1px var(--bg2)' }} />
                                ))}
                                {opps.length > 4 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{opps.length - 4}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selectedDate && (
              <div style={{ width: 320, flexShrink: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
                </div>

                {selectedDateEvents.touches.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      Touches ({selectedDateEvents.touches.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedDateEvents.touches.map((touch, idx) => (
                        <div key={idx} style={{ padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>
                            {touch.full_name || touch.company}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                            {touch.touch_type === 'email' ? '✉ Email' : touch.touch_type === 'call' ? '📞 Call' : '🔗 LinkedIn'} - {touch.touchpoint}
                          </div>
                          <button onClick={() => markDone(null, { id: touch.lead_id }, touch.touchpoint)}
                            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--success)', background: 'var(--success-bg)', color: 'var(--success)', cursor: 'pointer', fontWeight: 500 }}>
                            ✓ Done
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateEvents.opps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      Deadlines ({selectedDateEvents.opps.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedDateEvents.opps.map((opp, idx) => (
                        <div key={idx} style={{ padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 11 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--danger)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opp.title}
                          </div>
                          <div style={{ color: 'var(--text3)', marginBottom: 4, fontSize: 10 }}>
                            {opp.agency}
                          </div>
                          {opp.fit_score && (
                            <div style={{ fontSize: 10, color: 'var(--success)', marginBottom: 6, fontWeight: 500 }}>
                              Fit: {opp.fit_score}
                            </div>
                          )}
                          <button onClick={() => window.open(opp.opportunity_url, '_blank')}
                            style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
                            View →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDateEvents.touches.length === 0 && selectedDateEvents.opps.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '2rem 0' }}>
                    No events on this date
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: '1rem' }}>
              Today's Touches
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)', marginLeft: 12 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
              {data.overdue.length > 0 ? `${data.overdue.length} overdue · ${data.due.length} due today` : `${data.due.length} due today`}
            </div>

            {goalData && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Today's Activity</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <GoalBar label="Calls" actual={goalData.today.calls} goal={goalData.goals.daily_calls} color="var(--success)" />
                  <GoalBar label="Emails" actual={goalData.today.emails} goal={goalData.goals.daily_emails} color="var(--accent)" />
                  {goalData.goals.daily_linkedin > 0 && (
                    <GoalBar label="LinkedIn" actual={goalData.today.linkedin} goal={goalData.goals.daily_linkedin} color="var(--accent)" />
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { key: 'all',      label: `All (${allLeads.length})` },
                { key: 'call',     label: `📞 Calls (${typeCounts.call})` },
                { key: 'email',    label: `✉ Emails (${typeCounts.email})` },
                { key: 'linkedin', label: `🔗 LinkedIn (${typeCounts.linkedin})` },
              ].map(f => (
                <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: filter === f.key ? 'var(--accent)' : 'var(--bg2)',
                    color: filter === f.key ? '#fff' : 'var(--text2)',
                    border: filter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  {f.label}
                </button>
              ))}
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
                style={{ fontSize: 12, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
                <option value="default">Sort: Default</option>
                <option value="company">Sort: Company</option>
                <option value="name">Sort: Lead Name</option>
                <option value="overdue">Sort: Most Overdue</option>
              </select>
            </div>

            {loading ? (
              <div>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : loadError ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{loadError}</div>
                <button onClick={load} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
              </div>
            ) : filtered.length === 0 ? (
              <div>
                {goalData && <SummaryBar completed={completedToday} total={completedToday} />}
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>All caught up! No touches due today</div>
                  <div style={{ fontSize: 14, marginBottom: 20 }}>Great work staying on top of your follow-ups. You're crushing your engagement goals.</div>
                  <button
                    onClick={() => navigate('/pipeline')}
                    style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    View Pipeline
                  </button>
                </div>
              </div>
            ) : (
              <>
                {goalData && <SummaryBar completed={completedToday} total={completedToday + totalTouchesRemaining} />}
                <>
                  {overdueFiltered.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {!loading && overdueFiltered.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                          <button onClick={bulkMarkDone} disabled={bulkActing !== null} style={bulkBtn}>
                            {bulkActing === 'done' ? 'Marking...' : `✓ Mark All Done (${overdueFiltered.length})`}
                          </button>
                          <button onClick={bulkReschedule} disabled={bulkActing !== null} style={bulkBtn2}>
                            {bulkActing === 'reschedule' ? 'Rescheduling...' : '⏱ Reschedule All'}
                          </button>
                          <button onClick={bulkSkip} disabled={bulkActing !== null} style={bulkBtn2}>
                            {bulkActing === 'skip' ? 'Skipping...' : '⏭ Skip to Next Touch'}
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        <span>OVERDUE ({overdueFiltered.length})</span>
                      </div>
                      {paginatedOverdue.map(l => <LeadRow key={`${l.id}-${l.next_touch}`} lead={l} urgency="overdue" />)}
                      <Pagination current={page} total={totalOverduePages} onChange={setPage} />
                    </div>
                  )}
                  {dueFiltered.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        Due Today ({dueFiltered.length})
                      </div>
                      {paginatedDue.map(l => <LeadRow key={`${l.id}-${l.next_touch}`} lead={l} urgency="due" />)}
                      <Pagination current={page} total={totalDuePages} onChange={setPage} />
                    </div>
                  )}
                </>
              </>
            )}
          </div>
        )}

        {doneModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setDoneModal(null)}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 420 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Complete Touch</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>
                {doneModal.lead.next_touch_label} for {doneModal.lead.full_name || doneModal.lead.company}
              </div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Notes (optional)</label>
              <textarea value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
                placeholder="What happened? Any follow-up needed?"
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'inherit', minHeight: 80, resize: 'none', marginBottom: '1.25rem' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  const key = `${doneModal.lead.id}-${doneModal.touchpoint}`;
                  setMarking(m => ({ ...m, [key]: true }));
                  try {
                    await api.post(`/sequence/${doneModal.lead.id}/touch`, { touchpoint: doneModal.touchpoint, status: 'done', notes: doneNotes });
                    showToast('Touch completed!', 'success');
                    setDoneModal(null);
                    load();
                    loadCalendar(currentMonth);
                  } catch (err) {
                    console.error(err);
                    showToast('Failed — try again', 'error');
                  }
                  finally { setMarking(m => ({ ...m, [key]: false })); }
                }} style={{ flex: 1, padding: 10, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', fontWeight: 500, cursor: 'pointer', fontSize: 13 }}>
                  ✓ Mark Complete
                </button>
                <button onClick={() => setDoneModal(null)}
                  style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
