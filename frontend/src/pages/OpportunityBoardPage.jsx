import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const OpportunityBoardPage = () => {
  const { addToast } = useToast();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
  const [draggedCard, setDraggedCard] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);

  // Fetch opportunities
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        const res = await api.get('/opportunities', { params: { limit: 500 } });
        setOpportunities(res.data.opportunities || []);
      } catch (err) {
        console.error('Error fetching opportunities:', err);
        addToast('Failed to load opportunities', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, [addToast]);

  // Status -> Column mapping
  const statusColumns = {
    'new': 'Identified',
    'pursuing': 'Pursuing',
    'submitted': 'Proposal',
    'won': 'Won',
    'lost': 'Lost',
  };

  const statuses = ['new', 'pursuing', 'submitted', 'won', 'lost'];
  const allStatuses = new Set(opportunities.map(o => o.status || 'new'));

  // Filter opportunities by search query
  const filteredOpps = opportunities.filter(opp =>
    opp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opp.agency?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group opportunities by status
  const oppsByStatus = {};
  statuses.forEach(s => { oppsByStatus[s] = []; });
  filteredOpps.forEach(opp => {
    const status = opp.status || 'new';
    if (oppsByStatus[status]) {
      oppsByStatus[status].push(opp);
    } else {
      oppsByStatus[status] = [opp];
    }
  });

  // Calculate metrics
  const totalValue = filteredOpps.reduce((sum, o) => sum + (o.est_value || 0), 0);
  const avgDaysInStage = (() => {
    if (filteredOpps.length === 0) return 0;
    const now = new Date();
    const totalDays = filteredOpps.reduce((sum, o) => {
      const createdDate = new Date(o.created_at);
      const days = Math.floor((now - createdDate) / 86400000);
      return sum + days;
    }, 0);
    return Math.round(totalDays / filteredOpps.length);
  })();
  const winRate = (() => {
    const totalOpp = opportunities.filter(o => o.status === 'won' || o.status === 'lost');
    if (totalOpp.length === 0) return 0;
    const wonCount = opportunities.filter(o => o.status === 'won').length;
    return Math.round((wonCount / totalOpp.length) * 100);
  })();

  // Drag and drop handlers
  const handleDragStart = (e, opp) => {
    setDraggedCard(opp);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!draggedCard) return;

    try {
      const newStatus = targetStatus === 'new' ? 'new' : targetStatus;
      const res = await api.put(`/opportunities/${draggedCard.id}`, {
        status: newStatus,
      });

      // Update local state
      setOpportunities(opps =>
        opps.map(o =>
          o.id === draggedCard.id ? { ...o, status: newStatus } : o
        )
      );

      addToast(`Opportunity moved to ${statusColumns[newStatus]}`, 'success');
    } catch (err) {
      console.error('Error updating opportunity:', err);
      addToast('Failed to update opportunity', 'error');
    } finally {
      setDraggedCard(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text2)' }}>
          Loading opportunity board...
        </div>
      </Layout>
    );
  }

  if (viewMode === 'list') {
    const formatValue = (v) => v ? `$${(v / 1000).toFixed(0)}K` : '—';
    const statusBadge = (s) => {
      const colors = { new: 'var(--text3)', pursuing: 'var(--accent2)', submitted: 'var(--warning)', won: 'var(--success)', lost: 'var(--danger)' };
      const bgs = { new: 'var(--bg3)', pursuing: 'var(--accent-bg)', submitted: 'var(--warning-bg)', won: 'var(--success-bg)', lost: 'var(--danger-bg)' };
      return { color: colors[s] || 'var(--text3)', background: bgs[s] || 'var(--bg3)' };
    };
    return (
      <Layout>
        <div style={{ padding: '2rem', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Opportunities — List View</h1>
            <button onClick={() => setViewMode('board')} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              📋 Board View
            </button>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search opportunities..." style={{ padding: '9px 14px', width: 300, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
          </div>
          {filteredOpps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>No opportunities found</div>
          ) : (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Agency', 'Status', 'Est. Value', 'Fit Score', 'Type', 'Created'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOpps.map(opp => {
                    const badge = statusBadge(opp.status);
                    return (
                      <tr key={opp.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedOpp(opp)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{opp.title || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{opp.agency || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, ...badge }}>{statusColumns[opp.status] || opp.status}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{formatValue(opp.est_value || opp.value_max)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {opp.fit_score != null ? <span style={{ fontWeight: 600, color: opp.fit_score >= 70 ? 'var(--success)' : opp.fit_score >= 40 ? 'var(--warning)' : 'var(--text3)' }}>{opp.fit_score}</span> : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{opp.type || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', paddingTop: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Opportunity Board</h1>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                background: 'var(--bg2)',
                color: 'var(--text2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              📄 List View
            </button>
          </div>

          {/* Metrics Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: '1.5rem',
          }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Total Opportunities
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                {filteredOpps.length}
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Total Value
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                ${(totalValue / 1000000).toFixed(1)}M
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Avg Days in Stage
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {avgDaysInStage}
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Win Rate
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: winRate > 50 ? 'var(--success)' : 'var(--warning)' }}>
                {winRate}%
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search by title or agency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Kanban Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {statuses.map(status => {
            const statusLabel = statusColumns[status];
            const oppList = oppsByStatus[status] || [];
            const columnValue = oppList.reduce((sum, o) => sum + (o.est_value || 0), 0);

            return (
              <div
                key={status}
                style={{
                  background: 'var(--bg2)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 600,
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg3)',
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px 0' }}>
                    {statusLabel}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{oppList.length} opp{oppList.length !== 1 ? 's' : ''}</span>
                    <span>${(columnValue / 1000000).toFixed(1)}M</span>
                  </div>
                </div>

                {/* Droppable Area */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    border: draggedCard ? '2px dashed var(--accent)' : 'none',
                    transition: 'border 0.2s',
                  }}
                >
                  {oppList.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 200,
                      color: 'var(--text3)',
                      fontSize: 13,
                    }}>
                      No opportunities
                    </div>
                  ) : (
                    oppList.map(opp => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        onDragStart={handleDragStart}
                        isDragging={draggedCard?.id === opp.id}
                        onClick={() => setSelectedOpp(opp)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Slide-out Panel */}
      {selectedOpp && (
        <>
          <div
            onClick={() => setSelectedOpp(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.4)', zIndex: 998,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px, 90vw)',
            background: 'var(--bg)', borderLeft: '1px solid var(--border)',
            boxShadow: '-8px 0 30px rgba(0,0,0,0.2)', zIndex: 999,
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '1.5rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: selectedOpp.status === 'won' ? 'var(--success)' : selectedOpp.status === 'lost' ? 'var(--danger)' : 'var(--accent)',
                  marginBottom: 8,
                }}>
                  {statusColumns[selectedOpp.status] || selectedOpp.status}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>
                  {selectedOpp.title || 'Untitled Opportunity'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOpp(null)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 22, color: 'var(--text3)', padding: '0 0 0 12px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Key Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Agency</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedOpp.agency || '—'}</div>
                  {selectedOpp.sub_agency && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{selectedOpp.sub_agency}</div>
                  )}
                </div>
                <div style={{ background: 'var(--bg2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Fit Score</div>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    color: selectedOpp.fit_score >= 70 ? 'var(--success)' : selectedOpp.fit_score >= 50 ? 'var(--warning)' : 'var(--text3)',
                  }}>
                    {selectedOpp.fit_score ? Math.round(selectedOpp.fit_score) : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Deadline</div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: (() => {
                      if (!selectedOpp.response_deadline) return 'var(--text3)';
                      const d = Math.ceil((new Date(selectedOpp.response_deadline) - new Date()) / 86400000);
                      return d < 7 ? 'var(--danger)' : d < 30 ? 'var(--warning)' : 'var(--text)';
                    })(),
                  }}>
                    {selectedOpp.response_deadline
                      ? new Date(selectedOpp.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </div>
                  {selectedOpp.response_deadline && (() => {
                    const d = Math.ceil((new Date(selectedOpp.response_deadline) - new Date()) / 86400000);
                    return d >= 0
                      ? <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{d} days remaining</div>
                      : <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>Expired</div>;
                  })()}
                </div>
                <div style={{ background: 'var(--bg2)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Est. Value</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                    {selectedOpp.est_value ? `$${(selectedOpp.est_value / 1000000).toFixed(1)}M` : '—'}
                  </div>
                </div>
              </div>

              {/* Details */}
              {(selectedOpp.naics_code || selectedOpp.set_aside) && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedOpp.naics_code && (
                    <span style={{
                      padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                    }}>
                      NAICS: {selectedOpp.naics_code}
                    </span>
                  )}
                  {selectedOpp.set_aside && (
                    <span style={{
                      padding: '4px 10px', background: 'var(--accent)22', border: '1px solid var(--accent)44',
                      borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    }}>
                      {selectedOpp.set_aside}
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedOpp.description && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Description
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
                    background: 'var(--bg2)', padding: '1rem', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedOpp.description.length > 1500
                      ? selectedOpp.description.substring(0, 1500) + '...'
                      : selectedOpp.description}
                  </div>
                </div>
              )}

              {/* SAM.gov Link */}
              {selectedOpp.sam_notice_id && (
                <a
                  href={`https://sam.gov/opp/${selectedOpp.sam_notice_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', color: 'var(--accent)', fontSize: 13,
                    fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  View on SAM.gov ↗
                </a>
              )}

              {/* Posted Date */}
              {selectedOpp.posted_date && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  Posted: {new Date(selectedOpp.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

const OpportunityCard = ({ opp, onDragStart, isDragging, onClick }) => {
  const [didDrag, setDidDrag] = useState(false);

  const daysUntilDeadline = opp.response_deadline
    ? Math.ceil((new Date(opp.response_deadline) - new Date()) / 86400000)
    : null;

  let deadlineColor = 'var(--text3)';
  if (daysUntilDeadline !== null) {
    if (daysUntilDeadline < 7) deadlineColor = 'var(--danger)';
    else if (daysUntilDeadline < 30) deadlineColor = 'var(--warning)';
  }

  const fitScoreColor = opp.fit_score
    ? opp.fit_score >= 70
      ? 'var(--success)'
      : opp.fit_score >= 50
      ? 'var(--warning)'
      : 'var(--text3)'
    : 'var(--text3)';

  // Truncate title to 2 lines
  const truncatedTitle = opp.title ? opp.title.substring(0, 60) : 'Untitled';

  return (
    <div
      draggable
      onDragStart={(e) => { setDidDrag(true); onDragStart(e, opp); }}
      onDragEnd={() => setDidDrag(false)}
      onMouseDown={() => setDidDrag(false)}
      onClick={() => { if (!didDrag && onClick) onClick(); }}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px',
        cursor: 'pointer',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 8,
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {truncatedTitle}
      </div>

      {/* Agency */}
      <div style={{
        fontSize: 11,
        color: 'var(--text2)',
        marginBottom: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {opp.agency || 'Unknown Agency'}
      </div>

      {/* Deadline */}
      {opp.response_deadline && (
        <div style={{
          fontSize: 11,
          color: deadlineColor,
          marginBottom: 8,
          fontWeight: 500,
        }}>
          Due: {new Date(opp.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
            <span style={{ color: 'var(--text3)' }}> ({daysUntilDeadline}d)</span>
          )}
        </div>
      )}

      {/* Value */}
      {opp.est_value && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          marginBottom: 8,
        }}>
          ${(opp.est_value / 1000000).toFixed(1)}M
        </div>
      )}

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opp.fit_score && (
          <span style={{
            padding: '2px 8px',
            background: `${fitScoreColor}22`,
            color: fitScoreColor,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}>
            Score: {Math.round(opp.fit_score)}
          </span>
        )}
        {opp.set_aside && (
          <span style={{
            padding: '2px 8px',
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {opp.set_aside.substring(0, 10)}
          </span>
        )}
      </div>
    </div>
  );
};

export default OpportunityBoardPage;
