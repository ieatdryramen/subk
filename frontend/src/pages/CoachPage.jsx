import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

const simpleMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/## (.+)/g, '<div style="font-weight:600;font-size:14px;margin:12px 0 6px;color:var(--accent2)">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '\n• ')
    .replace(/\n/g, '<br/>');
};

const quickPrompts = [
  'How do I find teaming partners?',
  'Help me write a capability statement',
  'What set-asides should I pursue?',
  'Review my profile for weaknesses',
];

export default function CoachPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text = null) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput('');
    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const r = await api.post('/chat/general', { messages: newMessages });
      const assistantMessage = r.data.message || r.data.reply || 'No response';
      setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to get response from AI coach';
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg)',
    },
    header: {
      padding: '1.5rem 2rem',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg2)',
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 700,
      marginBottom: 2,
    },
    headerSub: {
      fontSize: 13,
      color: 'var(--text2)',
    },
    messagesContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '1.5rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
    emptyState: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      color: 'var(--text2)',
    },
    promptsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
      marginTop: 16,
      width: '100%',
      maxWidth: 500,
    },
    promptBtn: {
      padding: '10px 12px',
      background: 'var(--accent-bg)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      color: 'var(--accent2)',
      cursor: 'pointer',
      fontWeight: 500,
      transition: 'all 0.15s',
    },
    messageBubble: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
    },
    bubbleIcon: {
      flexShrink: 0,
      fontSize: 18,
      marginTop: 2,
    },
    bubbleContent: (isUser) => ({
      maxWidth: '60%',
      padding: '10px 14px',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      lineHeight: 1.5,
      background: isUser ? 'var(--accent)' : 'var(--bg2)',
      color: isUser ? 'var(--text-inverse)' : 'var(--text)',
      border: isUser ? 'none' : '1px solid var(--border)',
      wordWrap: 'break-word',
    }),
    inputContainer: {
      padding: '1.5rem 2rem',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg2)',
      flexShrink: 0,
    },
    inputForm: {
      display: 'flex',
      gap: 10,
      maxWidth: '100%',
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      color: 'var(--text)',
      outline: 'none',
    },
    sendBtn: {
      padding: '10px 20px',
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'opacity 0.15s',
    },
  };

  return (
    <Layout>
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.headerTitle}>AI Coach 💬</div>
          <div style={s.headerSub}>Get instant advice on finding partners, writing proposals, and growing your business</div>
        </div>

        <div style={s.messagesContainer}>
          {messages.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Welcome to AI Coach</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>
                Ask me anything about GovCon, teaming, or growing your business
              </div>
              <div style={s.promptsGrid}>
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    style={s.promptBtn}
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ ...s.messageBubble, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && <div style={s.bubbleIcon}>🤖</div>}
                <div style={s.bubbleContent(msg.role === 'user')} dangerouslySetInnerHTML={msg.role === 'assistant' ? { __html: simpleMarkdown(msg.content) } : undefined}>
                  {msg.role === 'user' ? msg.content : undefined}
                </div>
                {msg.role === 'user' && <div style={s.bubbleIcon}>👤</div>}
              </div>
            ))
          )}
          {loading && (
            <div style={{ ...s.messageBubble }}>
              <div style={s.bubbleIcon}>🤖</div>
              <div style={s.bubbleContent(false)}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={s.inputContainer}>
          <form
            style={s.inputForm}
            onSubmit={e => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <input
              style={s.input}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask the AI Coach anything..."
              disabled={loading}
            />
            <button
              style={{ ...s.sendBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              type="submit"
              disabled={loading}
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
