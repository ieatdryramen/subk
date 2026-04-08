import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

// Inject animation keyframes
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleSheet);
}

const simpleMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/### (.+)/g, '<div style="font-weight:600;font-size:13px;margin:10px 0 4px;color:var(--accent2)">$1</div>')
    .replace(/## (.+)/g, '<div style="font-weight:600;font-size:14px;margin:12px 0 6px;color:var(--accent2)">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\n- /g, '\n• ')
    .replace(/\n(\d+)\. /g, '\n<span style="color:var(--accent2);font-weight:600">$1.</span> ')
    .replace(/\n/g, '<br/>');
};

const quickPrompts = [
  {
    category: 'BD Strategy',
    icon: '🎯',
    prompts: [
      { text: 'How do I find teaming partners for my next bid?', short: 'Find teaming partners' },
      { text: "What's the best capture management process for a small GovCon?", short: 'Capture management' },
      { text: 'How should I prioritize which opportunities to pursue?', short: 'Prioritize opportunities' },
    ],
  },
  {
    category: 'Proposals',
    icon: '📝',
    prompts: [
      { text: 'Help me write a capability statement for federal contracting', short: 'Capability statement' },
      { text: 'How do I structure a technical volume for an RFP response?', short: 'Technical volume' },
      { text: 'What makes a winning past performance section?', short: 'Past performance tips' },
    ],
  },
  {
    category: 'Compliance',
    icon: '📋',
    prompts: [
      { text: 'What set-asides should I pursue based on my certifications?', short: 'Set-aside strategy' },
      { text: 'Explain FAR compliance basics for new GovCon companies', short: 'FAR basics' },
      { text: 'What are the key requirements for DCAA accounting compliance?', short: 'DCAA compliance' },
    ],
  },
  {
    category: 'Growth',
    icon: '📈',
    prompts: [
      { text: 'Review my company profile and suggest improvements', short: 'Profile review' },
      { text: 'How do I get on GSA Schedule?', short: 'GSA Schedule' },
      { text: 'What steps do I need to take to grow from $1M to $10M in federal revenue?', short: 'Revenue growth' },
    ],
  },
];

export default function CoachPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('sumx_coach_history');
    if (saved) {
      try { setConversationHistory(JSON.parse(saved)); } catch { setConversationHistory([]); }
    }
  }, []);

  const saveHistory = (updated) => {
    setConversationHistory(updated);
    localStorage.setItem('sumx_coach_history', JSON.stringify(updated));
  };

  const saveConversation = (msgs = messages) => {
    if (msgs.length === 0) return;
    const firstUserMsg = msgs.find(m => m.role === 'user')?.content || 'Conversation';
    const summary = firstUserMsg.substring(0, 60) + (firstUserMsg.length > 60 ? '...' : '');

    if (activeConvId) {
      // Update existing conversation
      const updated = conversationHistory.map(c =>
        c.id === activeConvId ? { ...c, messages: msgs, timestamp: new Date().toLocaleString() } : c
      );
      saveHistory(updated);
    } else {
      // Create new
      const newEntry = {
        id: Date.now(),
        title: summary,
        timestamp: new Date().toLocaleString(),
        messages: msgs,
      };
      setActiveConvId(newEntry.id);
      saveHistory([newEntry, ...conversationHistory]);
    }
  };

  const startNewConversation = () => {
    if (messages.length > 0) saveConversation();
    setMessages([]);
    setInput('');
    setActiveConvId(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const loadConversation = (id) => {
    if (messages.length > 0 && activeConvId !== id) saveConversation();
    const conv = conversationHistory.find(c => c.id === id);
    if (conv) {
      setMessages(conv.messages);
      setActiveConvId(conv.id);
      setSidebarOpen(false);
    }
  };

  const deleteConversation = (id) => {
    const updated = conversationHistory.filter(c => c.id !== id);
    saveHistory(updated);
    if (activeConvId === id) {
      setMessages([]);
      setActiveConvId(null);
    }
    setConfirmDelete(null);
  };

  const renameConversation = (id) => {
    if (!editTitleValue.trim()) { setEditingTitle(null); return; }
    const updated = conversationHistory.map(c =>
      c.id === id ? { ...c, title: editTitleValue.trim() } : c
    );
    saveHistory(updated);
    setEditingTitle(null);
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
      const finalMessages = [...newMessages, { role: 'assistant', content: assistantMessage }];
      setMessages(finalMessages);
      // Auto-save every exchange
      setTimeout(() => saveConversation(finalMessages), 100);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to get response from AI coach';
      setMessages([...newMessages, { role: 'assistant', content: `I couldn't process that request. ${errorMsg}. Please try again.` }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, btnEl) => {
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        btnEl.textContent = '✓';
        setTimeout(() => { btnEl.textContent = '📋'; }, 1500);
      }
    }).catch(err => console.error('Failed to copy:', err));
  };

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  return (
    <Layout>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', position: 'relative' }}>
        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
        )}

        {/* Sidebar */}
        <div style={{
          width: 300, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', transition: 'transform 0.2s ease',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          position: 'absolute', height: '100%', zIndex: 100,
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Conversations</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={startNewConversation}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                + New
              </button>
              <button onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>
                ✕
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {conversationHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '2rem 1rem', textAlign: 'center' }}>
                No conversations yet. Start chatting to save your first one.
              </div>
            ) : conversationHistory.map((conv) => (
              <div key={conv.id}
                style={{
                  padding: '10px 12px', background: activeConvId === conv.id ? 'var(--accent-bg)' : 'var(--bg)',
                  border: `1px solid ${activeConvId === conv.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onClick={() => loadConversation(conv.id)}
                onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                {editingTitle === conv.id ? (
                  <input value={editTitleValue}
                    onChange={e => setEditTitleValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameConversation(conv.id); if (e.key === 'Escape') setEditingTitle(null); }}
                    onBlur={() => renameConversation(conv.id)}
                    autoFocus onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 3, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} />
                ) : (
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>
                    {conv.title}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {conv.messages?.length || 0} messages · {conv.timestamp}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingTitle(conv.id); setEditTitleValue(conv.title); }}
                      title="Rename" style={{ background: 'none', border: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--text3)', padding: '0 3px' }}>✎</button>
                    {confirmDelete === conv.id ? (
                      <>
                        <button onClick={() => deleteConversation(conv.id)}
                          style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>Delete</button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, padding: '1px 6px', cursor: 'pointer', color: 'var(--text3)' }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(conv.id)}
                        title="Delete" style={{ background: 'none', border: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--text3)', padding: '0 3px' }}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)' }}>
          {/* Header */}
          <div style={{
            padding: '1rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
            flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: 14, cursor: 'pointer', color: 'var(--text2)' }}
                title="Conversation history">
                ☰
              </button>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>AI Coach</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>GovCon strategy, proposals, compliance, and growth</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {messages.length > 0 && (
                <button onClick={startNewConversation}
                  style={{
                    padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  + New Chat
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, fontFamily: 'Syne, sans-serif' }}>
                  Hey {firstName}, what can I help with?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32, maxWidth: 400 }}>
                  I know GovCon inside and out — from finding opportunities and teaming partners to writing winning proposals and staying compliant.
                </div>

                {/* Quick prompt grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, width: '100%', maxWidth: 700 }}>
                  {quickPrompts.map(cat => (
                    <div key={cat.category} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{cat.icon}</span> {cat.category}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cat.prompts.map((p, i) => (
                          <button key={i}
                            onClick={() => sendMessage(p.text)}
                            style={{
                              padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text)', cursor: 'pointer',
                              textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit', lineHeight: 1.4,
                            }}
                            onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent2)'; }}
                            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text)'; }}>
                            {p.short}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'fadeInUp 0.2s ease',
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-bg)',
                      border: '1px solid var(--accent)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 14, flexShrink: 0,
                    }}>🤖</div>
                  )}
                  <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      fontSize: 13, lineHeight: 1.6,
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg2)',
                      color: msg.role === 'user' ? '#FFFFFF' : 'var(--text)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                      wordWrap: 'break-word',
                    }}
                      dangerouslySetInnerHTML={msg.role === 'assistant' ? { __html: DOMPurify.sanitize(simpleMarkdown(msg.content)) } : undefined}>
                      {msg.role === 'user' ? msg.content : undefined}
                    </div>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={(e) => copyToClipboard(msg.content, e.currentTarget)}
                          style={{
                            padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text3)', cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => e.target.style.borderColor = 'var(--accent)'}
                          onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
                          title="Copy to clipboard">📋</button>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0,
                    }}>{(user?.full_name || 'U')[0].toUpperCase()}</div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div style={{ display: 'flex', gap: 10, animation: 'fadeInUp 0.2s ease' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-bg)',
                  border: '1px solid var(--accent)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>🤖</div>
                <div style={{
                  padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s infinite', animationDelay: '0s' }} />
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }} />
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '1rem 2rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
            {messages.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['Tell me more', 'Give me an example', 'How do I start?', 'What are the risks?'].map(suggestion => (
                  <button key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    disabled={loading}
                    style={{
                      padding: '5px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 20, fontSize: 11, color: 'var(--text2)', cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!loading) { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent2)'; } }}
                    onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text2)'; }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <form
              style={{ display: 'flex', gap: 10 }}
              onSubmit={e => { e.preventDefault(); sendMessage(); }}>
              <input ref={inputRef}
                style={{
                  flex: 1, padding: '11px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', fontSize: 13, color: 'var(--text)', outline: 'none',
                  fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Ask anything about GovCon, proposals, teaming..."
                disabled={loading} />
              <button
                style={{
                  padding: '11px 24px', background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-lg)', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'opacity 0.15s', opacity: loading ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
                type="submit" disabled={loading}>
                {loading ? '...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
