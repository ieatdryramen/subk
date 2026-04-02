import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

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
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  avatar: (name) => ({ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--accent2)', flexShrink: 0 }),
  memberInfo: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: 500 },
  memberEmail: { fontSize: 11, color: 'var(--text3)' },
  memberStats: { display: 'flex', gap: 16, marginRight: 8 },
  memberStat: { textAlign: 'center' },
  memberStatNum: { fontSize: 14, fontWeight: 600 },
  memberStatLabel: { fontSize: 10, color: 'var(--text3)' },
  roleSelect: { fontSize: 12, padding: '3px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer' },
  removeBtn: { padding: '3px 8px', fontSize: 11, borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer' },
  activityItem: { display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' },
  activityDot: (type) => ({ width: 8, height: 8, borderRadius: '50%', background: type === 'playbook' ? 'var(--accent)' : 'var(--success)', marginTop: 4, flexShrink: 0 }),
  activityText: { fontSize: 13, flex: 1 },
  activityTime: { fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' },
  leadRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  score: (s) => ({ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s >= 70 ? 'var(--success-bg)' : s >= 40 ? 'var(--warning-bg)' : 'var(--danger-bg)', color: s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--danger)', flexShrink: 0 }),
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/admin/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (memberId, role) => {
    await api.put(`/admin/members/${memberId}/role`, { role });
    load();
  };

  const removeMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    await api.delete(`/admin/members/${memberId}`);
    load();
  };

  if (loading) return <Layout><div style={{ padding: '2rem', color: 'var(--text2)' }}>Loading...</div></Layout>;
  if (!data) return <Layout><div style={{ padding: '2rem', color: 'var(--danger)' }}>Could not load dashboard. Make sure you are an admin.</div></Layout>;

  const { stats, members, activity, topLeads } = data;

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Team Dashboard</div>
        <div style={s.sub}>Overview of team activity and performance</div>

        {/* Stats */}
        <div style={s.statsGrid}>
          {[
            { num: stats.total_playbooks || 0, label: 'Total playbooks', sub: `+${stats.playbooks_this_week || 0} this week` },
            { num: stats.total_leads || 0, label: 'Total leads', sub: `+${stats.leads_this_week || 0} this week` },
            { num: stats.high_score_leads || 0, label: 'High ICP leads', sub: 'Score 70+' },
            { num: stats.touchpoints_completed || 0, label: 'Touchpoints sent', sub: 'Across all reps' },
          ].map(s => (
            <div key={s.label} style={s.statCard || { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 }}>{s.num}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={s.grid2}>
          {/* Team members */}
          <div style={s.card}>
            <div style={s.cardTitle}>Team members</div>
            {members.map(m => (
              <div key={m.id} style={s.memberRow}>
                <div style={s.avatar(m.full_name)}>{initials(m.full_name || m.email)}</div>
                <div style={s.memberInfo}>
                  <div style={s.memberName}>{m.full_name || m.email}</div>
                  <div style={s.memberEmail}>{m.email}</div>
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
                <select style={s.roleSelect} value={m.role} onChange={e => changeRole(m.id, e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button style={s.removeBtn} onClick={() => removeMember(m.id, m.full_name || m.email)}>✕</button>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div style={s.card}>
            <div style={s.cardTitle}>Recent activity</div>
            {activity.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)' }}>No activity yet</div>}
            {activity.map((a, i) => (
              <div key={i} style={s.activityItem}>
                <div style={s.activityDot(a.type)} />
                <div style={s.activityText}>
                  <strong>{a.user_name || 'Someone'}</strong> {a.type === 'playbook' ? 'generated a playbook for' : 'completed a touchpoint with'} <strong>{a.lead_name}</strong> at {a.company}
                </div>
                <div style={s.activityTime}>{timeAgo(a.timestamp)}</div>
              </div>
            ))}
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
