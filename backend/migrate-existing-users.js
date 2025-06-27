const mongoose = require('mongoose');
const User = require('./models/userModel');
require('dotenv').config();

const migrateExistingUsers = async () => {
  try {
    console.log('🔄 Подключение к базе данных...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Подключено к MongoDB');

    console.log('🔄 Обновление существующих пользователей...');
    
    // Обновляем всех пользователей у которых нет поля isEmailVerified
    const result = await User.updateMany(
      { 
        $or: [
          { isEmailVerified: { $exists: false } },
          { isEmailVerified: null }
        ]
      },
      { 
        $set: { isEmailVerified: true },
        $unset: { 
          emailVerificationToken: "",
          emailVerificationExpires: ""
        }
      }
    );

    console.log(`✅ Обновлено пользователей: ${result.modifiedCount}`);
    
    // Получаем статистику
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
    const unverifiedUsers = await User.countDocuments({ isEmailVerified: false });

    console.log('\n📊 Статистика:');
    console.log(`Всего пользователей: ${totalUsers}`);
    console.log(`Подтвержденных: ${verifiedUsers}`);
    console.log(`Неподтвержденных: ${unverifiedUsers}`);

    console.log('\n✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Отключено от MongoDB');
    process.exit(0);
  }
};

// Запускаем миграцию если скрипт вызван напрямую
if (require.main === module) {
  migrateExistingUsers();
}

module.exports = migrateExistingUsers; 