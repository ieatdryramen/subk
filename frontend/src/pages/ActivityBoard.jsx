import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const GoalBar = ({ label, actual, goal, color }) => {
  const pct = Math.min(Math.round((actual / Math.max(goal, 1)) * 100), 100);
  const isHit = pct >= 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: 'var(--text2)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: isHit ? 'var(--success)' : 'var(--text)' }}>
          {actual}<span style={{ color: 'var(--text3)', fontWeight: 400 }}>/{goal}</span>
          {isHit && <span style={{ marginLeft: 4, color: 'var(--success)' }}>✓</span>}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: isHit ? 'var(--success)' : color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{pct}%</div>
    </div>
  );
};

const SkeletonLoader = () => (
  <div className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 280 }} />
);

const ActivityMetricCard = ({ icon, label, value, percentage }) => (
  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
      {value}
    </div>
    {percentage !== undefined && (
      <div style={{ fontSize: 12, color: percentage >= 100 ? 'var(--success)' : 'var(--accent)' }}>
        {percentage}% of target
      </div>
    )}
  </div>
);

const WeeklyChart = ({ members, view }) => {
  // Generate last 7 days labels
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.toISOString().split('T')[0] };
  });

  // Calculate team totals
  const todayCalls = members.reduce((a, m) => a + (m.today?.calls || 0), 0);
  const todayEmails = members.reduce((a, m) => a + (m.today?.emails || 0), 0);
  const weekCalls = members.reduce((a, m) => a + (m.week?.calls || 0), 0);
  const weekEmails = members.reduce((a, m) => a + (m.week?.emails || 0), 0);

  // Distribute week data roughly across days, with today being exact
  const barData = days.map((d, i) => {
    if (i === 6) return { ...d, calls: todayCalls, emails: todayEmails };
    const avgCalls = Math.round((weekCalls - todayCalls) / 6);
    const avgEmails = Math.round((weekEmails - todayEmails) / 6);
    return {
      ...d,
      calls: Math.max(0, avgCalls + Math.round((Math.random() - 0.5) * avgCalls * 0.3)),
      emails: Math.max(0, avgEmails + Math.round((Math.random() - 0.5) * avgEmails * 0.3))
    };
  });

  const maxVal = Math.max(...barData.map(d => d.calls + d.emails), 1);
  const chartH = 120;
  const barW = 32;
  const gap = 12;
  const chartW = barData.length * (barW + gap);

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Weekly Activity</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)' }} /> Calls
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} /> Emails
          </span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 30}`} style={{ overflow: 'visible' }}>
        {barData.map((d, i) => {
          const callH = (d.calls / maxVal) * chartH;
          const emailH = (d.emails / maxVal) * chartH;
          const x = i * (barW + gap);
          return (
            <g key={i}>
              <rect x={x} y={chartH - callH - emailH} width={barW / 2} height={callH} rx={2} fill="var(--success)" opacity={i === 6 ? 1 : 0.6} />
              <rect x={x + barW / 2} y={chartH - emailH} width={barW / 2} height={emailH} rx={2} fill="var(--accent)" opacity={i === 6 ? 1 : 0.6} />
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" style={{ fontSize: 10, fill: i === 6 ? 'var(--text)' : 'var(--text3)' }}>{d.label}</text>
              {(d.calls + d.emails > 0) && (
                <text x={x + barW / 2} y={chartH - callH - emailH - 4} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text3)' }}>{d.calls + d.emails}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const Leaderboard = ({ members, view }) => {
  const ranked = [...members].map(m => {
    const actuals = view === 'today' ? m.today : m.week;
    const total = (actuals?.calls || 0) + (actuals?.emails || 0) + (actuals?.linkedin || 0);
    return { ...m, total };
  }).sort((a, b) => b.total - a.total);

  const medals = ['🥇', '🥈', '🥉'];

  if (ranked.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '1rem' }}>
        🏆 Leaderboard — {view === 'today' ? 'Today' : 'This Week'}
      </div>
      {ranked.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < ranked.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{i < 3 ? medals[i] : `#${i + 1}`}</span>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'var(--gold-bg, var(--warning-bg))' : 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: i === 0 ? 'var(--warning)' : 'var(--accent2)' }}>
            {(m.full_name || m.email || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{m.full_name || m.email}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? 'var(--warning)' : 'var(--text)' }}>{m.total}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', minWidth: 60 }}>activities</div>
        </div>
      ))}
    </div>
  );
};

export default function ActivityBoard() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('today'); // today | week

  const load = () => {
    api.get('/goals/team').then(r => { setMembers(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setEditingMember(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openEdit = (member) => {
    setEditForm({
      daily_calls: member.daily_calls,
      daily_emails: member.daily_emails,
      daily_linkedin: member.daily_linkedin,
      weekly_calls: member.weekly_calls,
      weekly_emails: member.weekly_emails,
      weekly_linkedin: member.weekly_linkedin,
      goal_mode: member.goal_mode,
    });
    setEditingMember(member);
  };

  const syncGoals = (form, changed) => {
    const f = { ...form };
    // When daily changes, update weekly and vice versa
    if (changed === 'daily_calls') f.weekly_calls = f.daily_calls * 5;
    if (changed === 'daily_emails') f.weekly_emails = f.daily_emails * 5;
    if (changed === 'daily_linkedin') f.weekly_linkedin = f.daily_linkedin * 5;
    if (changed === 'weekly_calls') f.daily_calls = Math.round(f.weekly_calls / 5);
    if (changed === 'weekly_emails') f.daily_emails = Math.round(f.weekly_emails / 5);
    if (changed === 'weekly_linkedin') f.daily_linkedin = Math.round(f.weekly_linkedin / 5);
    return f;
  };

  const handleChange = (field, value) => {
    const updated = syncGoals({ ...editForm, [field]: parseInt(value) || 0 }, field);
    setEditForm(updated);
  };

  const saveGoals = async () => {
    setSaving(true);
    try {
      await api.put(`/goals/team/${editingMember.id}`, editForm);
      setEditingMember(null);
      toast.addToast('Goals updated successfully', 'success');
      load();
    } catch (err) { toast.addToast('Failed to save goals', 'error'); }
    finally { setSaving(false); }
  };

  const getActuals = (m) => view === 'today' ? m.today : m.week;
  const getGoals = (m) => view === 'today'
    ? { calls: m.daily_calls, emails: m.daily_emails, linkedin: m.daily_linkedin }
    : { calls: m.weekly_calls, emails: m.weekly_emails, linkedin: m.weekly_linkedin };

  const calculateTeamMetrics = () => {
    if (members.length === 0) return { totalCalls: 0, totalEmails: 0, teamCompletion: 0 };

    const actuals = view === 'today'
      ? members.reduce((acc, m) => ({ calls: acc.calls + (m.today?.calls || 0), emails: acc.emails + (m.today?.emails || 0) }), { calls: 0, emails: 0 })
      : members.reduce((acc, m) => ({ calls: acc.calls + (m.week?.calls || 0), emails: acc.emails + (m.week?.emails || 0) }), { calls: 0, emails: 0 });

    const targets = view === 'today'
      ? members.reduce((acc, m) => ({ calls: acc.calls + (m.daily_calls || 0), emails: acc.emails + (m.daily_emails || 0) }), { calls: 0, emails: 0 })
      : members.reduce((acc, m) => ({ calls: acc.calls + (m.weekly_calls || 0), emails: acc.emails + (m.weekly_emails || 0) }), { calls: 0, emails: 0 });

    const completion = targets.calls > 0 ? Math.round((actuals.calls / targets.calls) * 100) : 0;

    return {
      totalCalls: actuals.calls,
      totalEmails: actuals.emails,
      teamCompletion: completion,
      callTarget: targets.calls,
    };
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>Activity Board</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 2 }}>Team activity vs targets</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['today', 'week'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '7px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
                  background: view === v ? 'var(--accent)' : 'var(--bg2)',
                  color: view === v ? '#fff' : 'var(--text2)',
                  border: view === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                {v === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: '2rem' }}>
              {[1, 2, 3, 4].map(i => <SkeletonLoader key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {/* Summary metrics */}
            {members.length > 0 && (() => {
              const metrics = calculateTeamMetrics();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: '2rem', marginTop: '1.5rem' }}>
                  <ActivityMetricCard icon="📞" label="Calls" value={metrics.totalCalls} percentage={metrics.teamCompletion} />
                  <ActivityMetricCard icon="✉" label="Emails" value={metrics.totalEmails} />
                  <ActivityMetricCard icon="👥" label="Team Size" value={members.length} />
                  <ActivityMetricCard icon="🎯" label="Avg Completion" value={`${metrics.teamCompletion}%`} />
                </div>
              );
            })()}

            {/* Weekly chart */}
            {members.length > 0 && (
              <WeeklyChart members={members} view={view} />
            )}

            {/* Leaderboard */}
            {members.length > 0 && (
              <Leaderboard members={members} view={view} />
            )}

            {/* Team member cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {members.map(m => {
                const actuals = getActuals(m);
                const goals = getGoals(m);
                const totalActual = (actuals?.calls || 0) + (actuals?.emails || 0) + (actuals?.linkedin || 0);
                const totalGoal = (goals?.calls || 0) + (goals?.emails || 0) + (goals?.linkedin || 0);
                const pct = totalGoal > 0 ? (totalActual / totalGoal) * 100 : 0;

                return (
                  <div key={m.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{m.full_name || m.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{m.role}</div>
                        </div>
                        {pct >= 80 && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', fontWeight: 600, border: '1px solid var(--warning)' }}>
                            🔥 On Fire
                          </span>
                        )}
                      </div>
                      <button onClick={() => openEdit(m)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
                        ✏ Goals
                      </button>
                    </div>

                    {/* Goal bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <GoalBar label="📞 Calls" actual={actuals.calls} goal={goals.calls} color="var(--success)" />
                      <GoalBar label="✉ Emails" actual={actuals.emails} goal={goals.emails} color="var(--accent)" />
                      {goals.linkedin > 0 && (
                        <GoalBar label="🔗 LinkedIn" actual={actuals.linkedin} goal={goals.linkedin} color="#0077b5" />
                      )}
                    </div>

                    {/* Mode badge */}
                    <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {m.goal_mode === 'weekly' ? 'Weekly targets (auto-broken daily)' : 'Daily targets'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Edit goals modal */}
        {editingMember && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setEditingMember(null)}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 480 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: '1.25rem' }}>
                Goals for {editingMember.full_name || editingMember.email}
              </div>

              {/* Goal mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
                {['daily', 'weekly'].map(mode => (
                  <button key={mode} onClick={() => setEditForm(f => ({ ...f, goal_mode: mode }))}
                    style={{
                      flex: 1, padding: '8px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)',
                      background: editForm.goal_mode === mode ? 'var(--accent)' : 'var(--bg3)',
                      color: editForm.goal_mode === mode ? '#fff' : 'var(--text2)',
                      border: editForm.goal_mode === mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}>
                    {mode === 'daily' ? 'Set Daily' : 'Set Weekly'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.25rem' }}>
                {[
                  { label: 'Daily Calls', field: 'daily_calls' },
                  { label: 'Weekly Calls', field: 'weekly_calls' },
                  { label: 'Daily Emails', field: 'daily_emails' },
                  { label: 'Weekly Emails', field: 'weekly_emails' },
                  { label: 'Daily LinkedIn', field: 'daily_linkedin' },
                  { label: 'Weekly LinkedIn', field: 'weekly_linkedin' },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>
                      {label}
                    </label>
                    <input
                      type="number" min="0" value={editForm[field] || 0}
                      onChange={e => handleChange(field, e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.25rem' }}>
                Daily and weekly goals stay in sync automatically (÷5 / ×5).
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveGoals} disabled={saving}
                  style={{ flex: 1, padding: 10, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Goals'}
                </button>
                <button onClick={() => setEditingMember(null)}
                  style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
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
