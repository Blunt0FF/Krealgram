const Conversation = require('../models/conversationModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { processYouTubeUrl, createMediaResponse, validateMediaFile } = require('../utils/mediaHelper');
const googleDrive = require('../config/googleDrive');
const { onlineUsers, io } = require('../index'); // ИСПРАВЛЕННЫЙ ПУТЬ

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
          newMessage.sharedPost = {
            post: sharedPost.id || sharedPost._id
          };
        }
      } catch(e) {
        console.error("Failed to parse sharedPost JSON", e);
        // Не прерываем операцию, просто не добавляем пост
      }
    }

    // Обработка медиа файлов
    if (req.file) {
      // Валидация загруженного файла
      try {
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        validateMediaFile(req.file, fileType);
        
        // Создаем ответ для медиа - поддерживаем как Cloudinary, так и локальные файлы
        const mediaResponse = {
          type: fileType,
          url: req.file.path || `/uploads/messages/${req.file.filename}`, // Cloudinary возвращает path
          filename: req.file.originalname,
          size: req.file.size
        };
        
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

    // Отправляем уведомление через WebSocket, если есть
    if (req.app.get('io')) {
      req.app.get('io').to(recipientId.toString()).emit('newMessage', {
        conversationId: conversation._id,
        message: sentMessage
      });
    }

    res.status(200).json({
      conversationId: conversation._id,
      sentMessage: sentMessage
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
};

// @desc    Удаление сообщения из диалога
// @route   DELETE /api/conversations/:conversationId/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  const { conversationId, messageId } = req.params;
  const userId = req.user.id;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Находим диалог и атомарно удаляем сообщение, если пользователь является его автором
    const conversation = await Conversation.findOneAndUpdate(
      { 
        _id: conversationId, 
        'messages._id': messageId,
        'messages.sender': userId // Проверяем авторство прямо в запросе
      },
      { 
        $pull: { messages: { _id: messageId } } 
      },
      { new: false, session } // new: false вернет документ *до* удаления, чтобы мы могли получить данные удаленного сообщения
    );

    // Если conversation === null, значит либо диалог/сообщение не найдены, либо пользователь не автор
    if (!conversation) {
      await session.abortTransaction();
      session.endSession();
      // Проверяем, существует ли диалог, чтобы дать более точную ошибку
      const convExists = await Conversation.findById(conversationId).select('_id').lean();
      if (!convExists) {
        return res.status(404).json({ message: 'Conversation not found.' });
      }
      return res.status(403).json({ message: 'Message not found or you are not authorized to delete it.' });
    }

    // Находим удаленное сообщение в "старом" документе, чтобы получить URL файла
    const message = conversation.messages.find(m => m._id.toString() === messageId);

    // Если в сообщении есть медиафайл, загруженный на Google Drive, удаляем его
    if (message && message.media && message.media.url && message.media.url.includes('drive.google.com')) {
      try {
        const url = new URL(message.media.url);
        const fileId = url.searchParams.get('id');
        if (fileId) {
            console.log(`[DELETE_MSG] Attempting to delete Google Drive file: ${fileId}`);
            await googleDrive.deleteFile(fileId);
            console.log(`[DELETE_MSG] ✅ Successfully deleted Google Drive file: ${fileId}`);
        }
      } catch(error) {
          console.error(`[DELETE_MSG] ❌ Could not delete file from URL ${message.media.url}.`, error.message);
          // Не прерываем операцию, если файл не удалось удалить
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Отправляем уведомление через WebSocket всем участникам диалога
    if (io) {
      conversation.participants.forEach(participantId => {
        io.to(participantId.toString()).emit('messageDeleted', { conversationId, messageId });
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Message deleted successfully',
      conversationId,
      messageId 
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Server error while deleting message.', error: error.message });
  }
};