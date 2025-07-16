const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 500
  },
  image: {
    type: String, // URL или путь к видео
    required: true
  },
  videoUrl: {
    type: String
  },
  thumbnailUrl: {
    type: String,
    default: '/default-post-placeholder.png'
  },
  gifPreview: {
    type: String
  },
  youtubeData: {
    platform: String,
    videoId: String,
    originalUrl: String,
    embedUrl: String,
    title: String,
    isExternalLink: {
      type: Boolean,
      default: false
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Like'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Добавляем индекс для быстрого поиска по автору
videoSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Video', videoSchema); 