import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

// SVG Line Chart for Pipeline Velocity
function PipelineVelocityChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>No data available</div>;
  }

  const width = 600;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => Math.max(d.new || 0, d.pursuing || 0, d.won || 0, d.lost || 0)), 1);
  const xStep = graphWidth / (data.length - 1 || 1);

  // Helper to create path
  const createPath = (key, color) => {
    const points = data.map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + graphHeight - (((d[key] || 0) / maxValue) * graphHeight);
      return `${x},${y}`;
    }).join(' ');
    return points;
  };

  return (
    <svg width={width} height={height} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      {/* Grid */}
      {[0, 1, 2, 3, 4].map(i => {
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <line key={`grid-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4,4" opacity="0.5" />
        );
      })}

      {/* Y-axis */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />
      {/* X-axis */}
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />

      {/* Y-axis labels */}
      {[0, 1, 2, 3, 4].map(i => {
        const value = Math.round((maxValue / 4) * i);
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <text key={`y-label-${i}`} x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text3)">
            {value}
          </text>
        );
      })}

      {/* Lines */}
      <polyline points={createPath('new', 'var(--text3)')} fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={createPath('pursuing', 'var(--accent2)')} fill="none" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={createPath('won', 'var(--success)')} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={createPath('lost', 'var(--danger)')} fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 5) !== 0 && i !== data.length - 1) return null;
        const x = padding.left + i * xStep;
        return (
          <text key={`x-label-${i}`} x={x} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fill="var(--text3)">
            {d.date}
          </text>
        );
      })}

      {/* Legend */}
      <g>
        {[
          { label: 'New', color: 'var(--text3)', x: padding.left },
          { label: 'Pursuing', color: 'var(--accent2)', x: padding.left + 120 },
          { label: 'Won', color: 'var(--success)', x: padding.left + 240 },
          { label: 'Lost', color: 'var(--danger)', x: padding.left + 320 },
        ].map((item, i) => (
          <g key={`legend-${i}`}>
            <line x1={item.x} y1={10} x2={item.x + 15} y2={10} stroke={item.color} strokeWidth="2" />
            <text x={item.x + 20} y={15} fontSize="11" fill="var(--text2)">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// SVG Bar Chart for Win/Loss
function WinLossChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>No data available</div>;
  }

  const width = 600;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => Math.max(d.won || 0, d.lost || 0)), 1);
  const barGroupWidth = graphWidth / data.length;
  const barWidth = barGroupWidth * 0.35;
  const spacing = barWidth * 0.5;

  return (
    <svg width={width} height={height} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      {/* Grid */}
      {[0, 1, 2, 3, 4].map(i => {
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <line key={`grid-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4,4" opacity="0.5" />
        );
      })}

      {/* Y-axis */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />
      {/* X-axis */}
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />

      {/* Y-axis labels */}
      {[0, 1, 2, 3, 4].map(i => {
        const value = Math.round((maxValue / 4) * i);
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <text key={`y-label-${i}`} x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text3)">
            {value}
          </text>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const baseX = padding.left + (i + 0.5) * barGroupWidth;
        const wonHeight = (d.won / maxValue) * graphHeight;
        const lostHeight = (d.lost / maxValue) * graphHeight;

        return (
          <g key={`bar-${i}`}>
            {/* Won bar */}
            <rect
              x={baseX - spacing - barWidth}
              y={padding.top + graphHeight - wonHeight}
              width={barWidth}
              height={wonHeight}
              fill="var(--success)"
              opacity="0.8"
              rx="2"
            />
            {/* Lost bar */}
            <rect
              x={baseX + spacing}
              y={padding.top + graphHeight - lostHeight}
              width={barWidth}
              height={lostHeight}
              fill="var(--danger)"
              opacity="0.8"
              rx="2"
            />
            {/* Month label */}
            <text x={baseX} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fill="var(--text3)">
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g>
        <rect x={padding.left} y={15} width={10} height={10} fill="var(--success)" opacity="0.8" />
        <text x={padding.left + 15} y={23} fontSize="11" fill="var(--text2)">Won</text>
        <rect x={padding.left + 70} y={15} width={10} height={10} fill="var(--danger)" opacity="0.8" />
        <text x={padding.left + 85} y={23} fontSize="11" fill="var(--text2)">Lost</text>
      </g>
    </svg>
  );
}

// SVG Grouped Bar Chart for Outreach Performance
function OutreachPerformanceChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>No data available</div>;
  }

  const width = 600;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.flatMap(d => [d.emails || 0, d.calls || 0, d.linkedin || 0]), 1);
  const barGroupWidth = graphWidth / data.length;
  const barWidth = barGroupWidth * 0.22;
  const spacing = barWidth * 0.3;

  return (
    <svg width={width} height={height} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      {/* Grid */}
      {[0, 1, 2, 3, 4].map(i => {
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <line key={`grid-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4,4" opacity="0.5" />
        );
      })}

      {/* Y-axis */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />
      {/* X-axis */}
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--text2)" strokeWidth="2" />

      {/* Y-axis labels */}
      {[0, 1, 2, 3, 4].map(i => {
        const value = Math.round((maxValue / 4) * i);
        const y = padding.top + (graphHeight / 4) * i;
        return (
          <text key={`y-label-${i}`} x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text3)">
            {value}
          </text>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const baseX = padding.left + (i + 0.5) * barGroupWidth;
        const emailsHeight = ((d.emails || 0) / maxValue) * graphHeight;
        const callsHeight = ((d.calls || 0) / maxValue) * graphHeight;
        const linkedinHeight = ((d.linkedin || 0) / maxValue) * graphHeight;

        return (
          <g key={`bars-${i}`}>
            <rect
              x={baseX - spacing * 1.5 - barWidth}
              y={padding.top + graphHeight - emailsHeight}
              width={barWidth}
              height={emailsHeight}
              fill="var(--accent)"
              opacity="0.8"
              rx="2"
            />
            <rect
              x={baseX - spacing * 0.5}
              y={padding.top + graphHeight - callsHeight}
              width={barWidth}
              height={callsHeight}
              fill="var(--accent2)"
              opacity="0.8"
              rx="2"
            />
            <rect
              x={baseX + spacing * 0.5 + barWidth}
              y={padding.top + graphHeight - linkedinHeight}
              width={barWidth}
              height={linkedinHeight}
              fill="var(--warning)"
              opacity="0.8"
              rx="2"
            />
            <text x={baseX} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fill="var(--text3)">
              {d.week}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g>
        <rect x={padding.left} y={15} width={10} height={10} fill="var(--accent)" opacity="0.8" />
        <text x={padding.left + 15} y={23} fontSize="11" fill="var(--text2)">Emails</text>
        <rect x={padding.left + 100} y={15} width={10} height={10} fill="var(--accent2)" opacity="0.8" />
        <text x={padding.left + 115} y={23} fontSize="11" fill="var(--text2)">Calls</text>
        <rect x={padding.left + 180} y={15} width={10} height={10} fill="var(--warning)" opacity="0.8" />
        <text x={padding.left + 195} y={23} fontSize="11" fill="var(--text2)">LinkedIn</text>
      </g>
    </svg>
  );
}

// SVG Horizontal Bar Chart for Pipeline Status
function PipelineStatusChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>No data available</div>;
  }

  const items = [
    { label: 'New', key: 'new', color: 'var(--text3)' },
    { label: 'Pursuing', key: 'pursuing', color: 'var(--accent2)' },
    { label: 'Won', key: 'won', color: 'var(--success)' },
    { label: 'Lost', key: 'lost', color: 'var(--danger)' },
  ];

  const maxValue = Math.max(...items.map(item => data[item.key] || 0), 1);
  const width = 500;
  const height = 200;
  const barHeight = 30;
  const padding = { top: 20, bottom: 20, left: 100, right: 60 };

  return (
    <svg width={width} height={height} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      {items.map((item, i) => {
        const value = data[item.key] || 0;
        const barWidth = ((value / maxValue) * (width - padding.left - padding.right));
        const y = padding.top + i * barHeight;

        return (
          <g key={item.key}>
            <text x={padding.left - 10} y={y + 18} textAnchor="end" fontSize="12" fontWeight="500" fill="var(--text2)">
              {item.label}
            </text>
            <rect x={padding.left} y={y + 5} width={barWidth} height={20} fill={item.color} opacity="0.8" rx="2" />
            <text x={padding.left + barWidth + 10} y={y + 18} fontSize="11" fontWeight="600" fill="var(--text2)">
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Main Reports Page
export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const { addToast } = useToast();

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/reports?days=${dateRange}`);
      setReports(res.data);
    } catch (err) {
      addToast('Failed to load reports', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (filename, headers, rows) => {
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = r[h.toLowerCase().replace(/\s+/g, '_')] || '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Layout>
        <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', color: 'var(--text3)' }}>Loading reports...</div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto', background: 'var(--bg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem 0' }}>📊 Reports & Export</h1>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>Track pipeline velocity, win/loss analysis, and outreach performance</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="999999">All Time</option>
            </select>
            <button
              onClick={handlePrint}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              🖨 Print
            </button>
          </div>
        </div>

        {!reports ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>No data available</div>
        ) : (
          <>
            {/* Pipeline Velocity */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Pipeline Velocity</h2>
                <button
                  onClick={() => {
                    const headers = ['Date', 'New', 'Pursuing', 'Won', 'Lost'];
                    const rows = reports.pipeline_velocity || [];
                    exportCSV('pipeline-velocity.csv', headers, rows);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Export CSV
                </button>
              </div>
              <PipelineVelocityChart data={reports.pipeline_velocity} />
            </section>

            {/* Win/Loss Analysis */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Win/Loss Analysis</h2>
                <button
                  onClick={() => {
                    const headers = ['Month', 'Won', 'Lost'];
                    const rows = reports.win_loss || [];
                    exportCSV('win-loss.csv', headers, rows);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Export CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                <WinLossChart data={reports.win_loss} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Total Won</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{reports.win_loss_summary?.total_won || 0}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Total Lost</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{reports.win_loss_summary?.total_lost || 0}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Win Rate</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                      {reports.win_loss_summary ? Math.round((reports.win_loss_summary.total_won / (reports.win_loss_summary.total_won + reports.win_loss_summary.total_lost || 1)) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Outreach Performance */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Outreach Performance (Last 4 Weeks)</h2>
                <button
                  onClick={() => {
                    const headers = ['Week', 'Emails', 'Calls', 'LinkedIn'];
                    const rows = reports.outreach_performance || [];
                    exportCSV('outreach-performance.csv', headers, rows);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Export CSV
                </button>
              </div>
              <OutreachPerformanceChart data={reports.outreach_performance} />
            </section>

            {/* Opportunity Pipeline */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Opportunity Pipeline</h2>
                <button
                  onClick={() => {
                    const data = reports.opportunity_pipeline;
                    const headers = ['Status', 'Count'];
                    const rows = Object.entries(data || {}).map(([status, count]) => ({
                      status: status.charAt(0).toUpperCase() + status.slice(1),
                      count,
                    }));
                    exportCSV('pipeline-status.csv', headers, rows);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Export CSV
                </button>
              </div>
              <PipelineStatusChart data={reports.opportunity_pipeline} />
            </section>

            {/* Top Performers */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Top Performers</h2>
                <button
                  onClick={() => {
                    const headers = ['Name', 'Company', 'ICP Score', 'Touches', 'Engagement'];
                    const rows = reports.top_performers || [];
                    exportCSV('top-performers.csv', headers, rows);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Export CSV
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ICP Score</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Touches</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports.top_performers || []).map((lead, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text)' }}>{lead.name}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text2)' }}>{lead.company}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text)', textAlign: 'center', fontWeight: 600 }}>
                        <span style={{
                          background: lead.icp_score >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          color: lead.icp_score >= 70 ? 'var(--success)' : 'var(--warning)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: 12,
                        }}>{lead.icp_score}</span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text)', textAlign: 'center' }}>{lead.touches}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text)', textAlign: 'center', fontWeight: 500 }}>{lead.engagement}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Prime Engagement Summary */}
            <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 1.5rem 0' }}>Prime Engagement Summary</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'var(--bg3)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Total Primes</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{reports.prime_summary?.total_primes || 0}</div>
                </div>
                <div style={{ background: 'var(--bg3)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Contacted</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{reports.prime_summary?.contacted || 0}</div>
                </div>
                <div style={{ background: 'var(--bg3)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Response Rate</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent2)' }}>
                    {reports.prime_summary ? Math.round((reports.prime_summary.responded / (reports.prime_summary.contacted || 1)) * 100) : 0}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg3)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Teaming Agreements</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{reports.prime_summary?.teaming_agreements || 0}</div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <style>{`
        @media print {
          main { padding: 0.5rem !important; }
          button { display: none !important; }
          section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1.5rem; }
          svg { max-width: 100%; height: auto; }
        }
      `}</style>
    </Layout>
  );
}
