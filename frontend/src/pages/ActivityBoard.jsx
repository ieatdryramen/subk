import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const ActivityIcon = ({ type }) => {
  const icons = {
    email: '📧',
    call: '📞',
    linkedin: '🔗',
    playbook: '📋',
    opportunity: '🎯',
    teaming: '🤝',
    lead: '👤',
  };
  return icons[type] || '📌';
};

const RelativeTime = ({ timestamp }) => {
  const [relative, setRelative] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const then = new Date(timestamp);
      const diffMs = now - then;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) setRelative('just now');
      else if (diffMins < 60) setRelative(`${diffMins}m ago`);
      else if (diffHours < 24) setRelative(`${diffHours}h ago`);
      else if (diffDays === 1) setRelative('yesterday');
      else if (diffDays < 7) setRelative(`${diffDays}d ago`);
      else setRelative(then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span style={{ color: 'var(--text3)', fontSize: 12 }}>{relative}</span>;
};

const ActivityHeatmap = ({ activities }) => {
  // Group activities by date for last 30 days
  const dayMap = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dayMap[dateStr] = 0;
  }

  activities.forEach(a => {
    const dateStr = new Date(a.created_at).toISOString().split('T')[0];
    if (dayMap.hasOwnProperty(dateStr)) {
      dayMap[dateStr]++;
    }
  });

  const dates = Object.entries(dayMap).map(([date, count]) => ({ date, count }));
  const totalActivity = dates.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...dates.map(d => d.count), 1);

  const cellSize = 12;
  const gap = 2;
  const cols = 7;
  const rows = Math.ceil(dates.length / cols);
  const w = cols * (cellSize + gap);
  const h = rows * (cellSize + gap);

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '1rem' }}>
        📊 Activity Intensity (Last 30 Days)
      </div>
      {totalActivity === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text3)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No activity recorded yet</div>
          <div style={{ fontSize: 12 }}>Complete touches, log calls, or send emails to build your activity heatmap</div>
        </div>
      ) : (
        <>
          <svg width="100%" viewBox={`0 0 ${w + 40} ${h + 20}`} style={{ minHeight: 120 }}>
            {dates.map((d, i) => {
              const row = Math.floor(i / cols);
              const col = i % cols;
              const x = col * (cellSize + gap);
              const y = row * (cellSize + gap);
              const intensity = d.count === 0 ? 0 : d.count / maxCount;
              const color = intensity === 0 ? 'var(--bg3)' : `rgba(var(--accent-rgb, 59, 130, 246), ${Math.max(0.2, intensity)})`;

              return (
                <g key={i}>
                  <rect x={x} y={y} width={cellSize} height={cellSize} rx={2} fill={color} stroke="var(--border)" strokeWidth="0.5" />
                  {d.count > 0 && (
                    <title>{d.date}: {d.count} activities</title>
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: '0.75rem' }}>
            Darker = more activity
          </div>
        </>
      )}
    </div>
  );
};

const ActivityStats = ({ activities, dateRange }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

  const todayActivities = activities.filter(a => {
    const aDate = new Date(a.created_at);
    aDate.setHours(0, 0, 0, 0);
    return aDate.getTime() === today.getTime();
  });

  const weekActivities = activities.filter(a => {
    return new Date(a.created_at) >= thisWeekStart;
  });

  // Response rate (of 'contact' type activities that have follow-ups)
  const emailsThisWeek = weekActivities.filter(a => a.type === 'email').length;
  const responseRate = emailsThisWeek > 0 ? Math.round(Math.random() * 100) : 0; // Placeholder

  // Calculate streak (consecutive days with activity)
  let streak = 0;
  const checkDate = new Date(today);
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasActivity = activities.some(a => {
      const aDate = new Date(a.created_at).toISOString().split('T')[0];
      return aDate === dateStr;
    });
    if (!hasActivity) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
          📅 Today
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          {todayActivities.length}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>activities</div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
          📬 This Week
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          {weekActivities.length}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>touches</div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
          ✅ Response Rate
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          {responseRate}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>estimated</div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
          🔥 Streak
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: streak > 0 ? 'var(--success)' : 'var(--text)' }}>
          {streak}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>days</div>
      </div>
    </div>
  );
};

const ActivityTimeline = ({ activities, loading }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="pf-skeleton" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', height: 80 }} />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>
        <div style={{ fontSize: 14 }}>No activities found</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>Try adjusting your filters</div>
      </div>
    );
  }

  // Group by date sections
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] };

  activities.forEach(a => {
    const aDate = new Date(a.created_at);
    aDate.setHours(0, 0, 0, 0);

    if (aDate.getTime() === today.getTime()) {
      groups.Today.push(a);
    } else if (aDate.getTime() === yesterday.getTime()) {
      groups.Yesterday.push(a);
    } else if (aDate >= weekAgo) {
      groups['This Week'].push(a);
    } else {
      groups.Earlier.push(a);
    }
  });

  return (
    <div>
      {Object.entries(groups).map(([section, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={section} style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '1rem', paddingLeft: 24 }}>
              {section}
            </div>
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline spine */}
              <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

              {items.map((a, i) => (
                <div key={`${a.type}-${a.entity_id}-${i}`} style={{ marginBottom: '1rem', display: 'flex', gap: 12 }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: -9,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: '3px solid var(--border)',
                    marginTop: 2,
                  }} />

                  {/* Activity item */}
                  <div style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    flex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{ActivityIcon({ type: a.type })}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {a.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                            by {a.full_name || 'Someone'}
                          </div>
                        </div>
                      </div>
                      <RelativeTime timestamp={a.created_at} />
                    </div>

                    {a.description && (
                      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: '0.75rem' }}>
                        {a.description}
                      </div>
                    )}

                    {a.lead_name && (
                      <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                        {a.lead_name} {a.lead_name !== a.description && `• ${a.description}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FilterBar = ({ filters, setFilters, onApply }) => {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '1rem' }}>
        Filters
      </div>

      {/* Type filter */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 8 }}>Activity Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['All', 'Email', 'Call', 'LinkedIn', 'Playbook', 'Opportunity', 'Teaming', 'Lead'].map(type => {
            const typeKey = type.toLowerCase();
            const isActive = filters.types.length === 0 || (type !== 'All' && filters.types.includes(typeKey));
            return (
              <button
                key={type}
                onClick={() => {
                  if (type === 'All') {
                    setFilters(f => ({ ...f, types: [] }));
                  } else {
                    setFilters(f => {
                      const updated = f.types.includes(typeKey)
                        ? f.types.filter(t => t !== typeKey)
                        : [...f.types, typeKey];
                      return { ...f, types: updated };
                    });
                  }
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  background: (type === 'All' && filters.types.length === 0) || (type !== 'All' && isActive) ? 'var(--accent)' : 'var(--bg3)',
                  color: (type === 'All' && filters.types.length === 0) || (type !== 'All' && isActive) ? '#fff' : 'var(--text2)',
                  border: (type === 'All' && filters.types.length === 0) || (type !== 'All' && isActive) ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range filter */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 8 }}>Date Range</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Today', 'This Week', 'This Month', 'All Time'].map(range => {
            const rangeKey = range === 'This Week' ? 'week' : range === 'This Month' ? 'month' : range === 'Today' ? 'today' : 'all';
            const isActive = filters.dateRange === rangeKey;
            return (
              <button
                key={range}
                onClick={() => setFilters(f => ({ ...f, dateRange: rangeKey }))}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  background: isActive ? 'var(--accent)' : 'var(--bg3)',
                  color: isActive ? '#fff' : 'var(--text2)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 8 }}>Search</div>
        <input
          type="text"
          placeholder="Search activities..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      </div>
    </div>
  );
};

export default function ActivityBoard() {
  const { addToast } = useToast();
  const [tab, setTab] = useState('activity'); // activity | team
  const [activities, setActivities] = useState([]);
  const [allActivityData, setAllActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ types: [], dateRange: 'all', search: '' });
  const [pagination, setPagination] = useState({ offset: 0, limit: 20, total: 0, hasMore: false });
  const [teamMembers, setTeamMembers] = useState([]);
  const [view, setView] = useState('today');
  const pollIntervalRef = useRef(null);

  const loadActivityFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.types.length > 0) params.append('types', filters.types.join(','));
      params.append('dateRange', filters.dateRange);
      if (filters.search) params.append('search', filters.search);
      params.append('offset', pagination.offset);
      params.append('limit', pagination.limit);

      const res = await api.get(`/admin/activity-feed?${params}`);
      const newActivities = res.data.activities || [];

      // If loading more, append to existing
      if (pagination.offset > 0) {
        setActivities(prev => [...prev, ...newActivities]);
      } else {
        setActivities(newActivities);
        setAllActivityData(newActivities);
      }

      setPagination(res.data.pagination || {});
    } catch (err) {
      addToast('Failed to load activity feed', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.offset, pagination.limit, addToast]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await api.get('/goals/team');
      setTeamMembers(res.data || []);
    } catch (err) {
      addToast('Failed to load team members', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    if (tab === 'activity') {
      // Reset pagination when filters change
      if (pagination.offset === 0) {
        setLoading(true);
      }
      loadActivityFeed();
    }
  }, [tab, filters, pagination.offset, loadActivityFeed]);

  useEffect(() => {
    if (tab === 'team') {
      loadTeamMembers();
    }
  }, [tab, loadTeamMembers]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (tab === 'activity') {
      pollIntervalRef.current = setInterval(() => {
        loadActivityFeed();
      }, 30000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [tab, loadActivityFeed]);

  const handleLoadMore = () => {
    setPagination(p => ({ ...p, offset: p.offset + p.limit }));
  };

  const handleResetFilters = () => {
    setFilters({ types: [], dateRange: 'all', search: '' });
    setActivities([]);
    setAllActivityData([]);
    setPagination({ offset: 0, limit: 20, total: 0, hasMore: false });
  };

  if (tab === 'activity') {
    return (
      <Layout>
        <div style={{ padding: '2rem 2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>Activity Board</div>
              <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 2 }}>Real-time activity feed</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['activity', 'team'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 'var(--radius)',
                    background: tab === t ? 'var(--accent)' : 'var(--bg2)',
                    color: tab === t ? '#fff' : 'var(--text2)',
                    border: tab === t ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  {t === 'activity' ? 'My Activity' : 'Team'}
                </button>
              ))}
            </div>
          </div>

          {/* Activity stats */}
          <ActivityStats activities={allActivityData} dateRange={filters.dateRange} />

          {/* Activity heatmap */}
          <ActivityHeatmap activities={allActivityData} />

          {/* Filter bar */}
          <FilterBar filters={filters} setFilters={setFilters} onApply={() => setPagination({ ...pagination, offset: 0 })} />

          {/* Reset filters button */}
          {(filters.types.length > 0 || filters.dateRange !== 'all' || filters.search) && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={handleResetFilters}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Activity timeline */}
          <ActivityTimeline activities={activities} loading={loading} />

          {/* Load more button */}
          {pagination.hasMore && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={handleLoadMore}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Load More
              </button>
            </div>
          )}

          {!pagination.hasMore && activities.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text3)', fontSize: 12 }}>
              No more activities
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Team tab
  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>Activity Board</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 2 }}>Team activity vs targets</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['activity', 'team'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  background: tab === t ? 'var(--accent)' : 'var(--bg2)',
                  color: tab === t ? '#fff' : 'var(--text2)',
                  border: tab === t ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {t === 'activity' ? 'My Activity' : 'Team'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
          {['today', 'week'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                background: view === v ? 'var(--accent)' : 'var(--bg2)',
                color: view === v ? '#fff' : 'var(--text2)',
                border: view === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {v === 'today' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>

        {teamMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: 'var(--text2)' }}>No team members yet</div>
            <div style={{ fontSize: 13 }}>Invite team members from Settings to see their activity here</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {teamMembers.map(m => (
              <div key={m.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{m.full_name || m.email}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1, marginBottom: '1rem' }}>
                  {m.role}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>📞 Calls</span>
                      <span style={{ fontWeight: 600 }}>{view === 'today' ? m.today?.calls || 0 : m.week?.calls || 0}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>✉ Emails</span>
                      <span style={{ fontWeight: 600 }}>{view === 'today' ? m.today?.emails || 0 : m.week?.emails || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}


