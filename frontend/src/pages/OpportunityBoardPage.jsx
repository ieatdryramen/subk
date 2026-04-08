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
    return (
      <Layout>
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Opportunities</h1>
            <button
              onClick={() => setViewMode('board')}
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              📋 Board View
            </button>
          </div>
          <p style={{ color: 'var(--text2)' }}>Switch back to board view for kanban-style filtering.</p>
          <a href="/opportunities" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Go to full opportunities list
          </a>
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

const OpportunityCard = ({ opp, onDragStart, isDragging }) => {
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
      onDragStart={(e) => onDragStart(e, opp)}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
        active: { cursor: 'grabbing' },
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
