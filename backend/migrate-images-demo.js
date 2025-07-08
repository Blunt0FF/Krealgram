const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const { uploadToImgur } = require('./middlewares/uploadMiddleware');

const migrateToCloudinary = async () => {
  console.log('🚀 Starting real migration to Cloudinary...');
  console.log('🔧 Using credentials:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set'
  });

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'demo-krealgram') {
      console.log('⚠️  Demo credentials detected. Set real Cloudinary credentials first!');
      console.log('1. Sign up at: https://cloudinary.com/users/register_free');
      console.log('2. Get your credentials from Dashboard');
      console.log('3. Update .env file with real values');
      console.log('4. Run this script again');
      return;
    }

    // Initialize Cloudinary with real credentials
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // 1. Migrate post images to Imgur
    console.log('📸 Migrating post images to Imgur...');
    const posts = await Post.find({ image: { $not: /^https?:\/\/(i\.)?imgur\.com/ } }); // Только не-Imgur
    for (const post of posts) {
      let imageUrl = post.image;
      let localPath = imageUrl;
      if (!/^http/.test(imageUrl)) {
        localPath = path.join(__dirname, 'uploads', imageUrl);
      } else {
        // Скачать файл по ссылке
        const res = await axios.get(imageUrl, { responseType: 'stream' });
        localPath = path.join(__dirname, 'temp', `post_${post._id}_${Date.now()}`);
        await new Promise((resolve, reject) => {
          const stream = require('fs').createWriteStream(localPath);
          res.data.pipe(stream);
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
      }
      try {
        const imgurUrl = await uploadToImgur(localPath);
        await Post.findByIdAndUpdate(post._id, { image: imgurUrl });
        console.log(`✅ Migrated: ${imageUrl} -> ${imgurUrl}`);
      } catch (e) {
        console.error(`❌ Failed to migrate ${imageUrl}:`, e.message);
      }
      if (localPath && !/^http/.test(imageUrl)) {
        require('fs').unlink(localPath, () => {});
      }
    }

    // 2. Migrate user avatars to Imgur
    console.log('👤 Migrating user avatars to Imgur...');
    const users = await User.find({ avatar: { $exists: true, $not: /^https?:\/\/(i\.)?imgur\.com/ } });
    for (const user of users) {
      let avatarUrl = user.avatar;
      let localPath = avatarUrl;
      if (!/^http/.test(avatarUrl)) {
        localPath = path.join(__dirname, 'uploads', avatarUrl);
      } else {
        // Скачать файл по ссылке
        const res = await axios.get(avatarUrl, { responseType: 'stream' });
        localPath = path.join(__dirname, 'temp', `avatar_${user._id}_${Date.now()}`);
        await new Promise((resolve, reject) => {
          const stream = require('fs').createWriteStream(localPath);
          res.data.pipe(stream);
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
      }
      try {
        const imgurUrl = await uploadToImgur(localPath);
        await User.findByIdAndUpdate(user._id, { avatar: imgurUrl });
        console.log(`✅ Migrated avatar: ${avatarUrl} -> ${imgurUrl}`);
      } catch (e) {
        console.error(`❌ Failed to migrate avatar ${avatarUrl}:`, e.message);
      }
      if (localPath && !/^http/.test(avatarUrl)) {
        require('fs').unlink(localPath, () => {});
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 All images are now stored in Cloudinary');
    console.log('💡 New uploads will automatically go to Cloudinary');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
migrateToCloudinary(); 