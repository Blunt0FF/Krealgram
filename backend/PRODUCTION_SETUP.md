# Подготовка к продакшену

## Переход на Cloudinary

### 1. Установка зависимостей
```bash
npm install cloudinary
```

### 2. Настройка переменных окружения
Создайте `.env` файл со следующими переменными:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key

# Cloudinary (получить на https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
USE_CLOUDINARY=true

# Сервер
NODE_ENV=production
PORT=3000
```

### 3. Обновление контроллеров для Cloudinary

#### Для постов (postController.js):
```javascript
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// В функции создания поста:
if (req.file) {
  const cloudinaryResult = await uploadToCloudinary(req.file.path, 'posts');
  post.image = cloudinaryResult.url;
  post.cloudinaryId = cloudinaryResult.public_id;
  
  // Удаляем локальный файл после загрузки в Cloudinary
  await deleteLocalFile(req.file.path);
}
```

#### Для сообщений (conversationController.js):
```javascript
// В функции отправки сообщения:
if (req.file) {
  const cloudinaryResult = await uploadToCloudinary(req.file.path, 'messages');
  newMessage.media = {
    type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
    url: cloudinaryResult.url,
    cloudinaryId: cloudinaryResult.public_id
  };
  
  // Удаляем локальный файл
  await deleteLocalFile(req.file.path);
}
```

### 4. Обновление моделей

#### postModel.js:
```javascript
cloudinaryId: {
  type: String,
  required: false // Для обратной совместимости
}
```

#### conversationModel.js:
```javascript
media: {
  // ... существующие поля
  cloudinaryId: {
    type: String,
    required: false
  }
}
```

### 5. Миграция существующих файлов

Создайте скрипт для переноса существующих локальных файлов в Cloudinary:

```javascript
// scripts/migrateToCloudinary.js
const { uploadToCloudinary } = require('../config/cloudinary');
const Post = require('../models/postModel');
const fs = require('fs');
const path = require('path');

async function migratePostImages() {
  const posts = await Post.find({ cloudinaryId: { $exists: false } });
  
  for (const post of posts) {
    if (post.image && post.image.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '..', post.image);
      
      if (fs.existsSync(localPath)) {
        try {
          const result = await uploadToCloudinary(localPath, 'posts');
          post.image = result.url;
          post.cloudinaryId = result.public_id;
          await post.save();
          
          console.log(`Migrated post ${post._id}`);
        } catch (error) {
          console.error(`Failed to migrate post ${post._id}:`, error);
        }
      }
    }
  }
}
```

### 6. Настройка CORS для продакшена

```javascript
// В index.js обновите CORS:
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-domain.com',
  credentials: true,
  // ... остальные настройки
}));
```

### 7. Оптимизация изображений

Cloudinary автоматически оптимизирует изображения. Для дополнительной оптимизации:

```javascript
// При загрузке в Cloudinary:
const result = await cloudinary.uploader.upload(filePath, {
  folder: 'posts',
  transformation: [
    { width: 1080, height: 1080, crop: 'limit' },
    { quality: 'auto:good' },
    { fetch_format: 'auto' }
  ]
});
```

### 8. Мониторинг и логирование

```javascript
// Добавьте в index.js:
if (process.env.NODE_ENV === 'production') {
  // Настройка логирования для продакшена
  const winston = require('winston');
  
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ]
  });
}
```

## Чек-лист перед деплоем

- [ ] Установлен Cloudinary
- [ ] Настроены переменные окружения
- [ ] Обновлены контроллеры для работы с Cloudinary
- [ ] Добавлены поля cloudinaryId в модели
- [ ] Создан скрипт миграции существующих файлов
- [ ] Настроен CORS для продакшена
- [ ] Добавлено логирование
- [ ] Протестирована загрузка медиа
- [ ] Протестирована отправка сообщений с медиа

## Дополнительные возможности

### Автоматическое создание превью для видео:
```javascript
// При загрузке видео в Cloudinary:
const videoResult = await cloudinary.uploader.upload(filePath, {
  resource_type: 'video',
  folder: 'videos',
  eager: [
    { width: 300, height: 300, crop: 'pad', audio_codec: 'none' },
    { width: 160, height: 100, crop: 'crop', gravity: 'south', audio_codec: 'none' }
  ]
});
```

### Адаптивные изображения:
```javascript
// Генерация URL для разных размеров:
const thumbnailUrl = cloudinary.url(publicId, {
  width: 150,
  height: 150,
  crop: 'thumb',
  gravity: 'face'
});
``` 