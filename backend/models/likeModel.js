const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Пользователь для лайка обязателен']
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'Пост для лайка обязателен']
  }
}, { 
  timestamps: true // Добавляет createdAt (когда был поставлен лайк) и updatedAt
});

// Составной уникальный индекс, чтобы пользователь мог лайкнуть пост только один раз
likeSchema.index({ user: 1, post: 1 }, { unique: true });

// Дополнительные индексы, если потребуются для специфических запросов
// likeSchema.index({ post: 1, createdAt: -1 }); // Например, для получения лайков поста, отсортированных по времени

module.exports = mongoose.model('Like', likeSchema); 