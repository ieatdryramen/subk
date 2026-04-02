import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const TOUCHPOINT_LABELS = {
  email1: 'Day 1', email2: 'Day 3', email3: 'Day 7', email4: 'Day 14',
  linkedin_connect: 'LinkedIn Connect', linkedin_dm: 'LinkedIn DM', call: 'Call'
};

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 900 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
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
  deleteBtn: { padding: '6px 14px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 14 },
  filters: { display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterBtn: (active) => ({ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'var(--bg2)', color: active ? 'var(--accent2)' : 'var(--text2)', cursor: 'pointer', fontWeight: active ? 600 : 400 }),
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState({});
  const [expanded, setExpanded] = useState({});

  const load = () => api.get('/templates').then(r => setTemplates(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this template?')) return;
    await api.delete(`/templates/${id}`);
    setTemplates(t => t.filter(x => x.id !== id));
  };

  const copy = (template) => {
    const text = template.subject ? `SUBJECT: ${template.subject}\n\n${template.body}` : template.body;
    navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [template.id]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [template.id]: false })), 2000);
  };

  const filtered = filter === 'all' ? templates : templates.filter(t => t.touchpoint === filter);
  const touchpoints = [...new Set(templates.map(t => t.touchpoint).filter(Boolean))];

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Email Templates</div>
        <div style={s.sub}>Saved emails from your playbooks. Save any email as a template from the playbook viewer.</div>

        <div style={s.filters}>
          <button style={s.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>All ({templates.length})</button>
          {touchpoints.map(tp => (
            <button key={tp} style={s.filterBtn(filter === tp)} onClick={() => setFilter(tp)}>
              {TOUCHPOINT_LABELS[tp] || tp} ({templates.filter(t => t.touchpoint === tp).length})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={s.empty}>
            No templates yet — open any playbook, go to an email tab, and click "Save template"
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
                  <button style={s.deleteBtn} onClick={() => del(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
