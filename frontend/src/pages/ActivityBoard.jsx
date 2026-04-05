import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

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

export default function ActivityBoard() {
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
      load();
    } catch (err) { alert('Failed to save goals'); }
    finally { setSaving(false); }
  };

  const getActuals = (m) => view === 'today' ? m.today : m.week;
  const getGoals = (m) => view === 'today'
    ? { calls: m.daily_calls, emails: m.daily_emails, linkedin: m.daily_linkedin }
    : { calls: m.weekly_calls, emails: m.weekly_emails, linkedin: m.weekly_linkedin };

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
          <div style={{ color: 'var(--text3)', marginTop: '2rem' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: '1.5rem' }}>
            {members.map(m => {
              const actuals = getActuals(m);
              const goals = getGoals(m);
              return (
                <div key={m.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{m.full_name || m.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{m.role}</div>
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
