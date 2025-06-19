const User = require('../models/userModel');

// Функция для установки пользователей как offline, если они не были активны более 15 минут
const updateInactiveUsers = async () => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); // 15 минут назад
    
    // Находим всех пользователей, которые онлайн, но не были активны более 15 минут
    await User.updateMany(
      {
        isOnline: true,
        lastActive: { $lt: fifteenMinutesAgo }
      },
      {
        $set: { isOnline: false }
      }
    );
    
    console.log('Inactive users updated to offline');
  } catch (error) {
    console.error('Error updating inactive users:', error);
  }
};

// Функция для запуска периодического обновления статуса
const startUserStatusUpdater = () => {
  // Запускаем каждые 10 минут (уменьшаем нагрузку на MongoDB)
  setInterval(updateInactiveUsers, 10 * 60 * 1000);
  console.log('User status updater started');
};

module.exports = {
  updateInactiveUsers,
  startUserStatusUpdater
}; 