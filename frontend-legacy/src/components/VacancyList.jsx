import React from 'react';
import RunwayStrip from './RunwayStrip.jsx';

const CATEGORY_COLOR = { Premium: 'var(--amber)', Standard: 'var(--blue)', Budget: 'var(--green)' };

export default function VacancyList({ vacancies, selectedId, onSelect }) {
  return (
    <div className="scrollbar-thin" style={{ overflowY: 'auto', height: '100%' }}>
      {vacancies.map(v => {
        const active = v.hoarding_id === selectedId;
        return (
          <button
            key={v.hoarding_id}
            onClick={() => onSelect(v.hoarding_id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: active ? 'var(--surface-raised)' : 'transparent',
              border: 'none',
              borderLeft: active ? '3px solid var(--amber)' : '3px solid transparent',
              borderBottom: '1px solid var(--border)',
              padding: '14px 16px',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{v.location}</span>
              <span
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: 0.5,
                  color: CATEGORY_COLOR[v.category], border: `1px solid ${CATEGORY_COLOR[v.category]}`,
                  borderRadius: 4, padding: '1px 6px'
                }}
              >
                {v.category.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {v.hoarding_id} · {v.size}
            </div>
            <RunwayStrip daysUntilVacant={v.days_until_vacant} alreadyVacant={v.already_vacant} compact />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
              <span style={{ color: v.already_vacant ? 'var(--red)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {v.already_vacant ? 'VACANT NOW' : `free in ${v.days_until_vacant}d`}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                ₹{v.revenue_at_risk_per_month.toLocaleString('en-IN')}/mo
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
