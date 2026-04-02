import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import Layout from '../components/Layout';

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

const scoreColor = (s) => s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--text3)';
const scoreBg = (s) => s >= 70 ? 'var(--success-bg)' : s >= 40 ? 'var(--warning-bg)' : 'var(--bg3)';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [stats, setStats] = useState(null);
  const [topLeads, setTopLeads] = useState([]);
  const [activity, setActivity] = useState([]);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    api.get('/reminders/due').then(r => setDueCount((r.data || []).filter(l => l.urgency !== 'upcoming').length)).catch(() => {});
    Promise.all([
      api.get('/lists'),
      api.get('/admin/dashboard').catch(() => null),
      api.get('/billing/status').catch(() => null),
    ]).then(([listsRes, adminRes, billingRes]) => {
      setLists(listsRes.data || []);
      if (adminRes?.data) {
        const me = adminRes.data.members?.find(m => m.email === user?.email);
        setStats(me);
        setTopLeads(adminRes.data.topLeads?.slice(0, 6) || []);
        setActivity(adminRes.data.activity?.slice(0, 10) || []);
      }
      if (billingRes?.data) setBilling(billingRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const totalLeads = lists.reduce((a, l) => a + parseInt(l.lead_count || 0), 0);
  const readyLeads = lists.reduce((a, l) => a + parseInt(l.done_count || 0), 0);
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const statCards = [
    { n: stats?.playbooks_generated || 0, label: 'Playbooks created', sub: `+${stats?.playbooks_this_week || 0} this week`, color: 'var(--accent2)' },
    { n: totalLeads, label: 'Total leads', sub: `${readyLeads} with playbooks`, color: 'var(--text)' },
    { n: stats?.touchpoints_completed || 0, label: 'Touches sent', sub: 'Across all sequences', color: 'var(--success)' },
    { n: lists.length, label: 'Lead lists', sub: 'Active lists', color: 'var(--text2)' },
  ];

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 }}>
            Hey {firstName} 👋
          </div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Due touches nudge */}
        {dueCount > 0 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: 'var(--warning)' }}>
              🎯 {dueCount} touch{dueCount !== 1 ? 'es' : ''} due today
            </div>
            <button onClick={() => navigate('/reminders')} style={{ padding: '6px 14px', background: 'var(--warning)', color: '#000', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              See who →
            </button>
          </div>
        )}

        {/* Trial warning */}
        {billing?.plan === 'trial' && billing.playbooks_used >= 7 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: 'var(--warning)' }}>
              ⚠ {10 - billing.playbooks_used} free playbooks remaining
            </div>
            <button onClick={() => navigate('/billing')} style={{ padding: '6px 14px', background: 'var(--warning)', color: '#000', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Upgrade →
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: s.color, marginBottom: 2 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: '1.5rem' }}>
          {/* Lead Lists */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lead Lists</div>
              <button onClick={() => navigate('/lists')} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>+ New List</button>
            </div>
            {lists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>
                No lists yet — create your first lead list
              </div>
            ) : lists.slice(0, 7).map(list => (
              <div key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{list.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {list.lead_count} leads · {list.done_count || 0} playbooks
                  </div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>→</span>
              </div>
            ))}
          </div>

          {/* Activity Feed */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>Team Activity</div>
            {activity.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '2rem 0', textAlign: 'center' }}>
                No activity yet — generate your first playbook
              </div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.type === 'playbook' ? 'var(--accent)' : 'var(--success)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                  <strong>{a.user_name || 'You'}</strong> {a.type === 'playbook' ? 'generated playbook for' : 'completed touch with'} <strong>{[a.lead_name, a.company].filter(Boolean).join(' at ') || 'a lead'}</strong>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(a.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Leads */}
        {topLeads.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top leads by ICP score</div>
              <span onClick={() => navigate('/pipeline')} style={{ fontSize: 12, color: 'var(--accent2)', cursor: 'pointer' }}>View pipeline →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {topLeads.map((lead, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: scoreBg(lead.icp_score), color: scoreColor(lead.icp_score), flexShrink: 0 }}>
                    {lead.icp_score}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
