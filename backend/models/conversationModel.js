const mongoose = require('mongoose');

// Схема для вложенных документов сообщений
const messageSubSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  // Медиа контент
  media: {
    type: {
      type: String,
      enum: ['image', 'video'],
      required: false
    },
    url: {
      type: String,
      required: false
    },
    filename: {
      type: String,
      required: false
    },
    // Для видео YouTube
    youtubeId: {
      type: String,
      required: false
    },
    thumbnail: {
      type: String,
      required: false
    }
  },
  sharedPost: {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [messageSubSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: true
});

// Индексы для оптимизации запросов
conversationSchema.index({ participants: 1 });
conversationSchema.index({ "messages.createdAt": -1 });

module.exports = mongoose.model('Conversation', conversationSchema); 