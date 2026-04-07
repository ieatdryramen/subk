import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const commands = [
    { label: 'Dashboard', path: '/' },
    { label: 'Opportunities', path: '/opportunities' },
    { label: 'Pipeline', path: '/pipeline' },
    { label: 'Marketplace', path: '/marketplace' },
    { label: 'Teaming Inbox', path: '/teaming' },
    { label: 'Prime Tracker', path: '/primes' },
    { label: "Today's Touches", path: '/reminders' },
    { label: 'Lead Lists', path: '/lists' },
    { label: 'Templates', path: '/templates' },
    { label: 'Company Profile', path: '/profile' },
    { label: 'AI Coach', path: '/coach' },
    { label: 'Billing', path: '/billing' },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  // Handle Cmd+K or Ctrl+K to open palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
        setSearch('');
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        setSelectedIndex(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, filteredCommands]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleSelect = (command) => {
    navigate(command.path);
    setIsOpen(false);
    setSearch('');
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="command-palette-backdrop"
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
      />

      {/* Palette container */}
      <div
        className="command-palette-container"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          width: '90%',
          maxWidth: '600px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg2)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--text)', opacity: 0.6, fontSize: '14px' }}>
            ⌘
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '16px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span
            style={{
              color: 'var(--text)',
              opacity: 0.5,
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            ESC
          </span>
        </div>

        {/* Commands list */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '8px 0',
          }}
        >
          {filteredCommands.length > 0 ? (
            filteredCommands.map((command, index) => (
              <button
                key={command.path}
                onClick={() => handleSelect(command)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor:
                    index === selectedIndex
                      ? 'var(--accent-bg)'
                      : 'transparent',
                  color:
                    index === selectedIndex ? 'var(--accent)' : 'var(--text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {command.label}
              </button>
            ))
          ) : (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: 'var(--text)',
                opacity: 0.5,
                fontSize: '14px',
              }}
            >
              No commands found
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
