const User = require('../models/userModel');

// Функция для сброса всех пользователей в offline статус
const resetAllUsersToOffline = async () => {
  try {
    const result = await User.updateMany(
      {},
      {
        $set: { isOnline: false }
      }
    );
    
    console.log(`Reset ${result.modifiedCount} users to offline status`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error resetting user statuses:', error);
    throw error;
  }
};

module.exports = {
  resetAllUsersToOffline
}; 