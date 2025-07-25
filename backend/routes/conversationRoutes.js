const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { upload, uploadToGoogleDrive } = require('../middlewares/uploadMiddleware');

// @route   GET /api/conversations
// @desc    Получение списка диалогов текущего пользователя
// @access  Private
router.get('/', authMiddleware, conversationController.getConversations);

// @route   GET /api/conversations/:conversationId/messages
// @desc    Получение сообщений для конкретного диалога (с пагинацией)
// @access  Private
router.get('/:conversationId/messages', authMiddleware, conversationController.getMessagesForConversation);

// @route   POST /api/conversations/:recipientId/messages 
// @desc    Отправка сообщения пользователю (создает диалог, если его нет)
// @access  Private
router.post('/:recipientId/messages', authMiddleware, upload.single('media'), uploadToGoogleDrive, conversationController.sendMessage);

// @route   DELETE /api/conversations/messages/:messageId 
// @desc    Удаление сообщения пользователем
// @access  Private
router.delete('/messages/:messageId', authMiddleware, conversationController.deleteMessage);

module.exports = router; 