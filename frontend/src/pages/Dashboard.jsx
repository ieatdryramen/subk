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
  const [statsError, setStatsError] = useState(false);
  const [recentOpps, setRecentOpps] = useState([]);
  const [oppCount, setOppCount] = useState(0);

  useEffect(() => {
    api.get('/sequence/due/today').then(r => setDueCount((r.data?.total || 0))).catch(() => {});
    // Load lists fast, then dashboard separately so lists show immediately
    api.get('/lists').then(r => setLists(r.data || [])).catch(() => {});
    api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {});
    api.get('/opportunities/recent?limit=5').then(r => { setRecentOpps(r.data?.opportunities || []); setOppCount(r.data?.total || 0); }).catch(() => {});
    setStatsError(false);
    api.get('/admin/dashboard')
      .then(r => {
        if (r.data?.stats) {
          setStats(r.data.stats);
          setTopLeads(r.data.topLeads?.slice(0, 6) || []);
          setActivity(r.data.activity?.slice(0, 10) || []);
        }
      })
      .catch(() => setStatsError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const totalLeads = lists.reduce((a, l) => a + parseInt(l.lead_count || 0), 0);
  const readyLeads = lists.reduce((a, l) => a + parseInt(l.done_count || 0), 0);
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const statCards = [
    { n: stats?.total_playbooks || 0, label: 'Playbooks created', sub: `+${stats?.playbooks_this_week || 0} this week`, color: 'var(--accent2)' },
    { n: stats?.total_leads || totalLeads, label: 'Total leads', sub: `${readyLeads} playbooks ready`, color: 'var(--text)' },
    { n: stats?.touchpoints_completed || 0, label: 'Touches sent', sub: 'Across all sequences', color: 'var(--success)' },
    { n: stats?.total_lists || lists.length, label: 'Lead lists', sub: 'Active lists', color: 'var(--text2)' },
  ];

  return (
    <Layout>
      <style>{`
        @media (max-width: 768px) {
          .pf-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
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

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/lists')} style={{ padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.background = 'var(--bg3)'; e.target.style.borderColor = 'var(--accent)'; }} onMouseLeave={e => { e.target.style.background = 'var(--bg2)'; e.target.style.borderColor = 'var(--border)'; }}>
            + New Lead List
          </button>
          <button onClick={() => navigate('/opportunities')} style={{ padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.background = 'var(--bg3)'; e.target.style.borderColor = 'var(--accent)'; }} onMouseLeave={e => { e.target.style.background = 'var(--bg2)'; e.target.style.borderColor = 'var(--border)'; }}>
            🔍 Find Opportunities
          </button>
          <button onClick={() => navigate('/reminders')} style={{ padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.background = 'var(--bg3)'; e.target.style.borderColor = 'var(--accent)'; }} onMouseLeave={e => { e.target.style.background = 'var(--bg2)'; e.target.style.borderColor = 'var(--border)'; }}>
            📋 View Touches
          </button>
          <button onClick={() => navigate('/coach')} style={{ padding: '10px 16px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }} onMouseEnter={e => { e.target.style.opacity = '0.9'; }} onMouseLeave={e => { e.target.style.opacity = '1'; }}>
            ✨ AI Coach
          </button>
        </div>

        {/* Due touches nudge */}
        {dueCount > 0 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: 'var(--warning)' }}>
              🎯 {dueCount} touch{dueCount !== 1 ? 'es' : ''} due today
            </div>
            <button onClick={() => navigate('/reminders')} style={{ padding: '6px 14px', background: 'var(--warning)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
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
            <button onClick={() => navigate('/billing')} style={{ padding: '6px 14px', background: 'var(--warning)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Upgrade →
            </button>
          </div>
        )}

        {/* Stats */}
        {statsError && (
          <div style={{ background: 'var(--bg2)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '1rem', fontSize: 13, color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Stats couldn't load — showing defaults</span>
            <button onClick={() => window.location.reload()} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer' }}>Refresh</button>
          </div>
        )}
        <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
          {loading ? (
            <>
              <div className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 120 }} />
              <div className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 120 }} />
              <div className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 120 }} />
              <div className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 120 }} />
            </>
          ) : (
            statCards.map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: s.color, marginBottom: 2 }}>{s.n}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))
          )}
        </div>

        {/* Pipeline Overview */}
        {!loading && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.25rem' }}>Pipeline Overview</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {[
                { label: 'New', key: 'pipeline_new', color: 'var(--text2)' },
                { label: 'Contacted', key: 'pipeline_contacted', color: 'var(--accent2)' },
                { label: 'Engaged', key: 'pipeline_engaged', color: 'var(--warning)' },
                { label: 'Proposal', key: 'pipeline_proposal', color: 'var(--accent)' },
                { label: 'Closed', key: 'pipeline_closed', color: 'var(--success)' }
              ].map(stage => {
                const count = stats ? (stats[stage.key] || 0) : 0;
                const maxCount = Math.max(stats?.pipeline_new || 1, stats?.pipeline_contacted || 1, stats?.pipeline_engaged || 1, stats?.pipeline_proposal || 1, stats?.pipeline_closed || 1);
                const percentage = Math.max((count / maxCount) * 100, 8);
                return (
                  <div key={stage.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ background: stage.color, height: `${percentage}px`, borderRadius: 'var(--radius)', marginBottom: 8, minHeight: 20, transition: 'all 0.3s' }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: stage.color }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{stage.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Opportunities */}
        {!loading && recentOpps.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Opportunities {oppCount > 0 && <span style={{ color: 'var(--accent2)' }}>({oppCount})</span>}</div>
              <button onClick={() => navigate('/opportunities')} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {recentOpps.map((opp, i) => (
              <div key={opp.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < recentOpps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opp.agency} {opp.set_aside ? `· ${opp.set_aside}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {opp.fit_score && <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: scoreBg(opp.fit_score), color: scoreColor(opp.fit_score) }}>{opp.fit_score}</span>}
                  {opp.response_deadline && <span style={{ fontSize: 10, color: new Date(opp.response_deadline) < new Date(Date.now() + 7 * 86400000) ? 'var(--danger)' : 'var(--text3)' }}>Due {new Date(opp.response_deadline).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

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


