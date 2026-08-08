const express = require('express');
const router = express.Router();
const { generatePitch } = require('../services/pitchService');

// GET /api/pitch/:hoardingId/:customerId — personalised pitch + suggested rate
router.get('/:hoardingId/:customerId', async (req, res) => {
  try {
    const result = await generatePitch(req.params.hoardingId, req.params.customerId);
    if (!result) return res.status(404).json({ error: 'Hoarding or customer not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
