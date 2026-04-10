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

export default function SubConPlanPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    contract_value: '',
  });
  const [goals, setGoals] = useState(null);
  const [editingGoals, setEditingGoals] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subcon-plan');
      const planData = res.data?.plans || res.data?.data || [];
      setPlans(planData);
      if (planData.length > 0) {
        setSelectedPlan(planData[0]);
        loadGoals(planData[0].id);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGoals = async (planId) => {
    try {
      const res = await api.get(`/subcon-plan/${planId}/goals`);
      setGoals(res.data?.goals || {});
    } catch (err) {
      console.error('Load goals error:', err);
    }
  };

  const handleCreatePlan = async () => {
    if (!formData.title || !formData.contract_value) {
      addToast('Please fill in all fields', 'warning');
      return;
    }
    const val = parseFloat(formData.contract_value);
    if (isNaN(val) || val <= 0) {
      addToast('Contract value must be a positive number', 'warning');
      return;
    }

    try {
      const res = await api.post('/subcon-plan', {
        title: formData.title,
        contract_value: val,
      });
      addToast('Plan created', 'success');
      setFormData({ title: '', contract_value: '' });
      setShowNewForm(false);
      loadData();
    } catch (err) {
      addToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const handleUpdateGoals = async () => {
    if (!selectedPlan || !editingGoals) return;

    // Validate percentages
    const pctFields = ['sb_goal_pct', 'sdb_goal_pct', 'wosb_goal_pct', 'hubzone_goal_pct', 'sdvosb_goal_pct'];
    for (const field of pctFields) {
      const val = parseFloat(editingGoals[field]) || 0;
      if (val < 0 || val > 100) {
        addToast('Goal percentages must be between 0 and 100', 'warning');
        return;
      }
    }

    try {
      await api.put(`/subcon-plan/${selectedPlan.id}`, editingGoals);
      addToast('Goals updated', 'success');
      setEditingGoals(null);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedPlan) return;

    try {
      setGenerating(true);
      const res = await api.post(`/subcon-plan/${selectedPlan.id}/generate`);
      addToast('Plan generated', 'success');
      setSelectedPlan(res.plan);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectPlan = async (plan) => {
    setSelectedPlan(plan);
    loadGoals(plan.id);
  };

  if (loading) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></Layout>;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Subcontracting Plan Builder</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Generate FAR 19.704 compliant plans</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
          {/* Sidebar: Plans List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Plans</h3>
              <button
                onClick={() => setShowNewForm(true)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + New
              </button>
            </div>

            {showNewForm && (
              <div style={{
                background: 'var(--bg2)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                marginBottom: '1rem',
                border: `1px solid var(--border)`,
              }}>
                <input
                  type="text"
                  placeholder="Plan Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    marginBottom: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Contract Value"
                  value={formData.contract_value}
                  onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    marginBottom: '0.75rem',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleCreatePlan}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewForm(false)}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      background: 'var(--bg)',
                      border: `1px solid var(--border)`,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  style={{
                    padding: '0.75rem',
                    background: selectedPlan?.id === plan.id ? 'var(--accent)' : 'var(--bg2)',
                    color: selectedPlan?.id === plan.id ? 'white' : 'var(--text)',
                    border: `1px solid ${selectedPlan?.id === plan.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <div>{plan.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                    {formatCurrency(plan.contract_value)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          {selectedPlan && (
            <div>
              {/* Goals Section */}
              <div style={{
                background: 'var(--bg2)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                marginBottom: '2rem',
                border: `1px solid var(--border)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Small Business Goals</h2>
                  {!editingGoals && (
                    <button
                      onClick={() => setEditingGoals({ ...selectedPlan })}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: 'var(--accent2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Edit Goals
                    </button>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem',
                }}>
                  {goals && Object.entries(goals).map(([key, goal]) => (
                    <div key={key} style={{
                      background: 'var(--bg)',
                      padding: '1rem',
                      borderRadius: 'var(--radius)',
                      border: `1px solid var(--border)`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                        {key}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>
                        {goal.description}
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{goal.percentage}%</div>
                      </div>
                      <div style={{
                        height: 4,
                        background: 'var(--border)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, goal.percentage)}%`,
                          background: 'var(--success)',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
                        Target: {formatCurrency(goal.dollar_amount)}
                      </div>
                    </div>
                  ))}
                </div>

                {editingGoals && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid var(--border)` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      {[
                        { key: 'sb_goal_pct', label: 'SB %' },
                        { key: 'sdb_goal_pct', label: 'SDB %' },
                        { key: 'wosb_goal_pct', label: 'WOSB %' },
                        { key: 'hubzone_goal_pct', label: 'HUBZone %' },
                        { key: 'sdvosb_goal_pct', label: 'SDVOSB %' },
                      ].map(field => (
                        <div key={field.key}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {field.label}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editingGoals[field.key] || 0}
                            onChange={(e) => setEditingGoals({
                              ...editingGoals,
                              [field.key]: parseFloat(e.target.value),
                            })}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              border: `1px solid var(--border)`,
                              borderRadius: 'var(--radius)',
                              fontSize: 12,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleUpdateGoals}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'var(--success)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoals(null)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'var(--bg)',
                          border: `1px solid var(--border)`,
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Plan Text Section */}
              <div style={{
                background: 'var(--bg2)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                border: `1px solid var(--border)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Plan Document</h2>
                  <button
                    onClick={handleGeneratePlan}
                    disabled={generating}
                    style={{
                      padding: '0.5rem 1rem',
                      background: generating ? 'var(--text2)' : 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: generating ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {generating ? 'Generating...' : 'Generate Plan'}
                  </button>
                </div>

                {selectedPlan.plan_text ? (
                  <div style={{
                    background: 'var(--bg)',
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    border: `1px solid var(--border)`,
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 400,
                    overflowY: 'auto',
                  }}>
                    {selectedPlan.plan_text}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--accent-bg)',
                    padding: '2rem',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                    border: `1px solid var(--border)`,
                  }}>
                    <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13 }}>
                      Click "Generate Plan" to create your FAR 19.704 compliant subcontracting plan
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
