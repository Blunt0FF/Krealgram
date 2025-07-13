const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const User = require('./models/userModel');
const Post = require('./models/postModel');
const drive = require('./config/googleDrive');

async function uploadFileToDrive(fileUrl) {
  try {
    console.log(`[MIGRATION] Загрузка файла: ${fileUrl}`);
    
    if (!fileUrl) {
      console.warn('[MIGRATION] Пустой URL файла');
      return null;
    }

    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      console.error(`[MIGRATION] Ошибка загрузки файла: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    const fileMetadata = {
      name: path.basename(fileUrl),
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: blob.type || 'application/octet-stream',
      body: Buffer.from(buffer)
    };

    const uploadedFile = await drive.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    const newUrl = `https://drive.google.com/uc?id=${uploadedFile.data.id}`;
    console.log(`[MIGRATION] Файл загружен: ${newUrl}`);
    
    return newUrl;
  } catch (error) {
    console.error('[MIGRATION] Ошибка загрузки файла:', error);
    return null;
  }
}

async function migrateCloudinaryToDriveOnRender() {
  console.log('🚀 Начало миграции медиафайлов в Google Drive');

  try {
    const users = await User.find({});
    const posts = await Post.find({});

    console.log(`📊 Найдено ${posts.length} постов`);
    console.log(`👤 Найдено пользователей: ${users.length}`);

    const migratedPosts = [];
    const migratedUsers = [];
    const failedMigrations = [];

    // Миграция постов
    for (const post of posts) {
      try {
        if (post.image && !post.image.includes('drive.google.com')) {
          const newImageUrl = await uploadFileToDrive(post.image);
          if (newImageUrl) {
            post.image = newImageUrl;
            post.imageUrl = newImageUrl;
            await post.save();
            migratedPosts.push(post._id);
          } else {
            failedMigrations.push({ 
              type: 'post_image', 
              postId: post._id, 
              originalUrl: post.image 
            });
          }
        }

        if (post.thumbnailUrl && !post.thumbnailUrl.includes('drive.google.com')) {
          const newThumbnailUrl = await uploadFileToDrive(post.thumbnailUrl);
          if (newThumbnailUrl) {
            post.thumbnailUrl = newThumbnailUrl;
            await post.save();
          } else {
            failedMigrations.push({ 
              type: 'post_thumbnail', 
              postId: post._id, 
              originalUrl: post.thumbnailUrl 
            });
          }
        }
      } catch (postError) {
        console.error(`[MIGRATION] Ошибка миграции поста ${post._id}:`, postError);
        failedMigrations.push({ 
          type: 'post', 
          postId: post._id, 
          error: postError.message 
        });
      }
    }

    // Миграция аватаров пользователей
    for (const user of users) {
      try {
        if (user.avatar && !user.avatar.includes('drive.google.com')) {
          const newAvatarUrl = await uploadFileToDrive(user.avatar);
          if (newAvatarUrl) {
            user.avatar = newAvatarUrl;
            await user.save();
            migratedUsers.push(user._id);
          } else {
            failedMigrations.push({ 
              type: 'user_avatar', 
              userId: user._id, 
              originalUrl: user.avatar 
            });
          }
        }
      } catch (userError) {
        console.error(`[MIGRATION] Ошибка миграции аватара пользователя ${user._id}:`, userError);
        failedMigrations.push({ 
          type: 'user', 
          userId: user._id, 
          error: userError.message 
        });
      }
    }

    console.log('✅ Миграция медиафайлов завершена');
    
    return { 
      success: true, 
      migratedPosts: migratedPosts.length, 
      migratedUsers: migratedUsers.length,
      failedMigrations,
      details: {
        postIds: migratedPosts,
        userIds: migratedUsers
      }
    };
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    throw new Error(`Миграция не удалась: ${error.message}`);
  }
}

module.exports = { migrateCloudinaryToDriveOnRender }; 