import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1100 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: '2rem' },
  statCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  statNum: { fontSize: 30, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 2 },
  statLabel: { fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  statSub: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: '2rem' },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  cardTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  viewAll: { fontSize: 12, color: 'var(--accent2)', cursor: 'pointer' },
  listRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  listName: { fontSize: 14, fontWeight: 500, marginBottom: 2 },
  listMeta: { fontSize: 12, color: 'var(--text2)' },
  badge: (color) => ({ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `var(--${color}-bg)`, color: `var(--${color})`, border: `1px solid var(--${color})` }),
  activityItem: { display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' },
  activityDot: (color) => ({ width: 8, height: 8, borderRadius: '50%', background: `var(--${color})`, marginTop: 5, flexShrink: 0 }),
  activityText: { fontSize: 13, flex: 1, color: 'var(--text)' },
  activityTime: { fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' },
  seqBar: { display: 'flex', gap: 4, marginTop: 8 },
  seqStep: (done) => ({ flex: 1, height: 4, borderRadius: 2, background: done ? 'var(--accent)' : 'var(--bg3)' }),
  empty: { fontSize: 13, color: 'var(--text3)', padding: '1rem 0', textAlign: 'center' },
  newBtn: { padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' },
  scoreBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  score: (s) => ({ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0, background: s >= 70 ? 'var(--success-bg)' : s >= 40 ? 'var(--warning-bg)' : 'var(--danger-bg)', color: s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--danger)' }),
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [topLeads, setTopLeads] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [sequenceStats, setSequenceStats] = useState(null);

  useEffect(() => {
    // Load lists
    api.get('/lists').then(r => setLists(r.data)).catch(console.error);

    // Load personal stats from admin dashboard
    api.get('/admin/dashboard').then(r => {
      const me = r.data.members?.find(m => m.email === user?.email);
      setMyStats(me);
      setTopLeads(r.data.topLeads?.slice(0, 5) || []);
      setRecentActivity(r.data.activity?.slice(0, 8) || []);
    }).catch(() => {
      // Non-admin fallback - load basic stats
      api.get('/billing/status').then(r => setMyStats({ plan: r.data.plan }));
    });
  }, [user]);

  const totalLeads = lists.reduce((a, l) => a + parseInt(l.lead_count || 0), 0);
  const doneLeads = lists.reduce((a, l) => a + parseInt(l.done_count || 0), 0);

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>
          {user?.full_name ? `Hey ${user.full_name.split(' ')[0]} 👋` : 'Dashboard'}
        </div>
        <div style={s.sub}>Here's what's happening with your pipeline</div>

        {/* Stats */}
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={s.statNum}>{myStats?.playbooks_generated || 0}</div>
            <div style={s.statLabel}>Playbooks created</div>
            <div style={s.statSub}>+{myStats?.playbooks_this_week || 0} this week</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{myStats?.leads_created || totalLeads}</div>
            <div style={s.statLabel}>Total leads</div>
            <div style={s.statSub}>+{myStats?.leads_this_week || 0} this week</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{myStats?.touchpoints_completed || 0}</div>
            <div style={s.statLabel}>Touchpoints sent</div>
            <div style={s.statSub}>Across all sequences</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{lists.length}</div>
            <div style={s.statLabel}>Lead lists</div>
            <div style={s.statSub}>Active lists</div>
          </div>
        </div>

        <div style={s.grid2}>
          {/* Lead Lists */}
          <div style={s.card}>
            <div style={s.cardHead}>
              <div style={s.cardTitle}>Lead Lists</div>
              <button style={s.newBtn} onClick={() => navigate('/lists')}>+ New List</button>
            </div>
            {lists.length === 0 ? (
              <div style={s.empty}>No lists yet — create your first lead list</div>
            ) : lists.slice(0, 6).map(list => (
              <div key={list.id} style={s.listRow} onClick={() => navigate(`/lists/${list.id}`)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <div>
                  <div style={s.listName}>{list.name}</div>
                  <div style={s.listMeta}>{list.lead_count} leads · {new Date(list.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>→</span>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={s.card}>
            <div style={s.cardHead}>
              <div style={s.cardTitle}>Recent Activity</div>
            </div>
            {recentActivity.length === 0 ? (
              <div style={s.empty}>No activity yet — generate your first playbook</div>
            ) : recentActivity.map((a, i) => (
              <div key={i} style={s.activityItem}>
                <div style={s.activityDot(a.type === 'playbook' ? 'accent' : 'success')} />
                <div style={s.activityText}>
                  <strong>{a.user_name || 'You'}</strong> {a.type === 'playbook' ? 'generated playbook for' : 'completed touch with'} <strong>{a.lead_name}</strong>
                  {a.company ? ` at ${a.company}` : ''}
                </div>
                <div style={s.activityTime}>{timeAgo(a.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Leads */}
        {topLeads.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <div style={s.cardTitle}>Top leads by ICP score</div>
              <span style={s.viewAll} onClick={() => navigate('/lists')}>View all lists →</span>
            </div>
            {topLeads.map((lead, i) => (
              <div key={i} style={s.scoreBar}>
                <span style={s.score(lead.icp_score)}>{lead.icp_score}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.full_name} — {lead.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.company}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: lead.status === 'done' ? 'var(--success-bg)' : 'var(--bg3)', color: lead.status === 'done' ? 'var(--success)' : 'var(--text3)', border: '1px solid var(--border)' }}>
                  {lead.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
