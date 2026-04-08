import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
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

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Save search to recent when performed
  const addToRecent = useCallback((query) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== query);
      const updated = [query, ...filtered].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Global search when query is 2+ chars
  const searchAll = useCallback(async (query) => {
    if (query.length < 2) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data);
      addToRecent(query);
    } catch {
      setSearchResults({ leads: [], opportunities: [], primes: [] });
    } finally {
      setSearching(false);
    }
  }, [addToRecent]);

  // Helper function to highlight matching text
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <span key={i} style={{ background: 'var(--warning)', color: 'white', borderRadius: 2, padding: '0 2px', fontWeight: 600 }}>{part}</span>
        : part
    );
  };

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
  if (searchResults?.leads?.length > 0) {
    searchResults.leads.forEach(lead => {
      flatList.push({ label: lead.full_name || lead.email, sub: `${lead.company || ''} · ${lead.list_name || ''}`, path: `/lists/${lead.list_id}`, icon: '👤', _cat: 'Leads', _lead: lead });
    });
  }
  if (searchResults?.opportunities?.length > 0) {
    searchResults.opportunities.forEach(opp => {
      flatList.push({ label: opp.title, sub: `${opp.agency || ''} · ${opp.set_aside || ''}`, path: '/opportunities', icon: '🔍', _cat: 'Opportunities', _opp: opp });
    });
  }
  if (searchResults?.primes?.length > 0) {
    searchResults.primes.forEach(prime => {
      flatList.push({ label: prime.company_name, sub: `${prime.contact_name || ''} · ${prime.agency_focus || ''}`, path: '/primes', icon: '🏢', _cat: 'Primes', _prime: prime });
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
    if (search.length >= 2) {
      searchTimeout.current = setTimeout(() => searchAll(search), 300);
    } else {
      setSearchResults(null);
    }
  }, [search, searchAll]);

  // Show recent searches when opening palette with empty query
  useEffect(() => {
    if (isOpen && search === '') {
      setSearchResults(null);
    }
  }, [isOpen, search]);

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
          <input ref={inputRef} type="text" placeholder="Search leads, opportunities, primes, or navigate..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
          <kbd style={{ padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>ESC</kbd>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {/* Show commands when no search is active */}
          {!searchResults && search === '' && (
            <>
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

              {/* Show recent searches when palette opens empty */}
              {recentSearches.length > 0 && (
                <div>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Searches</div>
                  {recentSearches.map(q => {
                    idx++;
                    const i = idx;
                    return (
                      <button key={`recent-${q}`} onClick={() => { setSearch(q); setSelectedIndex(0); }}
                        onMouseEnter={() => setSelectedIndex(i)}
                        style={{
                          width: '100%', padding: '10px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                          fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                          background: i === selectedIndex ? 'var(--accent-bg)' : 'transparent',
                          color: i === selectedIndex ? 'var(--accent2)' : 'var(--text)',
                          transition: 'background 0.1s',
                        }}>
                        <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>🕐</span>
                        <span>{q}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Show filtered commands when typing a query */}
          {search !== '' && !searchResults && Object.entries(grouped).length > 0 && (
            <>
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
                        <span>{highlightMatch(cmd.label, search)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Global search results */}
          {searching && (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⏳</span>
              Searching...
            </div>
          )}
          {searchResults && ['leads', 'opportunities', 'primes'].map(type => {
            const items = searchResults[type] || [];
            const config = {
              leads: { label: 'Leads', icon: '👤', getLabel: i => i.full_name || i.email, getSub: i => [i.company, i.title, i.list_name].filter(Boolean).join(' · '), getPath: i => `/lists/${i.list_id}`, getScore: i => i.icp_score },
              opportunities: { label: 'Opportunities', icon: '🔍', getLabel: i => i.title, getSub: i => [i.agency, i.set_aside].filter(Boolean).join(' · '), getPath: () => '/opportunities', getScore: i => i.fit_score },
              primes: { label: 'Primes', icon: '🏢', getLabel: i => i.company_name, getSub: i => [i.contact_name, i.agency_focus].filter(Boolean).join(' · '), getPath: () => '/primes', getScore: i => i.fit_score },
            }[type];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {config.label}
                  <span style={{ fontSize: 9, background: 'var(--accent-bg)', color: 'var(--accent2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{items.length}</span>
                </div>
                {items.map(item => {
                  idx++;
                  const i = idx;
                  const score = config.getScore(item);
                  return (
                    <button key={`${type}-${item.id}`} onClick={() => handleSelect({ path: config.getPath(item) })}
                      onMouseEnter={() => setSelectedIndex(i)}
                      style={{
                        width: '100%', padding: '10px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                        fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                        background: i === selectedIndex ? 'var(--accent-bg)' : 'transparent',
                        color: i === selectedIndex ? 'var(--accent2)' : 'var(--text)',
                        transition: 'background 0.1s',
                      }}>
                      <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>{config.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{highlightMatch(config.getLabel(item), search)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.getSub(item)}</div>
                      </div>
                      {score != null && (
                        <span style={{
                          padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                          background: score >= 70 ? 'var(--success-bg)' : score >= 40 ? 'var(--warning-bg)' : 'var(--bg3)',
                          color: score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--text3)',
                        }}>{score}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {searchResults && !searching && search.length >= 2 &&
            (searchResults.leads?.length || 0) + (searchResults.opportunities?.length || 0) + (searchResults.primes?.length || 0) === 0 &&
            filteredCommands.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              No results for "{search}"
            </div>
          )}

          {search === '' && recentSearches.length === 0 && flatList.length === 0 && !searchResults && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              No commands found
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Type 2+ chars to search everything</span>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
