import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

export default function FOIACenterPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ draft: 0, submitted: 0, processing: 0, completed: 0, total: 0 });
  const [templates, setTemplates] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    agency: '',
    template_type: '',
    request_text: '',
    notes: '',
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.get('/foia'),
        api.get('/foia/templates'),
      ]);
      const reqRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const templateRes = results[1].status === 'fulfilled' ? results[1].value : null;
      if (reqRes) {
        setRequests(reqRes.data?.requests || []);
        setStats({ ...(reqRes.data?.stats || {}), total: reqRes.data?.total || reqRes.data?.requests?.length || 0 });
      }
      if (templateRes) {
        setTemplates(templateRes.data?.templates || []);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!formData.title || !formData.agency) {
      addToast('Please fill in title and agency', 'warning');
      return;
    }

    try {
      await api.post('/foia', formData);
      addToast('FOIA request created', 'success');
      setFormData({
        title: '',
        agency: '',
        template_type: '',
        request_text: '',
        notes: '',
      });
      setSelectedTemplate('');
      setShowNewModal(false);
      await loadData();
    } catch (err) {
      addToast(err.message || 'Failed to create request', 'error');
      setLoading(false);
    }
  };

  const handleApplyTemplate = (template) => {
    setSelectedTemplate(template.id);
    setFormData(prev => ({
      ...prev,
      template_type: template.id,
      request_text: template.template,
    }));
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/foia/${id}`, { status });
      addToast('Status updated', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!confirm('Delete this FOIA request?')) return;
    try {
      await api.delete(`/foia/${id}`);
      addToast('Request deleted', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div></Layout>;

  const statusColors = {
    draft: 'var(--text2)',
    submitted: 'var(--warning)',
    processing: 'var(--accent)',
    completed: 'var(--success)',
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>FOIA Center</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Track Freedom of Information Act requests</p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            background: 'var(--bg2)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Total Requests</div>
          </div>
          <div style={{
            background: 'var(--bg2)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text2)' }}>{stats.draft}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Draft</div>
          </div>
          <div style={{
            background: 'var(--bg2)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--warning)' }}>{stats.submitted}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Submitted</div>
          </div>
          <div style={{
            background: 'var(--bg2)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>{stats.processing}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Processing</div>
          </div>
          <div style={{
            background: 'var(--bg2)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: `1px solid var(--border)`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--success)' }}>{stats.completed}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Completed</div>
          </div>
        </div>

        {/* New Request Button */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            New FOIA Request
          </button>
        </div>

        {/* New Request Modal */}
        {showNewModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}>
            <div style={{
              background: 'var(--bg)',
              borderRadius: 'var(--radius)',
              padding: '2rem',
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: 20, fontWeight: 700 }}>Create FOIA Request</h2>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Title *</label>
                <input
                  type="text"
                  placeholder="FOIA Request Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Agency *</label>
                <input
                  type="text"
                  placeholder="e.g., Department of Defense"
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
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

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Use Template</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleApplyTemplate(t)}
                      style={{
                        padding: '0.5rem',
                        background: selectedTemplate === t.id ? 'var(--accent)' : 'var(--bg2)',
                        color: selectedTemplate === t.id ? 'white' : 'var(--text)',
                        border: `1px solid ${selectedTemplate === t.id ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Request Text *</label>
                <textarea
                  placeholder="Detailed FOIA request"
                  value={formData.request_text}
                  onChange={(e) => setFormData({ ...formData, request_text: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    minHeight: 150,
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes</label>
                <input
                  type="text"
                  placeholder="Internal notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleCreateRequest}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Create Request
                </button>
                <button
                  onClick={() => setShowNewModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--bg2)',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div style={{
          display: 'grid',
          gap: '1rem',
        }}>
          {requests.length > 0 ? (
            requests.map(req => (
              <div
                key={req.id}
                style={{
                  background: 'var(--bg2)',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  border: `1px solid var(--border)`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{req.title}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>Agency: {req.agency}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={req.status}
                      onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        background: 'var(--bg)',
                        border: `1px solid var(--border)`,
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                        color: statusColors[req.status] || 'var(--text)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: 'transparent',
                        border: `1px solid var(--danger)`,
                        color: 'var(--danger)',
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

                {req.tracking_number && (
                  <p style={{ margin: '0.5rem 0', fontSize: 12, color: 'var(--text2)' }}>
                    Tracking #: {req.tracking_number}
                  </p>
                )}

                <div style={{
                  background: 'var(--bg)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  marginTop: '0.75rem',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: 'var(--text2)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 150,
                  overflowY: 'auto',
                }}>
                  {req.request_text}
                </div>

                {req.notes && (
                  <p style={{ margin: '0.75rem 0 0 0', fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
                    Notes: {req.notes}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'var(--bg2)',
              borderRadius: 'var(--radius)',
              border: `1px solid var(--border)`,
            }}>
              <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>No FOIA requests yet</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
