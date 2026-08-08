const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  booking_id: { type: String, required: true, unique: true, index: true },
  hoarding_id: { type: String, required: true, index: true },
  customer_id: { type: String, required: true, index: true },
  start_date: Date,
  end_date: Date,
  value: Number,
  industry_at_booking: String
});

module.exports = mongoose.model('Booking', bookingSchema);
