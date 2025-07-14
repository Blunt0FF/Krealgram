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

// @route   POST api/auth/verify-email
// @desc    Подтверждение email адреса
// @access  Public
router.post('/verify-email', authController.verifyEmail);

// @route   POST api/auth/resend-verification
// @desc    Повторная отправка письма подтверждения
// @access  Public
router.post('/resend-verification', authController.resendVerification);

// @route   GET api/auth/me
// @desc    Получение данных текущего аутентифицированного пользователя
// @access  Private (защищено authMiddleware)
router.get('/me', authMiddleware, authController.getCurrentUser);

// @route   POST api/auth/logout
// @desc    Выход пользователя из системы
// @access  Private (защищено authMiddleware)
router.post('/logout', authMiddleware, authController.logout);

// Новый эндпоинт для пинга
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Backend is alive and ready!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 