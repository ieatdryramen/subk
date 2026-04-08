import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1200 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: '2rem' },
  statCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  statNum: { fontSize: 30, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 },
  statLabel: { fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  statSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  cardTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' },
  avatar: (name) => ({ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--accent2)', flexShrink: 0 }),
  memberInfo: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: 500 },
  memberEmail: { fontSize: 11, color: 'var(--text3)' },
  memberStats: { display: 'flex', gap: 16, marginRight: 8 },
  memberStat: { textAlign: 'center' },
  memberStatNum: { fontSize: 14, fontWeight: 600 },
  memberStatLabel: { fontSize: 10, color: 'var(--text3)' },
  roleBadge: (isAdmin) => ({ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: isAdmin ? 'var(--accent-bg)' : 'var(--bg3)', color: isAdmin ? 'var(--accent2)' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', cursor: 'pointer', border: '1px solid', borderColor: isAdmin ? 'var(--accent)' : 'var(--border)', transition: 'all 0.2s' }),
  removeBtn: { padding: '3px 8px', fontSize: 11, borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer' },
  activityItem: { display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' },
  activityIcon: (type) => ({ width: 28, height: 28, borderRadius: '50%', background: type === 'playbook' ? 'var(--accent-bg)' : 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: type === 'playbook' ? 'var(--accent2)' : 'var(--success)', fontWeight: 600, flexShrink: 0 }),
  activityText: { fontSize: 13, flex: 1 },
  activityTime: { fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' },
  leadRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  score: (s) => ({ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s >= 70 ? 'var(--success-bg)' : s >= 40 ? 'var(--warning-bg)' : 'var(--danger-bg)', color: s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--danger)', flexShrink: 0 }),
  progressBar: { height: 3, background: 'var(--border)', borderRadius: 1.5, marginTop: 6, overflow: 'hidden' },
  progressFill: (pct) => ({ height: '100%', background: 'var(--accent2)', width: `${pct}%`, borderRadius: 1.5, transition: 'width 0.3s' }),
  lastActive: { fontSize: 10, color: 'var(--text3)', marginTop: 4 },
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function AdminDashboard() {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/admin/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => { setLoading(false); setLoadError(true); });
  };

  useEffect(() => {
    load();
    // Auto-refresh activity feed every 60 seconds
    const interval = setInterval(() => {
      if (autoRefreshEnabled) {
        api.get('/admin/dashboard')
          .then(r => setData(r.data))
          .catch(err => console.error('Auto-refresh failed:', err));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  const changeRole = async (memberId, role) => {
    try {
      await api.put(`/admin/members/${memberId}/role`, { role });
      setRoleMenuOpen(null);
      load();
    } catch { addToast('Failed to update role', 'error'); }
  };

  const removeMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await api.delete(`/admin/members/${memberId}`);
      load();
    } catch { addToast('Failed to remove member', 'error'); }
  };

  if (loading) return <Layout><div style={{ padding: '2rem', color: 'var(--text2)' }}>Loading...</div></Layout>;
  if (loadError || !data) return (
    <Layout>
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>Could not load dashboard — make sure you are an admin</div>
        <button onClick={load} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
      </div>
    </Layout>
  );

  const { stats, members, activity, topLeads } = data;

  // Calculate metrics for stats
  const totalPlaybooksWeek = stats.playbooks_this_week || 0;
  const totalLeadsWeek = stats.leads_this_week || 0;
  const maxWeeklyPlaybooks = Math.max(totalPlaybooksWeek, 50);
  const maxWeeklyLeads = Math.max(totalLeadsWeek, 100);

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Team Dashboard</div>
        <div style={s.sub}>Overview of team activity and performance</div>

        {/* Team Overview Section */}
        <div style={{ ...s.card, marginBottom: '2rem', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Team</div>
            <div style={{ display: 'flex', gap: -4 }}>
              {members.slice(0, 8).map((m, i) => (
                <div key={m.id} style={{ ...s.avatar(m.full_name), marginLeft: i > 0 ? -8 : 0, border: '2px solid var(--bg2)', zIndex: 8 - i }}>
                  {initials(m.full_name || m.email)}
                </div>
              ))}
              {members.length > 8 && <div style={{ ...s.avatar(''), marginLeft: -8, background: 'var(--bg3)', color: 'var(--text3)' }}>+{members.length - 8}</div>}
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{members.filter(m => m.role === 'admin').length}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Admins</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{members.filter(m => m.role !== 'admin').length}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Members</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{stats.touchpoints_completed || 0}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Touches</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>{stats.playbooks_this_week || 0}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>This Week</div>
          </div>
        </div>

        {/* Stats with trend indicators and progress bars */}
        <div className="pf-stat-grid" style={s.statsGrid}>
          {[
            { num: stats.total_playbooks || 0, label: 'Total playbooks', sub: `+${stats.playbooks_this_week || 0} this week`, trend: stats.playbooks_this_week || 0, max: maxWeeklyPlaybooks, trendColor: 'var(--accent2)' },
            { num: stats.total_leads || 0, label: 'Total leads', sub: `+${stats.leads_this_week || 0} this week`, trend: stats.leads_this_week || 0, max: maxWeeklyLeads, trendColor: 'var(--success)' },
            { num: stats.high_score_leads || 0, label: 'High ICP leads', sub: 'Score 70+', trend: null, max: 100, trendColor: 'var(--warning)' },
            { num: stats.touchpoints_completed || 0, label: 'Touchpoints sent', sub: 'Across all reps', trend: null, max: 100, trendColor: 'var(--accent2)' },
          ].map(stat => (
            <div key={stat.label} style={{ ...s.statCard }}>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 }}>{stat.num}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: stat.trendColor, marginTop: 2, fontWeight: 500 }}>{stat.sub}</div>
              {stat.trend !== null && (
                <div style={s.progressBar}>
                  <div style={s.progressFill(Math.min((stat.trend / stat.max) * 100, 100))} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={s.grid2}>
          {/* Team members with role badges and last active */}
          <div style={s.card}>
            <div style={s.cardTitle}>Team members</div>
            {members.map(m => (
              <div key={m.id} style={s.memberRow} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={s.avatar(m.full_name)}>{initials(m.full_name || m.email)}</div>
                <div style={s.memberInfo}>
                  <div style={s.memberName}>{m.full_name || m.email}</div>
                  <div style={s.memberEmail}>{m.email}</div>
                  {m.last_active && <div style={s.lastActive}>Active {timeAgo(m.last_active)}</div>}
                </div>
                <div style={s.memberStats}>
                  <div style={s.memberStat}>
                    <div style={s.memberStatNum}>{m.playbooks_generated}</div>
                    <div style={s.memberStatLabel}>playbooks</div>
                  </div>
                  <div style={s.memberStat}>
                    <div style={s.memberStatNum}>{m.leads_created}</div>
                    <div style={s.memberStatLabel}>leads</div>
                  </div>
                  <div style={s.memberStat}>
                    <div style={s.memberStatNum}>{m.touchpoints_completed}</div>
                    <div style={s.memberStatLabel}>touches</div>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    style={s.roleBadge(m.role === 'admin')}
                    onClick={() => setRoleMenuOpen(roleMenuOpen === m.id ? null : m.id)}
                  >
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                  </button>
                  {roleMenuOpen === m.id && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', zIndex: 10, minWidth: 120, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                      <button
                        onClick={() => changeRole(m.id, 'admin')}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: m.role === 'admin' ? 'var(--accent2)' : 'var(--text)', fontWeight: m.role === 'admin' ? 600 : 400, borderBottom: '1px solid var(--border)' }}
                      >
                        ✓ Admin
                      </button>
                      <button
                        onClick={() => changeRole(m.id, 'member')}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: m.role === 'member' ? 'var(--text)' : 'var(--text3)', fontWeight: m.role === 'member' ? 600 : 400 }}
                      >
                        ✓ Member
                      </button>
                    </div>
                  )}
                </div>
                <button style={s.removeBtn} onClick={() => removeMember(m.id, m.full_name || m.email)}>✕</button>
              </div>
            ))}
          </div>

          {/* Team Activity Feed */}
          <div style={s.card}>
            <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span>Team Activity Feed</span>
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                style={{
                  fontSize: 10, padding: '4px 8px', borderRadius: 'var(--radius)',
                  background: autoRefreshEnabled ? 'var(--accent-bg)' : 'var(--bg3)',
                  color: autoRefreshEnabled ? 'var(--accent2)' : 'var(--text3)',
                  border: `1px solid ${autoRefreshEnabled ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px',
                  transition: 'all 0.2s',
                }}
              >
                {autoRefreshEnabled ? '◯ Live' : '◯ Paused'}
              </button>
            </div>
            {activity.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '1rem 0' }}>
                No recent activity yet
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {activity.map((a, i) => (
                  <div key={i} style={{ ...s.activityItem, paddingRight: 0 }}>
                    <div style={s.activityIcon(a.type)}>
                      {a.type === 'playbook' ? '📋' : '✓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={s.activityText}>
                        <strong style={{ color: 'var(--accent2)' }}>{a.user_name || 'Someone'}</strong> {a.type === 'playbook' ? 'generated a playbook for' : 'completed a touchpoint with'} <strong>{[a.lead_name, a.company].filter(Boolean).join(' at ') || 'a lead'}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {timeAgo(a.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{
              fontSize: 10, color: 'var(--text3)', textAlign: 'center',
              paddingTop: '1rem', borderTop: '1px solid var(--border)',
              marginTop: '1rem',
            }}>
              {autoRefreshEnabled && '⚡ Auto-refreshing every 60 seconds'}
            </div>
          </div>
        </div>

        {/* Top leads */}
        <div style={s.card}>
          <div style={s.cardTitle}>Top leads by ICP score</div>
          {topLeads.map((lead, i) => (
            <div key={i} style={s.leadRow}>
              <span style={s.score(lead.icp_score)}>{lead.icp_score}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.full_name} — {lead.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.company} · Owner: {lead.owner}</div>
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: lead.status === 'done' ? 'var(--success-bg)' : 'var(--bg3)', color: lead.status === 'done' ? 'var(--success)' : 'var(--text3)', border: '1px solid var(--border)' }}>{lead.status}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
