// Этот файл нужно запустить на самом Render сервере
// Добавь endpoint в routes для запуска миграции

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');
const GoogleDriveOAuth = require('./config/googleDriveOAuth');

async function migrateCloudinaryToDriveOnRender() {
  console.log('🚀 Начинаем миграцию с Cloudinary на Google Drive на Render...');
  
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Подключились к MongoDB');
    
    // Google Drive уже должен быть настроен в переменных окружения Render
    await GoogleDriveOAuth.initialize();
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
          const newUrl = await downloadAndUploadToDrive(post.image, GoogleDriveOAuth, tempDir, `post_${post._id}_image`);
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
          const newUrl = await downloadAndUploadToDrive(post.thumbnailUrl, GoogleDriveOAuth, tempDir, `post_${post._id}_thumbnail`);
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
          const newUrl = await downloadAndUploadToDrive(post.gifPreview, GoogleDriveOAuth, tempDir, `post_${post._id}_gif`);
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
          const newUrl = await downloadAndUploadToDrive(user.avatar, GoogleDriveOAuth, tempDir, `avatar_${user._id}`);
          user.avatar = newUrl;
          await user.save();
          usersUpdated++;
          console.log(`✅ Обновлен аватар пользователя ${user.username}: ${newUrl}`);
        } catch (error) {
          console.error(`❌ Ошибка миграции аватара пользователя ${user.username}:`, error.message);
        }
      }
    }
    
    // Очищаем временную папку
    console.log('🧹 Очищаем временные файлы...');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    const result = {
      success: true,
      postsUpdated,
      usersUpdated,
      message: 'Миграция завершена успешно!'
    };
    
    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Статистика:`);
    console.log(`   - Постов обновлено: ${postsUpdated}`);
    console.log(`   - Пользователей обновлено: ${usersUpdated}`);
    
    return result;
    
  } catch (error) {
    console.error('💥 Ошибка миграции:', error);
    return { success: false, error: error.message };
  } finally {
    mongoose.connection.close();
  }
}

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
    
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.webm') mimeType = 'video/webm';
    
    // Загружаем на Google Drive
    console.log(`☁️ Загружаем на Google Drive: ${filename}`);
    const driveFile = await googleDrive.uploadFile(
      fileBuffer,
      `${filename}${ext}`,
      mimeType
    );
    
    // Удаляем временный файл
    fs.unlinkSync(tempFilePath);
    
    return driveFile.secure_url;
    
  } catch (error) {
    // Удаляем временный файл в случае ошибки
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw error;
  }
}

module.exports = { migrateCloudinaryToDriveOnRender }; 