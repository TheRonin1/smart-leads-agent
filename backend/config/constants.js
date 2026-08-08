// Central place for all business rules so scoring/vacancy/pitch logic stay consistent
// and auditable — every number a lead score depends on is named here, not buried inline.

const VACANCY_WINDOW_DAYS = 90;

// Rate tiers a customer's budget_band can comfortably afford (monthly_rate ceiling).
// A "Low" budget customer should never top a Premium site's list — this is the hard gate.
const BUDGET_CEILING = {
  Low: 70000,
  Mid: 180000,
  High: Infinity
};

// Which industries are the strongest historical fit for each hoarding category.
// Used as the "industry fit" component of the lead score, and quoted verbatim in the
// "why" reasoning so every score is explainable from data, never a black box.
const INDUSTRY_AFFINITY = {
  Premium: ['Automobile', 'Finance', 'Real Estate', 'Tech'],
  Standard: ['Retail', 'FMCG', 'Entertainment', 'F&B'],
  Budget: ['Education', 'Healthcare', 'F&B']
};

// Scoring weights (sum to 1.0) — kept as named constants so the "why" narration
// can cite the exact contribution of each factor.
const WEIGHTS = {
  industryFit: 0.35,
  budgetFit: 0.30,
  relationship: 0.20,
  pastBookingAffinity: 0.15
};

const COLD_RELATIONSHIP_DAYS = 90; // no contact in this long -> flagged cold

module.exports = { VACANCY_WINDOW_DAYS, BUDGET_CEILING, INDUSTRY_AFFINITY, WEIGHTS, COLD_RELATIONSHIP_DAYS };
