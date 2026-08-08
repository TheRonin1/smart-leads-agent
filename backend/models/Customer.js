const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customer_id: { type: String, required: true, unique: true, index: true },
  name: String,
  industry: String,
  budget_band: { type: String, enum: ['Low', 'Mid', 'High'] },
  relationship_score: Number, // 1-10
  last_contact_date: Date
});

module.exports = mongoose.model('Customer', customerSchema);
