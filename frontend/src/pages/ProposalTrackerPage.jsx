import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const initials = (name) => {
  const str = typeof name === 'object' && name !== null ? (name.name || name.full_name || '?') : String(name || '?');
  return str.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

const daysUntil = (date) => {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / 86400000);
  if (days < 0) return { text: 'OVERDUE', color: 'var(--danger)' };
  if (days === 0) return { text: 'Today', color: 'var(--warning)' };
  return { text: `${days} days left`, color: days <= 7 ? 'var(--warning)' : 'var(--text2)' };
};

const getStatusColor = (status) => {
  const colors = {
    drafting: { bg: '#3b82f6', text: '#FFFFFF' },      // blue
    review: { bg: '#eab308', text: '#000000' },         // yellow
    submitted: { bg: '#06b6d4', text: '#FFFFFF' },     // teal
    awarded: { bg: '#22c55e', text: '#FFFFFF' },       // green
    rejected: { bg: '#ef4444', text: '#FFFFFF' },      // red
  };
  return colors[status] || { bg: 'var(--bg3)', text: 'var(--text2)' };
};

// New Proposal Modal
const NewProposalModal = ({ visible, onClose, onSave, opportunities, loading }) => {
  const [form, setForm] = useState({
    title: '',
    opportunity_id: '',
    deadline: '',
    estimated_value: '',
    sections: [
      { name: 'Technical Approach', assignee: '' },
      { name: 'Management Plan', assignee: '' },
      { name: 'Past Performance', assignee: '' },
      { name: 'Pricing', assignee: '' },
      { name: 'Compliance Matrix', assignee: '' },
    ],
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      alert('Please enter a proposal title');
      return;
    }
    onSave({
      title: form.title,
      opportunity_id: form.opportunity_id ? parseInt(form.opportunity_id) : null,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : 0,
      sections: form.sections,
      team_members: [],
      status: 'drafting',
    });
    setForm({
      title: '',
      opportunity_id: '',
      deadline: '',
      estimated_value: '',
      sections: [
        { name: 'Technical Approach', assignee: '' },
        { name: 'Management Plan', assignee: '' },
        { name: 'Past Performance', assignee: '' },
        { name: 'Pricing', assignee: '' },
        { name: 'Compliance Matrix', assignee: '' },
      ],
    });
  };

  const handleSectionChange = (idx, field, value) => {
    const newSections = [...form.sections];
    newSections[idx] = { ...newSections[idx], [field]: value };
    setForm({ ...form, sections: newSections });
  };

  if (!visible) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 999,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '2rem', zIndex: 1000,
        maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text)' }}>
          Create New Proposal
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Proposal Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'var(--text)', fontSize: 14,
            }}
            placeholder="e.g., FY2026 GSA Schedule Refresh"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Linked Opportunity
            </label>
            <select
              value={form.opportunity_id}
              onChange={e => setForm({ ...form, opportunity_id: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 14,
              }}
            >
              <option value="">None</option>
              {opportunities.map(opp => (
                <option key={opp.id} value={opp.id}>
                  {opp.title.substring(0, 40)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Deadline
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: 14,
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Estimated Value
          </label>
          <input
            type="number"
            value={form.estimated_value}
            onChange={e => setForm({ ...form, estimated_value: e.target.value })}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'var(--text)', fontSize: 14,
            }}
            placeholder="0"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Proposal Sections
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.sections.map((section, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  type="text"
                  value={section.name}
                  onChange={e => handleSectionChange(idx, 'name', e.target.value)}
                  placeholder="Section name"
                  style={{
                    padding: '8px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg2)',
                    color: 'var(--text)', fontSize: 13,
                  }}
                />
                <input
                  type="text"
                  value={section.assignee}
                  onChange={e => handleSectionChange(idx, 'assignee', e.target.value)}
                  placeholder="Assignee"
                  style={{
                    padding: '8px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg2)',
                    color: 'var(--text)', fontSize: 13,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text2)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--accent)',
              color: '#FFFFFF', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Creating...' : 'Create Proposal'}
          </button>
        </div>
      </div>
    </>
  );
};

// Proposal Card Component
const ProposalCard = ({ proposal, opportunities, onEdit, onExpand, expanded }) => {
  const opp = opportunities.find(o => o.id === proposal.opportunity_id);
  const countdown = daysUntil(proposal.deadline);
  const status = proposal.status || 'drafting';
  const colors = getStatusColor(status);

  const completedSections = (proposal.sections || []).filter(s => s.status === 'complete').length;
  const totalSections = (proposal.sections || []).length;
  const progressPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;

  return (
    <div
      onClick={() => onExpand(proposal.id)}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '1.5rem',
        cursor: 'pointer', transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,184,166,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
            {proposal.title}
          </h3>
          {opp && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Linked to: {opp.title}
            </div>
          )}
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 600,
          background: colors.bg, color: colors.text,
          whiteSpace: 'nowrap', marginLeft: 12,
        }}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {countdown && (
        <div style={{ fontSize: 12, color: countdown.color, fontWeight: 500, marginBottom: 12 }}>
          Deadline: {countdown.text}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>
            Progress
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
            {completedSections} / {totalSections} sections
          </span>
        </div>
        <div style={{
          height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: 'var(--accent)',
            width: `${progressPct}%`, transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {proposal.team_members && proposal.team_members.length > 0 && (
        <div style={{ display: 'flex', gap: -8, marginBottom: 12 }}>
          {proposal.team_members.slice(0, 5).map((member, i) => {
            const memberName = typeof member === 'object' && member !== null ? (member.name || member.full_name || '?') : String(member || '?');
            return (
              <div
                key={i}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--accent-bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--accent2)',
                  border: '2px solid var(--bg2)', marginLeft: i > 0 ? -8 : 0,
                  zIndex: 5 - i, title: memberName,
                }}
              >
                {initials(member)}
              </div>
            );
          })}
          {proposal.team_members.length > 5 && (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--bg3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: 'var(--text3)',
              border: '2px solid var(--bg2)', marginLeft: -8,
            }}>
              +{proposal.team_members.length - 5}
            </div>
          )}
        </div>
      )}

      {proposal.estimated_value > 0 && (
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--accent2)',
          paddingTop: 12, borderTop: '1px solid var(--border)',
        }}>
          ${(proposal.estimated_value / 1000000).toFixed(1)}M
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
            Sections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(proposal.sections || []).map((section, idx) => (
              <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={section.status === 'complete'}
                  onChange={(e) => {
                    const newSections = [...(proposal.sections || [])];
                    newSections[idx] = {
                      ...section,
                      status: e.target.checked ? 'complete' : 'in_progress',
                    };
                    onEdit(proposal.id, { sections: newSections });
                  }}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {section.name}
                  </div>
                  {section.assignee && (
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      Assigned to: {section.assignee}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {proposal.notes && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Notes
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)' }}>
                {proposal.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ProposalTrackerPage() {
  const { addToast } = useToast();
  const [proposals, setProposals] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [pRes, oRes] = await Promise.all([
        api.get('/proposals'),
        api.get('/opportunities'),
      ]);
      setProposals(pRes.data.proposals || []);
      setOpportunities(oRes.data.opportunities || []);
    } catch (err) {
      addToast('Failed to load proposals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateProposal = async (data) => {
    try {
      const res = await api.post('/proposals', data);
      setProposals([...proposals, res.data]);
      setModalOpen(false);
      addToast('Proposal created', 'success');
    } catch (err) {
      addToast('Failed to create proposal', 'error');
    }
  };

  const handleEditProposal = async (id, updates) => {
    try {
      const res = await api.put(`/proposals/${id}`, updates);
      setProposals(proposals.map(p => p.id === id ? res.data : p));
      addToast('Proposal updated', 'success');
    } catch (err) {
      addToast('Failed to update proposal', 'error');
    }
  };

  const stats = {
    active: proposals.filter(p => ['drafting', 'review'].includes(p.status)).length,
    underReview: proposals.filter(p => p.status === 'review').length,
    submitted: proposals.filter(p => p.status === 'submitted').length,
    awarded: proposals.filter(p => p.status === 'awarded').length,
    totalValue: proposals.reduce((sum, p) => sum + (p.estimated_value || 0), 0),
  };

  const winRate = proposals.length > 0
    ? Math.round((stats.awarded / proposals.length) * 100)
    : 0;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
              Proposal Tracker
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
              Manage and track all your active proposals
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--accent)',
              color: '#FFFFFF', cursor: 'pointer', fontSize: 14,
              fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            + New Proposal
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14,
          marginBottom: '2rem',
        }}>
          {[
            { label: 'Active Proposals', value: stats.active, color: 'var(--accent2)' },
            { label: 'Under Review', value: stats.underReview, color: 'var(--warning)' },
            { label: 'Submitted', value: stats.submitted, color: 'var(--accent)' },
            { label: 'Awarded', value: stats.awarded, color: 'var(--success)' },
            { label: 'Win Rate', value: `${winRate}%`, color: 'var(--accent2)' },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 28, fontWeight: 700, color: stat.color,
                marginBottom: 8,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Proposals Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
            Loading proposals...
          </div>
        ) : proposals.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem',
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 12 }}>
              No proposals yet
            </div>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: '1px solid var(--accent)', background: 'transparent',
                color: 'var(--accent2)', cursor: 'pointer', fontSize: 14,
                fontWeight: 600,
              }}
            >
              Create your first proposal
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: 20,
          }}>
            {proposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                opportunities={opportunities}
                onEdit={handleEditProposal}
                onExpand={(id) => setExpandedProposal(expandedProposal === id ? null : id)}
                expanded={expandedProposal === proposal.id}
              />
            ))}
          </div>
        )}
      </div>

      <NewProposalModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateProposal}
        opportunities={opportunities}
        loading={false}
      />
    </Layout>
  );
}
