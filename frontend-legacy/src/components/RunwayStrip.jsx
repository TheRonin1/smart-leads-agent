import React from 'react';

// A lit-up countdown strip, evoking a billboard sign counting down to go-dark.
// Position of the marker = days_until_vacant mapped across the 90-day window.
export default function RunwayStrip({ daysUntilVacant, alreadyVacant, compact = false }) {
  const WINDOW = 90;
  const clamped = Math.max(0, Math.min(WINDOW, daysUntilVacant));
  const pct = alreadyVacant ? 0 : (clamped / WINDOW) * 100;
  const urgent = alreadyVacant || daysUntilVacant <= 14;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          position: 'relative',
          height: compact ? 6 : 8,
          borderRadius: 4,
          background: 'linear-gradient(90deg, var(--red-dim), var(--amber-dim) 40%, var(--surface-raised) 100%)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${100 - pct}%`,
            background: urgent
              ? 'linear-gradient(90deg, var(--red), var(--amber))'
              : 'linear-gradient(90deg, var(--amber), var(--green))',
            transition: 'width 0.6s ease'
          }}
        />
      </div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <span>TODAY</span>
          <span>+90D</span>
        </div>
      )}
    </div>
  );
}
