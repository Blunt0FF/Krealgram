require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/userModel');
const GoogleDriveOAuth = require('./config/googleDriveOAuth');
const axios = require('axios');

// Подключение к MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

const migrateUserAvatars = async () => {
  try {
    await connectDB();
    
    console.log('\n🔄 МИГРАЦИЯ АВАТАРОВ ПОЛЬЗОВАТЕЛЕЙ НА GOOGLE DRIVE\n');
    
    // Инициализация Google Drive
    const googleDrive = new GoogleDriveOAuth();
    await googleDrive.initialize();
    console.log('✅ Google Drive инициализирован');
    
    // Найти пользователей с аватарами в формате Cloudinary ID
    const users = await User.find({
      avatar: { 
        $exists: true, 
        $ne: null, 
        $ne: '',
        $regex: /^krealgram\/posts\/[a-zA-Z0-9]+$/
      }
    });
    
    console.log(`👤 Найдено пользователей с Cloudinary аватарами: ${users.length}`);
    
    if (users.length === 0) {
      console.log('ℹ️  Нет пользователей для миграции');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`\n🔄 Обработка пользователя: ${user.username} (ID: ${user._id})`);
        console.log(`   Старый аватар: ${user.avatar}`);
        
        // Формируем Cloudinary URL
        let cloudinaryUrl = `https://res.cloudinary.com/dibcwdwsd/image/upload/${user.avatar}`;
        console.log(`   Cloudinary URL: ${cloudinaryUrl}`);
        
        // Проверяем существование файла
        try {
          const response = await axios.head(cloudinaryUrl, { timeout: 10000 });
          console.log(`   ✅ Файл существует (${response.status})`);
        } catch (error) {
          console.log(`   ⚠️  Файл не найден или недоступен: ${error.message}`);
          
          // Пробуем разные форматы
          const formats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
          let foundFormat = null;
          
          for (const format of formats) {
            try {
              const urlWithFormat = `${cloudinaryUrl}.${format}`;
              const response = await axios.head(urlWithFormat, { timeout: 5000 });
              console.log(`   ✅ Найден файл с форматом: ${format}`);
              foundFormat = format;
              break;
            } catch (err) {
              // Продолжаем поиск
            }
          }
          
          if (!foundFormat) {
            console.log(`   ❌ Файл не найден ни в одном формате, пропускаем`);
            errorCount++;
            continue;
          }
          
          // Обновляем URL с найденным форматом
          cloudinaryUrl = `${cloudinaryUrl}.${foundFormat}`;
        }
        
        // Скачиваем файл
        console.log(`   📥 Скачивание файла...`);
        const response = await axios.get(cloudinaryUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        // Определяем тип файла
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = contentType.split('/')[1] || 'jpg';
        
        // Загружаем в Google Drive
        console.log(`   📤 Загрузка в Google Drive...`);
        const fileName = `avatar_${user.username}_${user._id}.${extension}`;
        
        const buffer = Buffer.from(response.data);
        const driveResult = await googleDrive.uploadFile(buffer, fileName, contentType);
        const driveFileId = driveResult.fileId || driveResult;
        console.log(`   ✅ Файл загружен в Google Drive: ${driveFileId}`);
        
        // Обновляем пользователя
        await User.findByIdAndUpdate(user._id, {
          avatar: driveFileId
        });
        
        console.log(`   ✅ Аватар пользователя обновлен: ${user.username}`);
        migratedCount++;
        
        // Небольшая пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Ошибка при обработке пользователя ${user.username}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 РЕЗУЛЬТАТЫ МИГРАЦИИ АВАТАРОВ:');
    console.log(`✅ Успешно мигрировано: ${migratedCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log(`📊 Всего обработано: ${users.length}`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 МИГРАЦИЯ АВАТАРОВ ЗАВЕРШЕНА УСПЕШНО!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при миграции аватаров:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Отключен от MongoDB');
  }
};

migrateUserAvatars(); 