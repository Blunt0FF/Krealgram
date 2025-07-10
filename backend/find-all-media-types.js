require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

// Подключение к MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://admin:228228@study.flfhk.mongodb.net/Krealgram';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

const findAllMediaTypes = async () => {
  try {
    await connectDB();
    
    console.log('\n🔍 ПОИСК ВСЕХ ТИПОВ МЕДИА В БАЗЕ ДАННЫХ:\n');
    
    // Получаем все посты с медиа
    const allPosts = await Post.find({
      $or: [
        { media: { $exists: true, $ne: null, $ne: '' } },
        { image: { $exists: true, $ne: null, $ne: '' } },
        { video: { $exists: true, $ne: null, $ne: '' } },
        { gif: { $exists: true, $ne: null, $ne: '' } }
      ]
    });
    
    console.log(`📊 Всего постов с медиа: ${allPosts.length}`);
    
    // Анализируем типы медиа
    const mediaTypes = {
      cloudinary: [],
      resCloudinary: [],
      googleDrive: [],
      driveGoogleCom: [],
      httpUrls: [],
      httpsUrls: [],
      localFiles: [],
      googleDriveIds: [],
      unknown: []
    };
    
    allPosts.forEach(post => {
      const mediaFields = [post.media, post.image, post.video, post.gif].filter(Boolean);
      
      mediaFields.forEach(media => {
        if (media.includes('cloudinary.com')) {
          mediaTypes.cloudinary.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.includes('res.cloudinary.com')) {
          mediaTypes.resCloudinary.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.includes('drive.google.com')) {
          mediaTypes.driveGoogleCom.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.startsWith('http://')) {
          mediaTypes.httpUrls.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.startsWith('https://')) {
          mediaTypes.httpsUrls.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.startsWith('/') || media.includes('uploads/')) {
          mediaTypes.localFiles.push({ id: post._id, media, field: getFieldName(post, media) });
        } else if (media.length > 20 && media.length < 50 && !media.includes('/')) {
          // Похоже на Google Drive ID
          mediaTypes.googleDriveIds.push({ id: post._id, media, field: getFieldName(post, media) });
        } else {
          mediaTypes.unknown.push({ id: post._id, media, field: getFieldName(post, media) });
        }
      });
    });
    
    // Выводим результаты
    console.log('\n📋 АНАЛИЗ ТИПОВ МЕДИА:');
    console.log(`☁️  Cloudinary URLs: ${mediaTypes.cloudinary.length}`);
    console.log(`🌐 res.cloudinary.com URLs: ${mediaTypes.resCloudinary.length}`);
    console.log(`🚗 drive.google.com URLs: ${mediaTypes.driveGoogleCom.length}`);
    console.log(`🔗 HTTP URLs: ${mediaTypes.httpUrls.length}`);
    console.log(`🔐 HTTPS URLs: ${mediaTypes.httpsUrls.length}`);
    console.log(`📁 Локальные файлы: ${mediaTypes.localFiles.length}`);
    console.log(`🆔 Google Drive IDs: ${mediaTypes.googleDriveIds.length}`);
    console.log(`❓ Неизвестные: ${mediaTypes.unknown.length}`);
    
    // Показываем примеры каждого типа
    Object.entries(mediaTypes).forEach(([type, items]) => {
      if (items.length > 0) {
        console.log(`\n📄 ПРИМЕРЫ ${type.toUpperCase()}:`);
        items.slice(0, 5).forEach((item, index) => {
          console.log(`${index + 1}. ID: ${item.id}, Поле: ${item.field}`);
          console.log(`   Медиа: ${item.media}`);
        });
        if (items.length > 5) {
          console.log(`   ... и еще ${items.length - 5} файлов`);
        }
      }
    });
    
    // Проверяем пользователей
    console.log('\n👤 АНАЛИЗ АВАТАРОВ ПОЛЬЗОВАТЕЛЕЙ:');
    const users = await User.find({ avatar: { $exists: true, $ne: null, $ne: '' } });
    
    const userAvatarTypes = {
      cloudinary: [],
      resCloudinary: [],
      googleDrive: [],
      httpUrls: [],
      httpsUrls: [],
      localFiles: [],
      googleDriveIds: [],
      unknown: []
    };
    
    users.forEach(user => {
      const avatar = user.avatar;
      if (avatar.includes('cloudinary.com')) {
        userAvatarTypes.cloudinary.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.includes('res.cloudinary.com')) {
        userAvatarTypes.resCloudinary.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.includes('drive.google.com')) {
        userAvatarTypes.googleDrive.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.startsWith('http://')) {
        userAvatarTypes.httpUrls.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.startsWith('https://')) {
        userAvatarTypes.httpsUrls.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.startsWith('/') || avatar.includes('uploads/')) {
        userAvatarTypes.localFiles.push({ id: user._id, avatar, username: user.username });
      } else if (avatar.length > 20 && avatar.length < 50 && !avatar.includes('/')) {
        userAvatarTypes.googleDriveIds.push({ id: user._id, avatar, username: user.username });
      } else {
        userAvatarTypes.unknown.push({ id: user._id, avatar, username: user.username });
      }
    });
    
    console.log(`☁️  Cloudinary аватары: ${userAvatarTypes.cloudinary.length}`);
    console.log(`🌐 res.cloudinary.com аватары: ${userAvatarTypes.resCloudinary.length}`);
    console.log(`🚗 Google Drive аватары: ${userAvatarTypes.googleDrive.length}`);
    console.log(`🆔 Google Drive ID аватары: ${userAvatarTypes.googleDriveIds.length}`);
    console.log(`❓ Неизвестные аватары: ${userAvatarTypes.unknown.length}`);
    
    // Показываем примеры аватаров
    Object.entries(userAvatarTypes).forEach(([type, items]) => {
      if (items.length > 0) {
        console.log(`\n👤 ПРИМЕРЫ АВАТАРОВ ${type.toUpperCase()}:`);
        items.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. User: ${item.username}, ID: ${item.id}`);
          console.log(`   Аватар: ${item.avatar}`);
        });
      }
    });
    
    // Проверяем сообщения
    console.log('\n💬 АНАЛИЗ МЕДИА В СООБЩЕНИЯХ:');
    const conversations = await Conversation.find({
      'messages.media': { $exists: true, $ne: null, $ne: '' }
    });
    
    let messageMediaCount = 0;
    const messageMediaTypes = {
      cloudinary: [],
      resCloudinary: [],
      googleDrive: [],
      httpUrls: [],
      httpsUrls: [],
      localFiles: [],
      googleDriveIds: [],
      unknown: []
    };
    
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        if (msg.media) {
          messageMediaCount++;
          const media = typeof msg.media === 'string' ? msg.media : String(msg.media);
          
          if (media.includes('cloudinary.com')) {
            messageMediaTypes.cloudinary.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.includes('res.cloudinary.com')) {
            messageMediaTypes.resCloudinary.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.includes('drive.google.com')) {
            messageMediaTypes.googleDrive.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.startsWith('http://')) {
            messageMediaTypes.httpUrls.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.startsWith('https://')) {
            messageMediaTypes.httpsUrls.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.startsWith('/') || media.includes('uploads/')) {
            messageMediaTypes.localFiles.push({ convId: conv._id, media, msgId: msg._id });
          } else if (media.length > 20 && media.length < 50 && !media.includes('/')) {
            messageMediaTypes.googleDriveIds.push({ convId: conv._id, media, msgId: msg._id });
          } else {
            messageMediaTypes.unknown.push({ convId: conv._id, media, msgId: msg._id });
          }
        }
      });
    });
    
    console.log(`📊 Всего медиа в сообщениях: ${messageMediaCount}`);
    console.log(`☁️  Cloudinary в сообщениях: ${messageMediaTypes.cloudinary.length}`);
    console.log(`🌐 res.cloudinary.com в сообщениях: ${messageMediaTypes.resCloudinary.length}`);
    console.log(`🚗 Google Drive в сообщениях: ${messageMediaTypes.googleDrive.length}`);
    console.log(`🆔 Google Drive ID в сообщениях: ${messageMediaTypes.googleDriveIds.length}`);
    
    console.log('\n✅ АНАЛИЗ ЗАВЕРШЕН!');
    
  } catch (error) {
    console.error('❌ Ошибка при анализе медиа:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Отключен от MongoDB');
  }
};

function getFieldName(post, media) {
  if (post.media === media) return 'media';
  if (post.image === media) return 'image';
  if (post.video === media) return 'video';
  if (post.gif === media) return 'gif';
  return 'unknown';
}

findAllMediaTypes(); 