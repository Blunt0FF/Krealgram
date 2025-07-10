const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Импорт моделей
const Post = require('./models/postModel');
const User = require('./models/userModel');
const Conversation = require('./models/conversationModel');

const simulateCloudinaryUpload = (localPath) => {
  // Симуляция Cloudinary URL для тестирования
  const filename = path.basename(localPath);
  return `https://res.cloudinary.com/demo-krealgram/image/upload/v1234567890/${filename}`;
};

const testMigration = async () => {
  console.log('🧪 Starting test migration simulation...');

  try {
    // 1. Test post images migration
    console.log('📸 Testing post images migration...');
    const posts = await Post.find({ image: { $not: /^http/ } }); // Only local images
    console.log(`Found ${posts.length} posts with local images`);
    
    for (let i = 0; i < Math.min(posts.length, 3); i++) {
      const post = posts[i];
      const localPath = path.join(__dirname, 'uploads', post.image);
      
      if (fs.existsSync(localPath)) {
        const simulatedUrl = simulateCloudinaryUpload(localPath);
        console.log(`📸 Would migrate: ${post.image} -> ${simulatedUrl}`);
        
        // Uncomment to actually update the database:
        // await Post.findByIdAndUpdate(post._id, { image: simulatedUrl });
      } else {
        console.log(`⚠️  File not found: ${localPath}`);
      }
    }

    // 2. Test user avatars migration
    console.log('\n👤 Testing user avatars migration...');
    const users = await User.find({ avatar: { $exists: true, $not: /^http/ } });
    console.log(`Found ${users.length} users with local avatars`);
    
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      const user = users[i];
      const localPath = path.join(__dirname, 'uploads', user.avatar);
      
      if (fs.existsSync(localPath)) {
        const simulatedUrl = simulateCloudinaryUpload(localPath);
        console.log(`👤 Would migrate: ${user.avatar} -> ${simulatedUrl}`);
        
        // Uncomment to actually update the database:
        // await User.findByIdAndUpdate(user._id, { avatar: simulatedUrl });
      } else {
        console.log(`⚠️  Avatar file not found: ${localPath}`);
      }
    }

    // 3. Test message media migration
    console.log('\n💬 Testing message media migration...');
    const conversations = await Conversation.find({
      'messages.media.url': { $not: /^http/ }
    });
    console.log(`Found ${conversations.length} conversations with local media`);
    
    for (let i = 0; i < Math.min(conversations.length, 2); i++) {
      const conversation = conversations[i];
      
      for (const message of conversation.messages) {
        if (message.media && message.media.url && !message.media.url.startsWith('http')) {
          const localPath = path.join(__dirname, message.media.url.replace(/^\//, ''));
          
          if (fs.existsSync(localPath)) {
            const simulatedUrl = simulateCloudinaryUpload(localPath);
            console.log(`💬 Would migrate: ${message.media.url} -> ${simulatedUrl}`);
            
            // Uncomment to actually update the database:
            // message.media.url = simulatedUrl;
          } else {
            console.log(`⚠️  Message media file not found: ${localPath}`);
          }
        }
      }
      
      // Uncomment to actually save the conversation:
      // await conversation.save();
    }

    console.log('\n🎉 Test migration simulation completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Get real Cloudinary credentials from https://cloudinary.com/users/register_free');
    console.log('2. Update .env file with real credentials');
    console.log('3. Run: node migrate-to-cloudinary.js');
    console.log('4. Uncomment database update lines in this script for actual migration');
    
  } catch (error) {
    console.error('💥 Test migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run test migration
testMigration(); 