import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const REQUIREMENT_TEMPLATES = {
  FAR_DFARS: [
    { key: 'far-clauses', category: 'FAR/DFARS', name: 'FAR Flow-Down Clauses', description: 'Implementation of required FAR clauses in subcontracts' },
    { key: 'dfars-cyber', category: 'FAR/DFARS', name: 'DFARS Cybersecurity Requirements (7012)', description: 'DFARS 252.204-7012 cybersecurity controls' },
    { key: 'eicpac', category: 'FAR/DFARS', name: 'eICPAC Registration', description: 'Electronic Interchange of Cost and Price Analysis' },
  ],
  CMMC: [
    { key: 'cmmc-level1', category: 'CMMC', name: 'CMMC Level 1', description: 'Basic maturity in 14 security practices' },
    { key: 'cmmc-level2', category: 'CMMC', name: 'CMMC Level 2', description: 'Intermediate maturity in 23 security practices' },
    { key: 'cmmc-level3', category: 'CMMC', name: 'CMMC Level 3', description: 'Advanced maturity in 110+ security practices' },
  ],
  CUI: [
    { key: 'cui-controls', category: 'CUI', name: 'CUI Controls (NIST SP 800-171)', description: 'Protection of Controlled Unclassified Information' },
    { key: 'cui-flow-down', category: 'CUI', name: 'CUI Flow-Down Requirements', description: 'Cascade CUI requirements to subcontractors' },
  ],
  Section508: [
    { key: 'section-508', category: 'Section 508', name: 'Section 508 Compliance', description: 'Accessibility requirements for information technology' },
  ],
  ITAR: [
    { key: 'itar-registration', category: 'ITAR', name: 'ITAR Registration', description: 'Directorate of Defense Trade Controls (DDTC) registration' },
    { key: 'itar-controls', category: 'ITAR', name: 'ITAR Controls Implementation', description: 'Technical data and defense article controls' },
  ],
  Registrations: [
    { key: 'sam-registration', category: 'Registrations', name: 'SAM.gov Registration', description: 'System for Award Management (SAM.gov) registration' },
    { key: 'cage-code', category: 'Registrations', name: 'CAGE Code Assignment', description: 'Commercial and Government Entity code' },
    { key: 'duns-number', category: 'Registrations', name: 'DUNS Number', description: 'Dun and Bradstreet DUNS number' },
    { key: 'uei', category: 'Registrations', name: 'UEI', description: 'Unique Entity Identifier' },
  ],
};

export default function ComplianceCenterPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ pending: 0, in_progress: 0, pass: 0, fail: 0, na: 0, total: 0, complete_percentage: 0 });
  const [selectedCategory, setSelectedCategory] = useState('FAR_DFARS');
  const [showForm, setShowForm] = useState(false);

  const categories = Object.keys(REQUIREMENT_TEMPLATES);
  const categoryLabels = {
    FAR_DFARS: 'FAR/DFARS',
    CMMC: 'CMMC',
    CUI: 'CUI',
    Section508: 'Section 508',
    ITAR: 'ITAR',
    Registrations: 'Registrations',
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/compliance');
      setItems(res.data?.items || res.data?.data || []);
      setStats(res.data?.stats || {});
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemOrKey, newStatus, template) => {
    try {
      if (typeof itemOrKey === 'number' || (typeof itemOrKey === 'string' && /^\d+$/.test(itemOrKey))) {
        // Existing item — update by ID
        await api.put(`/compliance/${itemOrKey}`, { status: newStatus });
      } else {
        // New item — create it first with the template data
        await api.post('/compliance', {
          items: [{
            key: template.key,
            category: template.category,
            name: template.name,
            description: template.description,
            status: newStatus,
            expiration_date: null,
            notes: '',
          }],
        });
      }
      addToast('Status updated', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleInitialize = async () => {
    try {
      const templates = Object.values(REQUIREMENT_TEMPLATES).flat();
      const newItems = templates.map(t => ({
        ...t,
        status: 'pending',
        expiration_date: null,
        notes: '',
      }));

      await api.post('/compliance', { items: newItems });
      addToast('Compliance checklist initialized', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></Layout>;

  const categoryItems = REQUIREMENT_TEMPLATES[selectedCategory] || [];
  const categoryStatus = items.filter(i => i.category === categoryLabels[selectedCategory]);

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Compliance Center</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Track readiness against federal requirements</p>
        </div>

        {/* Scorecard */}
        {stats.total > 0 ? (
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                  {stats.complete_percentage}%
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Complete</div>
                <div style={{
                  height: 4,
                  background: 'var(--border)',
                  borderRadius: 2,
                  marginTop: 8,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${stats.complete_percentage}%`,
                    background: 'var(--success)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{stats.pass}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Passed</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{stats.in_progress}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>In Progress</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{stats.pending}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Pending</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>{stats.fail}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Failed</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--accent-bg)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center',
            border: `1px solid var(--border)`,
          }}>
            <p style={{ margin: 0, fontSize: 14, marginBottom: '1rem' }}>Initialize with standard federal compliance requirements</p>
            <button
              onClick={handleInitialize}
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
              Initialize Checklist
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid var(--border)`,
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '1rem 1.5rem',
                background: 'transparent',
                border: 'none',
                borderBottom: selectedCategory === cat ? `2px solid var(--accent)` : 'none',
                cursor: 'pointer',
                fontWeight: selectedCategory === cat ? 700 : 600,
                color: selectedCategory === cat ? 'var(--accent)' : 'var(--text2)',
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Items in Category */}
        <div style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          border: `1px solid var(--border)`,
        }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {categoryItems.map(template => {
              const item = items.find(i => i.requirement_key === template.key);
              const status = item?.status || 'pending';

              const isExpiring = item?.expiration_date && new Date(item.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

              return (
                <div
                  key={template.key}
                  style={{
                    background: 'var(--bg)',
                    border: `1px solid ${isExpiring ? 'var(--warning)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{template.name}</div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>{template.description}</p>
                    </div>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(item?.id || template.key, e.target.value, template)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        border: `1px solid var(--border)`,
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                        background: 'var(--bg2)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>

                  {item?.expiration_date && (
                    <div style={{
                      fontSize: 12,
                      color: isExpiring ? 'var(--warning)' : 'var(--text2)',
                      marginBottom: '0.5rem',
                      fontWeight: isExpiring ? 600 : 400,
                    }}>
                      Expires: {new Date(item.expiration_date).toLocaleDateString()}
                    </div>
                  )}

                  {item?.notes && (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text2)',
                      padding: '0.5rem',
                      background: 'var(--bg2)',
                      borderRadius: 'var(--radius)',
                      marginTop: '0.5rem',
                      fontStyle: 'italic',
                    }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
