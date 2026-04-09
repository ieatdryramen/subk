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

const PHASES = ['Lead', 'Qualify', 'Capture', 'Proposal', 'Submit', 'Award'];

// Arc gauge for Pwin
const PwinGauge = ({ pwin = 0 }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pwin / 100) * circumference;

  const color = pwin < 30 ? 'var(--danger)' : pwin < 60 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="100" height="60" style={{ marginBottom: 8 }}>
        {/* Background arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
          strokeDasharray={circumference}
          transform="rotate(-180 50 50)"
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-180 50 50)"
          style={{ transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 4 }}>
        {pwin}%
      </div>
    </div>
  );
};

// New Capture Modal
const NewCaptureModal = ({ visible, onClose, onSave, opportunities, loading }) => {
  const [form, setForm] = useState({
    title: '',
    opportunity_id: '',
    initial_phase: 'Lead',
    notes: '',
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      alert('Please enter a capture title');
      return;
    }
    onSave(form);
    setForm({
      title: '',
      opportunity_id: '',
      initial_phase: 'Lead',
      notes: '',
    });
  };

  if (!visible) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
        }}
      />
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
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text)' }}>
          Create New Capture
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Capture Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., DoD SAIC Subcontract"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Linked Opportunity
          </label>
          <select
            value={form.opportunity_id}
            onChange={e => setForm({ ...form, opportunity_id: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">None</option>
            {opportunities.map(opp => (
              <option key={opp.id} value={opp.id}>
                {opp.title.substring(0, 40)}...
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Initial Phase
          </label>
          <select
            value={form.initial_phase}
            onChange={e => setForm({ ...form, initial_phase: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            {PHASES.map(phase => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Initial capture notes..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 14,
              minHeight: 80,
              fontFamily: 'Plus Jakarta Sans',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Creating...' : 'Create Capture'}
          </button>
        </div>
      </div>
    </>
  );
};

export default function CaptureManagerPage() {
  const { addToast } = useToast();
  const [captures, setCaptures] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [gateReviewCriteria, setGateReviewCriteria] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [captureRes, oppRes, statsRes] = await Promise.all([
        api.get('/capture'),
        api.get('/opportunities'),
        api.get('/capture/stats'),
      ]);
      setCaptures(captureRes.data?.data || captureRes.data?.captures || []);
      setOpportunities(oppRes.data?.opportunities || []);
    } catch (err) {
      addToast('Failed to load captures', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCapture = async (data) => {
    try {
      const res = await api.post('/capture', {
        ...data,
        opportunity_id: data.opportunity_id ? parseInt(data.opportunity_id) : null,
        phase: data.initial_phase,
      });
      setCaptures([...captures, res.data?.data || res.data]);
      setModalOpen(false);
      addToast('Capture created', 'success');
    } catch (err) {
      addToast('Failed to create capture', 'error');
    }
  };

  const handleAdvancePhase = async (id, currentPhase) => {
    try {
      const currentIdx = PHASES.indexOf(currentPhase);
      const nextPhase = PHASES[currentIdx + 1];
      if (!nextPhase) {
        addToast('Already at final phase', 'warning');
        return;
      }

      const res = await api.put(`/capture/${id}`, {
        phase: nextPhase,
      });
      setCaptures(captures.map(c => c.id === id ? (res.data?.data || res.data) : c));
      addToast(`Advanced to ${nextPhase}`, 'success');
    } catch (err) {
      addToast('Failed to advance phase', 'error');
    }
  };

  const handleGateReview = async (id) => {
    try {
      const res = await api.put(`/capture/${id}/gate-review`, {
        criteria: gateReviewCriteria[id] || {},
      });
      setCaptures(captures.map(c => c.id === id ? (res.data?.data || res.data) : c));
      setReviewingId(null);
      addToast('Gate review completed', 'success');
    } catch (err) {
      addToast('Failed to complete gate review', 'error');
    }
  };

  // Calculate stats
  const stats = {
    totalValue: captures.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0),
    avgPwin: Math.round(captures.reduce((sum, c) => sum + (Number(c.pwin) || 0), 0) / Math.max(captures.length, 1)),
    byPhase: PHASES.map(phase => ({
      phase,
      count: captures.filter(c => (c.phase || '').toLowerCase() === phase.toLowerCase()).length,
    })),
  };

  // Group captures by phase
  const capturesByPhase = PHASES.map(phase => ({
    phase,
    items: captures.filter(c => (c.phase || '').toLowerCase() === phase.toLowerCase()),
  }));

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
              Capture Manager
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
              Shipley-style capture phases and gate reviews
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--accent)',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.target.style.opacity = '0.9')}
            onMouseLeave={e => (e.target.style.opacity = '1')}
          >
            + New Capture
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: '2rem',
          }}
        >
          {[
            { label: 'Total Pipeline', value: formatCurrency(stats.totalValue), color: 'var(--accent2)' },
            { label: 'Average Pwin', value: `${stats.avgPwin}%`, color: 'var(--accent)' },
            { label: 'Total Captures', value: captures.length, color: 'var(--text2)' },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: stat.color, marginBottom: 8 }}>
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 12,
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

        {/* Phase Pipeline */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
            overflowX: 'auto',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 1.5rem 0' }}>
            Phase Pipeline
          </h2>
          <div
            style={{
              display: 'flex',
              gap: 0,
              minWidth: 'min-content',
            }}
          >
            {PHASES.map((phase, idx) => (
              <div
                key={phase}
                style={{
                  flex: 1,
                  minWidth: 120,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--accent2)',
                      marginBottom: 4,
                    }}
                  >
                    {stats.byPhase[idx]?.count || 0}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text2)',
                    }}
                  >
                    {phase}
                  </div>
                </div>
                {idx < PHASES.length - 1 && (
                  <div
                    style={{
                      fontSize: 20,
                      color: 'var(--text3)',
                      marginLeft: 12,
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Captures by Phase */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
            Loading captures...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
            {captures.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '3rem 2rem',
                  background: 'var(--bg2)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 12 }}>
                  No captures yet
                </div>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--accent)',
                    background: 'transparent',
                    color: 'var(--accent2)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Create your first capture
                </button>
              </div>
            ) : (
              captures.map(capture => {
                const opp = opportunities.find(o => o.id === capture.opportunity_id);
                const phaseIdx = PHASES.findIndex(p => p.toLowerCase() === (capture.phase || '').toLowerCase());

                return (
                  <div
                    key={capture.id}
                    style={{
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setExpandedId(expandedId === capture.id ? null : capture.id)}
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
                        {capture.title}
                      </h3>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'var(--accent-bg)',
                          color: 'var(--accent2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {capture.phase}
                      </span>
                    </div>

                    {opp && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                        Linked to: {opp.title}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Days in Phase
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                          {capture.days_in_phase || 0}
                        </div>
                      </div>
                      <PwinGauge pwin={capture.pwin || 0} />
                    </div>

                    {capture.estimated_value > 0 && (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent2)',
                          paddingTop: 12,
                          borderTop: '1px solid var(--border)',
                          marginBottom: 12,
                        }}
                      >
                        {formatCurrency(capture.estimated_value)}
                      </div>
                    )}

                    {expandedId === capture.id && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: '1px solid var(--border)',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8 }}>
                            Gate Criteria
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {['Customer Alignment', 'Technical Fit', 'Win Strategy', 'Resource Plan'].map(criterion => (
                              <label key={criterion} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  defaultChecked={false}
                                  onChange={e => {
                                    const criteria = gateReviewCriteria[capture.id] || {};
                                    setGateReviewCriteria({
                                      ...gateReviewCriteria,
                                      [capture.id]: {
                                        ...criteria,
                                        [criterion]: e.target.checked,
                                      },
                                    });
                                  }}
                                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                                  {criterion}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleGateReview(capture.id)}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--accent)',
                              background: 'transparent',
                              color: 'var(--accent2)',
                              cursor: 'pointer',
                              fontSize: 12,
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
                            Run Gate Review
                          </button>
                          <button
                            onClick={() => handleAdvancePhase(capture.id, capture.phase)}
                            disabled={phaseIdx >= PHASES.length - 1}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: 'var(--radius)',
                              border: 'none',
                              background: phaseIdx >= PHASES.length - 1 ? 'var(--border)' : 'var(--success)',
                              color: '#FFFFFF',
                              cursor: phaseIdx >= PHASES.length - 1 ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                              opacity: phaseIdx >= PHASES.length - 1 ? 0.5 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            Advance Phase
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <NewCaptureModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateCapture}
        opportunities={opportunities}
        loading={false}
      />
    </Layout>
  );
}
