import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import Layout from '../components/Layout';

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 1100 },
  heading: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { color: 'var(--text2)', fontSize: 14, marginBottom: '2rem' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: '2.5rem' },
  stat: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
  statNum: { fontSize: 32, fontWeight: 600, fontFamily: 'Syne', marginBottom: 2 },
  statLabel: { fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  section: { marginBottom: '2rem' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  sectionTitle: { fontSize: 16, fontWeight: 600 },
  newBtn: { padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13 },
  listGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  listCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' },
  listName: { fontSize: 15, fontWeight: 500, marginBottom: 2 },
  listMeta: { fontSize: 12, color: 'var(--text2)' },
  listRight: { display: 'flex', gap: 10, alignItems: 'center' },
  badge: (c) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: c==='done'?'var(--success-bg)':c==='generating'?'var(--warning-bg)':'var(--bg3)', color: c==='done'?'var(--success)':c==='generating'?'var(--warning)':'var(--text2)' }),
  openBtn: { padding: '7px 14px', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 13, borderRadius: 'var(--radius)' },
  empty: { textAlign: 'center', padding: '3rem', color: 'var(--text2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [stats, setStats] = useState({ lists: 0, leads: 0, playbooks: 0 });

  useEffect(() => {
    api.get('/lists').then(r => {
      setLists(r.data);
      const totalLeads = r.data.reduce((a, l) => a + parseInt(l.lead_count || 0), 0);
      setStats({ lists: r.data.length, leads: totalLeads, playbooks: 0 });
    }).catch(console.error);
  }, []);

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.heading}>Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}</div>
        <div style={s.sub}>Your sales intelligence command center</div>

        <div style={s.stats}>
          <div style={s.stat}><div style={s.statNum}>{stats.lists}</div><div style={s.statLabel}>Lead Lists</div></div>
          <div style={s.stat}><div style={s.statNum}>{stats.leads}</div><div style={s.statLabel}>Total Leads</div></div>
          <div style={s.stat}><div style={s.statNum}>{stats.playbooks}</div><div style={s.statLabel}>Playbooks Generated</div></div>
        </div>

        <div style={s.section}>
          <div style={s.sectionHead}>
            <div style={s.sectionTitle}>Lead Lists</div>
            <button style={s.newBtn} onClick={() => navigate('/lists')}>+ New List</button>
          </div>
          {lists.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No lead lists yet</div>
              <div style={{ fontSize: 13 }}>Go to Lead Lists to create your first list and import prospects</div>
            </div>
          ) : (
            <div style={s.listGrid}>
              {lists.map(list => (
                <div key={list.id} style={s.listCard} onClick={() => navigate(`/lists/${list.id}`)}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <div>
                    <div style={s.listName}>{list.name}</div>
                    <div style={s.listMeta}>{list.lead_count} lead{list.lead_count !== '1' ? 's' : ''} · Created {new Date(list.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={s.listRight}>
                    <button style={s.openBtn}>Open →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
