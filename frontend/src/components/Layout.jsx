import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/profile', label: 'Company Profile', icon: '◈' },
  { to: '/lists', label: 'Lead Lists', icon: '◉' },
];

const s = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' },
  logo: { padding: '1.5rem 1.25rem 1rem', fontFamily: 'Syne', fontSize: 18, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' },
  logoSub: { fontSize: 10, fontFamily: 'Inter', fontWeight: 400, color: 'var(--text3)', display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' },
  nav: { flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 },
  navLink: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' },
  navLinkActive: { background: 'var(--accent-bg)', color: 'var(--accent2)' },
  footer: { padding: '1rem', borderTop: '1px solid var(--border)' },
  userLine: { fontSize: 13, color: 'var(--text2)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13, borderRadius: 'var(--radius)' },
  main: { flex: 1, overflow: 'auto' },
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          ProspectForge
          <span style={s.logoSub}>Sales Intelligence</span>
        </div>
        <nav style={s.nav}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to==='/'} style={({ isActive }) => ({ ...s.navLink, ...(isActive ? s.navLinkActive : {}) })}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={s.footer}>
          <div style={s.userLine}>{user?.email}</div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  );
}
