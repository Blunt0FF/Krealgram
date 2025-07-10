const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

async function migrateOnRender() {
  console.log('🚀 Запускаем миграцию на Render...');
  
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Подключились к MongoDB');
    
    // Проверяем посты с Cloudinary
    const posts = await Post.find({
      $or: [
        { image: { $regex: 'cloudinary.com' } },
        { thumbnailUrl: { $regex: 'cloudinary.com' } },
        { gifPreview: { $regex: 'cloudinary.com' } }
      ]
    });
    
    console.log(`📊 Найдено ${posts.length} постов с Cloudinary`);
    
    // Для каждого поста заменяем Cloudinary URL на placeholder
    let updated = 0;
    for (const post of posts) {
      let changed = false;
      
      if (post.image && post.image.includes('cloudinary.com')) {
        // Временно заменяем на placeholder до настройки Google Drive
        post.image = '/api/placeholder/image/' + post._id;
        changed = true;
      }
      
      if (post.thumbnailUrl && post.thumbnailUrl.includes('cloudinary.com')) {
        post.thumbnailUrl = '/api/placeholder/thumbnail/' + post._id;
        changed = true;
      }
      
      if (post.gifPreview && post.gifPreview.includes('cloudinary.com')) {
        post.gifPreview = '/api/placeholder/gif/' + post._id;
        changed = true;
      }
      
      if (changed) {
        await post.save();
        updated++;
        console.log(`✅ Обновлен пост ${post._id}`);
      }
    }
    
    // Проверяем пользователей
    const users = await User.find({
      avatar: { $regex: 'cloudinary.com' }
    });
    
    console.log(`👤 Найдено ${users.length} пользователей с Cloudinary аватарами`);
    
    let usersUpdated = 0;
    for (const user of users) {
      if (user.avatar && user.avatar.includes('cloudinary.com')) {
        user.avatar = '/api/placeholder/avatar/' + user._id;
        await user.save();
        usersUpdated++;
        console.log(`✅ Обновлен аватар пользователя ${user.username}`);
      }
    }
    
    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Статистика:`);
    console.log(`   - Постов обновлено: ${updated}`);
    console.log(`   - Пользователей обновлено: ${usersUpdated}`);
    console.log(`\n💡 Все Cloudinary URL заменены на placeholder'ы`);
    console.log(`💡 Настройте Google Drive для полной миграции`);
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateOnRender(); 