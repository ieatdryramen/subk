import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

const TOUCH_ICONS = { email1: '✉', email2: '✉', email3: '✉', email4: '✉', call: '📞', linkedin_dm: '💬' };

const urgencyStyle = (u) => ({
  overdue: { bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger)' },
  due: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)' },
  upcoming: { bg: 'var(--bg3)', color: 'var(--text3)', border: 'var(--border)' },
}[u] || {});

export default function RemindersPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reminders/due').then(r => { setLeads(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const overdue = leads.filter(l => l.urgency === 'overdue');
  const due = leads.filter(l => l.urgency === 'due');
  const upcoming = leads.filter(l => l.urgency === 'upcoming');

  const LeadCard = ({ lead }) => {
    const style = urgencyStyle(lead.urgency);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: style.bg, border: `1px solid ${style.border}`, borderRadius: 'var(--radius)', marginBottom: 8, cursor: 'pointer' }}
        onClick={() => navigate(`/lists/${lead.list_id}`)}>
        <div style={{ fontSize: 20, flexShrink: 0 }}>{TOUCH_ICONS[lead.next_touch] || '•'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {lead.full_name || lead.company} 
            <span style={{ fontWeight: 400, color: 'var(--text2)' }}> · {lead.company}</span>
          </div>
          <div style={{ fontSize: 12, color: style.color, marginTop: 1 }}>
            {lead.next_touch_label}
            {lead.days_overdue > 0 && ` · ${lead.days_overdue}d overdue`}
          </div>
        </div>
        {lead.icp_score && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: lead.icp_score >= 70 ? 'var(--success-bg)' : 'var(--bg3)', color: lead.icp_score >= 70 ? 'var(--success)' : 'var(--text3)', flexShrink: 0 }}>
            {lead.icp_score}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>→</span>
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 800 }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Today's Touches</div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' }}>
          Leads that need attention based on your sequence timing
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>You're all caught up</div>
            <div style={{ fontSize: 13 }}>No touches due right now. Check back tomorrow.</div>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  ⚠ Overdue ({overdue.length})
                </div>
                {overdue.map(l => <LeadCard key={l.lead_id} lead={l} />)}
              </div>
            )}
            {due.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Due Today ({due.length})
                </div>
                {due.map(l => <LeadCard key={l.lead_id} lead={l} />)}
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Coming Up ({upcoming.length})
                </div>
                {upcoming.map(l => <LeadCard key={l.lead_id} lead={l} />)}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
