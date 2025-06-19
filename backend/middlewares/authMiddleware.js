const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const authMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authorization required.' });
    }

    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Находим пользователя
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // Обновляем lastActive только если прошло больше 5 минут с последнего обновления
    const now = new Date();
    const lastActiveTime = user.lastActive ? new Date(user.lastActive) : new Date(0);
    const timeDifference = now - lastActiveTime;
    const fiveMinutes = 5 * 60 * 1000; // 5 минут в миллисекундах

    if (timeDifference > fiveMinutes) {
      user.lastActive = now;
      await user.save();
    }

    // Добавляем пользователя в объект запроса
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server authentication error.', error: error.message });
  }
};

module.exports = authMiddleware; 