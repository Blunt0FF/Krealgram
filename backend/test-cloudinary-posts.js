const mongoose = require('mongoose');
require('dotenv').config();

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

async function testCloudinaryPosts() {
  try {
    console.log('🔍 Проверяем посты с Cloudinary...');
    
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Подключились к MongoDB');
    
    // Ищем посты с Cloudinary
    const posts = await Post.find({
      $or: [
        { image: { $regex: 'cloudinary.com' } },
        { thumbnailUrl: { $regex: 'cloudinary.com' } },
        { gifPreview: { $regex: 'cloudinary.com' } }
      ]
    });
    
    console.log(`\n📊 Найдено ${posts.length} постов с Cloudinary:`);
    
    posts.forEach((post, index) => {
      console.log(`\n--- Пост ${index + 1} ---`);
      console.log(`ID: ${post._id}`);
      console.log(`Автор: ${post.author}`);
      console.log(`Изображение: ${post.image}`);
      if (post.thumbnailUrl) console.log(`Превью: ${post.thumbnailUrl}`);
      if (post.gifPreview) console.log(`GIF превью: ${post.gifPreview}`);
      console.log(`Тип медиа: ${post.mediaType}`);
      console.log(`Подпись: ${post.caption || 'Нет подписи'}`);
    });
    
    // Ищем пользователей с Cloudinary аватарами
    const users = await User.find({
      avatar: { $regex: 'cloudinary.com' }
    });
    
    console.log(`\n👤 Найдено ${users.length} пользователей с Cloudinary аватарами:`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} - ${user.avatar}`);
    });
    
    // Ищем сообщения с Cloudinary медиа
    const conversations = await Conversation.find({
      'messages.media.url': { $regex: 'cloudinary.com' }
    });
    
    console.log(`\n💬 Найдено ${conversations.length} бесед с Cloudinary медиа`);
    
    let messageCount = 0;
    conversations.forEach(conversation => {
      conversation.messages.forEach(message => {
        if (message.media && message.media.url && message.media.url.includes('cloudinary.com')) {
          messageCount++;
        }
      });
    });
    
    console.log(`📝 Всего сообщений с Cloudinary медиа: ${messageCount}`);
    
    console.log('\n🎯 Итого для миграции:');
    console.log(`   - Постов: ${posts.length}`);
    console.log(`   - Аватаров: ${users.length}`);
    console.log(`   - Сообщений: ${messageCount}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    mongoose.connection.close();
  }
}

testCloudinaryPosts(); 