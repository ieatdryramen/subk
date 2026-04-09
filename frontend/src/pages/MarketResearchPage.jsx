import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ReportCard = ({ report, onView, onDelete }) => {
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
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16, fontWeight: 600 }}>{report.title}</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {report.naics && (
              <span
                style={{
                  fontSize: 12,
                  padding: '0.25rem 0.75rem',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  borderRadius: 'var(--radius)',
                  fontWeight: 500,
                }}
              >
                NAICS: {report.naics}
              </span>
            )}
            {report.agency && (
              <span
                style={{
                  fontSize: 12,
                  padding: '0.25rem 0.75rem',
                  background: 'var(--bg3)',
                  color: 'var(--text2)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {report.agency}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onView(report.id)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            View
          </button>
          <button
            onClick={() => onDelete(report.id)}
            style={{
              padding: '0.5rem 1rem',
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

      <p style={{ margin: '0.5rem 0 0 0', fontSize: 12, color: 'var(--text3)' }}>Generated: {formatDate(report.created_at)}</p>
    </div>
  );
};

const GenerateModal = ({ visible, onClose, onGenerate, loading }) => {
  const [form, setForm] = useState({
    naics: '',
    agency: '',
    keywords: '',
  });

  const handleGenerate = () => {
    if (!form.naics.trim()) {
      alert('Please enter a NAICS code');
      return;
    }
    onGenerate(form);
    setForm({ naics: '', agency: '', keywords: '' });
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
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 600 }}>Generate Market Research Report</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            NAICS Code *
          </label>
          <input
            type="text"
            value={form.naics}
            onChange={(e) => setForm({ ...form, naics: e.target.value })}
            placeholder="e.g., 541512 (Computer Systems Design)"
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

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Agency (Optional)
          </label>
          <input
            type="text"
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value })}
            placeholder="e.g., DoD, DHS"
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

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Keywords (Optional)
          </label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            placeholder="e.g., cloud, AI, cybersecurity"
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

        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.5rem' }}>Report generation typically takes 30-60 seconds...</p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
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
            onClick={handleGenerate}
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
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>
    </>
  );
};

// Simple markdown renderer: handles ## headings, **bold**, \n\n paragraphs, bullet lists
const renderMarkdown = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Heading
    if (line.startsWith('## ')) {
      return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, margin: '1.25rem 0 0.5rem', color: 'var(--text)' }}>{line.replace('## ', '')}</h3>;
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} style={{ fontSize: 14, fontWeight: 600, margin: '1rem 0 0.25rem', color: 'var(--text)' }}>{line.replace('### ', '')}</h4>;
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      return <li key={i} style={{ marginLeft: '1rem', fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>{content}</li>;
    }
    // Empty line
    if (line.trim() === '') return <br key={i} />;
    // Bold inline
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} style={{ margin: '0.25rem 0', fontSize: 13, lineHeight: 1.7, color: 'var(--text2)' }}>
        {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
      </p>
    );
  });
};

const ReportViewer = ({ report, visible, onClose }) => {
  if (!visible || !report) return null;

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
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: 20, fontWeight: 600 }}>{report.title}</h2>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {report.naics && (
            <span
              style={{
                fontSize: 12,
                padding: '0.25rem 0.75rem',
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                borderRadius: 'var(--radius)',
                fontWeight: 500,
              }}
            >
              NAICS: {report.naics}
            </span>
          )}
          {report.agency && (
            <span
              style={{
                fontSize: 12,
                padding: '0.25rem 0.75rem',
                background: 'var(--bg3)',
                color: 'var(--text2)',
                borderRadius: 'var(--radius)',
              }}
            >
              {report.agency}
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text2)', marginBottom: '1.5rem' }}>
          {renderMarkdown(report.content)}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </>
  );
};

export default function MarketResearchPage() {
  const { addToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/market-research');
      setReports(res.data?.data || res.data?.reports || []);
    } catch (err) {
      addToast('Failed to load reports', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (form) => {
    try {
      setGenerating(true);
      setModalOpen(false);
      addToast('Generating report... this may take a minute', 'info');

      const res = await api.post('/market-research/generate', form);
      const newReport = res.data?.data || res.data;
      setReports([newReport, ...reports]);
      addToast('Report generated successfully', 'success');
    } catch (err) {
      addToast('Failed to generate report', 'error');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await api.delete(`/market-research/${reportId}`);
      setReports(reports.filter((r) => r.id !== reportId));
      addToast('Report deleted', 'success');
    } catch (err) {
      addToast('Failed to delete report', 'error');
      console.error(err);
    }
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>Market Research</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>AI-generated market research reports for your target markets</p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setModalOpen(true)}
            disabled={generating}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              opacity: generating ? 0.6 : 1,
            }}
          >
            + Generate Report
          </button>
        </div>

        {generating && (
          <div
            style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              marginBottom: '2rem',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Generating report... This may take a minute or two. Please don't close this page.
          </div>
        )}

        <div>
          {reports.length > 0 ? (
            <>
              {reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onView={(id) => {
                    setSelectedReport(r);
                    setViewerOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </>
          ) : (
            <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '2rem' }}>No reports yet. Generate your first market research report.</p>
          )}
        </div>

        <GenerateModal visible={modalOpen} onClose={() => setModalOpen(false)} onGenerate={handleGenerate} loading={generating} />
        <ReportViewer report={selectedReport} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
      </div>
    </Layout>
  );
}
