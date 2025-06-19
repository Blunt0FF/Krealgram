const express = require('express');
const router = express.Router();
const { resetAllUsersToOffline } = require('../utils/resetUserStatuses');
const { updateInactiveUsers } = require('../utils/userStatusUpdater');
const User = require('../models/userModel');

// @route   POST /api/admin/reset-user-statuses
// @desc    Сброс всех пользователей в offline статус
// @access  Admin (в production добавить аутентификацию администратора)
router.post('/reset-user-statuses', async (req, res) => {
  try {
    const modifiedCount = await resetAllUsersToOffline();
    res.status(200).json({ 
      message: 'User statuses reset successfully',
      modifiedCount 
    });
  } catch (error) {
    console.error('Error resetting user statuses:', error);
    res.status(500).json({ message: 'Failed to reset user statuses', error: error.message });
  }
});

// @route   POST /api/admin/update-inactive-users
// @desc    Обновить статус неактивных пользователей
// @access  Admin
router.post('/update-inactive-users', async (req, res) => {
  try {
    await updateInactiveUsers();
    res.status(200).json({ 
      message: 'Inactive users updated successfully'
    });
  } catch (error) {
    console.error('Error updating inactive users:', error);
    res.status(500).json({ message: 'Failed to update inactive users', error: error.message });
  }
});

// @route   GET /api/admin/user-statuses
// @desc    Получить статистику по статусам пользователей
// @access  Admin
router.get('/user-statuses', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const offlineUsers = totalUsers - onlineUsers;
    
    // Получить активных пользователей за последние 24 часа
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeToday = await User.countDocuments({ 
      lastActive: { $gte: oneDayAgo } 
    });

    res.status(200).json({
      totalUsers,
      onlineUsers,
      offlineUsers,
      activeToday,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user statuses:', error);
    res.status(500).json({ message: 'Failed to get user statuses', error: error.message });
  }
});

module.exports = router; 