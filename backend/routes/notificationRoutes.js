const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Маршрут для получения уведомлений пользователя
router.get('/', authMiddleware, notificationController.getNotifications);

// Маршрут для пометки всех уведомлений как прочитанных
router.post('/mark-all-read', authMiddleware, notificationController.markAllNotificationsAsRead);

// @route   DELETE /api/notifications/deleted-users
// @desc    Очистить все уведомления от удаленных пользователей
// @access  Private
router.delete('/deleted-users', authMiddleware, notificationController.clearDeletedUserNotifications);

// @route   POST /api/notifications/:notificationId/mark-read
// @desc    Пометить конкретное уведомление как прочитанное
// @access  Private
router.post('/:notificationId/mark-read', authMiddleware, notificationController.markNotificationAsRead);

// @route   DELETE /api/notifications/:notificationId
// @desc    Delete a specific notification
// @access  Private
router.delete('/:notificationId', authMiddleware, notificationController.deleteNotification);

module.exports = router; 