const Conversation = require('../models/conversationModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { processYouTubeUrl, createMediaResponse, validateMediaFile } = require('../utils/mediaHelper');
const googleDrive = require('../config/googleDrive');
const Post = require('../models/postModel'); // Добавляем импорт Post
// Удаляем импорт onlineUsers и io
// const { onlineUsers, io } = require('../index');
const path = require('path'); // Добавляем импорт path
const fs = require('fs/promises'); // Добавляем импорт fs

// Улучшенная функция генерации безопасного имени файла
const generateSafeFilename = (originalName, prefix = '') => {
  // Удаляем небезопасные символы и ограничиваем длину
  const safeName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')  // Заменяем небезопасные символы
    .replace(/(\.{2,})/g, '.')  // Удаляем множественные точки
    .substring(0, 255);  // Ограничиваем длину

  const timestamp = Date.now();
  const extension = path.extname(safeName);
  const baseFileName = path.basename(safeName, extension);

  // Добавляем префикс, если передан
  const finalPrefix = prefix ? `${prefix}_` : '';

  return `${finalPrefix}${baseFileName}_${timestamp}${extension}`;
};

// Улучшенная функция переименования файла с расширенной отладкой
const safeRenameFile = async (sourcePath, targetPath) => {
  try {
    // Создаем директорию, если она не существует
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    console.log('[FILE_RENAME_DEBUG] Попытка переименования:', {
      source: sourcePath,
      target: targetPath
    });

    // Проверяем существование исходного файла
    await fs.access(sourcePath, fs.constants.F_OK);

    // Переименовываем файл
    await fs.rename(sourcePath, targetPath);

    console.log('[FILE_RENAME_DEBUG] ✅ Файл успешно переименован');
    return targetPath;
  } catch (error) {
    console.error('[FILE_RENAME_DEBUG] ❌ Ошибка переименования:', {
      message: error.message,
      code: error.code,
      source: sourcePath,
      target: targetPath
    });

    // Если переименование не удалось, пробуем скопировать файл
    try {
      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
      console.log('[FILE_RENAME_DEBUG] ✅ Файл скопирован вместо переименования');
      return targetPath;
    } catch (copyError) {
      console.error('[FILE_RENAME_DEBUG] ❌ Ошибка копирования:', copyError.message);
      throw copyError;
    }
  }
};

// @desc    Получение списка диалогов пользователя
// @route   GET /api/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ participants: userId })
      .populate({
        path: 'participants',
        select: 'username avatar email isOnline lastActive',
        match: { _id: { $ne: userId } } // Получаем только другого участника, а не себя
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    // Модифицируем результат, чтобы participants был объектом другого пользователя, а не массивом
    const formattedConversations = conversations.map(conv => {
      // Убедимся, что есть участники и сообщения (для случаев новых пустых диалогов)
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
      // Получаем последнее сообщение из массива сообщений
      const lastMessage = conv.messages && conv.messages.length > 0 
        ? conv.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] 
        : null;
      return {
        _id: conv._id,
        participant: otherParticipant,
        lastMessage: lastMessage,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });

    res.status(200).json({
      message: 'Conversations fetched successfully',
      conversations: formattedConversations
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error while fetching conversations.', error: error.message });
  }
};

// @desc    Получение сообщений для конкретного диалога
// @route   GET /api/conversations/:conversationId/messages
// @access  Private
exports.getMessagesForConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20; // Количество сообщений на запрос
    const offset = parseInt(req.query.offset) || 0; // Смещение от конца

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId // Убедимся, что текущий пользователь является участником диалога
    })
    .populate({
      path: 'messages.sender',
      select: 'username avatar' // Данные отправителя для каждого сообщения
    })
    .populate({
      path: 'messages.sharedPost.post',
      model: 'Post',
      populate: [
        {
          path: 'author',
          model: 'User',
          select: 'username avatar'
        },
        {
          path: 'comments',
          populate: {
            path: 'user',
            model: 'User',
            select: 'username avatar'
          }
        }
      ]
    })
    .select('messages participants'); // Выбираем только сообщения и участников

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found or you do not have access.' });
    }

    // Сортируем сообщения по дате (старые -> новые)
    const sortedMessages = conversation.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const totalMessages = sortedMessages.length;

    // Для offset=0 берем последние limit сообщений
    // Для offset>0 берем сообщения с конца, пропуская offset сообщений
    const endIndex = totalMessages - offset;
    const startIndex = Math.max(0, endIndex - limit);

    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);

    res.status(200).json({
      message: 'Conversation messages fetched successfully',
      conversationId,
      messages: paginatedMessages,
      totalCount: totalMessages,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid conversation ID.' });
    }
    res.status(500).json({ message: 'Server error while fetching messages.', error: error.message });
  }
};

// @desc    Отправка сообщения в диалог
// @route   POST /api/conversations/:recipientId/messages (или просто /api/conversations/send)
// @access  Private
exports.sendMessage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { text, media, youtubeUrl, sharedPost: sharedPostString } = req.body;
    const recipientId = req.params.recipientId;
    const senderId = req.user._id;

    // Получаем глобальный объект io из req, если он был установлен в middleware
    const io = req.app.get('io');

    if (!recipientId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Message recipient not specified.' });
    }

    // Проверяем, существует ли диалог
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    }).session(session);

    // Если диалога нет, создаем новый
    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        messages: []
      });
    }

    const newMessage = {
      sender: senderId,
      text: text ? text.trim() : '',
      createdAt: new Date() // Устанавливаем текущую дату
    };

    // Обработка пересланного поста
    if (sharedPostString) {
      try {
        console.log('Received sharedPost JSON:', sharedPostString);
        const sharedPost = JSON.parse(sharedPostString);
        console.log('Parsed sharedPost:', JSON.stringify(sharedPost, null, 2));

        if (sharedPost && (sharedPost.id || sharedPost._id)) {
          // Проверяем, существует ли пост в базе данных
          const existingPost = await Post.findById(sharedPost.id || sharedPost._id);
          console.log('Existing post:', existingPost ? 'Found' : 'Not found');
          
          if (existingPost) {
            newMessage.sharedPost = {
              post: existingPost._id
            };
          } else {
            // Если пост не найден, создаем временный пост
            const tempPost = new Post({
              author: senderId, // Текущий пользователь как автор
              caption: sharedPost.caption || '',
              image: sharedPost.image || sharedPost.imageUrl,
              imageUrl: sharedPost.imageUrl || sharedPost.image,
              mediaType: sharedPost.mediaType || 'image',
              videoUrl: sharedPost.videoUrl,
              youtubeData: sharedPost.youtubeData,
              createdAt: sharedPost.createdAt || new Date()
            });
            
            console.log('Creating temporary post:', JSON.stringify(tempPost, null, 2));
            
            const savedTempPost = await tempPost.save({ session });
            
            newMessage.sharedPost = {
              post: savedTempPost._id
            };
          }
        }
      } catch(e) {
        console.error("Failed to parse or process sharedPost JSON", e);
        // Не прерываем операцию, просто не добавляем пост
      }
    }

    // Обработка медиа файлов
    if (req.file) {
      // Валидация загруженного файла
      try {
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        validateMediaFile(req.file, fileType);
        
        // Генерируем безопасное имя файла с сохранением оригинального имени
        const safeFilename = generateSafeFilename(req.file.originalname);
        const uploadPath = path.join('uploads', 'messages', safeFilename);

        // Переименовываем файл
        await safeRenameFile(req.file.path, uploadPath);
        
        // Создаем ответ для медиа
        const mediaResponse = {
          type: fileType,
          url: `/uploads/messages/${safeFilename}`,
          filename: req.file.originalname,  // Сохраняем оригинальное имя
          originalFilename: safeFilename,   // Добавляем безопасное имя
          size: req.file.size
        };
        
        console.log('[MEDIA_DEBUG] Media response:', {
          type: mediaResponse.type,
          url: mediaResponse.url,
          filename: mediaResponse.filename,
          originalFilename: mediaResponse.originalFilename,
          size: mediaResponse.size
        });

        newMessage.media = mediaResponse;
        newMessage.image = mediaResponse.url; // Для обратной совместимости
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Media validation failed: ${error.message}` });
      }
    } else if (media) {
      // Медиа передано в JSON (например, для прямых ссылок)
      newMessage.media = media;
    } else if (youtubeUrl) {
      // Обработка YouTube ссылки
      try {
        const youtubeData = processYouTubeUrl(youtubeUrl);
        newMessage.media = createMediaResponse(null, youtubeData);
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `YouTube URL validation failed: ${error.message}` });
      }
    }

    // Добавляем сообщение в диалог
    conversation.messages.push(newMessage);
    conversation.lastMessageAt = newMessage.createdAt;

    await conversation.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Населяем данные последнего сообщения для немедленного отображения на клиенте
    const lastMessageIndex = conversation.messages.length - 1;
    await conversation.populate([
      {
        path: `messages.${lastMessageIndex}.sender`,
        select: 'username avatar'
      },
      {
        path: `messages.${lastMessageIndex}.sharedPost.post`,
        model: 'Post',
        populate: [
          {
            path: 'author',
            select: 'username avatar'
          },
          {
            path: 'comments',
            populate: {
              path: 'user',
              model: 'User',
              select: 'username avatar'
            }
          }
        ]
      }
    ]);
    const sentMessage = conversation.messages[lastMessageIndex];

    // Отправляем уведомление получателю через Socket.IO, если io доступен
    if (io) {
      io.to(recipientId).emit('newMessage', {
        conversationId: conversation._id,
        message: sentMessage,
        sender: req.user
      });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      sentMessage
    });

  } catch (error) {
    console.error('Error sending message:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error while sending message.', error: error.message });
  }
};

// @desc    Удаление сообщения в диалоге
// @route   DELETE /api/conversations/delete-message/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const messageId = req.params.messageId;
    const userId = req.user._id;

    // Находим диалог, содержащий это сообщение
    const conversation = await Conversation.findOne({
      'messages._id': messageId,
      participants: userId
    }).session(session);

    if (!conversation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Conversation not found or message does not exist.' });
    }

    // Проверяем, что сообщение принадлежит текущему пользователю
    const messageToDelete = conversation.messages.find(msg => 
      msg._id.toString() === messageId && msg.sender.toString() === userId.toString()
    );

    if (!messageToDelete) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'You are not authorized to delete this message.' });
    }

    // Удаляем сообщение
    conversation.messages = conversation.messages.filter(msg => 
      msg._id.toString() !== messageId
    );

    // Обновляем последнее сообщение, если нужно
    if (conversation.messages.length > 0) {
      conversation.lastMessageAt = conversation.messages[conversation.messages.length - 1].createdAt;
    } else {
      conversation.lastMessageAt = null;
    }

    await conversation.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ 
      message: 'Message deleted successfully',
      conversationId: conversation._id
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      message: 'Server error while deleting message', 
      error: error.message 
    });
  }
};