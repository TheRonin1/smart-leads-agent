import React, { useEffect, useState } from 'react';
import VacancyList from './components/VacancyList.jsx';
import LeadCard from './components/LeadCard.jsx';
import PitchModal from './components/PitchModal.jsx';
import RunwayStrip from './components/RunwayStrip.jsx';
import { getVacancies, getLeads, getPitch } from './api/client.js';

export default function App() {
  const [vacancyData, setVacancyData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [leadData, setLeadData] = useState(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getVacancies()
      .then(data => {
        setVacancyData(data);
        if (data.vacancies.length > 0) setSelectedId(data.vacancies[0].hoarding_id);
      })
      .catch(() => setError('Could not reach the API. Is the backend running on the expected port?'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLeadsLoading(true);
    getLeads(selectedId)
      .then(setLeadData)
      .finally(() => setLeadsLoading(false));
  }, [selectedId]);

  function handlePitch(customerId) {
    setPitch(null);
    setPitchLoading(true);
    getPitch(selectedId, customerId)
      .then(setPitch)
      .finally(() => setPitchLoading(false));
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-body)', color: 'var(--red)' }}>
        {error}
      </div>
    );
  }

  const selected = vacancyData?.vacancies.find(v => v.hoarding_id === selectedId);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
            Smart Leads<span style={{ color: 'var(--amber)' }}>.</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            HOARDINGS COCKPIT
          </span>
        </div>
        {vacancyData && (
          <div style={{ display: 'flex', gap: 24 }}>
            <Stat label="VACANCIES (90D)" value={vacancyData.count} color="var(--blue)" />
            <Stat
              label="REVENUE AT RISK / MO"
              value={`₹${(vacancyData.total_revenue_at_risk_per_month / 100000).toFixed(1)}L`}
              color="var(--amber)"
            />
            <Stat label="AS OF" value={vacancyData.reference_date} color="var(--text-secondary)" />
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden' }}>
        {/* Vacancy list */}
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
          {vacancyData ? (
            <VacancyList vacancies={vacancyData.vacancies} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading vacancies…</div>
          )}
        </div>

        {/* Detail panel */}
        <div className="scrollbar-thin" style={{ overflowY: 'auto', padding: 24 }}>
          {!selected && <div style={{ color: 'var(--text-secondary)' }}>Select a vacancy to see ranked leads.</div>}

          {selected && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24 }}>{selected.location}</h1>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                      {selected.hoarding_id} · {selected.size} · traffic score {selected.traffic_score}/100 · {selected.category}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--amber)' }}>
                      ₹{selected.monthly_rate.toLocaleString('en-IN')}/mo
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>rate-card price</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <RunwayStrip daysUntilVacant={selected.days_until_vacant} alreadyVacant={selected.already_vacant} />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {selected.already_vacant
                      ? `Vacant since ${selected.free_from}`
                      : `Free from ${selected.free_from} — booking ends ${selected.last_booking.end_date}`}
                  </div>
                </div>
              </div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12 }}>
                TOP-3 BEST-FIT LEADS
              </h2>

              {leadsLoading && <div style={{ color: 'var(--text-secondary)' }}>Scoring candidates…</div>}
              {leadData && !leadsLoading && leadData.leads.map((lead, i) => (
                <LeadCard key={lead.customer_id} lead={lead} rank={i} onPitch={handlePitch} />
              ))}
              {leadData && leadData.candidates_excluded_on_budget > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {leadData.candidates_excluded_on_budget} of {leadData.candidates_considered} customers excluded — budget band can't cover this site's rate.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {(pitch || pitchLoading) && (
        <PitchModal pitch={pitch} loading={pitchLoading} onClose={() => { setPitch(null); setPitchLoading(false); }} />
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
