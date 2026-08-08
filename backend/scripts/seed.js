/**
 * seed.js — reads data/*.csv and loads them into MongoDB.
 * Run: node scripts/seed.js
 * Requires MONGO_URI in .env (see .env.example).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Hoarding = require('../models/Hoarding');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  const headers = raw[0].split(',');
  return raw.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i]; });
    return obj;
  });
}

async function seed() {
  await connectDB();

  const hoardingsRaw = parseCsv(path.join(__dirname, '..', 'data', 'hoardings.csv'));
  const customersRaw = parseCsv(path.join(__dirname, '..', 'data', 'customers.csv'));
  const bookingsRaw = parseCsv(path.join(__dirname, '..', 'data', 'bookings.csv'));

  await Promise.all([Hoarding.deleteMany({}), Customer.deleteMany({}), Booking.deleteMany({})]);

  const hoardings = hoardingsRaw.map(h => ({
    hoarding_id: h.hoarding_id,
    location: h.location,
    size: h.size,
    traffic_score: Number(h.traffic_score),
    monthly_rate: Number(h.monthly_rate),
    category: h.category
  }));

  const customers = customersRaw.map(c => ({
    customer_id: c.customer_id,
    name: c.name,
    industry: c.industry,
    budget_band: c.budget_band,
    relationship_score: Number(c.relationship_score),
    last_contact_date: new Date(c.last_contact_date)
  }));

  const bookings = bookingsRaw.map(b => ({
    booking_id: b.booking_id,
    hoarding_id: b.hoarding_id,
    customer_id: b.customer_id,
    start_date: new Date(b.start_date),
    end_date: new Date(b.end_date),
    value: Number(b.value),
    industry_at_booking: b.industry_at_booking
  }));

  await Hoarding.insertMany(hoardings);
  await Customer.insertMany(customers);
  await Booking.insertMany(bookings);

  console.log(`Seeded ${hoardings.length} hoardings, ${customers.length} customers, ${bookings.length} bookings.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
