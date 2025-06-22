const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const authMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Требуется авторизация.' });
    }

    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Находим пользователя
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден.' });
    }

    // Обновляем только lastActive, но не isOnline
    // isOnline управляется только через WebSocket подключения и logout
    user.lastActive = new Date();
    await user.save();

    // Добавляем пользователя в объект запроса
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Неверный токен.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истек.' });
    }
    console.error('Ошибка аутентификации:', error);
    res.status(500).json({ message: 'На сервере произошла ошибка при аутентификации.', error: error.message });
  }
};

// Опциональный middleware - не блокирует запрос, если нет токена
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // Если токена нет, просто продолжаем без установки req.user
      return next();
    }

    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Находим пользователя
    const user = await User.findById(decoded.id);
    
    if (!user) {
      // Если пользователь не найден, просто продолжаем без установки req.user
      return next();
    }

    // Обновляем lastActive
    user.lastActive = new Date();
    await user.save();

    // Добавляем пользователя в объект запроса
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    // При любых ошибках с токеном просто продолжаем без авторизации
    next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuthMiddleware; 