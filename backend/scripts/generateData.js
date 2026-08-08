/**
 * generateData.js
 * Produces hoardings.csv, bookings.csv, customers.csv matching the spec's schema.
 * Reference "today" is fixed so booking end-dates fall realistically inside/outside
 * the 90-day vacancy window — makes the validation scenarios reproducible.
 *
 * Run: node scripts/generateData.js
 */
const fs = require('fs');
const path = require('path');

const TODAY = new Date('2026-08-08'); // reference date used everywhere in the system
const OUT_DIR = path.join(__dirname, '..', 'data');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function fmt(d) { return d.toISOString().slice(0, 10); }

const AREAS = ['Andheri', 'Bandra', 'Powai', 'Worli', 'Dadar', 'Thane', 'Borivali', 'Ghatkopar', 'Chembur', 'Malad', 'Vashi', 'Kandivali'];
const SIZES = ['20x10 ft', '30x15 ft', '40x20 ft', '10x8 ft'];
const INDUSTRIES = ['Retail', 'FMCG', 'Finance', 'Real Estate', 'Automobile', 'Entertainment', 'Tech', 'Healthcare', 'Education', 'F&B'];
const BUDGET_BANDS = ['Low', 'Mid', 'High'];
const NAMES_PREFIX = ['Shree', 'Om', 'Nova', 'Prime', 'Metro', 'Urban', 'Bright', 'Zenith', 'Apex', 'Blue', 'Golden', 'Silver', 'Star', 'Elite', 'Coastal'];
const NAMES_SUFFIX = ['Retail Pvt Ltd', 'FMCG Co', 'Finance Group', 'Realty', 'Motors', 'Studios', 'Technologies', 'Healthcare', 'Academy', 'Foods & Beverages'];

// Category is derived from traffic_score + monthly_rate — kept consistent at generation time.
function categoryFor(trafficScore) {
  if (trafficScore >= 75) return 'Premium';
  if (trafficScore >= 45) return 'Standard';
  return 'Budget';
}

const RATE_BY_CATEGORY = { Premium: [180000, 350000], Standard: [70000, 170000], Budget: [20000, 65000] };

// ---------- Hoardings ----------
const hoardings = [];
for (let i = 1; i <= 300; i++) {
  const trafficScore = rand(10, 98);
  const category = categoryFor(trafficScore);
  const [lo, hi] = RATE_BY_CATEGORY[category];
  hoardings.push({
    hoarding_id: `H${String(i).padStart(4, '0')}`,
    location: `${pick(AREAS)} ${pick(['Junction', 'Flyover', 'Signal', 'Main Road', 'Circle', 'Highway'])}`,
    size: pick(SIZES),
    traffic_score: trafficScore,
    monthly_rate: rand(lo, hi),
    category
  });
}

// ---------- Customers ----------
const customers = [];
for (let i = 1; i <= 150; i++) {
  const industry = pick(INDUSTRIES);
  const lastContactDaysAgo = rand(0, 260);
  customers.push({
    customer_id: `C${String(i).padStart(4, '0')}`,
    name: `${pick(NAMES_PREFIX)} ${pick(NAMES_SUFFIX)}`,
    industry,
    budget_band: pick(BUDGET_BANDS),
    relationship_score: rand(1, 10),
    last_contact_date: fmt(addDays(TODAY, -lastContactDaysAgo))
  });
}

// ---------- Bookings ----------
// For each hoarding, create 1-4 historical bookings. The LAST booking's end_date
// determines whether/when the site becomes vacant.
const bookings = [];
let bookingCounter = 1;
for (const h of hoardings) {
  const numBookings = rand(1, 4);
  let cursor = addDays(TODAY, -rand(400, 900)); // history starts well in the past
  for (let b = 0; b < numBookings; b++) {
    const cust = pick(customers);
    const durationDays = rand(60, 180);
    const start = new Date(cursor);
    const end = addDays(start, durationDays);
    bookings.push({
      booking_id: `B${String(bookingCounter++).padStart(5, '0')}`,
      hoarding_id: h.hoarding_id,
      customer_id: cust.customer_id,
      start_date: fmt(start),
      end_date: fmt(end),
      value: h.monthly_rate * Math.round(durationDays / 30),
      industry_at_booking: cust.industry
    });
    // small gap before next booking (or this is the last one)
    cursor = addDays(end, rand(5, 60));
  }
}

// Force a controlled slice of hoardings to have their LAST booking end within the
// next 90 days (the vacancy pipeline's target), and some already vacant / some far out,
// so every validation scenario has real examples to check against.
const sorted = [...hoardings];
function lastBookingOf(hoardingId) {
  const hb = bookings.filter(b => b.hoarding_id === hoardingId).sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
  return hb[0];
}

sorted.forEach((h, idx) => {
  const last = lastBookingOf(h.hoarding_id);
  if (!last) return;
  if (idx % 5 === 0) {
    // ~20% of sites: last booking ends within next 90 days -> should appear as vacancy
    last.end_date = fmt(addDays(TODAY, rand(1, 89)));
  } else if (idx % 5 === 1) {
    // ~20%: ended just before today already (vacant now, boundary case)
    last.end_date = fmt(addDays(TODAY, -rand(1, 10)));
  } else if (idx % 5 === 2) {
    // ~20%: ends exactly at the 90-day edge/beyond -> must NOT leak into the list
    last.end_date = fmt(addDays(TODAY, rand(91, 150)));
  }
  // remaining ~40% keep their randomly generated (usually far future or already renewed) dates
});

// ---------- Write CSVs ----------
function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => r[h]).join(','));
  return lines.join('\n');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'hoardings.csv'), toCsv(hoardings, ['hoarding_id', 'location', 'size', 'traffic_score', 'monthly_rate', 'category']));
fs.writeFileSync(path.join(OUT_DIR, 'customers.csv'), toCsv(customers, ['customer_id', 'name', 'industry', 'budget_band', 'relationship_score', 'last_contact_date']));
fs.writeFileSync(path.join(OUT_DIR, 'bookings.csv'), toCsv(bookings, ['booking_id', 'hoarding_id', 'customer_id', 'start_date', 'end_date', 'value', 'industry_at_booking']));

console.log(`Generated ${hoardings.length} hoardings, ${customers.length} customers, ${bookings.length} bookings.`);
console.log(`Reference "today" used by the system: ${fmt(TODAY)}`);
