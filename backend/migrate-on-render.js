// Этот файл нужно запустить на самом Render сервере
// Добавь endpoint в routes для запуска миграции

const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

// Импорт Google Drive
const GoogleDriveManager = require('./config/googleDriveOAuth');

const migrateCloudinaryToDriveOnRender = async () => {
  console.log('🚀 Начинаем миграцию с Cloudinary на Google Drive на Render...');
  
  try {
    // Инициализируем Google Drive
    const googleDrive = new GoogleDriveManager();
    await googleDrive.initialize();
    console.log('✅ Google Drive инициализирован');
    
    // Создаем временную папку для скачивания
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 1. Мигрируем изображения постов
    console.log('📸 Мигрируем изображения постов...');
    const posts = await Post.find({
      $or: [
        { image: { $regex: 'cloudinary.com' } },
        { thumbnailUrl: { $regex: 'cloudinary.com' } },
        { gifPreview: { $regex: 'cloudinary.com' } }
      ]
    });
    
    console.log(`Найдено ${posts.length} постов для миграции`);
    
    let postsUpdated = 0;
    for (const post of posts) {
      let updated = false;
      
      // Мигрируем основное изображение
      if (post.image && post.image.includes('cloudinary.com')) {
        try {
          console.log(`Мигрируем изображение поста ${post._id}...`);
          const newUrl = await downloadAndUploadToDrive(post.image, googleDrive, tempDir, `post_${post._id}_image`);
          post.image = newUrl;
          updated = true;
          console.log(`✅ Обновлено изображение поста: ${newUrl}`);
        } catch (error) {
          console.error(`❌ Ошибка миграции изображения поста ${post._id}:`, error.message);
        }
      }
      
      // Мигрируем превью (thumbnailUrl)
      if (post.thumbnailUrl && post.thumbnailUrl.includes('cloudinary.com')) {
        try {
          console.log(`Мигрируем превью поста ${post._id}...`);
          const newUrl = await downloadAndUploadToDrive(post.thumbnailUrl, googleDrive, tempDir, `post_${post._id}_thumbnail`);
          post.thumbnailUrl = newUrl;
          updated = true;
          console.log(`✅ Обновлено превью поста: ${newUrl}`);
        } catch (error) {
          console.error(`❌ Ошибка миграции превью поста ${post._id}:`, error.message);
        }
      }
      
      // Мигрируем GIF превью
      if (post.gifPreview && post.gifPreview.includes('cloudinary.com')) {
        try {
          console.log(`Мигрируем GIF превью поста ${post._id}...`);
          const newUrl = await downloadAndUploadToDrive(post.gifPreview, googleDrive, tempDir, `post_${post._id}_gif`);
          post.gifPreview = newUrl;
          updated = true;
          console.log(`✅ Обновлено GIF превью поста: ${newUrl}`);
        } catch (error) {
          console.error(`❌ Ошибка миграции GIF превью поста ${post._id}:`, error.message);
        }
      }
      
      if (updated) {
        await post.save();
        postsUpdated++;
        console.log(`✅ Обновлен пост ${post._id}`);
      }
    }
    
    // 2. Мигрируем аватары пользователей
    console.log('👤 Мигрируем аватары пользователей...');
    const users = await User.find({
      avatar: { $regex: 'cloudinary.com' }
    });
    
    console.log(`Найдено ${users.length} пользователей для миграции`);
    
    let usersUpdated = 0;
    for (const user of users) {
      if (user.avatar && user.avatar.includes('cloudinary.com')) {
        try {
          console.log(`Мигрируем аватар пользователя ${user.username}...`);
          const newUrl = await downloadAndUploadToDrive(user.avatar, googleDrive, tempDir, `avatar_${user._id}`);
          user.avatar = newUrl;
          await user.save();
          usersUpdated++;
          console.log(`✅ Обновлен аватар пользователя ${user.username}: ${newUrl}`);
        } catch (error) {
          console.error(`❌ Ошибка миграции аватара пользователя ${user.username}:`, error.message);
        }
      }
    }
    
    // 3. Мигрируем медиа в сообщениях
    console.log('💬 Мигрируем медиа в сообщениях...');
    const conversations = await Conversation.find({
      'messages.media.url': { $regex: 'cloudinary.com' }
    });
    
    console.log(`Найдено ${conversations.length} бесед с медиа для миграции`);
    
    let conversationsUpdated = 0;
    for (const conversation of conversations) {
      let updated = false;
      
      for (const message of conversation.messages) {
        if (message.media && message.media.url && message.media.url.includes('cloudinary.com')) {
          try {
            console.log(`Мигрируем медиа сообщения...`);
            const newUrl = await downloadAndUploadToDrive(message.media.url, googleDrive, tempDir, `message_${message._id}`);
            message.media.url = newUrl;
            updated = true;
            console.log(`✅ Обновлено медиа сообщения: ${newUrl}`);
          } catch (error) {
            console.error(`❌ Ошибка миграции медиа сообщения:`, error.message);
          }
        }
      }
      
      if (updated) {
        await conversation.save();
        conversationsUpdated++;
      }
    }
    
    // Очищаем временную папку
    console.log('🧹 Очищаем временные файлы...');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    const result = {
      success: true,
      message: 'Миграция завершена успешно!',
      stats: {
        postsUpdated,
        usersUpdated,
        conversationsUpdated,
        totalFiles: postsUpdated + usersUpdated + conversationsUpdated
      }
    };
    
    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Статистика:`);
    console.log(`   - Постов обновлено: ${postsUpdated}`);
    console.log(`   - Пользователей обновлено: ${usersUpdated}`);
    console.log(`   - Бесед обновлено: ${conversationsUpdated}`);
    console.log(`\n💡 Все файлы теперь хранятся в Google Drive`);
    
    return result;
    
  } catch (error) {
    console.error('💥 Ошибка миграции:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Функция для скачивания файла с Cloudinary и загрузки на Google Drive
async function downloadAndUploadToDrive(cloudinaryUrl, googleDrive, tempDir, filename) {
  const tempFilePath = path.join(tempDir, `${filename}_${Date.now()}`);
  
  try {
    // Скачиваем файл с Cloudinary
    console.log(`⬇️ Скачиваем файл: ${cloudinaryUrl}`);
    const response = await axios({
      method: 'GET',
      url: cloudinaryUrl,
      responseType: 'stream'
    });
    
    // Сохраняем во временный файл
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Читаем файл как buffer
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Определяем MIME тип по расширению файла
    const ext = path.extname(cloudinaryUrl.split('?')[0]).toLowerCase();
    let mimeType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.png':
        mimeType = 'image/png';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
      case '.mp4':
        mimeType = 'video/mp4';
        break;
      case '.mov':
        mimeType = 'video/quicktime';
        break;
      case '.avi':
        mimeType = 'video/x-msvideo';
        break;
      default:
        mimeType = 'application/octet-stream';
    }
    
    // Загружаем на Google Drive
    const result = await googleDrive.uploadFile(fileBuffer, `${filename}${ext}`, mimeType);
    
    // Удаляем временный файл
    fs.unlinkSync(tempFilePath);
    
    return result.secure_url;
    
  } catch (error) {
    // Удаляем временный файл в случае ошибки
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw error;
  }
}

module.exports = {
  migrateCloudinaryToDriveOnRender
}; 