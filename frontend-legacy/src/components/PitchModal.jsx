import React from 'react';

export default function PitchModal({ pitch, loading, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24
        }}
        className="scrollbar-thin"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18 }}>Pitch preview</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20 }}>✕</button>
        </div>

        {loading && <p style={{ color: 'var(--text-secondary)' }}>Drafting pitch…</p>}

        {pitch && !loading && (
          <>
            <div
              style={{
                background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 16, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, marginBottom: 16
              }}
            >
              {pitch.pitch_text}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div style={{ background: 'var(--amber-dim)', borderRadius: 8, padding: 12 }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>SUGGESTED RATE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--amber)' }}>
                  ₹{pitch.suggested_rate.toLocaleString('en-IN')}/mo
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  {pitch.discount_pct}% off card (₹{pitch.rate_card_base.toLocaleString('en-IN')})
                </div>
              </div>
              <div style={{ background: 'var(--blue-dim)', borderRadius: 8, padding: 12 }}>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>CUSTOMER HISTORY</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--blue)' }}>
                  {pitch.customer_history.past_bookings} bookings
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  ₹{pitch.customer_history.past_value.toLocaleString('en-IN')} lifetime value
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
