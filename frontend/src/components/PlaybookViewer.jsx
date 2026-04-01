import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';

const tabs = [
  { key: 'research', label: 'Research' },
  { key: 'email1', label: 'Email 1' },
  { key: 'email2', label: 'Email 2' },
  { key: 'email3', label: 'Email 3' },
  { key: 'email4', label: 'Email 4' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'call_opener', label: 'Call Opener' },
  { key: 'objection_handling', label: 'Objections' },
  { key: 'callbacks', label: 'Callbacks' },
  { key: 'chat', label: '💬 AI Coach' },
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
  chatWrap: { display: 'flex', flexDirection: 'column', height: 420 },
  chatMessages: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, paddingRight: 4 },
  chatInput: { display: 'flex', gap: 8 },
  chatTextarea: { flex: 1, minHeight: 44, maxHeight: 120, resize: 'vertical', fontSize: 13, padding: '10px 12px' },
  sendBtn: { padding: '10px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, alignSelf: 'flex-end', border: 'none' },
  chatHints: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  hint: { fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' },
};

const CHAT_HINTS = [
  'Rewrite email 1 more aggressively',
  'Make the call opener shorter',
  'What else should I know about this company?',
  'Rewrite email 2 with a different angle',
  'Give me 3 more objection rebuttals',
  'What is the best time to send these?',
];

export default function PlaybookViewer({ playbook, leadId }) {
  const [activeTab, setActiveTab] = useState('research');
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const copy = () => {
    navigator.clipboard.writeText(playbook[activeTab] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendChat = async (text) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const r = await api.post(`/chat/${leadId}`, { messages: newMessages });
      setChatMessages([...newMessages, { role: 'assistant', content: r.data.reply }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Error: ' + (err.response?.data?.error || err.message) }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!playbook) return null;

  const msgStyle = (role) => ({
    padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: 13, lineHeight: 1.6,
    maxWidth: '85%', whiteSpace: 'pre-wrap',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? 'var(--accent)' : 'var(--bg3)',
    color: role === 'user' ? '#fff' : 'var(--text)',
    border: role === 'user' ? 'none' : '1px solid var(--border)',
  });

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'chat' ? (
        <div style={s.content}>
          <div style={s.chatWrap}>
            <div style={s.chatMessages}>
              {chatMessages.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '0.5rem 0' }}>
                  Ask your AI sales coach anything about this prospect or playbook.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={msgStyle(m.role)}>{m.content}</div>
              ))}
              {chatLoading && <div style={{ ...msgStyle('assistant'), opacity: 0.6 }}>Thinking...</div>}
              <div ref={chatBottomRef} />
            </div>
            <div style={s.chatHints}>
              {CHAT_HINTS.map(h => (
                <span key={h} style={s.hint} onClick={() => sendChat(h)}>{h}</span>
              ))}
            </div>
            <div style={s.chatInput}>
              <textarea
                style={s.chatTextarea}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Rewrite email 2, get more objection rebuttals, ask about the prospect..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              />
              <button style={s.sendBtn} onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={s.content}>
          <button style={s.copyBtn} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
          <pre style={s.pre}>{playbook[activeTab] || 'Regenerate this playbook to get this section.'}</pre>
          {playbook.generated_at && (
            <div style={s.genTime}>Generated {new Date(playbook.generated_at).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  );
}
