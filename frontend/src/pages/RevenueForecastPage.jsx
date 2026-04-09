import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
};

const ScenarioCard = ({ scenario, index }) => {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: `3px solid ${scenario.color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        flex: 1,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem', fontWeight: 600 }}>
        {scenario.name}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: scenario.color, marginBottom: '0.5rem' }}>
        {formatCurrency(scenario.value)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{scenario.description}</div>
    </div>
  );
};

const PipelineTable = ({ captures, opportunities, proposals }) => {
  const allItems = [
    ...(captures || []).map((c) => ({
      type: 'Capture',
      title: c.title,
      value: c.estimated_value,
      weighted: c.weighted_value,
      pwin: c.pwin,
      color: 'var(--accent)',
    })),
    ...(opportunities || []).map((o) => ({
      type: 'Opportunity',
      title: o.title,
      value: o.value_max,
      weighted: o.value_max,
      pwin: 0,
      color: 'var(--text2)',
    })),
    ...(proposals || []).map((p) => ({
      type: 'Proposal',
      title: p.title,
      value: p.estimated_value,
      weighted: p.estimated_value,
      pwin: p.status === 'won' ? 100 : p.status === 'submitted' ? 50 : 10,
      color: 'var(--success)',
    })),
  ];

  if (allItems.length === 0) {
    return (
      <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '2rem', fontSize: 12 }}>
        No pipeline items yet
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
        }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 600, color: 'var(--text2)' }}>Item</th>
            <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 600, color: 'var(--text2)' }}>Type</th>
            <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 600, color: 'var(--text2)' }}>Value</th>
            <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 600, color: 'var(--text2)' }}>PW%</th>
            <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 600, color: 'var(--text2)' }}>Weighted Value</th>
          </tr>
        </thead>
        <tbody>
          {allItems.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg2)' : 'transparent' }}>
              <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{item.title}</td>
              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: item.color, fontWeight: 500 }}>
                {item.type}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--text2)' }}>
                {formatCurrency(item.value)}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--text2)' }}>
                {item.pwin}%
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--accent)', fontWeight: 600 }}>
                {formatCurrency(item.weighted)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MonthlyChart = ({ months }) => {
  if (!months || months.length === 0) return null;

  const maxValue = Math.max(...months.map((m) => m.value), 1);
  const height = 200;

  return (
    <div style={{ background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginTop: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: 14, fontWeight: 600 }}>Monthly Forecast</h3>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: height + 40, position: 'relative' }}>
        {months.map((month, idx) => {
          const barHeight = (month.value / maxValue) * height;
          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div
                style={{
                  height: barHeight,
                  width: '100%',
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius)',
                  marginBottom: '0.5rem',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
                title={formatCurrency(month.value)}
              />
              <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', width: '100%' }}>
                {month.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AddEntryModal = ({ visible, onClose, onSave, loading }) => {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    month: new Date().toISOString().split('T')[0],
    source: 'manual',
    is_actual: false,
    notes: '',
  });

  const handleSave = () => {
    if (!form.title.trim() || !form.amount) {
      alert('Please enter title and amount');
      return;
    }
    onSave(form);
    setForm({
      title: '',
      amount: '',
      month: new Date().toISOString().split('T')[0],
      source: 'manual',
      is_actual: false,
      notes: '',
    });
  };

  if (!visible) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          zIndex: 1000,
          maxWidth: 500,
          width: '90%',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 600 }}>Add Revenue Entry</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Army Contract Award"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Amount *
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Month
            </label>
            <input
              type="date"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="is_actual"
            checked={form.is_actual}
            onChange={(e) => setForm({ ...form, is_actual: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="is_actual" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontWeight: 500 }}>
            This is actual revenue (not forecast)
          </label>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Notes
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </>
  );
};

export default function RevenueForecastPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [forecastRes, scenariosRes] = await Promise.all([
        api.get('/revenue-forecast'),
        api.get('/revenue-forecast/scenarios'),
      ]);
      setData(forecastRes.data?.data || forecastRes.data);
      setScenarios(scenariosRes.data?.data || scenariosRes.data);
    } catch (err) {
      addToast('Failed to load forecast data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (form) => {
    try {
      setLoading(true);
      await api.post('/revenue-forecast/manual', form);
      addToast('Revenue entry added', 'success');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      addToast('Failed to add entry', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Generate monthly data
  const monthlyData = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthlyData.push({
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      date: date,
      value: Math.random() * 500000, // Mock data
    });
  }

  if (!data || !scenarios) {
    return (
      <Layout>
        <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
          <p style={{ color: 'var(--text2)' }}>Loading forecast data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>Revenue Forecast</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>Pipeline-based revenue projections</p>
        </div>

        {/* Key Metrics */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: 14, fontWeight: 600 }}>Key Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '0.5rem' }}>Weighted Pipeline</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                {formatCurrency(data?.weighted_pipeline || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Scenarios */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: 16, fontWeight: 600 }}>Scenarios</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {scenarios?.scenarios?.map((s, idx) => (
              <ScenarioCard key={idx} scenario={s} index={idx} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            + Add Manual Entry
          </button>
        </div>

        {/* Pipeline Table */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: 14, fontWeight: 600 }}>Pipeline Breakdown</h3>
          <PipelineTable
            captures={data?.captures}
            opportunities={data?.opportunities}
            proposals={data?.proposals}
          />
        </div>

        {/* Monthly Chart */}
        <MonthlyChart months={monthlyData} />

        <AddEntryModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={handleAddEntry} loading={loading} />
      </div>
    </Layout>
  );
}
