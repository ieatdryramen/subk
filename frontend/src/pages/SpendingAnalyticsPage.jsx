import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

// Horizontal bar chart for top agencies/NAICS
const HorizontalBarChart = ({ data, title, maxItems = 10 }) => {
  const items = data.slice(0, maxItems);
  if (items.length === 0) return null;

  const maxValue = Math.max(...items.map(d => d.amount || 0));

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, idx) => (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                {(item.name || item.agency || item.naics).substring(0, 40)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>
                {formatCurrency(item.amount)}
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: 'var(--bg3)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--accent2)',
                  width: `${(item.amount / maxValue) * 100}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Area chart for spending trends
const AreaChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.amount || 0));
  const width = 800;
  const height = 250;
  const padding = 40;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const points = data.map((item, idx) => ({
    x: (idx / (data.length - 1)) * plotWidth + padding,
    y: height - ((item.amount / maxValue) * plotHeight + padding),
    value: item.amount,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPathD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div style={{ overflow: 'auto', marginBottom: '2rem' }}>
      <svg width={width} height={height} style={{ minWidth: width }}>
        {/* Grid lines */}
        {[...Array(5)].map((_, i) => {
          const y = padding + (i * plotHeight) / 4;
          return (
            <line
              key={`grid-${i}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4"
              strokeWidth="1"
            />
          );
        })}

        {/* Y-axis labels */}
        {[...Array(5)].map((_, i) => {
          const value = (maxValue / 4) * (4 - i);
          const y = padding + (i * plotHeight) / 4;
          return (
            <text
              key={`label-${i}`}
              x={padding - 8}
              y={y + 4}
              fontSize="10"
              fill="var(--text3)"
              textAnchor="end"
            >
              ${(value / 1000000000).toFixed(1)}B
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaPathD} fill="var(--accent-bg)" opacity="0.5" />

        {/* Line */}
        <path d={pathD} stroke="var(--accent2)" strokeWidth="2" fill="none" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="var(--accent2)"
          />
        ))}

        {/* X-axis labels */}
        {data.map((item, i) => {
          if (i % Math.ceil(data.length / 5) !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={`x-label-${i}`}
              x={points[i].x}
              y={height - 8}
              fontSize="10"
              fill="var(--text3)"
              textAnchor="middle"
            >
              {item.year || item.period}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// Simple pie-style chart for set-aside distribution
const SetAsideChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + (d.amount || 0), 0);
  const cx = 150;
  const cy = 150;
  const radius = 100;

  let currentAngle = -90;
  const slices = data.map((item, idx) => {
    const percentage = item.amount / total;
    const sliceAngle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const pathD = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    currentAngle = endAngle;

    return { pathD, color: ['var(--accent2)', 'var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)'][idx % 5], ...item };
  });

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
      <svg width="300" height="300">
        {slices.map((slice, idx) => (
          <path key={idx} d={slice.pathD} fill={slice.color} stroke="var(--bg)" strokeWidth="2" />
        ))}
      </svg>
      <div style={{ flex: 1 }}>
        {slices.map((slice, idx) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: slice.color,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {slice.name || slice.type}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {Math.round((slice.amount / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function SpendingAnalyticsPage() {
  const { addToast } = useToast();
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [agencies, setAgencies] = useState([]);
  const [naicsCodes, setNaicsCodes] = useState([]);
  const [trends, setTrends] = useState([]);
  const [setAsideData, setSetAsideData] = useState([]);
  const [selectedNaics, setSelectedNaics] = useState(null);
  const [naicsDetail, setNaicsDetail] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agencyRes, naicsRes, trendsRes] = await Promise.all([
        api.get('/spending/by-agency', { params: { fiscalYear } }),
        api.get('/spending/by-naics', { params: { fiscalYear } }),
        api.get('/spending/trends'),
      ]);

      const agencyData = agencyRes.data.agencies || [];
      const naicsData = naicsRes.data.naics || [];
      const trendData = trendsRes.data.trends || [];

      setAgencies(agencyData);
      setNaicsCodes(naicsData);
      setTrends(trendData);

      // Calculate stats
      const totalObligation = agencyData.reduce((sum, a) => sum + (a.amount || 0), 0);
      const topAgency = agencyData[0];
      const topNaics = naicsData[0];
      const previousYear = trendData.find(t => t.year === String(parseInt(fiscalYear) - 1));
      const currentYear = trendData.find(t => t.year === fiscalYear);

      const yoyChange = previousYear && currentYear
        ? ((currentYear.amount - previousYear.amount) / previousYear.amount) * 100
        : 0;

      setStats({
        totalObligation,
        topAgency: topAgency?.agency || 'N/A',
        topNaics: topNaics?.naics || 'N/A',
        yoyChange: yoyChange.toFixed(1),
      });

      // Mock set-aside data
      setSetAsideData([
        { name: 'Small Business', amount: totalObligation * 0.25, type: 'SB' },
        { name: 'HUBZone', amount: totalObligation * 0.1, type: 'HUBZone' },
        { name: 'Women-Owned', amount: totalObligation * 0.08, type: 'WOSB' },
        { name: 'Service-Disabled Vet', amount: totalObligation * 0.05, type: 'SDVOSB' },
        { name: 'Open Market', amount: totalObligation * 0.52, type: 'Open' },
      ]);
    } catch (err) {
      addToast('Failed to load spending data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNaicsDrilldown = async (naics) => {
    try {
      setSelectedNaics(naics);
      // In a real app, this would fetch detailed spending by this NAICS code
      addToast(`Showing spending details for NAICS ${naics.naics}`, 'info');
    } catch (err) {
      addToast('Failed to load NAICS details', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    await loadData();
    addToast('Data refreshed', 'success');
  };

  const fiscalYears = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
              Spending Analytics
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
              Government spending trends and analysis
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={fiscalYear}
              onChange={e => {
                setFiscalYear(e.target.value);
                setLoading(true);
                // Would trigger reload on change
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {fiscalYears.map(year => (
                <option key={year} value={year}>
                  FY {year}
                </option>
              ))}
            </select>
            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: 'var(--accent)',
                color: '#FFFFFF',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '⟳' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Key Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginBottom: '2rem',
          }}
        >
          {[
            { label: 'Total Obligations', value: formatCurrency(stats.totalObligation), color: 'var(--accent2)' },
            { label: 'Top Agency', value: stats.topAgency, color: 'var(--accent)' },
            { label: 'Top NAICS', value: stats.topNaics, color: 'var(--text2)' },
            { label: 'YoY Change', value: `${stats.yoyChange > 0 ? '+' : ''}${stats.yoyChange}%`, color: stats.yoyChange > 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text2)' }}>
            Loading analytics...
          </div>
        ) : (
          <>
            {/* Top Agencies */}
            <div
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 2rem 0' }}>
                Top 10 Agencies by Spending
              </h2>
              <HorizontalBarChart data={agencies} title="" />
            </div>

            {/* Top NAICS */}
            <div
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 2rem 0' }}>
                Top 10 NAICS by Spending
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12,
                }}
              >
                {naicsCodes.slice(0, 10).map((naics, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleNaicsDrilldown(naics)}
                    style={{
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--bg)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg3)';
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                      {naics.naics}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                      {naics.description?.substring(0, 50)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>
                      {formatCurrency(naics.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spending Trends */}
            <div
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 2rem 0' }}>
                5-Year Spending Trends
              </h2>
              <AreaChart data={trends} />
            </div>

            {/* Set-Aside Distribution */}
            <div
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 2rem 0' }}>
                Set-Aside Distribution
              </h2>
              <SetAsideChart data={setAsideData} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
