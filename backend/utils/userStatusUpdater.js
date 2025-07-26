const User = require('../models/userModel');

// Функция для установки пользователей как offline, если они не были активны более 5 минут
const updateInactiveUsers = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 минут назад
    
    // Находим всех пользователей, которые онлайн, но не были активны более 5 минут
    await User.updateMany(
      {
        isOnline: true,
        lastActive: { $lt: fiveMinutesAgo }
      },
      {
        $set: { isOnline: false }
      }
    );
    
  } catch (error) {
    console.error('Error updating inactive users:', error);
  }
};

// Функция для запуска периодического обновления статуса
const startUserStatusUpdater = () => {
  // Запускаем каждые 2 минуты
  setInterval(updateInactiveUsers, 2 * 60 * 1000);
  console.log('User status updater started');
};

module.exports = {
  updateInactiveUsers,
  startUserStatusUpdater
}; 