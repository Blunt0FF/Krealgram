const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Подключение к Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

const migrateImages = async () => {
  console.log('🚀 Starting migration to Cloudinary...');

  try {
    // 1. Migrate post images
    console.log('📸 Migrating post images...');
    const posts = await Post.find({ image: { $not: /^http/ } }); // Only local images
    
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
    console.log('👤 Migrating user avatars...');
    const users = await User.find({ avatar: { $exists: true, $not: /^http/ } });
    
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

    // 3. Migrate message media
    console.log('💬 Migrating message media...');
    const conversations = await Conversation.find({
      'messages.media.url': { $not: /^http/ }
    });
    
    for (const conversation of conversations) {
      let updated = false;
      
      for (const message of conversation.messages) {
        if (message.media && message.media.url && !message.media.url.startsWith('http')) {
          const localPath = path.join(__dirname, message.media.url.replace(/^\//, ''));
          
          if (fs.existsSync(localPath)) {
            try {
              console.log(`Uploading message media ${message.media.url}...`);
              const result = await cloudinary.uploader.upload(localPath, {
                folder: 'krealgram/messages',
                resource_type: 'auto',
                transformation: [
                  { width: 800, height: 800, crop: 'limit', quality: 'auto' }
                ],
              });
              
              message.media.url = result.secure_url;
              updated = true;
              console.log(`✅ Migrated message media: ${localPath} -> ${result.secure_url}`);
            } catch (error) {
              console.error(`❌ Failed to migrate message media ${message.media.url}:`, error.message);
            }
          } else {
            console.log(`⚠️  Message media file not found: ${localPath}`);
          }
        }
      }
      
      if (updated) {
        await conversation.save();
      }
    }

    console.log('🎉 Migration completed successfully!');
    console.log('💡 Don\'t forget to update your .env file with real Cloudinary credentials');
    console.log('💡 Set USE_CLOUDINARY=true in your .env file');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
migrateImages(); 