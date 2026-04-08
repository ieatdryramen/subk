import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const CompetitiveIntelPage = () => {
  const { addToast } = useToast();
  const [intel, setIntel] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    competitor_name: '',
    opportunity_id: '',
    threat_level: 'medium',
    strengths: '',
    weaknesses: '',
    contract_value: '',
    outcome: 'pending',
    notes: '',
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [intelRes, analysisRes, oppsRes] = await Promise.all([
        api.get('/competitive/intel'),
        api.get('/competitive/analysis'),
        api.get('/opportunities'),
      ]);
      setIntel(intelRes.data || []);
      setAnalysis(analysisRes.data || {});
      setOpportunities(oppsRes.data || []);
    } catch (err) {
      console.error(err);
      addToast('Failed to load competitive intelligence', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      competitor_name: '',
      opportunity_id: '',
      threat_level: 'medium',
      strengths: '',
      weaknesses: '',
      contract_value: '',
      outcome: 'pending',
      notes: '',
    });
    setEditingId(null);
  };

  // Open modal for edit
  const openEdit = (entry) => {
    setFormData({
      competitor_name: entry.competitor_name,
      opportunity_id: entry.opportunity_id || '',
      threat_level: entry.threat_level,
      strengths: entry.strengths || '',
      weaknesses: entry.weaknesses || '',
      contract_value: entry.contract_value || '',
      outcome: entry.outcome || 'pending',
      notes: entry.notes || '',
    });
    setEditingId(entry.id);
    setShowModal(true);
  };

  // Save entry
  const handleSave = async () => {
    if (!formData.competitor_name.trim()) {
      addToast('Competitor name is required', 'error');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/competitive/intel/${editingId}`, formData);
        addToast('Entry updated', 'success');
      } else {
        await api.post('/competitive/intel', formData);
        addToast('Entry created', 'success');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Failed to save entry', 'error');
    }
  };

  // Delete entry
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.delete(`/competitive/intel/${id}`);
      addToast('Entry deleted', 'success');
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Failed to delete entry', 'error');
    }
  };

  const getThreatColor = (level) => {
    return level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)';
  };

  const getOutcomeColor = (outcome) => {
    return outcome === 'won' ? 'var(--success)' : outcome === 'lost' ? 'var(--danger)' : 'var(--text3)';
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '2rem', borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
          }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
              🏢 Competitive Intelligence
            </h1>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              style={{
                padding: '10px 18px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              + Add Intel
            </button>
          </div>

          {/* Analysis Dashboard */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem',
            padding: '2rem', background: 'var(--bg)',
          }}>
            {/* Total Competitors */}
            <div style={{
              background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Total Competitors
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent2)' }}>
                {analysis?.total_competitors || 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Unique competitors tracked
              </div>
            </div>

            {/* High Threat Count */}
            <div style={{
              background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                High Threat
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)' }}>
                {analysis?.high_threat_count || 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Encounters marked high-threat
              </div>
            </div>

            {/* Win Rate */}
            <div style={{
              background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Win Rate
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>
                {analysis?.win_rate || 0}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Against competitors with outcomes
              </div>
            </div>

            {/* Most Common Competitor */}
            <div style={{
              background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Top Competitor
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: 'var(--accent)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {analysis?.top_competitor?.competitor_name || '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                {analysis?.top_competitor?.count || 0} encounter(s)
              </div>
            </div>
          </div>

          {/* Intel List */}
          <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {intel.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    background: 'var(--bg2)', padding: '1.5rem', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                        {entry.competitor_name}
                      </h3>
                      {entry.opportunity_title && (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          📋 {entry.opportunity_title}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openEdit(entry)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text3)', fontSize: 18, padding: 0,
                      }}
                    >
                      ✏
                    </button>
                  </div>

                  {/* Threat Level Badge */}
                  <div style={{
                    display: 'inline-block', padding: '4px 10px',
                    background: getThreatColor(entry.threat_level) + '15',
                    color: getThreatColor(entry.threat_level),
                    borderRadius: '12px', fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', marginBottom: 12,
                    border: `1px solid ${getThreatColor(entry.threat_level)}30`,
                  }}>
                    {entry.threat_level.toUpperCase()} THREAT
                  </div>

                  {/* Strengths */}
                  {entry.strengths && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>
                        Strengths
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>
                        {entry.strengths.split('\n').filter(s => s.trim()).map((s, i) => (
                          <li key={i}>{s.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Weaknesses */}
                  {entry.weaknesses && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>
                        Weaknesses
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>
                        {entry.weaknesses.split('\n').filter(w => w.trim()).map((w, i) => (
                          <li key={i}>{w.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Outcome Badge */}
                  {entry.outcome !== 'pending' && (
                    <div style={{
                      display: 'inline-block', padding: '4px 10px',
                      background: getOutcomeColor(entry.outcome) + '15',
                      color: getOutcomeColor(entry.outcome),
                      borderRadius: '12px', fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', marginBottom: 12,
                      border: `1px solid ${getOutcomeColor(entry.outcome)}30`,
                    }}>
                      {entry.outcome === 'won' ? '✓' : '✗'} {entry.outcome.toUpperCase()}
                    </div>
                  )}

                  {/* Contract Value */}
                  {entry.contract_value > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                      💰 ${Number(entry.contract_value).toLocaleString()}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <div style={{
                      fontSize: 12, color: 'var(--text2)', padding: '10px',
                      background: 'var(--bg)', borderRadius: '6px', marginBottom: 12,
                      lineHeight: 1.4,
                    }}>
                      {entry.notes}
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{
                      width: '100%', padding: '8px', background: 'var(--danger)',
                      color: 'white', border: 'none', borderRadius: 'var(--radius)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}

              {intel.length === 0 && (
                <div style={{
                  gridColumn: '1/-1', textAlign: 'center', padding: '3rem',
                  color: 'var(--text3)',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>No competitive intel yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Add your first competitor encounter to get started</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        <div style={{
          width: 250, borderLeft: '1px solid var(--border)',
          background: 'var(--bg2)', padding: '2rem 1.5rem', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: 14, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' }}>
            🏆 Top Competitors
          </h3>

          {analysis?.competitor_list && analysis.competitor_list.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {analysis.competitor_list.map((comp, idx) => {
                const totalEncounters = comp.encounter_count;
                const maxCount = Math.max(...analysis.competitor_list.map(c => c.encounter_count)) || 1;
                const barWidth = (totalEncounters / maxCount) * 100;

                return (
                  <div key={idx}>
                    {/* Company Name & Count */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 6, fontSize: 12, fontWeight: 600,
                    }}>
                      <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {idx + 1}. {comp.competitor_name}
                      </span>
                      <span style={{ color: 'var(--accent2)', marginLeft: 8 }}>{comp.encounter_count}</span>
                    </div>

                    {/* Bar Chart */}
                    <svg width="100%" height="20" style={{ marginBottom: 6 }}>
                      {/* Background bar */}
                      <rect x="0" y="6" width="100%" height="8" fill="var(--border)" rx="4" />
                      {/* Progress bar */}
                      <rect x="0" y="6" width={`${barWidth}%`} height="8" fill="var(--accent)" rx="4" />
                    </svg>

                    {/* Win/Loss Indicators */}
                    <div style={{
                      display: 'flex', gap: 4, fontSize: 11, fontWeight: 500,
                    }}>
                      {comp.wins > 0 && (
                        <span style={{ color: 'var(--success)' }}>
                          ✓ {comp.wins} W
                        </span>
                      )}
                      {comp.losses > 0 && (
                        <span style={{ color: 'var(--danger)' }}>
                          ✗ {comp.losses} L
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '1rem 0' }}>
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 999,
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--bg)', padding: '2rem', borderRadius: 'var(--radius)',
            width: 'min(90%, 600px)', maxHeight: '90vh', overflowY: 'auto',
            zIndex: 1000, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              {editingId ? 'Edit' : 'Add'} Competitive Intel
            </h2>

            {/* Competitor Name */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Competitor Name
              </div>
              <input
                type="text"
                value={formData.competitor_name}
                onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </label>

            {/* Link to Opportunity */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Link to Opportunity
              </div>
              <select
                value={formData.opportunity_id}
                onChange={(e) => setFormData({ ...formData, opportunity_id: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              >
                <option value="">None</option>
                {opportunities.map(opp => (
                  <option key={opp.id} value={opp.id}>{opp.title}</option>
                ))}
              </select>
            </label>

            {/* Threat Level */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Threat Level
              </div>
              <select
                value={formData.threat_level}
                onChange={(e) => setFormData({ ...formData, threat_level: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            {/* Outcome */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Outcome
              </div>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              >
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </label>

            {/* Strengths */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Strengths (one per line)
              </div>
              <textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box', minHeight: '80px', resize: 'vertical',
                }}
              />
            </label>

            {/* Weaknesses */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Weaknesses (one per line)
              </div>
              <textarea
                value={formData.weaknesses}
                onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box', minHeight: '80px', resize: 'vertical',
                }}
              />
            </label>

            {/* Contract Value */}
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Contract Value
              </div>
              <input
                type="number"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </label>

            {/* Notes */}
            <label style={{ display: 'block', marginBottom: '2rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
                Notes
              </div>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{
                  width: '100%', padding: '10px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box', minHeight: '100px', resize: 'vertical',
                }}
              />
            </label>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: '12px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: '12px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text2)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default CompetitiveIntelPage;
