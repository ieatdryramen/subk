import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import SequenceTracker from './SequenceTracker';
import LeadNotes from './LeadNotes';

const tabs = [
  { key: 'sequence', label: '📋 Sequence' },
  { key: 'research', label: 'Research' },
  { key: 'email1', label: 'Email 1' },
  { key: 'email2', label: 'Email 2' },
  { key: 'email3', label: 'Email 3' },
  { key: 'email4', label: 'Email 4' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'call_opener', label: 'Call Opener' },
  { key: 'objection_handling', label: 'Objections' },
  { key: 'callbacks', label: 'Callbacks' },
  { key: 'notes', label: '📝 Notes' },
  { key: 'chat', label: '💬 AI Coach' },
];

const EMAIL_KEYS = { email1: 'email1', email2: 'email2', email3: 'email3', email4: 'email4' };
const EMAIL_DAYS = { email1: 'Day 1', email2: 'Day 3', email3: 'Day 7', email4: 'Day 14' };

const s = {
  wrap: { marginTop: 16 },
  tabs: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '1rem' },
  tab: (active) => ({
    padding: '6px 13px', fontSize: 12, fontWeight: 500, borderRadius: 20,
    background: active ? 'var(--accent)' : 'var(--bg3)',
    color: active ? '#fff' : 'var(--text2)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    cursor: 'pointer', transition: 'all 0.15s',
  }),
  content: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', position: 'relative' },
  pre: { whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13.5, lineHeight: 1.75, color: 'var(--text)', wordBreak: 'break-word' },
  actionRow: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  copyBtn: { padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--radius)', cursor: 'pointer' },
  sendBtn: { padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius)', cursor: 'pointer' },
  sendingBtn: { padding: '6px 14px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 'var(--radius)', cursor: 'not-allowed' },
  sentBadge: { padding: '6px 14px', fontSize: 12, background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius)', fontWeight: 500 },
  genTime: { fontSize: 11, color: 'var(--text3)', marginTop: 10, textAlign: 'right' },
  chatWrap: { display: 'flex', flexDirection: 'column', height: 420 },
  chatMessages: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, paddingRight: 4, scrollBehavior: 'smooth' },
  chatInput: { display: 'flex', gap: 8 },
  chatTextarea: { flex: 1, minHeight: 44, maxHeight: 120, resize: 'vertical', fontSize: 13, padding: '10px 12px' },
  sendChatBtn: { padding: '10px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, alignSelf: 'flex-end', border: 'none', cursor: 'pointer' },
  chatHints: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  hint: { fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' },
  outlookNote: { fontSize: 12, color: 'var(--text3)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', marginBottom: 10 },
};

const CHAT_HINTS = [
  'Rewrite email 1 more aggressively',
  'Shorter call opener',
  'What else should I know about this company?',
  'Give me 3 more objection rebuttals',
  'Rewrite email 2 different angle',
];

const parseEmailParts = (emailText) => {
  if (!emailText) return { subject: '', body: '' };
  const lines = emailText.split('\n');
  const subjectLine = lines.find(l => l.toUpperCase().startsWith('SUBJECT:'));
  const subject = subjectLine ? subjectLine.replace(/^SUBJECT:\s*/i, '').trim() : '';
  const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0;
  const body = lines.slice(bodyStart).join('\n').trim();
  return { subject, body };
};

export default function PlaybookViewer({ playbook, leadId, lead, outlookConnected }) {
  const [activeTab, setActiveTab] = useState('sequence');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({});

  const [zohoConnected, setZohoConnected] = useState(false);

  useEffect(() => {
    api.get('/zoho/status').then(r => setZohoConnected(r.data.connected)).catch(() => {});
  }, []);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages]);

  // Pre-populate sent status from sequence data
  useEffect(() => {
    if (lead) {
      setSent({
        email1: !!lead.email1_sent,
        email2: !!lead.email2_sent,
        email3: !!lead.email3_sent,
        email4: !!lead.email4_sent,
      });
    }
  }, [lead?.id]);

  const copy = () => {
    const text = playbook?.[activeTab] || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendEmail = async (emailKey) => {
    const emailText = playbook?.[emailKey];
    if (!emailText) return;
    const { subject, body } = parseEmailParts(emailText);
    setSending(s => ({ ...s, [emailKey]: true }));
    try {
      await api.post(`/outlook/send/${leadId}`, { emailKey, subject, body });
      setSent(s => ({ ...s, [emailKey]: true }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send. Check Outlook connection in Team & Integrations.');
    } finally {
      setSending(s => ({ ...s, [emailKey]: false }));
    }
  };


  const sendViaGmail = async (tabKey) => {
    const emailContent = playbook[tabKey];
    if (!emailContent || !playbook) return;
    const lines = emailContent.split('\n');
    const subjectLine = lines.find(l => l.toUpperCase().startsWith('SUBJECT:'));
    const subject = subjectLine ? subjectLine.replace(/^SUBJECT:\s*/i, '').trim() : 'Following up';
    const body = lines.filter(l => !l.toUpperCase().startsWith('SUBJECT:')).join('\n').trim();
    const touchpointMap = { email1: 'email1', email2: 'email2', email3: 'email3', email4: 'email4' };
    setSending(true);
    try {
      await api.post(`/gmail/send/${leadId}`, { subject, body, touchpoint: touchpointMap[tabKey] });
      setSent(s => ({ ...s, [`gmail_${tabKey}`]: true }));
      setTimeout(() => setSent(s => ({ ...s, [`gmail_${tabKey}`]: false })), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Gmail send failed. Check connection in Team & Integrations.');
    } finally {
      setSending(false);
    }
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

  const msgStyle = (role) => ({
    padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: 13, lineHeight: 1.6,
    maxWidth: '85%', whiteSpace: 'pre-wrap', alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? 'var(--accent)' : 'var(--bg3)',
    color: role === 'user' ? '#fff' : 'var(--text)',
    border: role === 'user' ? 'none' : '1px solid var(--border)',
  });

  if (!playbook) return null;

  const isEmailTab = EMAIL_KEYS[activeTab];

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'sequence' ? (
        <div style={s.content}>
        </div>
      ) : activeTab === 'chat' ? (
        <div style={s.content}>
          <div style={s.chatWrap}>
            <div style={s.chatMessages}>
              {chatMessages.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '0.5rem 0' }}>
                  Ask your AI sales coach anything about this prospect or playbook.
                </div>
              )}
              {chatMessages.map((m, i) => <div key={i} style={msgStyle(m.role)}>{m.content}</div>)}
              {chatLoading && <div style={{ ...msgStyle('assistant'), opacity: 0.6 }}>Thinking...</div>}
              <div ref={chatBottomRef} />
            </div>
            <div style={s.chatHints}>
              {CHAT_HINTS.map(h => <span key={h} style={s.hint} onClick={() => sendChat(h)}>{h}</span>)}
            </div>
            <div style={s.chatInput}>
              <textarea style={s.chatTextarea} value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Rewrite an email, get objection rebuttals, ask about the prospect..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button style={s.sendChatBtn} onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>Send</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={s.content}>
          <div style={s.actionRow}>
            <button style={s.copyBtn} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
            {isEmailTab && (
              outlookConnected ? (
                sent[activeTab] ? (
                  <span style={s.sentBadge}>✓ Sent via Outlook</span>
                ) : sending[activeTab] ? (
                  <span style={s.sendingBtn}>Sending...</span>
                ) : (
                  <button style={s.sendBtn} onClick={() => sendEmail(activeTab)}>
                    Send via Outlook ({EMAIL_DAYS[activeTab]})
                  </button>
                )
              ) : (
                <span style={s.outlookNote}>Connect Outlook in Team & Integrations to send directly</span>
              )
            )}
          </div>
          <pre style={s.pre}>{playbook[activeTab] || 'Regenerate this playbook to get this section.'}</pre>
          {playbook.generated_at && (
            <div style={s.genTime}>Generated {new Date(playbook.generated_at).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  );
}


