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
  const [primeStats, setPrimeStats] = useState({ total: 0, responding: 0, meetings: 0 });

  useEffect(() => {
    api.get('/sequence/due/today').then(r => setDueCount((r.data?.total || 0))).catch(() => {});
    api.get('/lists').then(r => setLists(r.data || [])).catch(() => {});
    api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {});
    api.get('/opportunities/recent?limit=5').then(r => {
      setRecentOpps(r.data?.opportunities || []);
      setOppCount(r.data?.total || 0);
    }).catch(() => {});
    // Try to get prime stats
    api.get('/subk-primes').then(r => {
      const primes = r.data?.primes || r.data || [];
      if (Array.isArray(primes)) {
        setPrimeStats({
          total: primes.length,
          responding: primes.filter(p => ['responded', 'meeting_set', 'teaming_agreement'].includes(p.outreach_status)).length,
          meetings: primes.filter(p => ['meeting_set', 'teaming_agreement'].includes(p.outreach_status)).length,
        });
      }
    }).catch(() => {});
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

  // Calculate pipeline conversion rate
  const pipelineNew = stats?.pipeline_new || 0;
  const pipelineContacted = stats?.pipeline_contacted || 0;
  const pipelineEngaged = stats?.pipeline_engaged || 0;
  const pipelineProposal = stats?.pipeline_proposal || 0;
  const pipelineClosed = stats?.pipeline_closed || 0;
  const pipelineTotal = pipelineNew + pipelineContacted + pipelineEngaged + pipelineProposal + pipelineClosed;
  const conversionRate = pipelineTotal > 0 ? Math.round(((pipelineEngaged + pipelineProposal + pipelineClosed) / pipelineTotal) * 100) : 0;

  const statCards = [
    { n: stats?.total_playbooks || 0, label: 'Playbooks created', sub: `+${stats?.playbooks_this_week || 0} this week`, color: 'var(--accent2)', icon: '📋' },
    { n: stats?.total_leads || totalLeads, label: 'Total leads', sub: `${readyLeads} ready`, color: 'var(--text)', icon: '👤' },
    { n: stats?.touchpoints_completed || 0, label: 'Touches sent', sub: 'All sequences', color: 'var(--success)', icon: '🎯' },
    { n: oppCount || 0, label: 'Opportunities', sub: `${recentOpps.filter(o => o.fit_score >= 70).length} high-fit`, color: 'var(--accent)', icon: '🔍' },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Layout>
      <style>{`
        @media (max-width: 768px) {
          .pf-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pf-dash-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 }}>
            {greeting()}, {firstName}
          </div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {dueCount > 0 && <span style={{ color: 'var(--warning)', marginLeft: 12 }}>· {dueCount} touches due</span>}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: '+ New List', path: '/lists', bg: 'var(--bg2)', color: 'var(--text)' },
            { label: 'Find Opportunities', path: '/opportunities', bg: 'var(--bg2)', color: 'var(--text)', icon: '🔍' },
            { label: 'View Touches', path: '/reminders', bg: 'var(--bg2)', color: 'var(--text)', icon: '📋' },
            { label: 'AI Coach', path: '/coach', bg: 'var(--accent)', color: '#fff', icon: '✨' },
          ].map(btn => (
            <button key={btn.label} onClick={() => navigate(btn.path)}
              style={{
                padding: '9px 16px', background: btn.bg, border: btn.bg === 'var(--bg2)' ? '1px solid var(--border)' : 'none',
                color: btn.color, borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.target.style.opacity = '1'; }}>
              {btn.icon && <span style={{ marginRight: 4 }}>{btn.icon}</span>}{btn.label}
            </button>
          ))}
        </div>

        {/* Due touches nudge */}
        {dueCount > 0 && (
          <div style={{
            background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)',
            padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, color: 'var(--warning)' }}>
              🎯 {dueCount} touch{dueCount !== 1 ? 'es' : ''} due today — keep the momentum going
            </div>
            <button onClick={() => navigate('/reminders')}
              style={{ padding: '6px 14px', background: 'var(--warning)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Start →
            </button>
          </div>
        )}

        {/* Trial warning */}
        {billing?.plan === 'trial' && billing.playbooks_used >= 7 && (
          <div style={{
            background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-lg)',
            padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, color: 'var(--warning)' }}>
              ⚠ {10 - billing.playbooks_used} free playbooks remaining
            </div>
            <button onClick={() => navigate('/billing')}
              style={{ padding: '6px 14px', background: 'var(--warning)', color: 'var(--text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Upgrade →
            </button>
          </div>
        )}

        {/* Stats error */}
        {statsError && (
          <div style={{
            background: 'var(--bg2)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)',
            padding: '12px 16px', marginBottom: '1rem', fontSize: 13, color: 'var(--danger)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Stats couldn't load — showing defaults</span>
            <button onClick={() => window.location.reload()}
              style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 100 }} />
            ))
          ) : (
            statCards.map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: s.color, marginBottom: 2 }}>{s.n}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                  </div>
                  <span style={{ fontSize: 20, opacity: 0.4 }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{s.sub}</div>
              </div>
            ))
          )}
        </div>

        {/* Pipeline + Conversion Row */}
        {!loading && (
          <div className="pf-dash-cols" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
            {/* Pipeline Overview */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pipeline Overview</div>
                <button onClick={() => navigate('/pipeline')} style={{ fontSize: 11, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer' }}>View pipeline →</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between' }}>
                {[
                  { label: 'New', count: pipelineNew, color: 'var(--text2)' },
                  { label: 'Contacted', count: pipelineContacted, color: 'var(--accent2)' },
                  { label: 'Engaged', count: pipelineEngaged, color: 'var(--warning)' },
                  { label: 'Proposal', count: pipelineProposal, color: 'var(--accent)' },
                  { label: 'Closed', count: pipelineClosed, color: 'var(--success)' },
                ].map(stage => {
                  const maxCount = Math.max(pipelineNew || 1, pipelineContacted || 1, pipelineEngaged || 1, pipelineProposal || 1, pipelineClosed || 1);
                  const percentage = Math.max((stage.count / maxCount) * 100, 8);
                  return (
                    <div key={stage.label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ background: stage.color, height: `${percentage}px`, borderRadius: 'var(--radius)', marginBottom: 8, minHeight: 20, transition: 'all 0.3s', opacity: 0.85 }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: stage.color }}>{stage.count}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{stage.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Metrics */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Key Metrics</div>

              {/* Conversion rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Engagement rate</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: conversionRate >= 30 ? 'var(--success)' : conversionRate >= 15 ? 'var(--warning)' : 'var(--text3)' }}>{conversionRate}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(conversionRate, 100)}%`, background: conversionRate >= 30 ? 'var(--success)' : conversionRate >= 15 ? 'var(--warning)' : 'var(--text3)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>

              {/* Lists active */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Active lists</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{lists.length}</span>
              </div>

              {/* Primes tracked */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Primes tracked</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{primeStats.total}</span>
              </div>

              {/* Meetings set */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Meetings booked</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: primeStats.meetings > 0 ? 'var(--success)' : 'var(--text3)' }}>{primeStats.meetings}</span>
              </div>

              {/* Playbook rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Playbook coverage</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>
                    {totalLeads > 0 ? Math.round((readyLeads / totalLeads) * 100) : 0}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalLeads > 0 ? Math.min((readyLeads / totalLeads) * 100, 100) : 0}%`, background: 'var(--accent2)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Opportunities */}
        {!loading && recentOpps.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recent Opportunities {oppCount > 0 && <span style={{ color: 'var(--accent2)' }}>({oppCount})</span>}
              </div>
              <button onClick={() => navigate('/opportunities')} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {recentOpps.map((opp, i) => (
              <div key={opp.id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < recentOpps.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opp.agency} {opp.set_aside ? `· ${opp.set_aside}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {opp.fit_score && (
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: scoreBg(opp.fit_score), color: scoreColor(opp.fit_score) }}>
                      {opp.fit_score}
                    </span>
                  )}
                  {opp.response_deadline && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius)',
                      background: new Date(opp.response_deadline) < new Date(Date.now() + 7 * 86400000) ? 'rgba(239,68,68,0.1)' : 'var(--bg3)',
                      color: new Date(opp.response_deadline) < new Date(Date.now() + 7 * 86400000) ? 'var(--danger)' : 'var(--text3)',
                    }}>
                      Due {new Date(opp.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid: Lead Lists + Activity */}
        <div className="pf-dash-cols" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
          {/* Lead Lists */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lead Lists</div>
              <button onClick={() => navigate('/lists')}
                style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                + New List
              </button>
            </div>
            {lists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>
                No lists yet — create your first lead list
              </div>
            ) : lists.slice(0, 7).map(list => (
              <div key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{list.name}</div>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>Recent Activity</div>
            {activity.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '2rem 0', textAlign: 'center' }}>
                No activity yet — generate your first playbook to get started
              </div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: a.type === 'playbook' ? 'var(--accent-bg)' : 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                }}>
                  {a.type === 'playbook' ? '📋' : '✓'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                    <strong>{a.user_name || 'You'}</strong>{' '}
                    {a.type === 'playbook' ? 'generated playbook for' : 'completed touch with'}{' '}
                    <strong>{[a.lead_name, a.company].filter(Boolean).join(' at ') || 'a lead'}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(a.timestamp)}</div>
                </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {topLeads.map((lead, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onClick={() => lead.list_id && navigate(`/lists/${lead.list_id}`)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <span style={{
                    padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: scoreBg(lead.icp_score), color: scoreColor(lead.icp_score), flexShrink: 0,
                  }}>
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
