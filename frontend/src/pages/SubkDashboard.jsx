import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const scoreColor = (score) => {
  if (!score) return { color: 'var(--text3)', bg: 'var(--bg3)' };
  if (score >= 70) return { color: 'var(--success)', bg: 'var(--success-bg)' };
  if (score >= 40) return { color: 'var(--warning)', bg: 'var(--warning-bg)' };
  return { color: 'var(--text3)', bg: 'var(--bg3)' };
};

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function Dashboard() {
  const [opps, setOpps] = useState([]);
  const [primes, setPrimes] = useState([]);
  const [profile, setProfile] = useState(null);
  const [billing, setBilling] = useState(null);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activity, setActivity] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/opportunities').then(r => setOpps(Array.isArray(r.data) ? r.data : r.data.opportunities || [])).catch(() => {});
    api.get('/primes').then(r => setPrimes(r.data)).catch(() => {});
    api.get('/profile').then(r => setProfile(r.data)).catch(() => {});
    api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {});
    api.get('/subk-dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/subk-dashboard/analytics').then(r => setAnalytics(r.data)).catch(() => {});
    api.get('/subk-dashboard/activity').then(r => setActivity(r.data || [])).catch(() => {});
  }, []);

  const topOpps = opps.filter(o => o.fit_score >= 70).slice(0, 5);
  const topPrimes = primes.filter(p => p.outreach_status !== 'sequence_complete').slice(0, 5);
  const dueTouches = primes.filter(p => p.outreach_status === 'in_sequence').length;
  const deadlineSoon = opps.filter(o => {
    if (!o.response_deadline) return false;
    const days = (new Date(o.response_deadline) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 14;
  }).length;

  const s = {
    page: { padding: '2rem 2.5rem' },
    heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' },
    statCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
    statNum: { fontSize: 32, fontWeight: 700, fontFamily: 'Syne', marginBottom: 2 },
    statLabel: { fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' },
    section: { marginBottom: '2rem' },
    sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
    sectionTitle: { fontSize: 16, fontWeight: 600 },
    viewAll: { fontSize: 12, color: 'var(--accent2)', cursor: 'pointer', background: 'none', border: 'none' },
    card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    badge: (score) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, ...scoreColor(score) }),
    setupCard: { background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    btn: (v) => ({ padding: '9px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', background: v === 'primary' ? 'var(--accent)' : 'var(--bg3)', color: v === 'primary' ? '#fff' : 'var(--text2)' }),
    miniStat: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  };

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Dashboard</div>
        <div style={s.sub}>Your GovCon teaming command center</div>

        {!profile && (
          <div style={s.setupCard}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Complete your company profile to get started</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Add your NAICS codes, certifications, and capabilities to score opportunities and generate outreach.</div>
            </div>
            <button style={s.btn('primary')} onClick={() => navigate('/onboarding')}>Set up profile &#x2192;</button>
          </div>
        )}

        {/* Main Stats */}
        <div style={s.grid4}>
          {[
            { n: stats?.opportunities ?? opps.length, l: 'Opportunities tracked', c: 'var(--text)', click: '/opportunities' },
            { n: stats?.high_fit ?? topOpps.length, l: 'High fit (70+)', c: 'var(--success)', click: '/opportunities' },
            { n: stats?.primes_tracked ?? primes.length, l: 'Primes tracked', c: 'var(--accent2)', click: '/primes' },
            { n: stats?.deadlines_14d ?? deadlineSoon, l: 'Deadlines in 14 days', c: (stats?.deadlines_14d || deadlineSoon) > 0 ? 'var(--warning)' : 'var(--text3)', click: '/opportunities' },
          ].map(x => (
            <div key={x.l} style={{ ...s.statCard, cursor: 'pointer' }} onClick={() => navigate(x.click)}>
              <div style={{ ...s.statNum, color: x.c }}>{x.n}</div>
              <div style={s.statLabel}>{x.l}</div>
            </div>
          ))}
        </div>

        {/* Teaming & Profile Stats Row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem' }}>
            <div style={s.miniStat} onClick={() => navigate('/teaming')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Teaming requests</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                  {stats.teaming_pending > 0
                    ? <><strong style={{ color: 'var(--warning)' }}>{stats.teaming_pending} pending</strong> &middot; {stats.teaming_received} total</>
                    : <>{stats.teaming_received} received</>}
                </div>
              </div>
              <span style={{ fontSize: 20 }}>&#x1F4E5;</span>
            </div>
            <div style={s.miniStat} onClick={() => navigate('/profile')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Profile completeness</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                    <div style={{ height: '100%', width: `${stats.profile_completeness}%`, background: stats.profile_completeness === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: stats.profile_completeness === 100 ? 'var(--success)' : 'var(--text)' }}>{stats.profile_completeness}%</span>
                </div>
              </div>
            </div>
            <div style={s.miniStat} onClick={() => navigate('/marketplace')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Marketplace</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                  {stats.marketplace_subs} subs listed &middot; {stats.is_public ? <span style={{ color: 'var(--success)' }}>You&#39;re visible</span> : <span style={{ color: 'var(--text3)' }}>Not listed</span>}
                </div>
              </div>
              <span style={{ fontSize: 20 }}>&#x1F91D;</span>
            </div>
          </div>
        )}

        {/* Usage */}
        {billing && (
          <div style={{ ...s.statCard, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                Plan: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{billing.plan}</strong> &middot; {billing.searches_used}/{billing.searches_limit} searches used
              </div>
              <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (billing.searches_used / billing.searches_limit) * 100)}%`, background: billing.searches_used >= billing.searches_limit ? 'var(--danger)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
            </div>
            {billing.plan === 'trial' && (
              <button style={s.btn('primary')} onClick={() => navigate('/billing')}>Upgrade</button>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Top opportunities */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.sectionTitle}>Top Opportunities</div>
              <button style={s.viewAll} onClick={() => navigate('/opportunities')}>View all &#x2192;</button>
            </div>
            {topOpps.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>
                {opps.length === 0 ? 'Run a search to find opportunities' : 'No high-fit opportunities yet'}
              </div>
            ) : topOpps.map(opp => (
              <div key={opp.id} style={s.card} onClick={() => navigate('/opportunities')}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={s.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, lineHeight: 1.3 }}>{opp.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{opp.agency}</div>
                    {opp.response_deadline && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                        Due {new Date(opp.response_deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <span style={s.badge(opp.fit_score)}>{opp.fit_score}</span>
                </div>
              </div>
            ))}
            {opps.length === 0 && (
              <button style={{ ...s.btn('primary'), marginTop: 8 }} onClick={() => navigate('/opportunities')}>
                Search opportunities &#x2192;
              </button>
            )}
          </div>

          {/* Prime tracker */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.sectionTitle}>Prime Targets</div>
              <button style={s.viewAll} onClick={() => navigate('/primes')}>View all &#x2192;</button>
            </div>
            {topPrimes.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No primes tracked yet</div>
            ) : topPrimes.map(prime => (
              <div key={prime.id} style={s.card} onClick={() => navigate('/primes')}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={s.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{prime.company_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{prime.agency_focus}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                      ${(prime.total_awards_value / 1000000).toFixed(0)}M in awards &middot; {prime.award_count} contracts
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {prime.fit_score && <span style={s.badge(prime.fit_score)}>{prime.fit_score}</span>}
                    <span style={{ fontSize: 10, color: prime.outreach_status === 'not_contacted' ? 'var(--text3)' : 'var(--accent2)' }}>
                      {prime.outreach_status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {primes.length === 0 && (
              <button style={{ ...s.btn('primary'), marginTop: 8 }} onClick={() => navigate('/primes')}>
                Find prime targets &#x2192;
              </button>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '2rem 0', paddingTop: '2rem' }}>
              <div style={s.heading}>Analytics</div>
              <div style={s.sub}>Your key performance indicators</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: '2rem' }}>
                {/* Opportunity Pipeline */}
                <div style={s.statCard}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Opportunity Pipeline
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'New', count: analytics.opps_new || 0, color: 'var(--text3)' },
                      { label: 'Pursuing', count: analytics.opps_pursuing || 0, color: 'var(--warning)' },
                      { label: 'Submitted', count: analytics.opps_submitted || 0, color: 'var(--accent2)' },
                      { label: 'Won', count: analytics.opps_won || 0, color: 'var(--success)' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>{item.label}</span>
                        <span style={{ fontWeight: 600, color: item.color }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Win Rate */}
                <div style={s.statCard}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Win Rate
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto', marginBottom: 8 }}>
                        <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="40" cy="40" r="30" fill="none" stroke="var(--bg3)" strokeWidth="6" />
                          <circle
                            cx="40" cy="40" r="30" fill="none" stroke="var(--success)" strokeWidth="6"
                            strokeDasharray={`${(analytics.win_rate || 0) * 1.88} 188.4`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{analytics.win_rate || 0}%</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{analytics.opps_won || 0}/{analytics.opps_submitted || 0} won</div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Value */}
                <div style={s.statCard}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Pipeline Value
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Pursuing + Submitted</div>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Syne', color: 'var(--accent2)' }}>
                        ${(analytics.pipeline_value / 1e6).toFixed(1)}M
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                      {analytics.opps_pursuing || 0} pursuing · {analytics.opps_submitted || 0} submitted
                    </div>
                  </div>
                </div>
              </div>

              {/* Prime Outreach Funnel */}
              {analytics.prime_funnel && (
                <div style={s.statCard}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Prime Outreach Funnel
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Not Contacted', count: analytics.prime_funnel.not_contacted || 0, color: 'var(--text3)' },
                      { label: 'In Sequence', count: analytics.prime_funnel.in_sequence || 0, color: 'var(--accent2)' },
                      { label: 'Responded', count: analytics.prime_funnel.responded || 0, color: 'var(--warning)' },
                      { label: 'Meeting Set', count: analytics.prime_funnel.meeting_set || 0, color: 'var(--accent2)' },
                      { label: 'Teaming Agreement', count: analytics.prime_funnel.teaming_agreement || 0, color: 'var(--success)' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)', minWidth: 140 }}>{item.label}</div>
                        <div style={{ flex: 1, height: 24, background: 'var(--bg3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${item.count > 0 ? Math.min(100, (item.count / (analytics.primes_total || 1)) * 100) : 0}%`,
                              background: item.color,
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: item.color, minWidth: 30 }}>{item.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Trend */}
              {analytics.monthly_activity && (
                <div style={{ ...s.statCard, marginTop: '1.5rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Activity (Last 6 Months)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 100, gap: 4 }}>
                    {analytics.monthly_activity.slice(-6).map((count, i) => {
                      const maxCount = Math.max(...analytics.monthly_activity.slice(-6), 1);
                      const height = (count / maxCount) * 100;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div
                            style={{
                              width: '100%',
                              height: `${height}%`,
                              background: 'var(--accent)',
                              borderRadius: '2px',
                            }}
                          />
                          <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Activity Feed */}
        {activity.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', margin: '2rem 0', paddingTop: '2rem' }}>
            <div style={s.sectionHead}>
              <div style={s.sectionTitle}>Recent Activity</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => navigate(a.link)}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {a.type === 'opportunity' ? '🎯' : a.type === 'prime' ? '🏢' : '🤝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{a.description}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {timeAgo(a.timestamp)}
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
