const express = require('express');
const router = express.Router();
const { updateInactiveUsers } = require('../utils/userStatusUpdater');
const User = require('../models/userModel');

// @route   POST /api/admin/reset-user-statuses
// @desc    Reset all users to offline status
// @access  Private (Admin only)
router.post('/reset-user-statuses', async (req, res) => {
  try {
    // Reset all users to offline
    const result = await User.updateMany({}, { 
      isOnline: false, 
      lastActive: new Date() 
    });

    res.json({
      success: true,
      message: `Reset ${result.modifiedCount} users to offline status`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error resetting user statuses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset user statuses',
      error: error.message 
    });
  }
});

// @route   POST /api/admin/update-inactive-users
// @desc    Update inactive users status
// @access  Private (Admin only)
router.post('/update-inactive-users', async (req, res) => {
  try {
    const updatedCount = await updateInactiveUsers();
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} inactive users`,
      updatedCount: updatedCount
    });
  } catch (error) {
    console.error('Error updating inactive users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update inactive users',
      error: error.message 
    });
  }
});

// @route   POST /api/admin/migrate-to-drive
// @desc    Migrate all Cloudinary files to Google Drive
// @access  Private (Admin only)
router.post('/migrate-to-drive', async (req, res) => {
  try {
    console.log('🚀 Запуск миграции через API...');
    
    // Импортируем функцию миграции
    const { migrateCloudinaryToDriveOnRender } = require('../migrate-on-render');
    
    // Запускаем миграцию
    const result = await migrateCloudinaryToDriveOnRender();
    
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// @route   GET /api/admin/migration-status
// @desc    Check migration status
// @access  Private (Admin only)
router.get('/migration-status', (req, res) => {
  res.json({ 
    status: 'ready',
    message: 'Миграция готова к запуску',
    endpoint: '/api/admin/migrate-to-drive'
  });
});

module.exports = router; 