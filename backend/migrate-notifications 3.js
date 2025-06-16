const mongoose = require('mongoose');
require('dotenv').config();

// Старая модель
const oldNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment', 'follow'], required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  read: { type: Boolean, default: false }
}, { timestamps: true });

const OldNotification = mongoose.model('OldNotification', oldNotificationSchema, 'notifications');

// Новая модель
const UserNotifications = require('./models/notificationModel');

async function migrateNotifications() {
  try {
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Подключено к MongoDB');

    console.log('Начинаем миграцию уведомлений...');
    
    // Получаем все старые уведомления
    const oldNotifications = await OldNotification.find({});
    console.log(`Найдено ${oldNotifications.length} старых уведомлений`);

    // Группируем по получателям
    const notificationsByUser = {};
    
    for (const notification of oldNotifications) {
      const userId = notification.recipient.toString();
      
      if (!notificationsByUser[userId]) {
        notificationsByUser[userId] = {
          notifications: [],
          unreadCount: 0
        };
      }

      const newNotification = {
        _id: new mongoose.Types.ObjectId(),
        sender: notification.sender,
        type: notification.type,
        post: notification.post,
        comment: notification.comment,
        read: notification.read,
        createdAt: notification.createdAt
      };

      notificationsByUser[userId].notifications.push(newNotification);
      
      if (!notification.read) {
        notificationsByUser[userId].unreadCount++;
      }
    }

    console.log(`Группировано по ${Object.keys(notificationsByUser).length} пользователям`);

    // Создаем новые документы
    let migratedCount = 0;
    for (const [userId, userData] of Object.entries(notificationsByUser)) {
      // Сортируем уведомления по дате (новые сначала)
      userData.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      await UserNotifications.create({
        userId: new mongoose.Types.ObjectId(userId),
        notifications: userData.notifications,
        unreadCount: userData.unreadCount
      });

      migratedCount++;
      
      if (migratedCount % 100 === 0) {
        console.log(`Перенесено ${migratedCount} пользователей...`);
      }
    }

    console.log(`✅ Миграция завершена! Перенесено ${migratedCount} пользователей с ${oldNotifications.length} уведомлениями`);
    
    // Опционально: переименовываем старую коллекцию
    console.log('Переименовываем старую коллекцию notifications в notifications_backup...');
    await mongoose.connection.db.collection('notifications').rename('notifications_backup');
    console.log('✅ Старая коллекция переименована в notifications_backup');

  } catch (error) {
    console.error('Ошибка при миграции:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Отключено от MongoDB');
  }
}

// Запускаем миграцию
migrateNotifications(); 
 
 
 