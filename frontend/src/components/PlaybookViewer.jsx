import { useState } from 'react';

const tabs = [
  { key: 'research', label: 'Research Brief' },
  { key: 'email1', label: 'Email 1' },
  { key: 'email2', label: 'Email 2' },
  { key: 'email3', label: 'Email 3' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'call_opener', label: 'Call Opener' },
  { key: 'objection_handling', label: 'Objections' },
  { key: 'callbacks', label: 'Callbacks' },
];

const s = {
  wrap: { marginTop: 16 },
  tabs: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '1rem' },
  tab: (active) => ({
    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 20,
    background: active ? 'var(--accent)' : 'var(--bg3)',
    color: active ? '#fff' : 'var(--text2)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    cursor: 'pointer', transition: 'all 0.15s',
  }),
  content: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '1.25rem', position: 'relative',
  },
  pre: {
    whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13.5,
    lineHeight: 1.75, color: 'var(--text)', wordBreak: 'break-word',
  },
  copyBtn: {
    position: 'absolute', top: 12, right: 12,
    padding: '5px 12px', fontSize: 12, fontWeight: 500,
    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
    borderRadius: 'var(--radius)',
  },
  genTime: { fontSize: 11, color: 'var(--text3)', marginTop: 10, textAlign: 'right' },
};

export default function PlaybookViewer({ playbook }) {
  const [activeTab, setActiveTab] = useState('research');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(playbook[activeTab] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!playbook) return null;

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={s.content}>
        <button style={s.copyBtn} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
        <pre style={s.pre}>{playbook[activeTab] || 'No content generated'}</pre>
        {playbook.generated_at && (
          <div style={s.genTime}>Generated {new Date(playbook.generated_at).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}
