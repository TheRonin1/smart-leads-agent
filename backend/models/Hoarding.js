const mongoose = require('mongoose');

const hoardingSchema = new mongoose.Schema({
  hoarding_id: { type: String, required: true, unique: true, index: true },
  location: String,
  size: String,
  traffic_score: Number,
  monthly_rate: Number,
  category: { type: String, enum: ['Premium', 'Standard', 'Budget'] }
});

module.exports = mongoose.model('Hoarding', hoardingSchema);
