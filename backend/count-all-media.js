require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

// Подключение к MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://admin:2282281488Kk@study.flfhk.mongodb.net/krealgram';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

const countAllMedia = async () => {
  try {
    await connectDB();
    
    console.log('\n🔍 ПОДСЧЕТ ВСЕХ МЕДИА ФАЙЛОВ В БАЗЕ ДАННЫХ:\n');
    
    // Подсчитываем все посты
    const totalPosts = await Post.countDocuments();
    console.log(`📊 Всего постов в базе: ${totalPosts}`);
    
    // Подсчитываем посты с медиа
    const postsWithMedia = await Post.find({
      $or: [
        { media: { $exists: true, $ne: null, $ne: '' } },
        { image: { $exists: true, $ne: null, $ne: '' } },
        { video: { $exists: true, $ne: null, $ne: '' } },
        { gif: { $exists: true, $ne: null, $ne: '' } }
      ]
    });
    
    console.log(`📷 Постов с медиа: ${postsWithMedia.length}`);
    
    // Подсчитываем посты с Cloudinary
    const cloudinaryPosts = await Post.find({
      $or: [
        { media: { $regex: /cloudinary\.com/i } },
        { image: { $regex: /cloudinary\.com/i } },
        { video: { $regex: /cloudinary\.com/i } },
        { gif: { $regex: /cloudinary\.com/i } }
      ]
    });
    
    console.log(`☁️ Постов с Cloudinary: ${cloudinaryPosts.length}`);
    
    // Подсчитываем посты с res.cloudinary.com
    const resCloudinaryPosts = await Post.find({
      $or: [
        { media: { $regex: /res\.cloudinary\.com/i } },
        { image: { $regex: /res\.cloudinary\.com/i } },
        { video: { $regex: /res\.cloudinary\.com/i } },
        { gif: { $regex: /res\.cloudinary\.com/i } }
      ]
    });
    
    console.log(`🌐 Постов с res.cloudinary.com: ${resCloudinaryPosts.length}`);
    
    // Подсчитываем посты с Google Drive
    const drivePosts = await Post.find({
      $or: [
        { media: { $regex: /drive\.google\.com/i } },
        { image: { $regex: /drive\.google\.com/i } },
        { video: { $regex: /drive\.google\.com/i } },
        { gif: { $regex: /drive\.google\.com/i } }
      ]
    });
    
    console.log(`🚗 Постов с Google Drive: ${drivePosts.length}`);
    
    // Проверяем пользователей с аватарами
    const usersWithAvatars = await User.find({
      avatar: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`👤 Пользователей с аватарами: ${usersWithAvatars.length}`);
    
    const usersWithCloudinaryAvatars = await User.find({
      avatar: { $regex: /cloudinary\.com/i }
    });
    
    console.log(`☁️ Пользователей с Cloudinary аватарами: ${usersWithCloudinaryAvatars.length}`);
    
    // Проверяем сообщения с медиа
    const conversationsWithMedia = await Conversation.find({
      'messages.media': { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`💬 Диалогов с медиа: ${conversationsWithMedia.length}`);
    
    // Показываем примеры постов с медиа
    console.log('\n📋 ПРИМЕРЫ ПОСТОВ С МЕДИА:');
    
    const samplePosts = await Post.find({
      $or: [
        { media: { $exists: true, $ne: null, $ne: '' } },
        { image: { $exists: true, $ne: null, $ne: '' } },
        { video: { $exists: true, $ne: null, $ne: '' } },
        { gif: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).limit(10);
    
    samplePosts.forEach((post, index) => {
      console.log(`\n${index + 1}. ID: ${post._id}`);
      console.log(`   Контент: ${post.content || 'Нет текста'}`);
      console.log(`   Медиа: ${post.media || 'Нет'}`);
      console.log(`   Изображение: ${post.image || 'Нет'}`);
      console.log(`   Видео: ${post.video || 'Нет'}`);
      console.log(`   GIF: ${post.gif || 'Нет'}`);
      console.log(`   Создан: ${post.createdAt}`);
    });
    
    console.log('\n✅ ПОДСЧЕТ ЗАВЕРШЕН!');
    
  } catch (error) {
    console.error('❌ Ошибка при подсчете медиа:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Отключен от MongoDB');
  }
};

countAllMedia(); 