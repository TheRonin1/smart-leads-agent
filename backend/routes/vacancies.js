const express = require('express');
const router = express.Router();
const { getVacancies } = require('../services/vacancyService');

// GET /api/vacancies — every hoarding falling vacant in the next 90 days, with revenue at risk
router.get('/', async (req, res) => {
  try {
    const vacancies = await getVacancies(new Date());
    res.json({
      reference_date: new Date().toISOString().slice(0, 10),
      count: vacancies.length,
      total_revenue_at_risk_per_month: vacancies.reduce((s, v) => s + v.revenue_at_risk_per_month, 0),
      vacancies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
