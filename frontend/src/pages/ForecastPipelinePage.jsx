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

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Simple SVG bar chart for agency budgets
const AgencyBudgetChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
        No budget data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.amount || 0));
  const chartHeight = 300;
  const barHeight = chartHeight / data.length;
  const padding = 40;

  return (
    <svg width="100%" height={chartHeight} style={{ minHeight: chartHeight }}>
      {data.map((item, idx) => {
        const barWidth = (item.amount / maxValue) * (600 - padding * 2);
        const y = idx * barHeight + barHeight * 0.4;

        return (
          <g key={idx}>
            <text
              x="10"
              y={y + 8}
              fontSize="12"
              fill="var(--text2)"
              textAnchor="start"
              style={{ fontWeight: 500 }}
            >
              {item.agency?.substring(0, 20)}
            </text>
            <rect
              x={padding}
              y={y - 8}
              width={barWidth}
              height="16"
              fill="var(--accent2)"
              rx="4"
            />
            <text
              x={padding + barWidth + 8}
              y={y + 8}
              fontSize="12"
              fill="var(--text2)"
              textAnchor="start"
              style={{ fontWeight: 600 }}
            >
              {formatCurrency(item.amount)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default function ForecastPipelinePage() {
  const { addToast } = useToast();
  const [forecasts, setForecasts] = useState([]);
  const [agencyBudgets, setAgencyBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filter states
  const [selectedAgency, setSelectedAgency] = useState('');
  const [naicsFilter, setNaicsFilter] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('This Quarter');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [forecastRes, budgetRes] = await Promise.all([
        api.get('/forecast'),
        api.get('/forecast/agency-budgets'),
      ]);
      setForecasts(forecastRes.data.forecasts || []);
      setAgencyBudgets(budgetRes.data.budgets || []);
    } catch (err) {
      addToast('Failed to load forecasts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      const res = await api.post('/forecast/scan');
      setForecasts(res.data.forecasts || []);
      addToast('Scan complete - new opportunities found', 'success');
    } catch (err) {
      addToast('Scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleTrack = async (forecast) => {
    try {
      await api.post('/opportunities', {
        title: forecast.title,
        agency: forecast.agency,
        value_min: forecast.value_min,
        value_max: forecast.value_max,
        expected_rfq_date: forecast.timeline,
        description: `Pre-RFP forecast from ${forecast.source}`,
        type: 'opportunity',
      });
      addToast('Opportunity tracked', 'success');
    } catch (err) {
      addToast('Failed to track opportunity', 'error');
    }
  };

  // Filter forecasts
  const filteredForecasts = forecasts.filter(f => {
    if (selectedAgency && f.agency !== selectedAgency) return false;
    if (naicsFilter && !f.naics?.includes(naicsFilter)) return false;
    if (minValue && f.value_min < parseFloat(minValue)) return false;
    if (maxValue && f.value_max > parseFloat(maxValue)) return false;
    // Timeline filtering would go here
    return true;
  });

  // Calculate stats
  const stats = {
    total: forecasts.length,
    q1: forecasts.filter(f => f.quarter === 'Q1').length,
    q2: forecasts.filter(f => f.quarter === 'Q2').length,
    q3: forecasts.filter(f => f.quarter === 'Q3').length,
    q4: forecasts.filter(f => f.quarter === 'Q4').length,
    govWin: forecasts.filter(f => f.source === 'govwin').length,
    sam: forecasts.filter(f => f.source === 'sam.gov').length,
  };

  const uniqueAgencies = [...new Set(forecasts.map(f => f.agency))];

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
              Forecast Pipeline
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
              Pre-RFP opportunity intelligence from budget and spending data
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--accent)',
              color: '#FFFFFF',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: scanning ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => !scanning && (e.target.style.opacity = '0.9')}
            onMouseLeave={e => !scanning && (e.target.style.opacity = '1')}
          >
            {scanning ? 'Scanning...' : '🔍 Scan for Opportunities'}
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
            marginBottom: '2rem',
          }}
        >
          {[
            { label: 'Total Forecasts', value: stats.total, color: 'var(--accent2)' },
            { label: 'Q1', value: stats.q1, color: 'var(--accent)' },
            { label: 'Q2', value: stats.q2, color: 'var(--accent)' },
            { label: 'Q3', value: stats.q3, color: 'var(--accent)' },
            { label: 'Q4', value: stats.q4, color: 'var(--accent)' },
            { label: 'GovWin', value: stats.govWin, color: 'var(--text2)' },
            { label: 'SAM.gov', value: stats.sam, color: 'var(--text2)' },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: stat.color, marginBottom: 4 }}>
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              Agency
            </label>
            <select
              value={selectedAgency}
              onChange={e => setSelectedAgency(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option value="">All Agencies</option>
              {uniqueAgencies.map(agency => (
                <option key={agency} value={agency}>
                  {agency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              NAICS Code
            </label>
            <input
              type="text"
              value={naicsFilter}
              onChange={e => setNaicsFilter(e.target.value)}
              placeholder="e.g., 541330"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              Timeline
            </label>
            <select
              value={timelineFilter}
              onChange={e => setTimelineFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option>This Quarter</option>
              <option>Next Quarter</option>
              <option>This FY</option>
              <option>Next FY</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              Min Value
            </label>
            <input
              type="number"
              value={minValue}
              onChange={e => setMinValue(e.target.value)}
              placeholder="$"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              Max Value
            </label>
            <input
              type="number"
              value={maxValue}
              onChange={e => setMaxValue(e.target.value)}
              placeholder="$"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Forecasts Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
            Loading forecasts...
          </div>
        ) : filteredForecasts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--bg2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 16, color: 'var(--text2)' }}>
              No forecasts found matching your filters
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: 16,
              marginBottom: '2rem',
            }}
          >
            {filteredForecasts.map((forecast, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,184,166,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1, marginRight: 8 }}>
                    {forecast.title}
                  </h3>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--accent-bg)',
                      color: 'var(--accent2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Forecast
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>Agency:</span> {forecast.agency}
                  </div>
                  {forecast.naics && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>NAICS:</span> {forecast.naics}
                    </div>
                  )}
                  {forecast.timeline && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Expected:</span> {formatDate(forecast.timeline)}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'var(--bg3)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    marginBottom: 12,
                    fontSize: 13,
                    color: 'var(--accent2)',
                    fontWeight: 600,
                  }}
                >
                  {formatCurrency(forecast.value_min)} - {formatCurrency(forecast.value_max)}
                </div>

                {forecast.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text3)',
                      marginBottom: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {forecast.description.substring(0, 100)}...
                  </div>
                )}

                {forecast.source && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
                    Source: {forecast.source}
                  </div>
                )}

                <button
                  onClick={() => handleTrack(forecast)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--accent)',
                    background: 'transparent',
                    color: 'var(--accent2)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'var(--accent-bg)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  Track as Opportunity
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Budget Trends */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginTop: '2rem',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 1.5rem 0' }}>
            Agency Budget Trends
          </h2>
          <AgencyBudgetChart data={agencyBudgets.slice(0, 10)} />
        </div>
      </div>
    </Layout>
  );
}
