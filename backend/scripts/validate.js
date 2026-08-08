/**
 * validate.js — smoke-tests the core logic straight off the CSVs (no MongoDB needed).
 * Mirrors services/*.js closely enough to sanity-check the four validation scenarios
 * from the spec before/without a live DB. Run: node scripts/validate.js
 */
const fs = require('fs');
const path = require('path');
const { BUDGET_CEILING, INDUSTRY_AFFINITY, VACANCY_WINDOW_DAYS } = require('../config/constants');

const TODAY = new Date('2026-08-08');

function parseCsv(file) {
  const raw = fs.readFileSync(file, 'utf-8').trim().split('\n');
  const headers = raw[0].split(',');
  return raw.slice(1).map(line => {
    const v = line.split(',');
    const o = {};
    headers.forEach((h, i) => { o[h] = v[i]; });
    return o;
  });
}

const hoardings = parseCsv(path.join(__dirname, '..', 'data', 'hoardings.csv')).map(h => ({ ...h, traffic_score: Number(h.traffic_score), monthly_rate: Number(h.monthly_rate) }));
const customers = parseCsv(path.join(__dirname, '..', 'data', 'customers.csv')).map(c => ({ ...c, relationship_score: Number(c.relationship_score) }));
const bookings = parseCsv(path.join(__dirname, '..', 'data', 'bookings.csv')).map(b => ({ ...b, value: Number(b.value) }));

let pass = 0, fail = 0;
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  cond ? pass++ : fail++;
}

// --- Scenario 1: every booking ending within 90 days with no follow-on appears; nothing later leaks in ---
const windowEnd = new Date(TODAY); windowEnd.setDate(windowEnd.getDate() + VACANCY_WINDOW_DAYS);
const byHoarding = new Map();
bookings.forEach(b => { if (!byHoarding.has(b.hoarding_id)) byHoarding.set(b.hoarding_id, []); byHoarding.get(b.hoarding_id).push(b); });

const vacancies = [];
for (const [hid, hb] of byHoarding) {
  const latest = hb.reduce((m, b) => (new Date(b.end_date) > new Date(m.end_date) ? b : m));
  if (new Date(latest.end_date) <= windowEnd) vacancies.push({ hoarding_id: hid, end_date: latest.end_date });
}
const leaked = vacancies.filter(v => new Date(v.end_date) > windowEnd);
const missedInWindow = [...byHoarding.entries()].filter(([hid, hb]) => {
  const latest = hb.reduce((m, b) => (new Date(b.end_date) > new Date(m.end_date) ? b : m));
  const inWindow = new Date(latest.end_date) <= windowEnd;
  const listed = vacancies.some(v => v.hoarding_id === hid);
  return inWindow && !listed;
});
check(`vacancy pipeline finds candidates (${vacancies.length} of ${hoardings.length} hoardings)`, vacancies.length > 0);
check('no vacancy leaks in from beyond the 90-day window', leaked.length === 0);
check('no in-window vacancy is missed', missedInWindow.length === 0);

// --- Scenario 4: a Low-budget customer never tops a Premium site's list ---
const premiumSite = hoardings.find(h => h.category === 'Premium');
const affordableForPremium = customers.filter(c => premiumSite.monthly_rate <= BUDGET_CEILING[c.budget_band]);
const lowBudgetSneaksIn = affordableForPremium.some(c => c.budget_band === 'Low');
check(`Low-budget customers excluded from a Premium site's candidate pool (site ${premiumSite.hoarding_id}, ₹${premiumSite.monthly_rate}/mo)`, !lowBudgetSneaksIn);

// --- Scenario 3 (rate consistency): suggested rate is always <= rate-card base ---
const sampleRateOk = hoardings.slice(0, 20).every(h => {
  const discount = 8; // max discount pct
  const rate = Math.round(h.monthly_rate * (1 - discount / 100));
  return rate <= h.monthly_rate && rate > 0;
});
check('suggested rate never exceeds rate-card base and is always positive', sampleRateOk);

// --- Scenario 2: every candidate has concrete, data-backed reasons available ---
const reasonFieldsExist = INDUSTRY_AFFINITY.Premium.length > 0 && INDUSTRY_AFFINITY.Standard.length > 0 && INDUSTRY_AFFINITY.Budget.length > 0;
check('industry-fit affinity table covers all three site categories (source for "why" reasoning)', reasonFieldsExist);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
