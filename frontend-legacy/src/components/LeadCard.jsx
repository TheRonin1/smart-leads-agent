import React from 'react';

const RANK_LABEL = ['#1 BEST FIT', '#2', '#3'];
const RANK_COLOR = ['var(--amber)', 'var(--blue)', 'var(--text-secondary)'];

export default function LeadCard({ lead, rank, onPitch }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${rank === 0 ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: RANK_COLOR[rank] }}>
            {RANK_LABEL[rank]}
          </span>
          <h3 style={{ margin: '4px 0 2px', fontFamily: 'var(--font-display)', fontSize: 16 }}>{lead.name}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {lead.industry} · {lead.budget_band} budget · {lead.customer_id}
            {lead.is_cold_relationship && (
              <span style={{ marginLeft: 8, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>● COLD</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            {(lead.score * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>fit score</div>
        </div>
      </div>

      <ul style={{ margin: '10px 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {lead.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <button
        onClick={() => onPitch(lead.customer_id)}
        style={{
          background: 'var(--amber)', color: '#12151B', border: 'none', borderRadius: 6,
          padding: '8px 14px', fontWeight: 600, fontSize: 13, marginTop: 6
        }}
      >
        Generate pitch →
      </button>
    </div>
  );
}
