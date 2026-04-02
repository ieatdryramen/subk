import { useState } from 'react';
import UsageBanner from './UsageBanner';
import TouchBanner from './TouchBanner';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/reminders', label: "Today's Touches", icon: '🎯' },
  { to: '/profile', label: 'Profile', icon: '◈' },
  { to: '/lists', label: 'Lead Lists', icon: '◉' },
  { to: '/pipeline', label: 'Pipeline', icon: '▤' },
  { to: '/templates', label: 'Templates', icon: '◧' },
  { to: '/cardscan', label: 'Card Scanner', icon: '📇' },
  { to: '/team', label: 'Integrations', icon: '◎' },
  { to: '/billing', label: 'Billing', icon: '◇' },
  { to: '/admin', label: 'Team Dashboard', icon: '◫', adminOnly: true },
  { to: '/activity', label: 'Activity Board', icon: '📊', adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebar = (
    <aside style={{
      width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '1.25rem 1.25rem 1rem', fontFamily: 'Syne', fontSize: 18, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          ProspectForge
          <span style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: 400, color: 'var(--text3)', display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Sales Intelligence</span>
        </div>
        <button onClick={() => setMobileOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer', padding: 0 }} className="mobile-close">✕</button>
      </div>
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 'var(--radius)', color: isActive ? 'var(--accent2)' : 'var(--text2)',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
            })}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <TouchBanner />
      <UsageBanner />
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{user?.role || 'member'}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        <button onClick={handleLogout} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13, borderRadius: 'var(--radius)' }}>Sign out</button>
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
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="pf-mobile-bar" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700 }}>ProspectForge</span>
        <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>☰ Menu</button>
      </div>

      <div className="pf-shell" style={{ display: 'flex', minHeight: '100vh' }}>
        <div className={`pf-sidebar ${mobileOpen ? 'open' : ''}`}>
          {sidebar}
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
      </div>
    </>
  );
}

