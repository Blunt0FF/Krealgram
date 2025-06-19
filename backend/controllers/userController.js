const User = require('../models/userModel');
const Post = require('../models/postModel');
const { addNotification, removeNotification } = require('./notificationController');
const mongoose = require('mongoose');
const sharp = require('sharp'); // Импортируем sharp

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

    // Добавляем полные URL для изображений постов пользователя
    if (user.posts && user.posts.length > 0) {
      user.posts = user.posts.map(post => ({
        ...post,
        imageUrl: post.image.startsWith('http') ? post.image : `${req.protocol}://${req.get('host')}/uploads/${post.image}`,
        likeCount: post.likes ? post.likes.length : 0,
        commentCount: post.comments ? post.comments.length : 0
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Явно добавляем postsCount
    user.postsCount = user.posts ? user.posts.length : 0;
    
    // Подсчитываем только существующих подписчиков и подписки
    // Фильтруем null значения (удаленные пользователи)
    const validFollowers = user.followers ? user.followers.filter(f => f !== null) : [];
    const validFollowing = user.following ? user.following.filter(f => f !== null) : [];
    
    user.followersCount = validFollowers.length;
    user.followingCount = validFollowing.length;

    // Если есть удаленные пользователи, очищаем их из базы
    if (user.followers && validFollowers.length !== user.followers.length) {
      await User.updateOne(
        { _id: user._id },
        { 
          $pull: { 
            followers: null 
          }
        }
      );
      console.log(`Cleaned ${user.followers.length - validFollowers.length} deleted followers from user ${user._id}`);
    }

    if (user.following && validFollowing.length !== user.following.length) {
      await User.updateOne(
        { _id: user._id },
        { 
          $pull: { 
            following: null 
          }
        }
      );
      console.log(`Cleaned ${user.following.length - validFollowing.length} deleted following from user ${user._id}`);
    }

    // Можно добавить информацию о том, подписан ли текущий пользователь на этого пользователя (если req.user существует)
    if (req.user) {
        user.isFollowedByCurrentUser = validFollowers.some(followerId => followerId.equals(req.user.id));
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

    // Обработка аватара - проверяем файл (через multer) или параметр удаления
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    // Если загружен новый файл аватара
    if (req.file) {
      // Сохраняем только имя файла, а не полный URL
      fieldsToUpdate.avatar = req.file.filename;
    } 
    // Если нужно удалить аватар
    else if (removeAvatar === 'true') {
      fieldsToUpdate.avatar = null;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ message: 'Нет данных для обновления.' });
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
    let { avatar: base64AvatarInput } = req.body; // Ожидаем строку base64

    // Проверяем, что base64AvatarInput является строкой. Пустая строка разрешена для удаления.
    if (typeof base64AvatarInput !== 'string') {
      return res.status(400).json({ message: 'Поле avatar должно быть строкой.' });
    }
    
    let finalProcessedBase64Avatar; // Изменено имя переменной во избежание конфликтов

    if (base64AvatarInput.trim() === '') {
      // Пользователь хочет удалить аватар
      finalProcessedBase64Avatar = '';
    } else {
      let base64Data = base64AvatarInput;
      // Удаляем префикс data URI, если он есть
      if (base64Data.startsWith('data:image')) {
        const parts = base64Data.split(',');
        if (parts.length > 1) {
            base64Data = parts[1];
        } else {
            // Некорректный data URI
            return res.status(400).json({ message: 'Некорректный формат Data URI для аватара.' });
        }
      }

      if (!base64Data) { // Если после удаления префикса осталась пустая строка, но изначально не была пустой
        return res.status(400).json({ message: 'Некорректный формат base64 для аватара.' });
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');

      const processedImageBuffer = await sharp(imageBuffer)
        .resize({ 
          width: 250, 
          height: 250, 
          fit: sharp.fit.cover,
          withoutEnlargement: true 
        })
        .webp({ quality: 80 })
        .toBuffer();
      
      finalProcessedBase64Avatar = `data:image/webp;base64,${processedImageBuffer.toString('base64')}`;

      // Уменьшим лимит, т.к. base64 раздувает размер.
      // 700KB base64 это ~525KB картинка. Для аватара должно хватить.
      if (finalProcessedBase64Avatar.length > 0.7 * 1024 * 1024) { 
        return res.status(400).json({ message: 'Размер аватара после обработки слишком большой (макс ~0.5MB).' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: finalProcessedBase64Avatar } }, // Используем правильную переменную
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    res.status(200).json({
      message: finalProcessedBase64Avatar === '' ? 'Аватар успешно удален' : 'Аватар успешно обновлен и сжат',
      user: updatedUser
    });

  } catch (error) {
    console.error('Ошибка обновления аватара:', error);
    // Добавим более специфичную проверку для ошибок sharp
    if (error.message.includes('Input buffer contains unsupported image format') || error.message.includes('Input buffer is invalid')) {
        return res.status(400).json({ message: 'Неподдерживаемый или поврежденный формат изображения для аватара.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.message });
    }
    res.status(500).json({ message: 'На сервере произошла ошибка при обновлении аватара.', error: error.message });
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

    // Фильтруем только существующих пользователей
    const validFollowers = user.followers.filter(follower => follower !== null && follower);
    
    // Если есть удаленные пользователи, очищаем их из базы
    if (validFollowers.length !== user.followers.length) {
      await User.updateOne(
        { _id: userId },
        { 
          $pull: { 
            followers: null 
          }
        }
      );
      console.log(`Cleaned ${user.followers.length - validFollowers.length} deleted followers from user ${userId}`);
    }

    res.status(200).json({
      message: 'Список подписчиков успешно получен',
      followers: validFollowers
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

    // Фильтруем только существующих пользователей
    const validFollowing = user.following.filter(following => following !== null && following);
    
    // Если есть удаленные пользователи, очищаем их из базы
    if (validFollowing.length !== user.following.length) {
      await User.updateOne(
        { _id: userId },
        { 
          $pull: { 
            following: null 
          }
        }
      );
      console.log(`Cleaned ${user.following.length - validFollowing.length} deleted following from user ${userId}`);
    }

    res.status(200).json({
      message: 'Список подписок успешно получен',
      following: validFollowing
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

    if (!profileOwner) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Профиль не найден.' });
    }

    // Специальная обработка для удаленных пользователей (followerId === 'null' или 'deleted')
    if (followerId === 'null' || followerId === 'deleted') {
      // Удаляем все null значения из подписчиков
      const originalFollowersCount = profileOwner.followers.length;
      profileOwner.followers = profileOwner.followers.filter(id => id !== null);
      
      await profileOwner.save({ session });
      await session.commitTransaction();
      session.endSession();

      const removedCount = originalFollowersCount - profileOwner.followers.length;
      console.log(`Removed ${removedCount} deleted users from followers of user ${userId}`);

      // Получаем обновленные счетчики
      const updatedProfileOwner = await User.findById(userId).select('followers following').lean();

      return res.status(200).json({
        message: `Удалено ${removedCount} удаленных подписчиков.`,
        followersCount: updatedProfileOwner.followers.length,
        followingCount: updatedProfileOwner.following.length
      });
    }

    // Обычная логика для существующих пользователей
    const followerUser = await User.findById(followerId).session(session);

    if (!followerUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Подписчик не найден.' });
    }

    // Проверяем, что пользователь действительно является подписчиком
    const isFollower = profileOwner.followers.some(id => id && id.equals(followerId));
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