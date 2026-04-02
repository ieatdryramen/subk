import { useState } from 'react';
import api from '../lib/api';

const s = {
  wrap: { padding: '4px 0' },
  genBtn: { padding: '10px 20px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  card: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' },
  cardFull: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', gridColumn: '1 / -1' },
  cardTitle: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 },
  cardBody: { fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' },
  oneLiner: { background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '14px 16px', gridColumn: '1 / -1', marginBottom: 4 },
  oneLinerText: { fontSize: 15, fontWeight: 500, color: 'var(--accent2)', fontStyle: 'italic' },
  loading: { color: 'var(--text2)', fontSize: 13, padding: '1rem 0' },
};

export default function Battlecard({ leadId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/battlecard/generate/${leadId}`);
      setData(r.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate battlecard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={s.loading}>⚔️ Building battlecard...</div>;

  if (!data) return (
    <div style={s.wrap}>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
        Generate a competitive battlecard for this prospect — likely incumbent, their weaknesses, your strengths, landmine questions, and proof points.
      </p>
      <button style={s.genBtn} onClick={generate}>⚔️ Generate battlecard</button>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.grid}>
        <div style={s.oneLiner}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Your positioning</div>
          <div style={s.oneLinerText}>"{data.one_liner}"</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>Likely incumbent</div>
          <div style={s.cardBody}>{data.likely_incumbent}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>Incumbent weaknesses</div>
          <div style={s.cardBody}>{data.incumbent_weaknesses}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>Where we win</div>
          <div style={s.cardBody}>{data.our_strengths}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>Proof points</div>
          <div style={s.cardBody}>{data.proof_points}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>🔍 Landmine questions</div>
          <div style={s.cardBody}>{data.landmines}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>⚠️ Traps to avoid</div>
          <div style={s.cardBody}>{data.traps_to_avoid}</div>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button style={{ ...s.genBtn, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }} onClick={generate}>↻ Regenerate</button>
        </div>
      </div>
    </div>
  );
}
