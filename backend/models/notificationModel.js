const mongoose = require('mongoose');

// Схема для отдельного уведомления внутри документа пользователя
const singleNotificationSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  sender: { // Пользователь, который инициировал событие
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: { // Тип уведомления
    type: String,
    enum: ['like', 'comment', 'follow'], // Возможные типы
    required: true
  },
  post: { // Ссылка на пост (для лайков, комментариев к посту)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  comment: { // Ссылка на комментарий (если уведомление о новом комментарии)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  read: { // Статус прочтения
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Основная схема документа уведомлений пользователя
const userNotificationsSchema = new mongoose.Schema({
  userId: { // ID пользователя, владельца уведомлений
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  notifications: [singleNotificationSchema], // Массив уведомлений
  unreadCount: { // Кэшированное количество непрочитанных уведомлений
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true // createdAt и updatedAt для документа
});

// Индекс уже создается через unique: true выше

module.exports = mongoose.model('UserNotifications', userNotificationsSchema); 