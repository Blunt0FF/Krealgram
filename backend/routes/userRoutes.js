const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { optionalAuth } = require('../middlewares/authMiddleware');
const { upload, uploadToGoogleDrive } = require('../middlewares/uploadMiddleware');

// Маршрут для получения своего профиля (альтернатива GET /api/users/profile/:identifier, когда не знаешь ID/username)
// @route   GET /api/users/me
// @desc    Получение данных текущего аутентифицированного пользователя (использует authController.getCurrentUser)
// @access  Private 
// router.get('/me', authMiddleware, authController.getCurrentUser); // Это уже есть в authRoutes

// @route   GET /api/users/search
// @desc    Поиск пользователей
// @access  Private
const searchController = require('../controllers/searchController');
router.get('/search', authMiddleware, searchController.searchUsers);

// @route   GET /api/users/profile/:identifier
// @desc    Получение профиля пользователя по ID или username
// @access  Public (authMiddleware здесь для того, чтобы можно было получить доп. инфо, например, isFollowedByCurrentUser)
router.get('/profile/:identifier', optionalAuth, userController.getUserProfile);

// @route   PUT /api/users/profile
// @desc    Обновление профиля текущего пользователя (bio и аватар)
// @access  Private
router.put('/profile', authMiddleware, upload.single('avatar'), uploadToGoogleDrive, userController.updateUserProfile);

// @route   PUT /api/users/profile/avatar
// @desc    Обновление аватара текущего пользователя (с обработкой base64 и сжатием)
// @access  Private
router.put('/profile/avatar', authMiddleware, upload.single('avatar'), uploadToGoogleDrive, userController.updateUserAvatar);

// @route   POST /api/users/:userIdToFollow/follow
// @desc    Подписаться на пользователя
// @access  Private
router.post('/:userIdToFollow/follow', authMiddleware, userController.toggleFollowUser);

// @route   DELETE /api/users/:userIdToFollow/follow  
// @desc    Отписаться от пользователя
// @access  Private
router.delete('/:userIdToFollow/follow', authMiddleware, userController.toggleFollowUser);

// @route   GET /api/users/:userId/followers
// @desc    Получение списка подписчиков пользователя
// @access  Public (можно добавить authMiddleware если информация о подписке текущего пользователя на них важна)
router.get('/:userId/followers', userController.getFollowersList);

// @route   GET /api/users/:userId/following
// @desc    Получение списка подписок пользователя
// @access  Public
router.get('/:userId/following', userController.getFollowingList);

// @route   DELETE /api/users/:userId/followers/:followerId
// @desc    Удалить подписчика (только владелец профиля)
// @access  Private
router.delete('/:userId/followers/:followerId', authMiddleware, userController.removeFollower);

// Тестовый маршрут для проверки существования пользователя
router.get('/test/:username', async (req, res) => {
  try {
    const { username } = req.params;
    console.log(`🧪 Testing user existence: ${username}`);
    
    // Проверяем точное совпадение
    const exactMatch = await require('../models/userModel').findOne({ username });
    console.log(`🧪 Exact match:`, exactMatch ? exactMatch.username : 'NOT FOUND');
    
    // Проверяем case-insensitive поиск
    const caseInsensitiveMatch = await require('../models/userModel').findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    console.log(`🧪 Case-insensitive match:`, caseInsensitiveMatch ? caseInsensitiveMatch.username : 'NOT FOUND');
    
    // Проверяем частичное совпадение
    const partialMatch = await require('../models/userModel').findOne({ 
      username: { $regex: new RegExp(username, 'i') } 
    });
    console.log(`🧪 Partial match:`, partialMatch ? partialMatch.username : 'NOT FOUND');
    
    res.json({
      username,
      exactMatch: !!exactMatch,
      caseInsensitiveMatch: !!caseInsensitiveMatch,
      partialMatch: !!partialMatch,
      exactMatchUser: exactMatch ? { username: exactMatch.username, _id: exactMatch._id } : null,
      caseInsensitiveMatchUser: caseInsensitiveMatch ? { username: caseInsensitiveMatch.username, _id: caseInsensitiveMatch._id } : null,
      partialMatchUser: partialMatch ? { username: partialMatch.username, _id: partialMatch._id } : null
    });
  } catch (error) {
    console.error('Test route error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 