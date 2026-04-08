import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import Layout from '../components/Layout';
import Tooltip from '../components/Tooltip';

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

// SVG Sparkline Mini-Chart
function Sparkline({ data, color = 'var(--accent)' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  if (max === 0) return <div style={{ height: 20, width: '100%', opacity: 0.3 }}>No data</div>;

  const width = 40;
  const height = 20;
  const padding = 1;
  const pointWidth = (width - padding * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = padding + i * pointWidth;
    const y = height - padding - (v / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// SVG Funnel Chart
function PipelineFunnel({ funnelData }) {
  const stages = [
    { label: 'Not Started', value: funnelData?.not_started || 0, color: 'var(--text3)' },
    { label: 'Touched (1-10)', value: funnelData?.touched || 0, color: 'var(--accent2)' },
    { label: 'MEFU', value: funnelData?.mefu || 0, color: 'var(--warning)' },
    { label: 'Completed', value: funnelData?.completed || 0, color: 'var(--success)' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);
  const funnelWidth = 200;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <svg width={funnelWidth} height={200} style={{ display: 'block', margin: '0 auto' }}>
        {stages.map((stage, i) => {
          const percentage = stage.value / maxValue;
          const width = funnelWidth * percentage;
          const x = (funnelWidth - width) / 2;
          const y = i * 50 + 10;

          return (
            <g key={stage.label}>
              <rect x={x} y={y} width={width} height={35} fill={stage.color} opacity="0.7" rx="2" />
              <text x={funnelWidth / 2} y={y + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">
                {stage.value}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        {stages.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text2)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// SVG Donut Chart (Win Rate)
function WinRateDonut({ won = 0, lost = 0, pursuing = 0 }) {
  const total = won + lost + pursuing;
  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>
        No opportunities yet
      </div>
    );
  }

  const size = 120;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  const wonPercent = (won / total) * 100;
  const lostPercent = (lost / total) * 100;
  const pursuingPercent = (pursuing / total) * 100;

  let offset = 0;
  const wonOffset = offset;
  offset += (wonPercent / 100) * circumference;

  const lostOffset = offset;
  offset += (lostPercent / 100) * circumference;

  const pursuingOffset = offset;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--success)" strokeWidth="12"
          strokeDasharray={`${(wonPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset="0" strokeLinecap="round" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--danger)" strokeWidth="12"
          strokeDasharray={`${(lostPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset={-wonOffset} strokeLinecap="round" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--accent)" strokeWidth="12"
          strokeDasharray={`${(pursuingPercent / 100) * circumference} ${circumference}`}
          strokeDashoffset={-(wonOffset + lostOffset)} strokeLinecap="round" />
        <text x={size/2} y={size/2 + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">
          {Math.round((won / (won + lost)) * 100) || 0}%
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text2)' }}>Won</span>
          <span style={{ fontWeight: 700, color: 'var(--success)' }}>{won}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text2)' }}>Lost</span>
          <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{lost}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text2)' }}>Pursuing</span>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{pursuing}</span>
        </div>
      </div>
    </div>
  );
}

// SVG Horizontal Bar Chart (Outreach Velocity)
function OutreachVelocity({ touchTrends = [] }) {
  if (!touchTrends || touchTrends.length === 0) {
    return <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '1rem' }}>No data</div>;
  }

  const maxCount = Math.max(...touchTrends.map(t => t.count || 0), 1);
  const chartHeight = touchTrends.length * 28;

  return (
    <svg width="100%" height={chartHeight} style={{ display: 'block' }}>
      {touchTrends.map((trend, i) => {
        const y = i * 28 + 8;
        const barWidth = (trend.count / maxCount) * 150;
        const dateStr = new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <g key={trend.date}>
            <text x="0" y={y + 12} fontSize="11" fill="var(--text2)" fontWeight="500">
              {dateStr}
            </text>
            <rect x="50" y={y} width={barWidth} height="16" fill="var(--accent)" rx="2" />
            <text x={55 + barWidth} y={y + 12} fontSize="11" fontWeight="700" fill="var(--text)" fontFamily="Syne, sans-serif">
              {trend.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Prime Outreach Funnel (mini)
function PrimeOutreachFunnel({ primeStats = {} }) {
  const stages = [
    { label: 'Not Contacted', value: primeStats.not_contacted || 0, color: 'var(--text3)' },
    { label: 'Contacted', value: primeStats.contacted || 0, color: 'var(--accent2)' },
    { label: 'Responded', value: primeStats.responded || 0, color: 'var(--warning)' },
    { label: 'Meeting Set', value: primeStats.meeting_set || 0, color: 'var(--success)' },
    { label: 'Teaming Agree', value: primeStats.teaming_agreement || 0, color: 'var(--accent)' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stages.map((stage) => {
        const percentage = (stage.value / maxValue) * 100;
        return (
          <div key={stage.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--text2)' }}>{stage.label}</span>
              <span style={{ fontWeight: 700, color: stage.color }}>{stage.value}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${percentage}%`, background: stage.color, borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Deadline Countdown Widget
function DeadlineCountdown({ deadlines = [] }) {
  if (!deadlines || deadlines.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>
        No upcoming deadlines in the next 14 days
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {deadlines.slice(0, 5).map((d, i) => {
        const now = new Date();
        const deadline = new Date(d.response_deadline);
        const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

        let countdownColor = 'var(--success)';
        if (daysLeft <= 3) countdownColor = 'var(--danger)';
        else if (daysLeft <= 7) countdownColor = 'var(--warning)';

        return (
          <div key={d.id || i} style={{
            background: 'var(--bg)',
            border: `1px solid ${countdownColor}`,
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.title?.substring(0, 50)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{d.agency}</div>
            </div>
            <div style={{
              padding: '4px 10px',
              background: countdownColor,
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              marginLeft: 10,
              textAlign: 'center',
            }}>
              {daysLeft}d
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Revenue Pipeline Gauge (semi-circular)
function RevenuePipelineGauge({ pipelineValue = 0 }) {
  const maxValue = 5000000; // $5M max for gauge
  const percentage = Math.min((pipelineValue / maxValue) * 100, 100);

  const size = 150;
  const radius = 60;
  const circumference = Math.PI * radius;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
        {/* Background arc */}
        <path
          d={`M 20 ${size * 0.6 - 10} A ${radius} ${radius} 0 0 1 ${size - 20} ${size * 0.6 - 10}`}
          fill="none"
          stroke="var(--bg3)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 20 ${size * 0.6 - 10} A ${radius} ${radius} 0 0 1 ${20 + (percentage / 100) * (size - 40)} ${size * 0.6 - 10}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Center text */}
        <text x={size / 2} y={size * 0.6 + 5} textAnchor="middle" fontSize="11" fill="var(--text3)">
          Pipeline Value
        </text>
      </svg>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
        ${(pipelineValue / 1000000).toFixed(1)}M
      </div>
    </div>
  );
}

// Today's Focus Panel
function TodaysFocus({ dueCount, deadlines = [], upcomingTouches = [] }) {
  let priority = null;
  let priorityLabel = '';
  let priorityColor = '';

  if (dueCount > 0) {
    priority = dueCount;
    priorityLabel = `${dueCount} touch${dueCount !== 1 ? 'es' : ''} overdue`;
    priorityColor = 'var(--danger)';
  } else if (deadlines && deadlines.length > 0) {
    const firstDeadline = deadlines[0];
    const now = new Date();
    const deadline = new Date(firstDeadline.response_deadline);
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    priority = daysLeft;
    priorityLabel = `${daysLeft}d until deadline: ${firstDeadline.title?.substring(0, 40)}`;
    priorityColor = daysLeft <= 3 ? 'var(--danger)' : 'var(--warning)';
  } else if (upcomingTouches && upcomingTouches.length > 0) {
    priority = upcomingTouches.length;
    priorityLabel = `${upcomingTouches.length} touch${upcomingTouches.length !== 1 ? 'es' : ''} scheduled`;
    priorityColor = 'var(--success)';
  } else {
    priorityLabel = 'All caught up!';
    priorityColor = 'var(--success)';
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${priorityColor}15 0%, ${priorityColor}08 100%)`,
      border: `1px solid ${priorityColor}40`,
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Today's Focus
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: priorityColor, fontFamily: 'Syne, sans-serif', marginBottom: 6 }}>
        {priority !== null ? priority : '0'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
        {priorityLabel}
      </div>
    </div>
  );
}

// Getting Started Checklist Widget
function GettingStartedChecklist({ onboarding = {}, navigate = () => {} }) {
  const tasks = [
    {
      id: 1,
      title: 'Set up company profile',
      completed: onboarding.has_profile,
      path: '/company-profile',
      icon: '🏢',
    },
    {
      id: 2,
      title: 'Import your first list',
      completed: onboarding.has_lists,
      path: '/lists',
      icon: '📋',
    },
    {
      id: 3,
      title: 'Send your first touch',
      completed: onboarding.has_touches,
      path: '/reminders',
      icon: '📧',
    },
    {
      id: 4,
      title: 'Track an opportunity',
      completed: onboarding.has_opportunities,
      path: '/opportunities',
      icon: '🎯',
    },
    {
      id: 5,
      title: 'Add a prime contractor',
      completed: onboarding.has_primes,
      path: '/subk-primes',
      icon: '🤝',
    },
  ];

  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const percentage = (completed / total) * 100;

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Getting Started
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {completed}/{total} completed
          </div>
        </div>
        <button onClick={() => {
          localStorage.setItem('pf-onboarding-dismissed', 'true');
          window.location.reload();
        }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 'var(--radius)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.target.style.color = 'var(--text2)';
            e.target.style.background = 'var(--bg3)';
          }}
          onMouseLeave={e => {
            e.target.style.color = 'var(--text3)';
            e.target.style.background = 'none';
          }}>
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          background: 'var(--accent)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Tasks list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => (
          <div
            key={task.id}
            onClick={() => navigate(task.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg3)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}>
            {/* Checkmark */}
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              background: task.completed ? 'var(--success)' : 'var(--bg3)',
              color: task.completed ? '#fff' : 'var(--text3)',
              flexShrink: 0,
            }}>
              {task.completed ? '✓' : '○'}
            </div>

            {/* Icon and title */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                color: task.completed ? 'var(--text3)' : 'var(--text)',
                textDecoration: task.completed ? 'line-through' : 'none',
              }}>
                {task.icon} {task.title}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ fontSize: 14, opacity: 0.4 }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Recommended Actions Widget
function RecommendedActions({ actions = [], loading = false, onRefresh = () => {} }) {
  const typeIcon = {
    follow_up: '📧',
    opportunity: '🎯',
    playbook: '📋',
    deadline: '🔔',
  };

  const typeLabel = {
    follow_up: 'Follow-up',
    opportunity: 'Opportunity',
    playbook: 'Playbook',
    deadline: 'Deadline',
  };

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🎯 AI Recommended Actions
        </div>
        <button onClick={onRefresh} disabled={loading}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12,
            padding: '4px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={e => !loading && (e.target.style.background = 'var(--bg3)')}
          onMouseLeave={e => e.target.style.background = 'none'}>
          {loading ? '⟳' : '↻'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Loading actions...
        </div>
      ) : actions.length === 0 ? (
        <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>All caught up!</div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>No priority actions right now.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((action, i) => (
            <div key={i} onClick={() => window.location.href = action.action_url}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg3)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}>
              <div style={{ fontSize: 16, flexShrink: 0 }}>
                {typeIcon[action.type] || '→'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: 4,
                    background: action.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(251, 146, 60, 0.15)',
                    color: action.priority === 'high' ? 'var(--danger)' : 'var(--warning)',
                  }}>
                    {action.priority}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>
                    {typeLabel[action.type]}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                  {action.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.3 }}>
                  {action.description}
                </div>
              </div>
              <div style={{ fontSize: 16, flexShrink: 0, opacity: 0.5 }}>→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [primeStats, setPrimeStats] = useState({});
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [nextActions, setNextActions] = useState([]);
  const [nextActionsLoading, setNextActionsLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const fetchNextActions = () => {
    setNextActionsLoading(true);
    api.get('/admin/next-actions')
      .then(r => setNextActions(r.data?.actions || []))
      .catch(() => setNextActions([]))
      .finally(() => setNextActionsLoading(false));
  };

  useEffect(() => {
    // Check if onboarding was dismissed
    setOnboardingDismissed(!!localStorage.getItem('pf-onboarding-dismissed'));

    // Fetch onboarding status
    api.get('/admin/onboarding-status')
      .then(r => setOnboarding(r.data))
      .catch(() => {});

    api.get('/sequence/due/today').then(r => setDueCount((r.data?.total || 0))).catch(() => {});
    api.get('/lists').then(r => setLists(r.data || [])).catch(() => {});
    api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {});
    api.get('/opportunities/recent?limit=5').then(r => {
      setRecentOpps(r.data?.opportunities || []);
      setOppCount(r.data?.total || 0);
    }).catch(() => {});

    // Get prime stats
    api.get('/subk-primes').then(r => {
      const primes = r.data?.primes || r.data || [];
      if (Array.isArray(primes)) {
        const stats = {
          not_contacted: 0,
          contacted: 0,
          responded: 0,
          meeting_set: 0,
          teaming_agreement: 0,
        };
        primes.forEach(p => {
          const status = p.outreach_status || 'not_contacted';
          if (stats.hasOwnProperty(status)) {
            stats[status]++;
          }
        });
        setPrimeStats(stats);
      }
    }).catch(() => {});

    // Get dashboard analytics (7-day trends, funnel, deadlines)
    api.get('/admin/dashboard-analytics').then(r => {
      setDashboardAnalytics(r.data);
    }).catch(() => {});

    // Get SubK analytics if available
    api.get('/subk-dashboard/analytics').then(r => {
      setAnalyticsData(r.data);
    }).catch(() => {});

    // Get next actions
    fetchNextActions();

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

  // Calculate win rate from analytics
  const opportunityPipeline = analyticsData?.opportunity_pipeline || {};
  const won = opportunityPipeline.won || 0;
  const lost = opportunityPipeline.lost || 0;
  const pursuing = opportunityPipeline.pursuing || 0;
  const pipelineValue = analyticsData?.pipeline_value || 0;

  const statCards = [
    { n: stats?.total_playbooks || 0, label: 'Playbooks created', sub: `+${stats?.playbooks_this_week || 0} this week`, color: 'var(--accent2)', icon: '📋', trend: dashboardAnalytics?.playbook_trends?.map(t => t.count) || [] },
    { n: stats?.total_leads || totalLeads, label: 'Total leads', sub: `${readyLeads} ready`, color: 'var(--text)', icon: '👤', trend: [] },
    { n: stats?.touchpoints_completed || 0, label: 'Touches sent', sub: 'All sequences', color: 'var(--success)', icon: '🎯', trend: dashboardAnalytics?.touch_trends?.map(t => t.count) || [] },
    { n: oppCount || 0, label: 'Opportunities', sub: `${recentOpps.filter(o => o.fit_score >= 70).length} high-fit`, color: 'var(--accent)', icon: '🔍', trend: [] },
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
          .pf-analytics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1200 }}>
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

        {/* Stat Cards with Sparklines */}
        <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', height: 130 }} />
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
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, marginBottom: 6 }}>{s.sub}</div>
                {s.trend && s.trend.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Sparkline data={s.trend} color={s.color} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Getting Started Checklist Widget */}
        {!loading && onboarding && !onboardingDismissed && onboarding.completed < 5 && (
          <GettingStartedChecklist onboarding={onboarding} navigate={navigate} />
        )}

        {/* Today's Focus Panel */}
        {!loading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <TodaysFocus
              dueCount={dueCount}
              deadlines={dashboardAnalytics?.upcoming_deadlines || []}
              upcomingTouches={[]}
            />
          </div>
        )}

        {/* AI Recommended Actions */}
        {!loading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <RecommendedActions
              actions={nextActions}
              loading={nextActionsLoading}
              onRefresh={fetchNextActions}
            />
          </div>
        )}

        {/* Analytics Grid: Funnel + Win Rate + Velocity + Revenue Gauge */}
        {!loading && (
          <div className="pf-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: '1.5rem' }}>
            {/* Pipeline Funnel */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Pipeline Funnel
                <Tooltip text="Distribution of leads across pipeline stages" />
              </div>
              <PipelineFunnel funnelData={dashboardAnalytics?.funnel_data} />
            </div>

            {/* Win Rate Donut */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Win Rate
              </div>
              <WinRateDonut won={won} lost={lost} pursuing={pursuing} />
            </div>

            {/* Outreach Velocity */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                Outreach Velocity
              </div>
              <OutreachVelocity touchTrends={dashboardAnalytics?.touch_trends || []} />
            </div>

            {/* Revenue Pipeline Gauge */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Pipeline Value
              </div>
              <RevenuePipelineGauge pipelineValue={pipelineValue} />
            </div>
          </div>
        )}

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
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {Object.values(primeStats).reduce((a, b) => a + b, 0)}
                </span>
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

        {/* Prime Outreach + Deadline Countdown Row */}
        {!loading && (
          <div className="pf-dash-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
            {/* Prime Outreach Funnel */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Prime Outreach Funnel
              </div>
              <PrimeOutreachFunnel primeStats={primeStats} />
            </div>

            {/* Deadline Countdown */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Upcoming Deadlines
              </div>
              <DeadlineCountdown deadlines={dashboardAnalytics?.upcoming_deadlines || []} />
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
