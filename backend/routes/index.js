const express = require('express');
const router = express.Router();

// Эндпоинт здоровья
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown'
  });
});

module.exports = router; 