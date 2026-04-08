import { useState } from 'react';
import UsageBanner from './UsageBanner';
import TouchBanner from './TouchBanner';
import NotificationBell from './NotificationBell';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navSections = [
  {
    label: 'INTELLIGENCE',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '▦' },
      { to: '/opportunity-board', label: 'Opp Board', icon: '📋' },
      { to: '/opportunities', label: 'Opportunities', icon: '🔍' },
      { to: '/pipeline', label: 'Pipeline', icon: '▤' },
    ],
  },
  {
    label: 'TEAMING',
    items: [
      { to: '/marketplace', label: 'Marketplace', icon: '🏪' },
      { to: '/teaming', label: 'Teaming Inbox', icon: '🤝' },
      { to: '/primes', label: 'Prime Tracker', icon: '🏢' },
    ],
  },
  {
    label: 'BD / OUTREACH',
    items: [
      { to: '/reminders', label: "Today's Touches", icon: '🎯' },
      { to: '/lists', label: 'Lead Lists', icon: '◉' },
      { to: '/templates', label: 'Templates', icon: '◧' },
      { to: '/reports', label: 'Reports', icon: '📊' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { to: '/profile', label: 'Company Profile', icon: '◈' },
      { to: '/sub-profile', label: 'Sub Profile', icon: '📋' },
      { to: '/coach', label: 'AI Coach', icon: '🤖' },
      { to: '/team', label: 'Team & Integrations', icon: '◎' },
      { to: '/billing', label: 'Billing', icon: '◇' },
      { to: '/cardscan', label: 'Card Scanner', icon: '📇' },
      { to: '/admin', label: 'Team Dashboard', icon: '◫', adminOnly: true },
      { to: '/activity', label: 'Activity Board', icon: '📊', adminOnly: true },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  // Auto-open sections that contain the active route, collapse the rest
  const getInitialOpen = () => {
    const open = {};
    navSections.forEach(section => {
      const hasActive = section.items.some(item => location.pathname.startsWith(item.to));
      open[section.label] = hasActive;
    });
    // Always open at least Intelligence if nothing matches
    if (!Object.values(open).some(Boolean)) open['INTELLIGENCE'] = true;
    return open;
  };
  const [openSections, setOpenSections] = useState(getInitialOpen);

  const toggleSection = (label) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const sidebar = (
    <aside style={{
      width: 230, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, color: '#08A5BF' }}>SumX</span>
          <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}> CRM</span>
          <span style={{ fontSize: 10, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 400, color: 'var(--text3)', display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>GovCon Intelligence Platform</span>
        </div>
        <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer', padding: 0 }} className="mobile-close">✕</button>
      </div>
      <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
        {navSections.map(section => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          const isOpen = openSections[section.label];
          const hasActive = visibleItems.some(item => location.pathname.startsWith(item.to));
          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 12px 6px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  color: hasActive ? 'var(--accent2)' : 'var(--text3)',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  transition: 'color 0.15s',
                }}>
                <span>{section.label}</span>
                <span style={{
                  fontSize: 9, transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.7,
                }}>▼</span>
              </button>
              <div style={{
                overflow: 'hidden',
                maxHeight: isOpen ? `${visibleItems.length * 40}px` : '0px',
                transition: 'max-height 0.2s ease-in-out',
              }}>
                {visibleItems.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderRadius: 'var(--radius)', color: isActive ? 'var(--accent2)' : 'var(--text2)',
                      fontSize: 13, fontWeight: 500, textDecoration: 'none',
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                    })}>
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <NotificationBell />
        <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <kbd style={{ padding: '1px 5px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, fontFamily: 'monospace' }}>⌘K</kbd>
          <span>Navigate</span>
        </div>
      </div>
      <TouchBanner />
      <UsageBanner />
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{user?.role || 'member'}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        <button onClick={handleLogout} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer' }}>Sign out</button>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .pf-shell { flex-direction: column !important; }
          .pf-sidebar { display: none !important; width: 100% !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 200 !important; height: 100vh !important; overflow-y: auto !important; }
          .pf-sidebar.open { display: flex !important; }
          .pf-mobile-bar { display: flex !important; }
          .pf-page { padding: 1rem !important; }
          .mobile-close { display: block !important; }
        }
        @media (min-width: 769px) {
          .pf-sidebar { display: flex !important; position: sticky !important; top: 0 !important; height: 100vh !important; }
          .pf-mobile-bar { display: none !important; }
          .mobile-close { display: none !important; }
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="pf-mobile-bar" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFFFFF', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}><span style={{ color: '#08A5BF' }}>SumX</span> CRM</span>
        <button onClick={() => setMobileOpen(true)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>☰ Menu</button>
      </div>

      {/* Mobile bottom nav */}
      <style>{`
        .pf-bottom-nav { display: none; }
        @media (max-width: 768px) {
          .pf-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg2);
            border-top: 1px solid var(--border);
            z-index: 150;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .pf-bottom-nav a {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 8px 4px;
            font-size: 10px;
            color: var(--text3);
            text-decoration: none;
            gap: 3px;
            border-top: 2px solid transparent;
            transition: all 0.15s;
          }
          .pf-bottom-nav a.active {
            color: var(--accent2);
            border-top-color: var(--accent);
          }
          .pf-bottom-nav a span.icon { font-size: 18px; }
          main { padding-bottom: 60px !important; }
        }
      `}</style>
      <nav className="pf-bottom-nav">
        {[
          { to: '/dashboard',     icon: '▦', label: 'Home' },
          { to: '/opportunities', icon: '🔍', label: 'Opps' },
          { to: '/marketplace',   icon: '🏪', label: 'Teaming' },
          { to: '/reminders',     icon: '🎯', label: 'Touches' },
          { to: '/pipeline',      icon: '▤', label: 'Pipeline' },
        ].map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="pf-shell" style={{ display: 'flex', minHeight: '100vh' }}>
        <div className={`pf-sidebar ${mobileOpen ? 'open' : ''}`}>
          {sidebar}
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
      </div>
    </>
  );
}
