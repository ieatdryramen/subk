import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const TOUCHPOINT_LABELS = {
  email1: 'Email 1', email2: 'Email 2', email3: 'Email 3', email4: 'Email 4',
  linkedin_connect: 'LinkedIn Connect', linkedin_dm: 'LinkedIn DM', call1: 'Call 1', call2: 'Call 2', call3: 'Call 3'
};

const MERGE_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'last_name', label: 'Last Name' },
];

const DEFAULT_TEMPLATES = [
  {
    name: 'Cold Outreach - Day 1',
    touchpoint: 'email1',
    subject: 'Quick thought on {{company}}',
    body: 'Hi {{first_name}},\n\nI came across {{company}} and saw you\'re in a {{title}} role. Thought of you when I was reading about GovCon ERP challenges.\n\nWould you be open to a quick 15-minute call next week?\n\nBest,\nAlex'
  },
  {
    name: 'Follow-up - Day 3',
    touchpoint: 'email2',
    subject: 'Quick follow-up - {{company}}',
    body: 'Hi {{first_name}},\n\nJust wanted to follow up on the message I sent earlier.\n\nNo pressure at all — I know your inbox gets packed. But if you have 15 minutes next week, I\'d love to show you how other firms like {{company}} are handling their compliance workflows.\n\nLet me know!\n\nBest,\nAlex'
  },
  {
    name: 'LinkedIn Connect Message',
    touchpoint: 'linkedin_dm',
    subject: '',
    body: 'Hi {{first_name}},\n\nI\'ve been following {{company}}\'s recent wins and was impressed. I think there might be some interesting things to discuss around GovCon operations.\n\nWould be great to connect — let\'s chat soon.\n\nBest,\nAlex'
  },
  {
    name: 'Call Opener Script',
    touchpoint: 'call1',
    subject: '',
    body: 'Hi {{first_name}}, this is Alex calling. I reached out over email the other day — did that message ever hit your inbox?\n\nGreat — I was calling because I\'ve been working with firms similar to {{company}}, and I noticed [specific pain point].\n\nDo you have 15 minutes next week to explore how we\'re helping similar companies?'
  }
];

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1000 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: 12 },
  searchBar: { flex: 1, maxWidth: 400, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' },
  newBtn: { padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' },
  aiBtn: { padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius)', border: '1px solid var(--accent2)', background: 'transparent', color: 'var(--accent2)', cursor: 'pointer' },
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
  tabs: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 },
  tab: (active) => ({ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent2)' : 'var(--text3)', cursor: 'pointer', borderBottom: active ? '2px solid var(--accent)' : 'none', paddingBottom: 8, marginBottom: -12 }),
  toolbar: { display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  mergeBtn: { padding: '4px 8px', fontSize: 11, borderRadius: 'var(--radius)', border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent2)', cursor: 'pointer' },
  previewBox: { padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)', maxHeight: 300, overflow: 'auto' },
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
  const [previewMode, setPreviewMode] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const bodyEditorRef = useRef(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api.get('/templates').then(r => {
      if (r.data.length === 0) {
        initDefaultTemplates();
      } else {
        setTemplates(r.data);
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      setLoadError('Failed to load templates');
      setLoading(false);
    });
  };

  const initDefaultTemplates = async () => {
    try {
      for (const tmpl of DEFAULT_TEMPLATES) {
        await api.post('/templates', tmpl);
      }
      const r = await api.get('/templates');
      setTemplates(r.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize default templates:', err);
      setTemplates([]);
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(t => t.filter(x => x.id !== id));
      addToast('Template deleted', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to delete template', 'error');
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
    setPreviewMode(false);
    setModalOpen(true);
  };

  const openEditModal = (template) => {
    setEditingId(template.id);
    setModalData({ name: template.name, subject: template.subject || '', body: template.body, touchpoint: template.touchpoint || '' });
    setPreviewMode(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setModalData({ name: '', subject: '', body: '', touchpoint: '' });
    setPreviewMode(false);
    setAiGenerating(false);
  };

  const insertMergeField = (key) => {
    const fieldText = `{{${key}}}`;
    const editor = bodyEditorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    const newBody = before + fieldText + after;

    setModalData({ ...modalData, body: newBody });
    setTimeout(() => {
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + fieldText.length;
    }, 0);
  };

  const generateAiTemplate = async () => {
    if (!modalData.touchpoint) {
      addToast('Select a touchpoint first', 'error');
      return;
    }
    setAiGenerating(true);
    try {
      const prompt = `Generate a professional, personalized GovCon outreach email template for a ${TOUCHPOINT_LABELS[modalData.touchpoint] || modalData.touchpoint}. Use merge fields like {{first_name}}, {{company}}, {{title}}. Keep it concise and authentic. Return ONLY the template in this format:
SUBJECT: [subject line]
BODY: [email body]`;

      const res = await api.post('/chat/generate-template', { prompt, touchpoint: modalData.touchpoint });
      const generated = res.data?.generated || '';

      const subjectMatch = generated.match(/SUBJECT:\s*(.+?)(?=BODY:|$)/s);
      const bodyMatch = generated.match(/BODY:\s*(.+?)$/s);

      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      const body = bodyMatch ? bodyMatch[1].trim() : '';

      setModalData({
        ...modalData,
        subject,
        body
      });
      addToast('Template generated! Edit and save', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to generate template', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const applyMergeFieldsPreview = (text) => {
    const sampleData = {
      first_name: 'John',
      company: 'Acme Corp',
      title: 'Controller',
      last_name: 'Smith'
    };
    let preview = text;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return preview;
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
        <div style={s.sub}>Build a reusable library of email templates for your outreach campaigns. Use merge fields to personalize at scale.</div>

        <div style={s.topBar}>
          <input
            type="text"
            placeholder="Search templates..."
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
              Build a reusable library of emails. Create templates with merge fields to personalize at scale.
            </div>
            <button
              onClick={openCreateModal}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', marginRight: 12 }}>
              Create First Template
            </button>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map(t => (
              <div key={t.id} style={s.card}>
                <div style={s.cardHead}>
                  <div>
                    <div style={s.cardName}>{t.name}</div>
                    <div style={s.cardMeta}>
                      {t.creator || 'You'} · {new Date(t.created_at).toLocaleDateString()}
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
                  <button style={s.copyBtn} onClick={() => copy(t)}>{copied[t.id] ? 'Copied' : 'Copy'}</button>
                  <button style={s.editBtn} onClick={() => openEditModal(t)}>Edit</button>
                  <button style={s.deleteBtn} onClick={() => del(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Edit Template' : 'Create Template'} wide>
        <div style={s.modalForm}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={s.tab(!previewMode)}
              onClick={() => setPreviewMode(false)}
            >
              Edit
            </button>
            <button
              style={s.tab(previewMode)}
              onClick={() => setPreviewMode(true)}
            >
              Preview
            </button>
          </div>

          {!previewMode ? (
            <>
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
                <label style={s.label}>Touchpoint</label>
                <select
                  style={s.select}
                  value={modalData.touchpoint}
                  onChange={(e) => setModalData({ ...modalData, touchpoint: e.target.value })}
                >
                  <option value="">-- Select Touchpoint --</option>
                  <option value="email1">Email 1</option>
                  <option value="email2">Email 2</option>
                  <option value="email3">Email 3</option>
                  <option value="email4">Email 4</option>
                  <option value="linkedin_connect">LinkedIn Connect</option>
                  <option value="linkedin_dm">LinkedIn DM</option>
                  <option value="call1">Call 1</option>
                  <option value="call2">Call 2</option>
                  <option value="call3">Call 3</option>
                </select>
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Email Subject</label>
                <input
                  type="text"
                  style={s.input}
                  value={modalData.subject}
                  onChange={(e) => setModalData({ ...modalData, subject: e.target.value })}
                  placeholder="e.g., Quick thought on {{company}}"
                />
              </div>

              <div style={s.formGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={s.label}>Email Body</label>
                  <button
                    style={s.aiBtn}
                    onClick={generateAiTemplate}
                    disabled={aiGenerating || !modalData.touchpoint}
                    type="button"
                  >
                    {aiGenerating ? 'Generating...' : 'Generate with AI'}
                  </button>
                </div>
                <div style={s.toolbar}>
                  {MERGE_FIELDS.map(field => (
                    <button
                      key={field.key}
                      style={s.mergeBtn}
                      onClick={() => insertMergeField(field.key)}
                      type="button"
                    >
                      {`{{${field.label}}}`}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyEditorRef}
                  style={s.textarea}
                  value={modalData.body}
                  onChange={(e) => setModalData({ ...modalData, body: e.target.value })}
                  placeholder="Enter email body. Use merge fields to personalize..."
                />
              </div>

              <div style={s.modalActions}>
                <button style={s.modalBtn(false)} onClick={closeModal}>Cancel</button>
                <button style={s.modalBtn(true)} onClick={saveTemplate} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Subject Preview</label>
                <div style={s.previewBox}>
                  {applyMergeFieldsPreview(modalData.subject) || '(no subject)'}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Body Preview</label>
                <div style={s.previewBox}>
                  {applyMergeFieldsPreview(modalData.body) || '(empty)'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                Sample data: John Smith @ Acme Corp, Controller
              </div>
              <div style={s.modalActions}>
                <button style={s.modalBtn(false)} onClick={() => setPreviewMode(false)}>Back to Edit</button>
                <button style={s.modalBtn(true)} onClick={saveTemplate} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
