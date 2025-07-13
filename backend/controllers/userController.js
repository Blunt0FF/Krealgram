const User = require('../models/userModel');
const Post = require('../models/postModel');
const { addNotification, removeNotification } = require('./notificationController');
const mongoose = require('mongoose');
const sharp = require('sharp'); // Импортируем sharp
const googleDrive = require('../config/googleDrive');
const uploadProcessedToGoogleDrive = require('../middlewares/uploadMiddleware').uploadProcessedToGoogleDrive;
const multer = require('multer');

// Настройка multer для обработки файлов
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 МБ
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'), false);
    }
  }
}).single('avatar');

// @desc    Получение профиля пользователя по ID или username
// @route   GET /api/users/:identifier
// @access  Public (или Private, если профили закрыты)
exports.getUserProfile = async (req, res) => {
  try {
    const { identifier } = req.params;
    let user;

    // Проверяем, является ли идентификатор валидным ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier)
        .select('-password -email') // Не отдаем пароль и email публично
        .populate({
            path: 'posts',
            select: 'image caption likes comments createdAt author',
            populate: [
                { path: 'author', select: 'username avatar _id' }, // Добавил _id на всякий случай
                { 
                    path: 'comments', 
                    select: 'text user createdAt _id',
                    populate: { path: 'user', select: 'username avatar _id' } // Добавил _id
                }
            ]
        })
        .lean();
    } else {
      // Если не ObjectId, предполагаем, что это username
      user = await User.findOne({ username: identifier })
        .select('-password -email')
        .populate({
            path: 'posts',
            select: 'image caption likes comments createdAt author',
            populate: [
                { path: 'author', select: 'username avatar _id' }, // Добавил _id
                { 
                    path: 'comments', 
                    select: 'text user createdAt _id',
                    populate: { path: 'user', select: 'username avatar _id' } // Добавил _id
                }
            ]
        })
        .lean();
    }

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    console.log('[PROFILE_DEBUG] User data:', {
      username: user.username,
      avatar: user.avatar,
      postsCount: user.posts ? user.posts.length : 0,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0
    });

    // Добавляем полные URL для изображений постов пользователя
    if (user.posts && user.posts.length > 0) {
      user.posts = user.posts.map(post => {
        console.log(`[PROFILE_DEBUG] Post details:`, {
          postId: post._id,
          image: post.image,
          imageUrl: post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`,
          comments: post.comments
        });

        const commentCount = post.comments ? post.comments.length : 0;
        console.log(`[DEBUG] Post ${post._id} comments:`, {
          commentsArray: post.comments,
          commentsCount: commentCount,
          commentsType: typeof post.comments,
          commentsIsArray: Array.isArray(post.comments)
        });

        return {
          ...post,
          imageUrl: post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`,
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
  upload(req, res, async (uploadError) => {
    if (uploadError) {
      console.error('[AVATAR_UPLOAD_ERROR]', uploadError);
      return res.status(400).json({ 
        message: uploadError.message || 'Ошибка загрузки файла' 
      });
    }

    try {
      const userId = req.user.id;
      const { bio } = req.body;

      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'Пользователь не найден.' });
      }

      const fieldsToUpdate = {};
      if (bio !== undefined) {
        fieldsToUpdate.bio = bio.trim();
      }

      // Обработка аватара
      if (req.file) {
        console.log('[AVATAR_UPLOAD_DEBUG] Файл получен:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });

        // Обработка изображения с помощью sharp
        const processedImageBuffer = await sharp(req.file.buffer)
          .resize({ width: 500, height: 500, fit: 'cover' }) // Квадратное изображение
          .webp({ quality: 80 })
          .toBuffer();

        // Генерируем уникальное имя файла
        const safeUsername = currentUser.username.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();
        const driveFilename = `avatar_${safeUsername}_${timestamp}.webp`;

        // Загружаем в Google Drive
        const uploadResult = await uploadProcessedToGoogleDrive(
          processedImageBuffer, 
          driveFilename, 
          'image/webp', 
          'avatar', 
          process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID
        );

        // Удаляем старый аватар
        if (currentUser.avatar && currentUser.avatar.includes('drive.google.com')) {
          try {
            const fileId = currentUser.avatar.split('id=')[1];
            if (fileId) {
              await googleDrive.deleteFile(fileId);
            }
          } catch(e) {
            console.error('Не удалось удалить старый аватар:', e);
          }
        }

        fieldsToUpdate.avatar = uploadResult.secure_url;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        fieldsToUpdate, 
        { new: true, select: '-password -email' }
      );

      res.status(200).json(updatedUser);

    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      res.status(500).json({ 
        message: 'Не удалось обновить профиль', 
        error: error.message 
      });
    }
  });
};

// @desc    Обновление аватара текущего пользователя
// @route   PUT /api/users/profile/avatar
// @access  Private
exports.updateUserAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    let { avatar: base64AvatarInput } = req.body;

    console.log('[AVATAR_DEBUG] Incoming avatar data:', {
      userId,
      avatarLength: base64AvatarInput ? base64AvatarInput.length : 'No data'
    });

    if (typeof base64AvatarInput !== 'string') {
      return res.status(400).json({ message: 'Поле avatar должно быть строкой.' });
    }

    let avatarUrl = '';

    if (base64AvatarInput.trim() === '') {
      // Пользователь хочет удалить аватар
      avatarUrl = '';
    } else {
      let base64Data = base64AvatarInput;
      // Удаляем префикс data URI, если он есть
      if (base64Data.startsWith('data:image')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) {
          base64Data = parts[1];
        } else {
          return res.status(400).json({ message: 'Некорректный формат Data URI для аватара.' });
        }
      }

      if (!base64Data) {
        return res.status(400).json({ message: 'Некорректный формат base64 для аватара.' });
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log('[AVATAR_DEBUG] Image buffer details:', {
        bufferLength: imageBuffer.length,
        mimeType: base64AvatarInput.split(';')[0].split(':')[1]
      });

      // Обрабатываем изображение
      const processedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 500, height: 500, fit: 'cover' }) // Квадратное изображение
        .webp({ quality: 80 })
        .toBuffer();

      console.log('[AVATAR_DEBUG] Processed image details:', {
        processedBufferLength: processedImageBuffer.length
      });

      // Загружаем в Google Drive
      const uploadResult = await googleDrive.uploadFile(
        processedImageBuffer,
        `avatar-${userId}-${Date.now()}.webp`,
        'image/webp',
        process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID
      );

      console.log('[AVATAR_DEBUG] Upload result:', {
        directUrl: uploadResult.directUrl,
        fileId: uploadResult.fileId
      });

      avatarUrl = uploadResult.directUrl;
    }

    // Получаем текущего пользователя чтобы удалить старый аватар
    const currentUser = await User.findById(userId);
    if (currentUser.avatar && currentUser.avatar.includes('drive.google.com')) {
      try {
        const fileId = currentUser.avatar.split('id=')[1];
        if (fileId) {
          await googleDrive.deleteFile(fileId);
          console.log(`[AVATAR_DEBUG] Старый аватар ${fileId} удален.`);
        }
      } catch (error) {
        console.error(`[AVATAR_DEBUG] Не удалось удалить старый аватар: ${error.message}`);
      }
    }

    // Обновляем пользователя
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    ).select('-password');

    console.log('[AVATAR_DEBUG] Updated user:', {
      username: updatedUser.username,
      avatar: updatedUser.avatar
    });

    res.status(200).json(updatedUser);

  } catch (error) {
    console.error('[AVATAR_DEBUG] Ошибка обновления аватара:', error);
    res.status(500).json({ 
      message: 'На сервере произошла ошибка при обновлении аватара.',
      error: error.message 
    });
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