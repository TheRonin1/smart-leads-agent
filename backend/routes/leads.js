const express = require('express');
const router = express.Router();
const { getRankedLeads } = require('../services/leadScoringService');
const { predictRenewal } = require('../services/pitchService');

// GET /api/leads/:hoardingId — top-3 ranked customers with reasons
router.get('/:hoardingId', async (req, res) => {
  try {
    const result = await getRankedLeads(req.params.hoardingId, new Date(), 3);
    if (!result) return res.status(404).json({ error: 'Hoarding not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:hoardingId/renewal/:customerId — bonus: renewal-vs-churn for the incumbent
router.get('/:hoardingId/renewal/:customerId', async (req, res) => {
  try {
    const result = await predictRenewal(req.params.hoardingId, req.params.customerId, new Date());
    if (!result) return res.status(404).json({ error: 'Customer not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
