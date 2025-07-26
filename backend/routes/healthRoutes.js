const express = require('express');
const router = express.Router();
const memoryMonitor = require('../utils/memoryMonitor');

// @route   GET /api/health
// @desc    Проверка здоровья сервера
// @access  Public
router.get('/', (req, res) => {
  try {
    const memInfo = memoryMonitor.getMemoryInfo();
    const memCheck = memoryMonitor.checkMemoryLimits();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: memInfo,
      warnings: memCheck.warnings,
      isHealthy: !memCheck.isCritical
    };
    
    const statusCode = memCheck.isCritical ? 503 : 200;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('[HEALTH_CHECK] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// @route   GET /api/health/memory
// @desc    Детальная информация о памяти
// @access  Public
router.get('/memory', (req, res) => {
  try {
    const memInfo = memoryMonitor.getMemoryInfo();
    const memCheck = memoryMonitor.checkMemoryLimits();
    
    res.json({
      memory: memInfo,
      warnings: memCheck.warnings,
      isCritical: memCheck.isCritical,
      recommendations: memCheck.isCritical ? [
        'Consider restarting the server',
        'Check for memory leaks',
        'Reduce concurrent requests'
      ] : []
    });
  } catch (error) {
    console.error('[MEMORY_CHECK] Error:', error);
    res.status(500).json({
      error: 'Memory check failed',
      message: error.message
    });
  }
});

// @route   POST /api/health/cleanup
// @desc    Принудительная очистка памяти
// @access  Public
router.post('/cleanup', (req, res) => {
  try {
    const beforeCleanup = memoryMonitor.getMemoryInfo();
    const cleanupResult = memoryMonitor.forceCleanup();
    const afterCleanup = memoryMonitor.getMemoryInfo();
    
    res.json({
      success: cleanupResult,
      before: beforeCleanup,
      after: afterCleanup,
      freed: {
        heapUsed: beforeCleanup.process.heapUsed - afterCleanup.process.heapUsed,
        rss: beforeCleanup.process.rss - afterCleanup.process.rss
      }
    });
  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      message: error.message
    });
  }
});

module.exports = router; 