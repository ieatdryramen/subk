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

export default function RateBenchmarksPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    rate: '',
    region: 'DC',
    experience_level: 'Mid',
    source: 'Internal',
  });

  const levels = ['Junior', 'Mid', 'Senior'];
  const regions = ['DC', 'Remote', 'Other'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [benchRes, marketRes, compRes] = await Promise.all([
        api.get('/rate-benchmarks'),
        api.get('/rate-benchmarks/market-data'),
        api.get('/rate-benchmarks/compare'),
      ]);
      setBenchmarks(benchRes.data?.benchmarks || benchRes.data?.data || []);
      setMarketData(marketRes.data?.marketData || marketRes.data?.data || []);
      setComparisons(compRes.data?.comparisons || compRes.data?.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async () => {
    if (!formData.category || !formData.rate) {
      addToast('Please fill in all required fields', 'warning');
      return;
    }

    try {
      await api.post('/rate-benchmarks', formData);
      addToast('Rate benchmark added', 'success');
      setFormData({
        category: '',
        rate: '',
        region: 'DC',
        experience_level: 'Mid',
        source: 'Internal',
      });
      setShowNewForm(false);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleExportReport = () => {
    const rows = comparisons.map(c => [
      c.category,
      c.level,
      c.region,
      c.orgRate,
      c.marketRate,
      c.delta,
      c.status,
    ]);

    const csv = [
      ['Category', 'Level', 'Region', 'Your Rate', 'Market Rate', 'Delta', 'Status'],
      ...rows,
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-benchmarks.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></Layout>;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Rate Benchmarks</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Labor rate comparison against GSA Schedule data</p>
        </div>

        {/* Market Rates Table */}
        <div style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: `1px solid var(--border)`,
        }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 18, fontWeight: 700 }}>Market Rates (GSA Schedule)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid var(--border)` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Category</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Junior (DC)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Junior (Remote)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Mid (DC)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Mid (Remote)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Senior (DC)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Senior (Remote)</th>
                </tr>
              </thead>
              <tbody>
                {marketData.map((cat, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid var(--border)`, backgroundColor: i % 2 ? 'var(--bg)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{cat.category}</td>
                    {['Junior', 'Mid', 'Senior'].map(level =>
                      ['DC', 'Remote'].map(region => {
                        const rate = cat.rates.find(r => r.level === level && r.region === region);
                        return (
                          <td key={`${level}-${region}`} style={{ padding: '0.75rem' }}>
                            {rate ? formatCurrency(rate.rate) : '-'}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Your Rates Section */}
        <div style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: `1px solid var(--border)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Your Rates</h2>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showNewForm ? 'Cancel' : 'Add Rate'}
            </button>
          </div>

          {showNewForm && (
            <div style={{
              background: 'var(--bg)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              marginBottom: '1.5rem',
              border: `1px solid var(--border)`,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category</label>
                  <input
                    type="text"
                    placeholder="e.g., Software Engineer"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid var(--border)`,
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Hourly Rate ($)</label>
                  <input
                    type="number"
                    placeholder="120"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid var(--border)`,
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Experience Level</label>
                  <select
                    value={formData.experience_level}
                    onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid var(--border)`,
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  >
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Region</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid var(--border)`,
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  >
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddRate}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Save Rate
              </button>
            </div>
          )}

          {benchmarks.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border)` }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Category</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Level</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Region</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid var(--border)`, backgroundColor: i % 2 ? 'var(--bg)' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{b.category}</td>
                      <td style={{ padding: '0.75rem' }}>{formatCurrency(b.rate)}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13 }}>{b.experience_level}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13 }}>{b.region}</td>
                      <td style={{ padding: '0.75rem', fontSize: 13, color: 'var(--text2)' }}>{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>No rates entered yet</p>
          )}
        </div>

        {/* Comparison View */}
        {comparisons.length > 0 && (
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Comparison</h2>
              <button
                onClick={handleExportReport}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Export Report
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border)` }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Category</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Your Rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Market Rate</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Delta</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: 13 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((c, i) => {
                    const statusColor = c.status === 'competitive' ? 'var(--success)' : c.status === 'above' ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid var(--border)`, backgroundColor: i % 2 ? 'var(--bg)' : 'transparent' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{c.category} ({c.level}/{c.region})</td>
                        <td style={{ padding: '0.75rem' }}>{formatCurrency(c.orgRate)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatCurrency(c.marketRate)}</td>
                        <td style={{ padding: '0.75rem', color: statusColor, fontWeight: 600 }}>
                          {c.delta > 0 ? '+' : ''}{formatCurrency(c.delta)}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            background: statusColor,
                            color: 'white',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
