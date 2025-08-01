const User = require('../models/userModel');

// Функция для установки пользователей как offline, если они не были активны более 5 минут
const updateInactiveUsers = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 минут назад
    
    // Проверяем подключение к базе данных
    if (User.db.readyState !== 1) {
      console.log('Database not ready, skipping inactive users update');
      return 0;
    }
    
    // Находим всех пользователей, которые онлайн, но не были активны более 5 минут
    const result = await User.updateMany(
      {
        isOnline: true,
        lastActive: { $lt: fiveMinutesAgo }
      },
      {
        $set: { isOnline: false }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} inactive users to offline`);
    }
    
    return result.modifiedCount;
    
  } catch (error) {
    // Проверяем тип ошибки
    if (error.name === 'PoolClearedOnNetworkError' || 
        error.name === 'MongoNetworkError' || 
        error.name === 'MongoServerSelectionError') {
      console.log('Network error during inactive users update, will retry later');
      return 0;
    }
    
    console.error('Error updating inactive users:', error);
    return 0;
  }
};

// Функция для запуска периодического обновления статуса с обработкой ошибок
const startUserStatusUpdater = () => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const runUpdate = async () => {
    try {
      await updateInactiveUsers();
      retryCount = 0; // Сбрасываем счетчик при успехе
    } catch (error) {
      retryCount++;
      console.error(`User status updater error (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('Max retries reached for user status updater');
        retryCount = 0; // Сбрасываем для следующего цикла
      }
    }
  };
  
  // Запускаем каждые 2 минуты
  setInterval(runUpdate, 2 * 60 * 1000);
  
  // Первый запуск через 30 секунд после старта сервера
  setTimeout(runUpdate, 30 * 1000);
  
  console.log('User status updater started');
};

module.exports = {
  updateInactiveUsers,
  startUserStatusUpdater
}; 