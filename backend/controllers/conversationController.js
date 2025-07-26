const Conversation = require('../models/conversationModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { processYouTubeUrl, createMediaResponse, validateMediaFile } = require('../utils/mediaHelper');
const googleDrive = require('../config/googleDrive');
const Post = require('../models/postModel'); // Добавляем импорт Post
// Удаляем импорт onlineUsers и io
// const { onlineUsers, io } = require('../index');

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
    const { getMediaUrl } = require('../utils/urlUtils');
    const formattedConversations = conversations.map(conv => {
      // Убедимся, что есть участники и сообщения (для случаев новых пустых диалогов)
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
      // Получаем последнее сообщение из массива сообщений
      let lastMessage = conv.messages && conv.messages.length > 0 
        ? conv.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] 
        : null;
      
      // Обрабатываем URL для медиа в последнем сообщении
      if (lastMessage) {
        if (lastMessage.media && lastMessage.media.url) {
          lastMessage.media.url = getMediaUrl(lastMessage.media.url, lastMessage.media.type || 'image');
        }
        if (lastMessage.image) {
          lastMessage.image = getMediaUrl(lastMessage.image, 'image');
        }
      }
      
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

    // Обрабатываем URL для медиа в сообщениях - используем прокси для Google Drive
    const { getMediaUrl } = require('../utils/urlUtils');
    const processedMessages = paginatedMessages.map(message => {
      if (message.media && message.media.url) {
        message.media.url = getMediaUrl(message.media.url, message.media.type || 'image');
      }
      if (message.image) {
        message.image = getMediaUrl(message.image, 'image');
      }
      return message;
    });

    res.status(200).json({
      message: 'Conversation messages fetched successfully',
      conversationId,
      messages: processedMessages,
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
        const sharedPost = JSON.parse(sharedPostString);

        if (sharedPost && (sharedPost.id || sharedPost._id)) {
          // Проверяем, существует ли пост в базе данных
          const existingPost = await Post.findById(sharedPost.id || sharedPost._id);
          
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
        
        // Сохраняем прямой Google Drive URL, как было раньше
        const mediaResponse = {
          type: fileType,
          url: req.uploadResult.secure_url,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        };
        newMessage.media = mediaResponse;
        newMessage.image = mediaResponse.url; // Для обратной совместимости
      } catch (error) {
        console.error('❌ Ошибка валидации медиа:', error);
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
        console.error('❌ Ошибка обработки YouTube URL:', error);
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
    let sentMessage = conversation.messages[lastMessageIndex];
    
    // Обрабатываем URL для медиа в отправленном сообщении
    if (sentMessage.media && sentMessage.media.url) {
      sentMessage.media.url = getMediaUrl(sentMessage.media.url, sentMessage.media.type || 'image');
    }
    if (sentMessage.image) {
      sentMessage.image = getMediaUrl(sentMessage.image, 'image');
    }

    // Отправляем уведомление получателю через Socket.IO, если io доступен
    if (io) {
      // Создаем копию сообщения для Socket.IO с правильными URL
      const socketMessage = {
        ...sentMessage.toObject ? sentMessage.toObject() : sentMessage
      };
      
      // Обрабатываем URL для медиа в Socket.IO сообщении
      if (socketMessage.media && socketMessage.media.url) {
        socketMessage.media.url = getMediaUrl(socketMessage.media.url, socketMessage.media.type || 'image');
      }
      if (socketMessage.image) {
        socketMessage.image = getMediaUrl(socketMessage.image, 'image');
      }
      
      io.to(recipientId).emit('newMessage', {
        conversationId: conversation._id,
        message: socketMessage,
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

// @desc    Удаление сообщения
// @route   DELETE /api/conversations/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const messageId = req.params.messageId;
    const userId = req.user._id;

    // Находим сообщение и проверяем права на удаление
    const conversation = await Conversation.findOne({
      'messages._id': messageId,
      participants: userId
    }).session(session);

    if (!conversation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Message not found or you do not have permission to delete it.' });
    }

    // Находим конкретное сообщение
    const messageToDelete = conversation.messages.id(messageId);

    if (!messageToDelete) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Message not found.' });
    }

    // Проверяем, что удаляющий пользователь является отправителем сообщения
    if (messageToDelete.sender.toString() !== userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    // Удаление файла с Google Drive, если есть медиа
    if (messageToDelete.media && messageToDelete.media.url) {
      try {
        const googleDrive = require('../config/googleDrive');
        const url = messageToDelete.media.url;
        
        if (url.includes('drive.google.com')) {
          const fileId = url.split('id=')[1] || url.split('/').pop();
          
          if (fileId) {
            await googleDrive.deleteFile(fileId);
            console.log(`[DELETE_MESSAGE] ✅ Successfully deleted media file: ${fileId}`);
          }
        }
      } catch (driveError) {
        console.error('[DELETE_MESSAGE] Error deleting file from Google Drive:', driveError);
        // Не прерываем выполнение, если не удалось удалить файл
      }
    }

    // Удаляем сообщение из массива сообщений
    conversation.messages.pull(messageId);

    // Обновляем lastMessageAt, если это было последнее сообщение
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
      deletedMedia: messageToDelete.media ? messageToDelete.media.url : null
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error while deleting message.', error: error.message });
  }
};