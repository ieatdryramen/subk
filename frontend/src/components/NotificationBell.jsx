import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const getNotifIcon = (message) => {
  const m = (message || '').toLowerCase();
  if (m.includes('overdue') || m.includes('touch') || m.includes('reminder')) return '⏰';
  if (m.includes('opportunit') || m.includes('match') || m.includes('fit score')) return '🎯';
  if (m.includes('teaming') || m.includes('partner') || m.includes('prime')) return '🤝';
  if (m.includes('deploy') || m.includes('system') || m.includes('update') || m.includes('version')) return '⚙';
  return '🔔';
};

const DEFAULT_PREFS = { overdue_touches: true, new_opportunities: true, teaming_requests: true, system_events: true };

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  // Load preferences
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sumx_notification_prefs'));
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...saved });
    } catch {}
  }, []);

  const savePrefs = (updated) => {
    setPrefs(updated);
    localStorage.setItem('sumx_notification_prefs', JSON.stringify(updated));
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      fetchUnreadCount();
    } catch {}
  }, [fetchUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      fetchUnreadCount();
    } catch {}
  }, [fetchUnreadCount]);

  const dismissNotification = useCallback(async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
    } catch {
      // If delete endpoint doesn't exist, just remove locally
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    setShowPrefs(false);
    if (!isOpen) fetchNotifications();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          bellRef.current && !bellRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowPrefs(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const displayNotifs = showAll ? notifications : notifications.slice(0, 10);

  return (
    <>
      <style>{`
        @keyframes bellFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ position: 'relative' }}>
        <button ref={bellRef} onClick={handleBellClick} aria-label="Notifications" aria-expanded={isOpen}
          style={{ position: 'relative', background: 'none', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          🔔
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'var(--danger)', color: '#fff', borderRadius: 9999, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, minWidth: 20 }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div ref={dropdownRef} style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
            backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 380, maxHeight: 520,
            display: 'flex', flexDirection: 'column', zIndex: 1000, animation: 'bellFadeIn 0.15s ease-out',
          }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius)' }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setShowPrefs(!showPrefs)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}
                  title="Notification preferences">⚙</button>
              </div>
            </div>

            {/* Preferences Panel */}
            {showPrefs && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Preferences</div>
                {[
                  { key: 'overdue_touches', label: 'Overdue touches', icon: '⏰' },
                  { key: 'new_opportunities', label: 'New opportunities', icon: '🎯' },
                  { key: 'teaming_requests', label: 'Teaming requests', icon: '🤝' },
                  { key: 'system_events', label: 'System events', icon: '⚙' },
                ].map(p => (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                    <span>{p.icon}</span>
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <div onClick={() => savePrefs({ ...prefs, [p.key]: !prefs[p.key] })}
                      style={{ width: 36, height: 20, borderRadius: 10, background: prefs[p.key] ? 'var(--accent)' : 'var(--bg3)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', border: '1px solid var(--border)' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: prefs[p.key] ? 19 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Notifications List */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>Loading...</div>
              ) : displayNotifs.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>You're all caught up!</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>No new notifications</div>
                </div>
              ) : (
                displayNotifs.map(notif => (
                  <div key={notif.id} onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      backgroundColor: notif.is_read ? 'transparent' : 'rgba(8,165,191,0.04)', transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = notif.is_read ? 'rgba(0,0,0,0.02)' : 'rgba(8,165,191,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = notif.is_read ? 'transparent' : 'rgba(8,165,191,0.04)'}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{getNotifIcon(notif.message || notif.text)}</span>
                      {!notif.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word', marginBottom: 3 }}>
                          {notif.message || notif.text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {formatTimeAgo(notif.created_at || notif.createdAt || notif.timestamp)}
                        </div>
                      </div>
                      <button onClick={e => dismissNotification(e, notif.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', padding: '2px 4px', opacity: 0.5, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                        title="Dismiss">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 10 && !showAll && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button onClick={() => setShowAll(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                  View all ({notifications.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
