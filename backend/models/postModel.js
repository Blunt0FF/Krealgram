const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Post must have an author']
  },
  image: {
    type: String, // Путь к загруженному файлу изображения или видео
    required: false // Будем проверять в контроллере
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  mimeType: {
    type: String,
    trim: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [500, 'Caption cannot be more than 500 characters long']
  },
  // Поле likes здесь также может быть избыточным при наличии отдельной модели Like.
  // Оставляю для соответствия, но для оптимизации лучше получать лайки через модель Like.
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Пользователи, которые лайкнули этот пост
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment' // Комментарии к этому посту
  }],
  youtubeUrl: {
    type: String,
    trim: true
  },
  // Дополнительная информация для YouTube видео и других платформ
  youtubeData: {
    videoId: String,
    embedUrl: String,
    thumbnailUrl: String,
    title: String,
    duration: String,
    platform: String,
    originalUrl: String,
    note: String
  },
  videoUrl: {
    type: String,
    trim: true
  },
  // URL превью для видео (создается Cloudinary для загруженных видео)
  thumbnailUrl: {
    type: String,
    trim: true
  },
  // URL GIF превью для видео (создается Cloudinary)
  gifPreview: {
    type: String,
    trim: true
  },
  // Данные для внешних видео (TikTok, Instagram, VK и т.д.)
  externalVideoData: {
    platform: String, // tiktok, instagram, vk, youtube, twitter
    originalUrl: String, // Оригинальная ссылка
    videoInfo: {
      title: String,
      description: String,
      duration: Number,
      uploader: String,
      thumbnail: String,
      viewCount: Number,
      uploadDate: String
    },
    googleDriveData: {
      fileId: String,
      url: String,
      thumbnailUrl: String,
      duration: Number,
      width: Number,
      height: Number,
      format: String,
      bytes: Number
    }
  },
  thumbnailUrl: {
    type: String,
    default: null
  }
}, { 
  timestamps: true // Добавляет createdAt и updatedAt
});

// Индексы для ускорения запросов
postSchema.index({ author: 1 });
postSchema.index({ createdAt: -1 }); // Для сортировки ленты по времени создания
postSchema.index({ author: 1, createdAt: -1 }); // Для постов конкретного пользователя, отсортированных по времени
postSchema.index({ likes: 1 }); // Добавляем индекс для быстрого поиска по лайкам

// Виртуальное поле для подсчета лайков
postSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Настраиваем схему для включения виртуальных полей при конвертации в JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

// Middleware for cascading delete of comments when a post is deleted
postSchema.pre('remove', async function(next) {
    const Post = this;
    try {
        await mongoose.model('Comment').deleteMany({ post: Post._id });
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Post', postSchema); 