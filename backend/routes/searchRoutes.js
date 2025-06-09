const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middlewares/authMiddleware');

// @route   GET /api/search/users
// @desc    Поиск пользователей по имени пользователя (username)
// @access  Private
// Пример запроса: /api/search/users?q=john&page=1&limit=10
router.get('/users', authMiddleware, searchController.searchUsers);

module.exports = router; 