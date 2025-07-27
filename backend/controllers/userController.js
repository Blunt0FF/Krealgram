const User = require('../models/userModel');
const Post = require('../models/postModel');
const { addNotification, removeNotification } = require('./notificationController');
const mongoose = require('mongoose');
const sharp = require('sharp'); // Импортируем sharp
const googleDrive = require('../config/googleDrive');
const path = require('path'); // Импортируем path для получения расширения файла
const fs = require('fs').promises; // Импортируем fs.promises

// @desc    Получение профиля пользователя по ID или username
// @route   GET /api/users/:identifier
// @access  Public (или Private, если профили закрыты)
exports.getUserProfile = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    console.log(`🔍 getUserProfile called with identifier: ${identifier}`);

    let user;

    // Проверяем, является ли идентификатор валидным ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier)
        .select('-password -email')
        .populate({
            path: 'posts',
            select: 'image caption likes comments createdAt author videoData thumbnailUrl youtubeData mediaType videoUrl',
            populate: [
                { path: 'author', select: 'username avatar _id' },
                { 
                    path: 'comments', 
                    select: 'text user createdAt _id',
                    populate: { path: 'user', select: 'username avatar _id' }
                }
            ]
        })
        .lean();
    } else {
      // Если не ObjectId, предполагаем, что это username
      // Используем case-insensitive поиск
      console.log(`🔍 Searching for username: ${identifier}`);
      
      // Сначала попробуем найти без populate
      const basicUser = await User.findOne({ username: { $regex: new RegExp(`^${identifier}$`, 'i') } })
        .select('-password -email')
        .lean();
      
      console.log(`🔍 Basic user search result:`, basicUser ? `Found: ${basicUser.username}` : 'Not found');
      
      if (basicUser) {
        // Если пользователь найден, попробуем с populate
        try {
          user = await User.findById(basicUser._id)
            .select('-password -email')
            .populate({
                path: 'posts',
                select: 'image caption likes comments createdAt author videoData thumbnailUrl youtubeData mediaType videoUrl',
                populate: [
                    { path: 'author', select: 'username avatar _id' },
                    { 
                        path: 'comments', 
                        select: 'text user createdAt _id',
                        populate: { path: 'user', select: 'username avatar _id' }
                    }
                ]
            })
            .lean();
          console.log(`🔍 Populated user result:`, user ? `Found with ${user.posts?.length || 0} posts` : 'Not found after populate');
        } catch (populateError) {
          console.error(`🔍 Populate error:`, populateError);
          // Если populate не работает, используем базового пользователя
          user = basicUser;
        }
      }
    }

    if (!user) {
      // Дополнительная проверка существования пользователя с case-insensitive поиском
      const userExists = await User.findOne({ username: { $regex: new RegExp(`^${identifier}$`, 'i') } }).select('_id');
      
      console.log(`🔍 User search failed. Identifier: ${identifier}`);
      console.log(`🔍 User exists check: ${!!userExists}`);
      if (userExists) {
        console.log(`🔍 Found user ID: ${userExists._id}`);
      }
      
      return res.status(404).json({ 
        message: 'Пользователь не найден.',
        details: {
          identifier,
          userExists: !!userExists,
          userExistsId: userExists?._id
        }
      });
    }
    
    // Проверяем, что пользователь активен (не удален)
    if (!user.username || user.username.trim() === '') {
      return res.status(404).json({ 
        message: 'Пользователь не найден.',
        details: {
          identifier,
          reason: 'empty_username'
        }
      });
    }
    
    // Добавляем безопасную обработку image
    if (user.posts && user.posts.length > 0) {
      user.posts = user.posts.map(post => {
        // Используем ту же логику, что и в уведомлениях - приоритет для thumbnailUrl
        let imageUrl;
        let thumbnailUrl;
        
        // Приоритет для thumbnailUrl (готовые превью)
        if (post.thumbnailUrl) {
          thumbnailUrl = post.thumbnailUrl;
        }
        
        // Для основного изображения всегда используем оригинал
        if (post.image) {
          imageUrl = post.image.startsWith('http') 
            ? post.image 
            : `${req.protocol}://${req.get('host')}/uploads/${post.image}`;
        } else {
          imageUrl = '/default-post-placeholder.png';
        }

        const commentCount = post.comments && Array.isArray(post.comments) 
          ? post.comments.length 
          : 0;

        return {
          ...post,
          imageUrl: imageUrl,
          thumbnailUrl: thumbnailUrl,
          likeCount: post.likes ? post.likes.length : 0,
          commentCount: commentCount
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Явно добавляем postsCount
    user.postsCount = user.posts ? user.posts.length : 0;
    user.followersCount = user.followers ? user.followers.length : 0;
    user.followingCount = user.following ? user.following.length : 0;

    // Можно добавить информацию о том, подписан ли текущий пользователь на этого пользователя (если req.user существует)
    if (req.user) {
        user.isFollowedByCurrentUser = user.followers.some(followerId => followerId.equals(req.user.id));
    } else {
        user.isFollowedByCurrentUser = false; // Для анонимных пользователей
    }

    res.status(200).json({ 
      message: 'Профиль пользователя успешно получен',
      user 
    });

  } catch (error) {
    console.error('Ошибка получения профиля пользователя:', error);
    if (error.kind === 'ObjectId' && !user) { // Если ошибка из-за ObjectId и юзер не найден по username потом
        return res.status(400).json({ message: 'Некорректный идентификатор пользователя.' });
    }
    res.status(500).json({ message: 'На сервере произошла ошибка при получении профиля.', error: error.message });
  }
};

// @desc    Обновление профиля текущего пользователя (например, bio)
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // ID текущего пользователя из authMiddleware
    const { bio, removeAvatar } = req.body;

    const fieldsToUpdate = {};
    if (bio !== undefined) {
      fieldsToUpdate.bio = bio.trim();
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    // Если загружен новый аватар
    if (req.uploadResult) {
      console.log('[AVATAR_UPDATE_DEBUG] Upload result:', req.uploadResult);

      // Проверяем корректность URL
      const avatarUrl = req.uploadResult.secure_url;
      if (!avatarUrl || !avatarUrl.startsWith('http')) {
        console.error('[AVATAR_UPDATE_ERROR] Некорректный URL аватара:', avatarUrl);
        return res.status(400).json({ message: 'Некорректный URL аватара' });
      }

      // Удаляем старый аватар, если он был и хранился на Google Drive
      if (currentUser.avatar && currentUser.avatar.includes('drive.google.com')) {
          try {
              const fileId = currentUser.avatar.split('id=')[1];
              if (fileId) {
                await googleDrive.deleteFile(fileId);
                console.log(`[AVATAR] Старый аватар ${fileId} удален.`);
                
                // Превью аватарки будет удалено в uploadMiddleware.js
                console.log(`[AVATAR] Превью аватарки будет удалено в uploadMiddleware.js`);
              }
          } catch(e) {
              console.error(`[AVATAR] Не удалось удалить старый аватар: ${e.message}`);
          }
      }
      
      // Используем только secure_url
      fieldsToUpdate.avatar = avatarUrl;
      
      // Создаем новый thumbnail для аватарки
      try {
        // Используем thumbnailUrl из uploadResult, если он есть
        if (req.uploadResult.thumbnailUrl) {
          // thumbnailUrl уже обработан
        }
      } catch (thumbError) {
        console.error(`[AVATAR] Не удалось обработать thumbnail: ${thumbError.message}`);
      }
    } 
    // Если нужно удалить аватар
    else if (removeAvatar === 'true') {
      if (currentUser.avatar && currentUser.avatar.includes('drive.google.com')) {
           try {
              const fileId = currentUser.avatar.split('id=')[1];
              if (fileId) {
                await googleDrive.deleteFile(fileId);
              }
          } catch(e) {
              console.error(`[AVATAR] Не удалось удалить аватар по запросу: ${e.message}`);
          }
      }
      fieldsToUpdate.avatar = null;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      // Если не было ни bio, ни файла, но был запрос, возвращаем текущие данные
      return res.status(200).json(currentUser);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: fieldsToUpdate },
      { new: true, runValidators: true } // new: true возвращает обновленный документ, runValidators: true для проверки по схеме
    ).select('-password'); // Не возвращаем пароль

    if (!updatedUser) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    res.status(200).json(updatedUser); // Возвращаем пользователя в том же формате, что ожидает фронтенд

  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.message });
    }
    res.status(500).json({ message: 'На сервере произошла ошибка при обновлении профиля.', error: error.message });
  }
};

// @desc    Обновление аватара текущего пользователя
// @route   PUT /api/users/profile/avatar
// @access  Private
exports.updateUserAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    let avatarUrl = '';

    // Приоритет: сначала файл из multipart, потом base64
    if (req.file) {
      // Используем результат из uploadToGoogleDrive middleware
      avatarUrl = req.uploadResult.secure_url;
    } else if (req.body.avatar) {
      let base64Data = req.body.avatar;
      
      // Удаляем префикс data URI, если он есть
      if (base64Data.startsWith('data:image')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) {
          base64Data = parts[1];
        } else {
          return res.status(400).json({ message: 'Invalid Data URI format for avatar.' });
        }
      }

      if (!base64Data) {
        return res.status(400).json({ message: 'Invalid base64 format for avatar.' });
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Используем оригинальное изображение (сжатие на клиенте)
      const processedImageBuffer = imageBuffer;

      // Создаем thumbnail для аватара
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Загружаем thumbnail в Google Drive
      const thumbnailFilename = `thumb_${req.user.username}.jpeg`;
      const thumbnailResult = await googleDrive.uploadFile(
        thumbnailBuffer,
        thumbnailFilename,
        'image/jpeg',
        process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID
      );

      // Загружаем сжатое изображение в Google Drive
      const uploadResult = await googleDrive.uploadFile(
        processedImageBuffer,
        `avatar_${req.user.username}.jpeg`,
        'image/jpeg',
        process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID
      );

      avatarUrl = uploadResult.secure_url;
    } else {
      // Если нет ни файла, ни base64 - удаляем аватар
      avatarUrl = null;
    }

    // Получаем текущего пользователя чтобы удалить старый аватар
    const currentUser = await User.findById(userId);
    if (currentUser.avatar && currentUser.avatar.includes('drive.google.com')) {
      const fileId = currentUser.avatar.split('id=')[1];
      if (fileId) {
        await googleDrive.deleteFile(fileId);
      }
      
      // Также удаляем thumbnail аватара
      if (currentUser.username) {
        try {
          await googleDrive.deleteAvatarThumbnail(currentUser.username);
        } catch (error) {
          console.error(`[AVATAR] Ошибка удаления thumbnail для ${currentUser.username}:`, error.message);
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: avatarUrl } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      message: avatarUrl === null ? 'Avatar successfully removed' : 'Avatar successfully updated',
      user: updatedUser
    });

  } catch (error) {
    console.error('Avatar update error:', error);
    if (error.message.includes('Input buffer contains unsupported image format') || error.message.includes('Input buffer is invalid')) {
      return res.status(400).json({ message: 'Unsupported or corrupted image format for avatar.' });
    }
    res.status(500).json({ message: 'Server error during avatar update.', error: error.message });
  }
};

// @desc    Подписаться/отписаться от пользователя
// @route   POST /api/users/:userIdToFollow/follow (подписаться)
// @route   DELETE /api/users/:userIdToFollow/follow (отписаться)
// @access  Private
exports.toggleFollowUser = async (req, res) => {
  const currentUserId = req.user.id; // ID текущего пользователя
  const { userIdToFollow } = req.params; // ID пользователя, на которого подписываемся/отписываемся
  const isFollowAction = req.method === 'POST'; // POST = подписаться, DELETE = отписаться

  if (currentUserId.toString() === userIdToFollow.toString()) {
    return res.status(400).json({ message: 'Вы не можете подписаться на самого себя.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currentUser = await User.findById(currentUserId).session(session);
    const userToFollow = await User.findById(userIdToFollow).session(session);

    if (!currentUser || !userToFollow) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Один из пользователей не найден.' });
    }

    const isAlreadyFollowing = currentUser.following.some(id => id.equals(userIdToFollow));

    if (isFollowAction) {
      // Подписаться
      if (isAlreadyFollowing) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Вы уже подписаны на этого пользователя.' });
      }
      
      currentUser.following.push(userIdToFollow);
      userToFollow.followers.push(currentUserId);

      // Создаем уведомление для пользователя, на которого подписались
      await addNotification(userIdToFollow, {
        sender: currentUserId,
        type: 'follow'
      });
    } else {
      // Отписаться
      if (!isAlreadyFollowing) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Вы не подписаны на этого пользователя.' });
      }
      
      currentUser.following.pull(userIdToFollow);
      userToFollow.followers.pull(currentUserId);

      // Удаляем уведомление о подписке, если оно существует
      await removeNotification(userIdToFollow, {
        sender: currentUserId,
        type: 'follow'
      });
    }

    await currentUser.save({ session });
    await userToFollow.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Получаем обновленные счетчики для userToFollow (целевого пользователя)
    const updatedUserToFollowData = await User.findById(userIdToFollow).select('followers following').lean();

    res.status(200).json({
      message: isFollowAction ? 'Вы успешно подписались.' : 'Вы успешно отписались.',
      isFollowing: isFollowAction,
      followersCount: updatedUserToFollowData.followers.length,
      followingCount: updatedUserToFollowData.following.length 
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Ошибка при подписке/отписке:', error);
    res.status(500).json({ message: 'На сервере произошла ошибка.', error: error.message });
  }
};

// @desc    Получить список подписчиков пользователя
// @route   GET /api/users/:userId/followers
// @access  Public (или Private, если требуется аутентификация)
exports.getFollowersList = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username avatar _id bio' // Выбираем нужные поля для отображения в списке
      })
      .select('followers'); // Выбираем только поле followers из основного документа user

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    res.status(200).json({
      message: 'Список подписчиков успешно получен',
      followers: user.followers
    });
  } catch (error) {
    console.error('Ошибка получения списка подписчиков:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Некорректный ID пользователя.' });
    }
    res.status(500).json({ message: 'На сервере произошла ошибка при получении списка подписчиков.', error: error.message });
  }
};

// @desc    Получить список подписок пользователя
// @route   GET /api/users/:userId/following
// @access  Public (или Private)
exports.getFollowingList = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username avatar _id bio' // Выбираем нужные поля
      })
      .select('following');

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    res.status(200).json({
      message: 'Список подписок успешно получен',
      following: user.following
    });
  } catch (error) {
    console.error('Ошибка получения списка подписок:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Некорректный ID пользователя.' });
    }
    res.status(500).json({ message: 'На сервере произошла ошибка при получении списка подписок.', error: error.message });
  }
};

// @desc    Удалить подписчика (только владелец профиля)
// @route   DELETE /api/users/:userId/followers/:followerId
// @access  Private
exports.removeFollower = async (req, res) => {
  const { userId, followerId } = req.params;
  const currentUserId = req.user.id;

  // Проверяем, что текущий пользователь является владельцем профиля
  if (currentUserId.toString() !== userId.toString()) {
    return res.status(403).json({ message: 'Доступ запрещен. Вы можете удалять подписчиков только со своего профиля.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const profileOwner = await User.findById(userId).session(session);
    const followerUser = await User.findById(followerId).session(session);

    if (!profileOwner) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Профиль не найден.' });
    }

    if (!followerUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Подписчик не найден.' });
    }

    // Проверяем, что пользователь действительно является подписчиком
    const isFollower = profileOwner.followers.some(id => id.equals(followerId));
    if (!isFollower) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Пользователь не является подписчиком.' });
    }

    // Удаляем подписчика из списка подписчиков владельца профиля
    profileOwner.followers.pull(followerId);
    
    // Удаляем владельца профиля из списка подписок подписчика
    followerUser.following.pull(userId);

    await profileOwner.save({ session });
    await followerUser.save({ session });

    // Удаляем уведомление о подписке, если оно существует
    await removeNotification(userId, {
      sender: followerId,
      type: 'follow'
    });

    await session.commitTransaction();
    session.endSession();

    // Получаем обновленные счетчики
    const updatedProfileOwner = await User.findById(userId).select('followers following').lean();

    res.status(200).json({
      message: 'Подписчик успешно удален.',
      followersCount: updatedProfileOwner.followers.length,
      followingCount: updatedProfileOwner.following.length
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Ошибка при удалении подписчика:', error);
    res.status(500).json({ message: 'На сервере произошла ошибка при удалении подписчика.', error: error.message });
  }
}; 