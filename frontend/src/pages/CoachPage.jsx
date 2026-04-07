import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';

// Inject animation keyframes
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleSheet);
}

const simpleMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/## (.+)/g, '<div style="font-weight:600;font-size:14px;margin:12px 0 6px;color:var(--accent2)">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '\n• ')
    .replace(/\n/g, '<br/>');
};

const quickPrompts = {
  'BD Strategy': [
    'How do I find teaming partners?',
    'What\'s the best capture management process?',
  ],
  'Proposals': [
    'Help me write a capability statement',
    'How do I structure a technical volume?',
  ],
  'Compliance': [
    'What set-asides should I pursue?',
    'Explain FAR compliance basics',
  ],
  'Growth': [
    'Review my profile for weaknesses',
    'How do I get GSA Schedule?',
  ],
};

export default function CoachPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('sumx_coach_history');
    if (saved) {
      try {
        setConversationHistory(JSON.parse(saved));
      } catch (e) {
        setConversationHistory([]);
      }
    }
  }, []);

  const saveConversation = () => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Conversation';
    const summary = firstUserMsg.substring(0, 50) + (firstUserMsg.length > 50 ? '...' : '');
    const newEntry = {
      id: Date.now(),
      title: summary,
      timestamp: new Date().toLocaleString(),
      messages: messages,
    };
    const updated = [newEntry, ...conversationHistory];
    setConversationHistory(updated);
    localStorage.setItem('sumx_coach_history', JSON.stringify(updated));
  };

  const clearConversation = () => {
    saveConversation();
    setMessages([]);
    setInput('');
  };

  const loadConversation = (id) => {
    const conv = conversationHistory.find(c => c.id === id);
    if (conv) {
      setMessages(conv.messages);
      setSidebarOpen(false);
    }
  };

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
    pageWrapper: {
      display: 'flex',
      height: '100vh',
      background: 'var(--bg)',
    },
    sidebar: {
      width: 280,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s',
      transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      position: 'absolute',
      height: '100%',
      zIndex: 100,
    },
    sidebarHeader: {
      padding: '1.5rem 1rem',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    },
    sidebarTitle: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 8,
    },
    sidebarHistory: {
      flex: 1,
      overflowY: 'auto',
      padding: '0.5rem',
    },
    historyItem: {
      padding: '8px 10px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      cursor: 'pointer',
      marginBottom: 6,
      transition: 'all 0.15s',
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      background: 'var(--bg)',
    },
    header: {
      padding: '1.5rem 2rem',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg2)',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flex: 1,
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
    headerButtons: {
      display: 'flex',
      gap: 10,
      flexShrink: 0,
    },
    headerBtn: {
      padding: '8px 12px',
      background: 'var(--accent-bg)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      color: 'var(--accent2)',
      cursor: 'pointer',
      fontWeight: 500,
      transition: 'all 0.15s',
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
    promptsSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      maxWidth: 600,
    },
    promptCategory: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    promptCategoryTitle: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--accent2)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    promptsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(1, 1fr)',
      gap: 8,
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
      textAlign: 'left',
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
    bubbleContentWrapper: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
    },
    bubbleContent: (isUser) => ({
      maxWidth: '60%',
      padding: '10px 14px',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      lineHeight: 1.5,
      background: isUser ? 'var(--accent)' : 'var(--bg2)',
      color: isUser ? '#FFFFFF' : 'var(--text)',
      border: isUser ? 'none' : '1px solid var(--border)',
      wordWrap: 'break-word',
    }),
    copyBtn: {
      padding: '4px 8px',
      background: 'transparent',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: 11,
      color: 'var(--text2)',
      cursor: 'pointer',
      transition: 'all 0.15s',
      flexShrink: 0,
    },
    typingIndicator: {
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      padding: '6px 0',
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--text2)',
      animation: 'pulse 1.4s infinite',
    },
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy:', err));
  };

  return (
    <Layout>
      <div style={s.pageWrapper}>
        {/* Sidebar */}
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={s.sidebarTitle}>Conversation History</div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text2)',
                cursor: 'pointer',
                fontSize: 18,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          <div style={s.sidebarHistory}>
            {conversationHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '1rem' }}>
                No saved conversations yet
              </div>
            ) : (
              conversationHistory.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  style={s.historyItem}
                  title={conv.timestamp}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    {conv.timestamp}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div style={s.container}>
          <div style={s.header}>
            <div style={s.headerLeft}>
              <div style={s.headerTitle}>AI Coach 💬</div>
              <div style={s.headerSub}>Get instant advice on finding partners, writing proposals, and growing your business</div>
            </div>
            <div style={s.headerButtons}>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={s.headerBtn}
                title="View conversation history"
              >
                📋 History
              </button>
              <button
                onClick={clearConversation}
                style={s.headerBtn}
                disabled={messages.length === 0}
                title="Clear current conversation"
              >
                🗑️ Clear
              </button>
            </div>
          </div>

        <div style={s.messagesContainer}>
          {messages.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Welcome to AI Coach</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>
                Ask me anything about GovCon, teaming, or growing your business
              </div>
              <div style={s.promptsSection}>
                {Object.entries(quickPrompts).map(([category, prompts]) => (
                  <div key={category} style={s.promptCategory}>
                    <div style={s.promptCategoryTitle}>{category}</div>
                    <div style={s.promptsGrid}>
                      {prompts.map((prompt, i) => (
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
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ ...s.messageBubble, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && <div style={s.bubbleIcon}>🤖</div>}
                <div style={s.bubbleContentWrapper}>
                  <div style={s.bubbleContent(msg.role === 'user')} dangerouslySetInnerHTML={msg.role === 'assistant' ? { __html: simpleMarkdown(msg.content) } : undefined}>
                    {msg.role === 'user' ? msg.content : undefined}
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(msg.content)}
                      style={s.copyBtn}
                      title="Copy message"
                    >
                      📋
                    </button>
                  )}
                </div>
                {msg.role === 'user' && <div style={s.bubbleIcon}>👤</div>}
              </div>
            ))
          )}
          {loading && (
            <div style={{ ...s.messageBubble }}>
              <div style={s.bubbleIcon}>🤖</div>
              <div style={s.bubbleContent(false)}>
                <div style={s.typingIndicator}>
                  <div style={{ ...s.typingDot, animationDelay: '0s' }} />
                  <div style={{ ...s.typingDot, animationDelay: '0.2s' }} />
                  <div style={{ ...s.typingDot, animationDelay: '0.4s' }} />
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
      </div>
    </Layout>
  );
}
