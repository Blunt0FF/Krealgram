const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');

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

    // 1. Migrate post images
    console.log('📸 Migrating post images...');
    const posts = await Post.find({ image: { $not: /^http/ } });
    console.log(`Found ${posts.length} posts with local images`);
    
    for (const post of posts) {
      const localPath = path.join(__dirname, 'uploads', post.image);
      
      if (fs.existsSync(localPath)) {
        try {
          console.log(`Uploading ${post.image}...`);
          const result = await cloudinary.uploader.upload(localPath, {
            folder: 'krealgram/posts',
            transformation: [
              { width: 1080, height: 1080, crop: 'limit', quality: 'auto' }
            ],
          });
          
          // Update post with Cloudinary URL
          await Post.findByIdAndUpdate(post._id, { image: result.secure_url });
          console.log(`✅ Migrated: ${post.image} -> ${result.secure_url}`);
        } catch (error) {
          console.error(`❌ Failed to migrate ${post.image}:`, error.message);
        }
      } else {
        console.log(`⚠️  File not found: ${localPath}`);
      }
    }

    // 2. Migrate user avatars
    console.log('\n👤 Migrating user avatars...');
    const users = await User.find({ avatar: { $exists: true, $not: /^http/ } });
    console.log(`Found ${users.length} users with local avatars`);
    
    for (const user of users) {
      const localPath = path.join(__dirname, 'uploads', user.avatar);
      
      if (fs.existsSync(localPath)) {
        try {
          console.log(`Uploading avatar ${user.avatar}...`);
          const result = await cloudinary.uploader.upload(localPath, {
            folder: 'krealgram/avatars',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
            ],
          });
          
          // Update user with Cloudinary URL
          await User.findByIdAndUpdate(user._id, { avatar: result.secure_url });
          console.log(`✅ Migrated avatar: ${user.avatar} -> ${result.secure_url}`);
        } catch (error) {
          console.error(`❌ Failed to migrate avatar ${user.avatar}:`, error.message);
        }
      } else {
        console.log(`⚠️  Avatar file not found: ${localPath}`);
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