const Hoarding = require('../models/Hoarding');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const { BUDGET_CEILING, INDUSTRY_AFFINITY, WEIGHTS, COLD_RELATIONSHIP_DAYS } = require('../config/constants');

const IDEAL_BAND_FOR_CATEGORY = { Premium: 'High', Standard: 'Mid', Budget: 'Low' };

function daysAgo(date, from = new Date()) {
  return Math.round((from.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the top-N ranked customers for a given hoarding, each with a
 * transparent score breakdown and plain-language reasons — never an
 * unexplained number.
 */
async function getRankedLeads(hoardingId, referenceDate = new Date(), topN = 3) {
  const hoarding = await Hoarding.findOne({ hoarding_id: hoardingId }).lean();
  if (!hoarding) return null;

  const [customers, allBookings] = await Promise.all([
    Customer.find({}).lean(),
    Booking.find({}).lean()
  ]);

  const bookingsByCustomer = new Map();
  for (const b of allBookings) {
    if (!bookingsByCustomer.has(b.customer_id)) bookingsByCustomer.set(b.customer_id, []);
    bookingsByCustomer.get(b.customer_id).push(b);
  }
  const hoardingsCache = new Map(); // hoarding_id -> category, filled lazily below
  const allHoardings = await Hoarding.find({}).lean();
  allHoardings.forEach(h => hoardingsCache.set(h.hoarding_id, h.category));

  // --- Hard gate: budget affordability. A customer whose band can't afford this
  // site's rate is excluded outright, so it structurally cannot top the list. ---
  const affordable = customers.filter(c => hoarding.monthly_rate <= BUDGET_CEILING[c.budget_band]);

  const scored = affordable.map(c => {
    const reasons = [];

    // 1. Industry fit
    const idealIndustries = INDUSTRY_AFFINITY[hoarding.category] || [];
    const isIdealIndustry = idealIndustries.includes(c.industry);
    const industryFit = isIdealIndustry ? 1.0 : 0.4;
    reasons.push(isIdealIndustry
      ? `${c.industry} is a proven fit for ${hoarding.category} sites (top industries here: ${idealIndustries.join(', ')}).`
      : `${c.industry} is not among the historically strongest industries for ${hoarding.category} sites (${idealIndustries.join(', ')}), so this is a secondary fit.`);

    // 2. Budget fit
    const idealBand = IDEAL_BAND_FOR_CATEGORY[hoarding.category];
    const budgetFit = c.budget_band === idealBand ? 1.0 : 0.65;
    reasons.push(`${c.budget_band} budget band comfortably covers this site's ₹${hoarding.monthly_rate.toLocaleString('en-IN')}/month rate` +
      (c.budget_band === idealBand ? ` and is the ideal band for a ${hoarding.category} site.` : '.'));

    // 3. Relationship strength
    const relationship = c.relationship_score / 10;
    const daysSinceContact = daysAgo(c.last_contact_date, referenceDate);
    const isCold = daysSinceContact > COLD_RELATIONSHIP_DAYS;
    reasons.push(`Relationship score ${c.relationship_score}/10; last contacted ${daysSinceContact} days ago` + (isCold ? ' (cold — flagged for re-engagement).' : '.'));

    // 4. Past booking affinity
    const custBookings = bookingsByCustomer.get(c.customer_id) || [];
    const bookedThisSite = custBookings.some(b => b.hoarding_id === hoarding.hoarding_id);
    const bookedSameCategory = custBookings.some(b => hoardingsCache.get(b.hoarding_id) === hoarding.category);
    let pastBookingAffinity = 0;
    if (bookedThisSite) pastBookingAffinity = 1.0;
    else if (bookedSameCategory) pastBookingAffinity = 0.6;
    else if (custBookings.length > 0) pastBookingAffinity = 0.2;

    if (bookedThisSite) reasons.push(`Has booked this exact hoarding before — a direct repeat-customer signal.`);
    else if (bookedSameCategory) reasons.push(`Has booked other ${hoarding.category} sites before, showing category affinity.`);
    else if (custBookings.length > 0) reasons.push(`Has booking history (${custBookings.length} past booking${custBookings.length > 1 ? 's' : ''}) but not in this category.`);
    else reasons.push(`No prior booking history with us.`);

    const score =
      industryFit * WEIGHTS.industryFit +
      budgetFit * WEIGHTS.budgetFit +
      relationship * WEIGHTS.relationship +
      pastBookingAffinity * WEIGHTS.pastBookingAffinity;

    return {
      customer_id: c.customer_id,
      name: c.name,
      industry: c.industry,
      budget_band: c.budget_band,
      relationship_score: c.relationship_score,
      is_cold_relationship: isCold,
      score: Number(score.toFixed(4)),
      score_breakdown: {
        industryFit: Number(industryFit.toFixed(2)),
        budgetFit: Number(budgetFit.toFixed(2)),
        relationship: Number(relationship.toFixed(2)),
        pastBookingAffinity: Number(pastBookingAffinity.toFixed(2)),
        weights: WEIGHTS
      },
      reasons
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    hoarding,
    leads: scored.slice(0, topN),
    candidates_considered: customers.length,
    candidates_excluded_on_budget: customers.length - affordable.length
  };
}

module.exports = { getRankedLeads };
