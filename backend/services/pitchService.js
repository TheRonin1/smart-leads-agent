const Hoarding = require('../models/Hoarding');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');

// Loyalty discount off the rate-card price, driven only by relationship_score —
// capped so the quoted rate is always traceable back to rate_card * discount, never invented.
function suggestedRate(monthlyRate, relationshipScore) {
  const maxDiscountPct = 8; // rate-card ceiling for negotiation room
  const discountPct = Math.round((relationshipScore / 10) * maxDiscountPct);
  const rate = Math.round(monthlyRate * (1 - discountPct / 100));
  return { rate, discountPct, rateCardBase: monthlyRate };
}

/**
 * Drafts a personalised pitch from site facts + customer history, with a rate
 * derived from the rate card (no invented numbers — traceable to monthly_rate).
 */
async function generatePitch(hoardingId, customerId) {
  const [hoarding, customer, custBookings] = await Promise.all([
    Hoarding.findOne({ hoarding_id: hoardingId }).lean(),
    Customer.findOne({ customer_id: customerId }).lean(),
    Booking.find({ customer_id: customerId }).lean()
  ]);
  if (!hoarding || !customer) return null;

  const { rate, discountPct, rateCardBase } = suggestedRate(hoarding.monthly_rate, customer.relationship_score);
  const pastCount = custBookings.length;
  const pastValue = custBookings.reduce((sum, b) => sum + b.value, 0);
  const bookedThisSiteBefore = custBookings.some(b => b.hoarding_id === hoarding.hoarding_id);

  const greeting = `Hi ${customer.name.split(' ')[0]} team,`;

  const siteLine = `${hoarding.location} (${hoarding.size}, traffic score ${hoarding.traffic_score}/100, ${hoarding.category} category) ` +
    (bookedThisSiteBefore ? `— the exact site you've advertised on before — ` : `— a strong fit for ${customer.industry} — `) +
    `is coming up for booking${bookedThisSiteBefore ? ' again' : ''}.`;

  const historyLine = pastCount > 0
    ? `Over ${pastCount} past booking${pastCount > 1 ? 's' : ''} with us worth ₹${pastValue.toLocaleString('en-IN')} total, ${customer.name} has been a reliable partner.`
    : `We'd love to welcome ${customer.name} as a new hoarding partner.`;

  const rateLine = discountPct > 0
    ? `Rate-card price is ₹${rateCardBase.toLocaleString('en-IN')}/month — as a relationship-score ${customer.relationship_score}/10 partner, we can offer ₹${rate.toLocaleString('en-IN')}/month (${discountPct}% off card).`
    : `Rate-card price for this site is ₹${rateCardBase.toLocaleString('en-IN')}/month.`;

  const closing = `Let us know by ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} if you'd like to lock this in before it's offered elsewhere.`;

  const pitchText = [greeting, '', siteLine, historyLine, rateLine, '', closing].join('\n');

  return {
    hoarding_id: hoarding.hoarding_id,
    customer_id: customer.customer_id,
    pitch_text: pitchText,
    suggested_rate: rate,
    rate_card_base: rateCardBase,
    discount_pct: discountPct,
    site_facts: { location: hoarding.location, size: hoarding.size, traffic_score: hoarding.traffic_score, category: hoarding.category },
    customer_history: { past_bookings: pastCount, past_value: pastValue, booked_this_site_before: bookedThisSiteBefore }
  };
}

/**
 * BONUS: renewal-vs-churn heuristic for the incumbent (most recent) customer of a
 * hoarding — based only on data already in the system (repeat-booking count on this
 * site, contact recency, relationship score), narrated the same way as lead scores.
 */
async function predictRenewal(hoardingId, incumbentCustomerId, referenceDate = new Date()) {
  const [customer, custBookingsOnSite] = await Promise.all([
    Customer.findOne({ customer_id: incumbentCustomerId }).lean(),
    Booking.find({ hoarding_id: hoardingId, customer_id: incumbentCustomerId }).lean()
  ]);
  if (!customer) return null;

  const repeatCount = custBookingsOnSite.length;
  const daysSinceContact = Math.round((referenceDate.getTime() - new Date(customer.last_contact_date).getTime()) / 86400000);

  let likelihood = 0.3 + Math.min(repeatCount, 3) * 0.15 + (customer.relationship_score / 10) * 0.3;
  if (daysSinceContact > 90) likelihood -= 0.15;
  likelihood = Math.max(0, Math.min(1, likelihood));

  return {
    customer_id: customer.customer_id,
    name: customer.name,
    repeat_bookings_on_site: repeatCount,
    days_since_contact: daysSinceContact,
    relationship_score: customer.relationship_score,
    renewal_likelihood: Number(likelihood.toFixed(2)),
    verdict: likelihood >= 0.6 ? 'Likely to renew' : likelihood >= 0.4 ? 'Uncertain — worth a proactive call' : 'At risk of churn'
  };
}

module.exports = { generatePitch, predictRenewal };
