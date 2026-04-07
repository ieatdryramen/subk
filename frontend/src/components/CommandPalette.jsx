import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentLeads, setRecentLeads] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const searchTimeout = useRef(null);

  const navCommands = [
    { label: 'Dashboard', path: '/dashboard', icon: '▦', category: 'Navigate' },
    { label: 'Opportunities', path: '/opportunities', icon: '🔍', category: 'Navigate' },
    { label: 'Pipeline', path: '/pipeline', icon: '▤', category: 'Navigate' },
    { label: 'Marketplace', path: '/marketplace', icon: '🏪', category: 'Navigate' },
    { label: 'Teaming Inbox', path: '/teaming', icon: '🤝', category: 'Navigate' },
    { label: 'Prime Tracker', path: '/primes', icon: '🏢', category: 'Navigate' },
    { label: "Today's Touches", path: '/reminders', icon: '🎯', category: 'Navigate' },
    { label: 'Lead Lists', path: '/lists', icon: '◉', category: 'Navigate' },
    { label: 'Templates', path: '/templates', icon: '◧', category: 'Navigate' },
    { label: 'Company Profile', path: '/profile', icon: '◈', category: 'Settings' },
    { label: 'Sub Profile', path: '/sub-profile', icon: '📋', category: 'Settings' },
    { label: 'AI Coach', path: '/coach', icon: '🤖', category: 'Settings' },
    { label: 'Team & Integrations', path: '/team', icon: '◎', category: 'Settings' },
    { label: 'Billing', path: '/billing', icon: '◇', category: 'Settings' },
    { label: 'Card Scanner', path: '/cardscan', icon: '📇', category: 'Settings' },
    { label: 'Activity Board', path: '/activity', icon: '📊', category: 'Settings' },
  ];

  const actionCommands = [
    { label: 'Create new lead list', action: () => navigate('/lists'), icon: '+', category: 'Actions' },
    { label: 'Search opportunities on SAM.gov', action: () => navigate('/opportunities'), icon: '🔍', category: 'Actions' },
    { label: 'Open AI Coach', action: () => navigate('/coach'), icon: '🤖', category: 'Actions' },
    { label: 'View today\'s touches', action: () => navigate('/reminders'), icon: '🎯', category: 'Actions' },
  ];

  const allCommands = [...navCommands, ...actionCommands];

  // Search leads when query is 3+ chars
  const searchLeads = useCallback(async (query) => {
    if (query.length < 3) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/lists');
      const lists = Array.isArray(data) ? data : [];
      const allLeads = [];
      for (const list of lists.slice(0, 5)) {
        try {
          const r = await api.get(`/lists/${list.id}/leads`);
          const leads = Array.isArray(r.data) ? r.data : r.data.leads || [];
          allLeads.push(...leads.map(l => ({ ...l, listName: list.name, listId: list.id })));
        } catch {}
      }
      const q = query.toLowerCase();
      const matches = allLeads.filter(l =>
        (l.full_name || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      ).slice(0, 5);
      setSearchResults(matches);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const filteredCommands = allCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered commands by category
  const grouped = {};
  filteredCommands.forEach(cmd => {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  });

  // Flat list for keyboard navigation
  const flatList = [];
  Object.entries(grouped).forEach(([cat, cmds]) => {
    cmds.forEach(cmd => flatList.push({ ...cmd, _cat: cat }));
  });
  if (searchResults?.length > 0) {
    searchResults.forEach(lead => {
      flatList.push({ label: lead.full_name || lead.email, sub: `${lead.company || ''} · ${lead.listName}`, path: `/lists/${lead.listId}`, icon: '👤', _cat: 'Leads', _isLead: true });
    });
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
        setSelectedIndex(0);
        setSearchResults(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { setIsOpen(false); setSearch(''); setSelectedIndex(0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, flatList.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) handleSelect(flatList[selectedIndex]);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, flatList]);

  useEffect(() => {
    setSelectedIndex(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (search.length >= 3) {
      searchTimeout.current = setTimeout(() => searchLeads(search), 300);
    } else {
      setSearchResults(null);
    }
  }, [search, searchLeads]);

  const handleSelect = (command) => {
    if (command.action) command.action();
    else if (command.path) navigate(command.path);
    setIsOpen(false);
    setSearch('');
    setSelectedIndex(0);
    setSearchResults(null);
  };

  if (!isOpen) return null;

  let idx = -1;

  return (
    <>
      <div onClick={() => setIsOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 999 }} />

      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
        width: '90%', maxWidth: 560, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text3)', fontSize: 14 }}>⌘</span>
          <input ref={inputRef} type="text" placeholder="Type a command or search leads..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
          <kbd style={{ padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>ESC</kbd>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{category}</div>
              {cmds.map(cmd => {
                idx++;
                const i = idx;
                return (
                  <button key={cmd.path || cmd.label} onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      width: '100%', padding: '10px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                      fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                      background: i === selectedIndex ? 'var(--accent-bg)' : 'transparent',
                      color: i === selectedIndex ? 'var(--accent2)' : 'var(--text)',
                      transition: 'background 0.1s',
                    }}>
                    <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>{cmd.icon}</span>
                    <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Lead search results */}
          {searching && (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              Searching leads...
            </div>
          )}
          {searchResults && searchResults.length > 0 && (
            <div>
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leads</div>
              {searchResults.map((lead, li) => {
                idx++;
                const i = idx;
                return (
                  <button key={lead.id} onClick={() => handleSelect({ path: `/lists/${lead.listId}` })}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      width: '100%', padding: '10px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                      fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                      background: i === selectedIndex ? 'var(--accent-bg)' : 'transparent',
                      color: i === selectedIndex ? 'var(--accent2)' : 'var(--text)',
                      transition: 'background 0.1s',
                    }}>
                    <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>👤</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.full_name || lead.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[lead.company, lead.title, lead.listName].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {lead.icp_score != null && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: lead.icp_score >= 70 ? 'var(--success-bg)' : lead.icp_score >= 40 ? 'var(--warning-bg)' : 'var(--bg3)',
                        color: lead.icp_score >= 70 ? 'var(--success)' : lead.icp_score >= 40 ? 'var(--warning)' : 'var(--text3)',
                      }}>{lead.icp_score}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {searchResults && searchResults.length === 0 && !searching && search.length >= 3 && (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              No leads found for "{search}"
            </div>
          )}

          {flatList.length === 0 && !searchResults && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              No commands found
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Type 3+ chars to search leads</span>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
