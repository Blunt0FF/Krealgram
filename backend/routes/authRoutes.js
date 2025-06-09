const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware'); // Мы создадим этот файл следующим

// @route   POST api/auth/register
// @desc    Регистрация нового пользователя
// @access  Public
router.post('/register', authController.register);

// @route   POST api/auth/login
// @desc    Вход пользователя и получение токена
// @access  Public
router.post('/login', authController.login);

// @route   POST api/auth/forgot-password
// @desc    Запрос на сброс пароля
// @access  Public
router.post('/forgot-password', authController.forgotPassword);

// @route   POST api/auth/reset-password
// @desc    Сброс пароля
// @access  Public
router.post('/reset-password', authController.resetPassword);

// @route   GET api/auth/me
// @desc    Получение данных текущего аутентифицированного пользователя
// @access  Private (защищено authMiddleware)
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router; 