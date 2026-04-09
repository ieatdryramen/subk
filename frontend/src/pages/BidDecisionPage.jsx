import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const CRITERIA = [
  { key: 'strategic_fit', label: 'Strategic Fit', weight: 20 },
  { key: 'technical_capability', label: 'Technical Capability', weight: 20 },
  { key: 'past_performance', label: 'Past Performance Relevance', weight: 15 },
  { key: 'pricing_competitiveness', label: 'Pricing Competitiveness', weight: 15 },
  { key: 'competition_level', label: 'Competition Level', weight: 10 },
  { key: 'timeline_feasibility', label: 'Timeline Feasibility', weight: 10 },
  { key: 'resource_availability', label: 'Resource Availability', weight: 10 },
];

const getRecommendationColor = (score) => {
  if (score > 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
};

const getRecommendationText = (score) => {
  if (score > 70) return 'Bid';
  if (score >= 50) return 'Consider';
  return 'No-Bid';
};

const DecisionCard = ({ decision, onEdit, onDelete }) => {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16, fontWeight: 600 }}>{decision.title}</h3>
          {decision.recommendation && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontSize: 12,
                  padding: '0.25rem 0.75rem',
                  background: getRecommendationColor(decision.total_score),
                  color: '#fff',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                }}
              >
                {getRecommendationText(decision.total_score)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{decision.total_score}%</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onEdit(decision)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(decision.id)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {decision.rationale && (
        <p style={{ margin: '0.75rem 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{decision.rationale}</p>
      )}

      {decision.decision_date && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)' }}>
          Decision: <strong>{decision.decision}</strong> on {new Date(decision.decision_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

const DecisionModal = ({ visible, onClose, onSave, loading, initial = null }) => {
  const [form, setForm] = useState(
    initial || {
      title: '',
      criteria: {
        strategic_fit: 3,
        technical_capability: 3,
        past_performance: 3,
        pricing_competitiveness: 3,
        competition_level: 3,
        timeline_feasibility: 3,
        resource_availability: 3,
      },
      rationale: '',
      decision: '',
    }
  );

  const [score, setScore] = useState(null);

  useEffect(() => {
    if (initial) {
      setForm(initial);
      if (initial.total_score) {
        setScore(initial.total_score);
      }
    }
  }, [initial]);

  const calculateScore = async () => {
    try {
      const res = await api.post('/bid-decision/score', {
        criteria: form.criteria,
      });
      setScore(res.data?.data?.total_score ?? res.data?.total_score);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (form.criteria) {
      calculateScore();
    }
  }, [form.criteria]);

  const handleSave = () => {
    if (!form.title.trim()) {
      alert('Please enter a decision title');
      return;
    }
    onSave({ ...form, total_score: score });
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
          maxWidth: 700,
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 600 }}>
          {initial ? 'Edit' : 'New'} Bid Decision
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Decision Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Army RFQ-2024-123"
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

        <div style={{ marginBottom: '1.5rem', background: 'var(--bg3)', padding: '1rem', borderRadius: 'var(--radius)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: 14, fontWeight: 600 }}>Scoring Criteria (1-5 scale)</h3>

          {CRITERIA.map((criterion) => (
            <div key={criterion.key} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {criterion.label}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Weight: {criterion.weight}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', minWidth: 20, textAlign: 'center' }}>
                    {form.criteria[criterion.key]}
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="5"
                value={form.criteria[criterion.key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    criteria: { ...form.criteria, [criterion.key]: parseInt(e.target.value) },
                  })
                }
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>

        {score !== null && (
          <div
            style={{
              background: getRecommendationColor(score),
              color: '#fff',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: '0.5rem' }}>Recommendation</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: '0.25rem' }}>{score}%</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{getRecommendationText(score)}</div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Rationale
          </label>
          <textarea
            value={form.rationale}
            onChange={(e) => setForm({ ...form, rationale: e.target.value })}
            placeholder="Why are you making this decision?"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
              minHeight: 80,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--bg2)',
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
            {loading ? 'Saving...' : 'Save Decision'}
          </button>
        </div>
      </div>
    </>
  );
};

export default function BidDecisionPage() {
  const { addToast } = useToast();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState(null);

  useEffect(() => {
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bid-decision');
      setDecisions(res.data?.data || res.data || []);
    } catch (err) {
      addToast('Failed to load decisions', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEdit = async (form) => {
    try {
      setLoading(true);
      if (editingDecision) {
        await api.put(`/bid-decision/${editingDecision.id}`, form);
        addToast('Decision updated', 'success');
      } else {
        await api.post('/bid-decision', form);
        addToast('Decision created', 'success');
      }
      setModalOpen(false);
      setEditingDecision(null);
      fetchDecisions();
    } catch (err) {
      addToast('Failed to save decision', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this decision?')) return;
    try {
      await api.delete(`/bid-decision/${id}`);
      addToast('Decision deleted', 'success');
      fetchDecisions();
    } catch (err) {
      addToast('Failed to delete decision', 'error');
      console.error(err);
    }
  };

  // Statistics
  const bidCount = decisions.filter((d) => d.recommendation === 'Bid').length;
  const considerCount = decisions.filter((d) => d.recommendation === 'Consider').length;
  const noBidCount = decisions.filter((d) => d.recommendation === 'No-Bid').length;
  const avgScore = decisions.length > 0 ? Math.round(decisions.reduce((sum, d) => sum + (d.total_score || 0), 0) / decisions.length) : 0;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>Bid/No-Bid Decision Tool</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>Structured framework for bid decisions</p>
        </div>

        {/* Statistics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Total Decisions</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{decisions.length}</div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Bid</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{bidCount}</div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Consider</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{considerCount}</div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>No-Bid</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{noBidCount}</div>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Average Score</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{avgScore}%</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => {
              setEditingDecision(null);
              setModalOpen(true);
            }}
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
            + New Decision
          </button>
        </div>

        <div>
          {decisions.length > 0 ? (
            <>
              {decisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  onEdit={(decision) => {
                    setEditingDecision(decision);
                    setModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </>
          ) : (
            <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '2rem' }}>No decisions yet. Create your first bid decision.</p>
          )}
        </div>

        <DecisionModal
          visible={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingDecision(null);
          }}
          onSave={handleAddEdit}
          loading={loading}
          initial={editingDecision}
        />
      </div>
    </Layout>
  );
}
