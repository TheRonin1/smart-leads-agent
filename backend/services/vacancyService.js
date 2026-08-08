const Hoarding = require('../models/Hoarding');
const Booking = require('../models/Booking');
const { VACANCY_WINDOW_DAYS } = require('../config/constants');

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * A hoarding is a "vacancy" if its LATEST booking end_date falls on or before
 * today + VACANCY_WINDOW_DAYS. This covers:
 *   - already vacant now (end_date in the past, nothing booked after)
 *   - falling vacant soon (end_date within the next 90 days)
 * Anything whose latest end_date is beyond the window is correctly excluded
 * ("nothing later leaks in").
 */
async function getVacancies(referenceDate = new Date()) {
  const hoardings = await Hoarding.find({}).lean();
  const bookings = await Booking.find({}).lean();

  const bookingsByHoarding = new Map();
  for (const b of bookings) {
    if (!bookingsByHoarding.has(b.hoarding_id)) bookingsByHoarding.set(b.hoarding_id, []);
    bookingsByHoarding.get(b.hoarding_id).push(b);
  }

  const windowEnd = new Date(referenceDate);
  windowEnd.setDate(windowEnd.getDate() + VACANCY_WINDOW_DAYS);

  const vacancies = [];

  for (const h of hoardings) {
    const hb = bookingsByHoarding.get(h.hoarding_id) || [];
    if (hb.length === 0) continue; // no booking history — outside the spec's detection scope

    const latest = hb.reduce((max, b) => (new Date(b.end_date) > new Date(max.end_date) ? b : max));
    const endDate = new Date(latest.end_date);

    if (endDate <= windowEnd) {
      const freeFrom = new Date(endDate);
      freeFrom.setDate(freeFrom.getDate() + 1);
      const daysUntilVacant = daysBetween(referenceDate, freeFrom);

      vacancies.push({
        hoarding_id: h.hoarding_id,
        location: h.location,
        size: h.size,
        traffic_score: h.traffic_score,
        monthly_rate: h.monthly_rate,
        category: h.category,
        free_from: freeFrom.toISOString().slice(0, 10),
        already_vacant: daysUntilVacant <= 0,
        days_until_vacant: daysUntilVacant,
        revenue_at_risk_per_month: h.monthly_rate,
        last_booking: {
          booking_id: latest.booking_id,
          customer_id: latest.customer_id,
          end_date: latest.end_date
        }
      });
    }
  }

  // Soonest-vacant / highest revenue-at-risk first
  vacancies.sort((a, b) => a.days_until_vacant - b.days_until_vacant || b.revenue_at_risk_per_month - a.revenue_at_risk_per_month);
  return vacancies;
}

module.exports = { getVacancies };
