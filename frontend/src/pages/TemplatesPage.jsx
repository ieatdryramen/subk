import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const TOUCHPOINT_LABELS = {
  email1: 'Day 1', email2: 'Day 3', email3: 'Day 7', email4: 'Day 14',
  linkedin_connect: 'LinkedIn Connect', linkedin_dm: 'LinkedIn DM', call: 'Call'
};

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: 12 },
  searchBar: { flex: 1, maxWidth: 400, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' },
  newBtn: { padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' },
  grid: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardName: { fontSize: 15, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  badge: { padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: 'var(--accent-bg)', color: 'var(--accent2)', border: '1px solid var(--accent)' },
  subject: { fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 },
  body: { fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', background: 'var(--bg3)', padding: '10px 12px', borderRadius: 'var(--radius)', maxHeight: 200, overflow: 'hidden', position: 'relative' },
  bodyFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, var(--bg3))' },
  actions: { display: 'flex', gap: 8, marginTop: 10 },
  copyBtn: { padding: '6px 14px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer' },
  editBtn: { padding: '6px 14px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--accent2)', cursor: 'pointer' },
  deleteBtn: { padding: '6px 14px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 14 },
  filters: { display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterBtn: (active) => ({ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'var(--bg2)', color: active ? 'var(--accent2)' : 'var(--text2)', cursor: 'pointer', fontWeight: active ? 600 : 400 }),
  modalForm: { display: 'flex', flexDirection: 'column', gap: 16 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  input: { padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' },
  textarea: { padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'monospace', minHeight: 200, resize: 'vertical' },
  select: { padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: (isPrimary) => ({ padding: '10px 16px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: isPrimary ? 'none' : '1px solid var(--border)', background: isPrimary ? 'var(--accent)' : 'var(--bg3)', color: isPrimary ? '#fff' : 'var(--text2)', cursor: 'pointer' }),
};

export default function TemplatesPage() {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalData, setModalData] = useState({ name: '', subject: '', body: '', touchpoint: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api.get('/templates').then(r => { setTemplates(r.data); setLoading(false); }).catch(err => { console.error(err); setLoadError('Failed to load templates'); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(t => t.filter(x => x.id !== id));
    } catch (err) {
      console.error(err);
      addToast('Failed to delete template — try again', 'error');
    }
  };

  const copy = (template) => {
    const text = template.subject ? `SUBJECT: ${template.subject}\n\n${template.body}` : template.body;
    navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [template.id]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [template.id]: false })), 2000);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setModalData({ name: '', subject: '', body: '', touchpoint: '' });
    setModalOpen(true);
  };

  const openEditModal = (template) => {
    setEditingId(template.id);
    setModalData({ name: template.name, subject: template.subject || '', body: template.body, touchpoint: template.touchpoint || '' });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setModalData({ name: '', subject: '', body: '', touchpoint: '' });
  };

  const saveTemplate = async () => {
    if (!modalData.name.trim() || !modalData.body.trim()) {
      addToast('Name and body are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await api.put(`/templates/${editingId}`, modalData);
        setTemplates(t => t.map(x => x.id === editingId ? res.data : x));
        addToast('Template updated', 'success');
      } else {
        const res = await api.post('/templates', modalData);
        setTemplates(t => [res.data, ...t]);
        addToast('Template created', 'success');
      }
      closeModal();
    } catch (err) {
      console.error(err);
      addToast('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  let filtered = filter === 'all' ? templates : templates.filter(t => t.touchpoint === filter);
  if (search) {
    filtered = filtered.filter(t =>
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.body?.toLowerCase().includes(search.toLowerCase())
    );
  }
  const touchpoints = [...new Set(templates.map(t => t.touchpoint).filter(Boolean))];

  const renderSkeletons = () => (
    <div style={s.grid}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={s.card}>
          <div style={s.cardHead}>
            <div style={{ flex: 1 }}>
              <div className="pf-skeleton" style={{ height: 18, width: '60%', marginBottom: 6 }} />
              <div className="pf-skeleton" style={{ height: 12, width: '40%' }} />
            </div>
            <div className="pf-skeleton" style={{ height: 20, width: 80, borderRadius: 10 }} />
          </div>
          <div className="pf-skeleton" style={{ height: 14, width: '50%', marginBottom: 8 }} />
          <div className="pf-skeleton" style={{ height: 120 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div className="pf-skeleton" style={{ height: 32, width: 60 }} />
            <div className="pf-skeleton" style={{ height: 32, width: 60 }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Email Templates</div>
        <div style={s.sub}>Saved emails from your playbooks. Save any email as a template from the playbook viewer.</div>

        <div style={s.topBar}>
          <input
            type="text"
            placeholder="Search by subject or body..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchBar}
          />
          <button style={s.newBtn} onClick={openCreateModal}>+ New Template</button>
        </div>

        <div style={s.filters}>
          <button style={s.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>All ({templates.length})</button>
          {touchpoints.map(tp => (
            <button key={tp} style={s.filterBtn(filter === tp)} onClick={() => setFilter(tp)}>
              {TOUCHPOINT_LABELS[tp] || tp} ({templates.filter(t => t.touchpoint === tp).length})
            </button>
          ))}
        </div>

        {loading ? (
          renderSkeletons()
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{loadError}</div>
            <button onClick={load} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>No templates yet</div>
            <div style={{ fontSize: 14, maxWidth: 450, margin: '0 auto 20px' }}>
              Build a reusable library of emails. Save templates from playbooks or create new ones to use across your campaigns.
            </div>
            <button
              onClick={openCreateModal}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', marginRight: 12 }}>
              Create Template
            </button>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>or save from a playbook</span>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map(t => (
              <div key={t.id} style={s.card}>
                <div style={s.cardHead}>
                  <div>
                    <div style={s.cardName}>{t.name}</div>
                    <div style={s.cardMeta}>
                      By {t.creator || 'You'} · {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {t.touchpoint && <span style={s.badge}>{TOUCHPOINT_LABELS[t.touchpoint] || t.touchpoint}</span>}
                </div>
                {t.subject && <div style={s.subject}>Subject: {t.subject}</div>}
                <div style={{ position: 'relative' }}>
                  <div style={{ ...s.body, maxHeight: expanded[t.id] ? 'none' : 200 }}>{t.body}</div>
                  {!expanded[t.id] && t.body.length > 400 && <div style={s.bodyFade} />}
                </div>
                {t.body.length > 400 && (
                  <div style={{ fontSize: 12, color: 'var(--accent2)', cursor: 'pointer', marginTop: 4 }}
                    onClick={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}>
                    {expanded[t.id] ? 'Show less' : 'Show more'}
                  </div>
                )}
                <div style={s.actions}>
                  <button style={s.copyBtn} onClick={() => copy(t)}>{copied[t.id] ? '✓ Copied' : 'Copy'}</button>
                  <button style={s.editBtn} onClick={() => openEditModal(t)}>Edit</button>
                  <button style={s.deleteBtn} onClick={() => del(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Edit Template' : 'Create Template'}>
        <div style={s.modalForm}>
          <div style={s.formGroup}>
            <label style={s.label}>Template Name</label>
            <input
              type="text"
              style={s.input}
              value={modalData.name}
              onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
              placeholder="e.g., Cold Outreach Day 1"
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Email Subject</label>
            <input
              type="text"
              style={s.input}
              value={modalData.subject}
              onChange={(e) => setModalData({ ...modalData, subject: e.target.value })}
              placeholder="e.g., Let's explore partnership opportunities"
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Email Body</label>
            <textarea
              style={s.textarea}
              value={modalData.body}
              onChange={(e) => setModalData({ ...modalData, body: e.target.value })}
              placeholder="Enter email body..."
            />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>Touchpoint (optional)</label>
            <select
              style={s.select}
              value={modalData.touchpoint}
              onChange={(e) => setModalData({ ...modalData, touchpoint: e.target.value })}
            >
              <option value="">-- Select Touchpoint --</option>
              <option value="email1">Day 1</option>
              <option value="email2">Day 3</option>
              <option value="email3">Day 7</option>
              <option value="email4">Day 14</option>
              <option value="linkedin_connect">LinkedIn Connect</option>
              <option value="linkedin_dm">LinkedIn DM</option>
              <option value="call">Call</option>
            </select>
          </div>

          <div style={s.modalActions}>
            <button style={s.modalBtn(false)} onClick={closeModal}>Cancel</button>
            <button style={s.modalBtn(true)} onClick={saveTemplate} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
