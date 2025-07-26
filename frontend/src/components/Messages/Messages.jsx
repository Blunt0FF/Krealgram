import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import io from 'socket.io-client';
import heic2any from 'heic2any';
import { getRecentUsers, addRecentUser } from '../../utils/recentUsers';
import { getAvatarUrl, getAvatarThumbnailUrl } from '../../utils/imageUtils';
import { getImageUrl } from '../../utils/imageUtils';
import { getVideoUrl } from '../../utils/mediaUrlResolver';
import { formatLastSeen, formatMessageTime } from '../../utils/timeUtils';
import PostModal from '../Post/PostModal';
import ImageModal from '../common/ImageModal';
import SharedPost from './SharedPost';
import './Messages.css';
import '../Post/ShareModal.css';
import { API_URL } from '../../config';
import { getMediaThumbnail, extractYouTubeId, createYouTubeData } from '../../utils/videoUtils';
import axios from 'axios';

// Функция для сжатия изображений (упрощенная версия как в CreatePost)
const compressImage = async (file) => {
  console.log('🔧 Starting compression for:', file.name, 'Size:', file.size, 'Type:', file.type);
  
  // Проверяем размер файла (4 МБ)
  const maxSize = 4 * 1024 * 1024; // 4 МБ
  if (file.size <= maxSize) {
    console.log('🔧 File size is within limits, no compression needed');
    return file;
  }
  
  // Проверяем, является ли файл HEIC/HEIF
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                 file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
  
  if (isHeic) {
    console.log('🔧 HEIC/HEIF file detected, converting to JPEG');
    try {
      // Конвертируем HEIC в JPEG
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      
      const convertedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      console.log('🔧 HEIC converted to JPEG:', {
        originalSize: file.size,
        convertedSize: convertedFile.size
      });
      
      return convertedFile;
    } catch (conversionError) {
      console.warn('⚠️ HEIC conversion failed, using original file:', conversionError);
      return file;
    }
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Проверяем, что изображение загрузилось корректно
      if (img.width === 0 || img.height === 0) {
        console.warn('⚠️ Image has zero dimensions, using original file');
        resolve(file);
        return;
      }
      
      // Устанавливаем размеры canvas (оригинальный размер для достижения 3.4MB)
      const maxWidth = img.width; // Оригинальный размер
      const maxHeight = img.height; // Оригинальный размер
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      console.log('🔧 Canvas dimensions:', width, 'x', height);

      // Рисуем изображение на canvas с правильной ориентацией
      ctx.drawImage(img, 0, 0, width, height);
      
      // Конвертируем в blob
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          console.log('🔧 Compression result:', {
            originalSize: file.size,
            compressedSize: compressedFile.size,
            compressionRatio: (compressedFile.size / file.size * 100).toFixed(1) + '%'
          });
          resolve(compressedFile);
        } else {
          console.warn('⚠️ Blob creation failed, using original file');
          resolve(file);
        }
      }, 'image/jpeg', 0.8); // Качество 80% для достижения 3.4MB
    };
    
    img.onerror = (error) => {
      console.warn('⚠️ Image loading failed, using original file:', error);
      resolve(file);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Компонент превью поста для модального окна выбора пользователя
const PostPreview = ({ post }) => {
  const isVideo = () => {
    const videoIndicators = [
      post.mediaType === 'video',
      post.videoUrl,
      post.youtubeData,
      post.type === 'video'
    ];

    return videoIndicators.some(Boolean);
  };

  const getThumbnailSrc = React.useMemo(() => {
    // Используем точно такую же логику как в уведомлениях
    const urls = [
      post.gifPreview, // ПРИОРИТЕТ 1: GIF превью для видео
      post.preview,    // ПРИОРИТЕТ 2: Обычное превью
      post.thumbnailUrl,
      post.youtubeData?.thumbnailUrl, // ПРИОРИТЕТ 3: YouTube превью
      post.imageUrl,
      post.image,
      '/default-post-placeholder.png'
    ].filter(Boolean);

    return getImageUrl(urls[0]);
  }, [post]);

  const handleImageError = (e) => {
    e.target.onerror = null; // Предотвращаем бесконечный цикл ошибок
    e.target.src = '/default-post-placeholder.png';
  };

  return (
    <img 
      src={getThumbnailSrc} 
      alt="Post preview" 
      className="notification-post-preview"
      onError={handleImageError}
      loading="lazy"
    />
  );
};

const Messages = ({ currentUser }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sharedPost, setSharedPost] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  
  // Новые состояния для отправки изображений
  const [imageToSend, setImageToSend] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null); // Реф для инпута файла
  const [isPostModalOpen, setPostModalOpen] = useState(false);
  const [selectedPostForModal, setSelectedPostForModal] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [conversationsScrollPosition, setConversationsScrollPosition] = useState(0);
  const [messageOffset, setMessageOffset] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  // Обработка пересылаемого поста
  useEffect(() => {
    const handleSharedPost = () => {
      if (location.state?.sharedPost && location.state?.timestamp) {
        const post = location.state.sharedPost;
    
        setSharedPost(post);
        
        // Если есть выбранный диалог, сразу отправляем пост
        if (selectedConversation) {
          sendMessage(null, post);
        } else {
          setShowNewMessageModal(true);
        }
        
        // Очищаем state немедленно
        navigate(location.pathname, { replace: true, state: {} });
      }
    };

    handleSharedPost();
  }, [location.state?.timestamp]); // Зависим от timestamp вместо всего state

  // Загружаем недавних пользователей при открытии модального окна
  useEffect(() => {
    if (showNewMessageModal) {
      const recentUsersData = getRecentUsers();
      setRecentUsers(recentUsersData);
    }
  }, [showNewMessageModal]);

  // Обновляем время каждую минуту для корректного отображения последней активности
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60 секунд

    return () => clearInterval(timer);
  }, []);

  // Сохраняем позицию скролла при скролле списка диалогов
  const handleConversationsScroll = useCallback((e) => {
    setConversationsScrollPosition(e.target.scrollTop);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Функции для работы с недавними пользователями
  const getRecentUsers = () => {
    try {
      const stored = localStorage.getItem('recentUsers');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting recent users:', error);
      return [];
    }
  };

  const addRecentUser = (user) => {
    try {
      const recent = getRecentUsers();
      const filtered = recent.filter(u => u._id !== user._id);
      const updated = [user, ...filtered].slice(0, 5); // Максимум 5 недавних пользователей
      localStorage.setItem('recentUsers', JSON.stringify(updated));
    } catch (error) {
      console.error('Error adding recent user:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Восстанавливаем скролл при закрытии чата
  useEffect(() => {
    if (!isChatOpen && conversationsScrollPosition > 0) {
      const conversationsList = document.querySelector('.conversations-list');
      if (conversationsList) {
        conversationsList.scrollTop = conversationsScrollPosition;
      }
    }
  }, [isChatOpen]);

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
    }
    try {
      setSearchLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      } else {
        console.error('Error searching users:', await response.text());
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    // Прокручиваем в верх при переходе на страницу сообщений
    window.scrollTo(0, 0);
    
    if (currentUser && currentUser._id) {
        fetchConversations().then(fetchedConversations => {
          const queryParams = new URLSearchParams(location.search);
          const recipientId = queryParams.get('recipient');

          if (recipientId) {
            const existingConv = fetchedConversations?.find(c => c.participant?._id === recipientId);
            if (existingConv) {
              selectConversation(existingConv);
            } else {
              // Получаем информацию о пользователе и создаем новый диалог
              console.log('Создаем новый диалог с пользователем ID:', recipientId);
              fetchUserById(recipientId).then(user => {
                console.log('Получен пользователь:', user);
                if (user) {
                  startConversation(user);
                  // Убираем параметр recipient из URL после создания диалога
                  navigate(location.pathname, { replace: true });
                } else {
                  console.warn(`Пользователь с ID ${recipientId} не найден`);
                  navigate(location.pathname, { replace: true });
                }
              }).catch(error => {
                console.error('Ошибка получения пользователя:', error);
                navigate(location.pathname, { replace: true });
              });
            }
          }
        });
    }
  }, [currentUser, location.search, location.pathname, navigate]);

  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchUsers]);

  // Блокировка фонового скролла при открытом модальном окне
  useEffect(() => {
    if (showNewMessageModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showNewMessageModal]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const convs = data.conversations || [];
        setConversations(convs);
        return convs;
      } else {
        console.error('Error fetching conversations:', await response.text());
        setConversations([]);
        return [];
      }
    } catch (error) {
      console.error('Network error fetching conversations:', error);
      setConversations([]);
      return [];
    }
  };

  const fetchUserById = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const response = await fetch(`${API_URL}/api/users/profile/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data.user;
      } else {
        console.error('Error fetching user:', await response.text());
        return null;
      }
    } catch (error) {
      console.error('Network error fetching user:', error);
      return null;
    }
  };

  const selectConversation = async (conversation) => {
    if (!conversation || !conversation._id) {
        setSelectedConversation(null);
        setMessages([]);
        setIsChatOpen(false);
        return;
    }
    
    // Позиция уже сохранена через onScroll
    
    setSelectedConversation(conversation);
    setIsChatOpen(true); // Открываем чат на мобильных
    setMessageOffset(0); // Сбрасываем offset для новой беседы
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/${conversation._id}/messages?limit=20&offset=0`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setTotalMessages(data.totalCount || 0);
        setTimeout(scrollToBottom, 100); // Добавляем небольшую задержку для уверенности что DOM обновился
      } else {
        console.error('Error fetching messages:', await response.text());
        setMessages([]);
        setTotalMessages(0);
      }
    } catch (error) {
      console.error('Network error fetching messages:', error);
      setMessages([]);
      setTotalMessages(0);
    }
  };

  // Новая функция для очистки выбранного изображения
  const clearImageToSend = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageToSend(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreview]);

  // Обновленная функция отправки сообщений
  const sendMessage = async (e, recipientIdOverride = null) => {
    if (e) e.preventDefault();
    
    const text = newMessage.trim();
    const postToShare = sharedPost;
    const fileToSend = imageToSend;

    if (!text && !postToShare && !fileToSend) return;
    
    const recipientId = recipientIdOverride || selectedConversation?.participant?._id;
    if (!recipientId) return;

    setIsSending(true);

    const formData = new FormData();
    formData.append('text', text);
    if (postToShare) {
      // Проверяем, что пост имеет все необходимые поля
      const validPost = {
        id: postToShare.id || postToShare._id,
        image: postToShare.image || postToShare.imageUrl,
        caption: postToShare.caption || '',
        author: typeof postToShare.author === 'object' 
          ? postToShare.author.username 
          : postToShare.author,
        createdAt: postToShare.createdAt || new Date().toISOString(),
        // Добавляем поддержку видео постов
        mediaType: postToShare.mediaType,
        videoUrl: postToShare.videoUrl,
        youtubeData: postToShare.youtubeData,
        thumbnailUrl: postToShare.thumbnailUrl,
        gifPreview: postToShare.gifPreview
      };
      
      formData.append('sharedPost', JSON.stringify(validPost));
    }
    if (fileToSend) {
      formData.append('media', fileToSend, fileToSend.name);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/${recipientId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Ошибка отправки сообщения: ${await response.text()}`);
      }
      
      const data = await response.json();
      const { sentMessage } = data;

      // Мгновенно обновляем состояние сообщений с помощью ответа от сервера
      setMessages(prevMessages => [...prevMessages, sentMessage]);

      // Очищаем поля ввода
      setNewMessage('');
      clearImageToSend();
      setSharedPost(null);
      setShowNewMessageModal(false);

      // Обновляем список диалогов (например, для обновления lastMessage)
      const fetchedConvs = await fetchConversations();
      
      // Если это был новый диалог, обновляем его ID, чтобы он перестал быть временным
      const newConvId = selectedConversation?._id?.startsWith('temp_') ? data.conversationId : selectedConversation._id;
      const currentConv = fetchedConvs.find(c => c._id === newConvId);
      if (currentConv) {
          setSelectedConversation(currentConv);
      }
      
      scrollToBottom();

    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // Обновленный обработчик выбора файла
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      
      try {
        let processedFile = file;
        
        // Сжимаем только изображения, видео оставляем как есть
        if (file.type.startsWith('image/')) {
          try {
            processedFile = await compressImage(file);
            console.log('✅ Image compressed successfully');
          } catch (compressionError) {
            console.warn('⚠️ Compression failed, using original file:', compressionError.message);
            // В случае ошибки сжатия используем оригинальный файл
            processedFile = file;
          }
        }
        
        setImageToSend(processedFile);
        setImagePreview(URL.createObjectURL(processedFile));
      } catch (error) {
        console.error('❌ Error processing file:', error);
        // В случае любой ошибки используем оригинальный файл
        setImageToSend(file);
        setImagePreview(URL.createObjectURL(file));
      }
    }
  };

  const startConversation = async (userToChatWith) => {
    if (!userToChatWith || !userToChatWith._id) return null;
    if (currentUser && userToChatWith._id === currentUser._id) {
        return null;
    }

    // Добавляем пользователя в недавние с полными данными
    try {
      // Убеждаемся, что у пользователя есть все необходимые данные
      const userWithFullData = {
        _id: userToChatWith._id,
        username: userToChatWith.username,
        avatar: userToChatWith.avatar,
        // Добавляем другие поля, если они есть
        ...userToChatWith
      };
      addRecentUser(userWithFullData);
      setRecentUsers(getRecentUsers());
    } catch (error) {
      console.log('Ошибка при работе с недавними пользователями:', error);
    }

    const existingConversation = conversations.find(
      (conv) => conv.participant && conv.participant._id === userToChatWith._id
    );

    if (existingConversation) {
      setSelectedConversation(existingConversation);
      setIsChatOpen(true);
      
      // Загружаем сообщения для существующего диалога
      setMessageOffset(0);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/conversations/${existingConversation._id}/messages?limit=20&offset=0`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
          setTotalMessages(data.totalCount || 0);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setMessages([]);
        setTotalMessages(0);
      }

      // Закрываем модальное окно
      setShowNewMessageModal(false);
      return existingConversation;
    } 

    // Создаем новый временный диалог
    const newConversation = {
      _id: `temp_${userToChatWith._id}`,
      participant: userToChatWith,
      lastMessage: null,
      lastMessageAt: new Date().toISOString()
    };

    setConversations(prev => [newConversation, ...prev]);
    setSelectedConversation(newConversation);
    setIsChatOpen(true);
    setMessages([]);
    setMessageOffset(0);
    setTotalMessages(0);
    
    // Закрываем модальное окно
    setShowNewMessageModal(false);
    return newConversation;
  };

  const sendPostToUser = async (userToChatWith) => {

    if (!userToChatWith || !sharedPost) {
      console.warn('Missing data for sending post:', { userToChatWith, sharedPost });
      return;
    }

    try {
      const conversation = await startConversation(userToChatWith);
      if (conversation) {
        // Список приоритетных источников изображения
        const imageSources = [
          sharedPost.imageUrl, 
          sharedPost.image, 
          sharedPost.thumbnailUrl,
          '/default-post-placeholder.png',
          '/video-placeholder.svg'
        ].filter(Boolean);

        const postToShare = {
          id: sharedPost._id || sharedPost.id || '',
          image: imageSources[0] || '',
          imageUrl: imageSources[0] || '',
          caption: sharedPost.caption || '',
          author: typeof sharedPost.author === 'object' 
            ? sharedPost.author.username 
            : sharedPost.author || 'Unknown',
          createdAt: sharedPost.createdAt || new Date().toISOString(),
          mediaType: sharedPost.mediaType || 
            (sharedPost.videoUrl ? 'video' : 
            (sharedPost.youtubeData ? 'youtube' : 'image')),
          thumbnailUrl: imageSources[1] || imageSources[0] || '',
          // Добавляем поддержку видео постов
          videoUrl: sharedPost.videoUrl,
          youtubeData: sharedPost.youtubeData,
          gifPreview: sharedPost.gifPreview
        };



        // Отправляем сообщение с постом
        await sendMessage(null, conversation.participant._id);
        
        // Очищаем sharedPost после отправки
        setSharedPost(null);
      }
    } catch (error) {
      console.error('Ошибка при отправке поста:', error);
    }
};

  const openImageModal = (imageSrc) => {
    setSelectedImage(imageSrc);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setImageModalOpen(false);
  };

  const loadOlderMessages = async () => {
    if (!selectedConversation || loadingOlderMessages) return;
    
    setLoadingOlderMessages(true);
    const newOffset = messageOffset + messages.length;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/${selectedConversation._id}/messages?limit=20&offset=${newOffset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const olderMessages = data.messages || [];
        
        if (olderMessages.length > 0) {
          // Сохраняем текущую позицию скролла
          const messagesArea = document.querySelector('.messages-area');
          const scrollHeight = messagesArea?.scrollHeight || 0;
          
          // Добавляем старые сообщения в начало
          setMessages(prevMessages => [...olderMessages, ...prevMessages]);
          setMessageOffset(newOffset);
          
          // Восстанавливаем позицию скролла после добавления сообщений
          setTimeout(() => {
            if (messagesArea) {
              const newScrollHeight = messagesArea.scrollHeight;
              messagesArea.scrollTop = newScrollHeight - scrollHeight;
            }
          }, 50);
        }
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const backToConversations = () => {
    setIsChatOpen(false);
    setSelectedConversation(null);
    setMessages([]);
    setMessageOffset(0);
    setTotalMessages(0);
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get('/api/conversations/get-messages', {
        params: { conversationId: selectedConversation._id }
      });
      // ... existing code ...
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete message: ${errorText}`);
      }

      const data = await response.json();

      // Обновляем список сообщений
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg._id !== messageId)
      );

      // Обновляем список диалогов
      fetchConversations();

      // Закрываем модальное окно подтверждения
      setShowDeleteConfirm(false);
      setMessageToDelete(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      // Показываем уведомление об ошибке
      alert('Не удалось удалить сообщение. Попробуйте позже.');
    }
  };

  const handleDeleteClick = (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (messageToDelete) {
      deleteMessage(messageToDelete);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setMessageToDelete(null);
  };

  const handlePostClickInMessage = (post) => {
    console.log('Clicked post in message:', post);
    
    // Проверяем, что пост имеет все необходимые поля
    const postToOpen = {
      ...post,
      author: typeof post.author === 'object' 
        ? post.author 
        : { username: post.author },
      image: post.image || post.imageUrl,
      thumbnailUrl: post.thumbnailUrl || post.image || post.imageUrl,
      mediaType: post.mediaType || 
                 (post.videoUrl ? 'video' : 
                 (post.youtubeData ? 'youtube' : 'image')),
      // Добавляем поддержку YouTube данных
      youtubeData: post.youtubeData,
      videoUrl: post.videoUrl,
      // Добавляем гиф превью для видео
      gifPreview: post.gifPreview
    };

    setSelectedPostForModal(postToOpen);
    setPostModalOpen(true);
  };

  const closePostModal = () => {
    setPostModalOpen(false);
    setSelectedPostForModal(null);
  };

  // Универсальная функция для проверки, что сообщение отправлено текущим пользователем
  const isMyMessage = (msg) => {
    if (!msg || !msg.sender || !currentUser) return false;
    if (typeof msg.sender === 'string') return msg.sender === currentUser._id;
    if (typeof msg.sender === 'object') return msg.sender._id === currentUser._id;
    return false;
  };

  // Если пользователь не загружен, показываем загрузку
  if (!currentUser) {
    return <div className="messages-loading">Loading user data...</div>;
  }

  const renderMessageMedia = (message) => {
    if (!message.media || !message.media.url) {
      return null;
    }

    try {
      // Список всех возможных источников URL
      const urlSources = [
        message.media.url,
        message.media.imageUrl,
        message.media.thumbnailUrl,
        message.media.image,
        '/default-post-placeholder.png'
      ].filter(Boolean);

      const processedUrl = getImageUrl(urlSources[0], 'image');

      const handleImageError = (e) => {
        e.target.src = urlSources[urlSources.length - 1];
      };

      return (
        <img 
          src={processedUrl} 
          alt="Медиа в сообщении" 
          onClick={() => openImageModal(processedUrl)}
          onError={handleImageError}
          style={{ 
            maxWidth: '300px', 
            maxHeight: '300px', 
            objectFit: 'contain', 
            cursor: 'pointer' 
          }}
        />
      );
    } catch (error) {
      return null;
    }
  };

  return (
    <div className="messages-container">
      <div className={`messages-sidebar ${isChatOpen ? 'hidden-mobile' : ''}`}>
        <div className="messages-header">
          <h2>Messages</h2>
                      <button 
              className="new-message-btn" 
              onClick={() => setShowNewMessageModal(true)}
              title="New message"
            >
              <img src="/plus.svg" alt="New message" width="24" height="24" />
          </button>
        </div>
        
        <div className="conversations-list" onScroll={handleConversationsScroll}>
          {conversations.length === 0 && !showNewMessageModal ? (
            <div className="no-conversations">
              <h3>Your Messages</h3>
              <p>Send private photos and messages to friends.</p>
              <button className="send-message-btn" onClick={() => setShowNewMessageModal(true)}>
                Send message
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv._id || conv.participant?._id}
                className={`conversation-item ${selectedConversation?._id === conv._id || (selectedConversation?.participant?._id === conv.participant?._id && selectedConversation?._id?.startsWith('temp_')) ? 'active' : ''} ${!conv.participant?.username ? 'deleted-user' : ''}`}
                onClick={() => selectConversation(conv)}
              >
                <div className="conversation-content"> 
                  <img 
                    src={conv.participant?.avatar ? getAvatarThumbnailUrl(conv.participant.avatar) : '/default-avatar.png'}
                    alt={conv.participant?.username || 'User'}
                    className={`conversation-avatar ${!conv.participant?.username ? 'deleted-user-avatar' : ''}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <div className="conversation-info">
                    <div className="conversation-name-row">
                      <span className={`conversation-name ${!conv.participant?.username ? 'deleted-user-name' : ''}`}>
                        {conv.participant?.username || 'DELETED USER'}
                      </span>
                      {conv.participant?.username && conv.participant?.isOnline && <span className="online-indicator">●</span>}
                    </div>
                    <span className="conversation-last-message">
                      {conv.lastMessage ? (
                        isMyMessage(conv.lastMessage) ? (
                          conv.lastMessage.media && conv.lastMessage.media.type === 'image' ? 
                            'You: Sent a photo' :
                                                     conv.lastMessage.media && conv.lastMessage.media.type === 'video' ? 
                             'You: Sent a video' :
                          conv.lastMessage.sharedPost ? 
                            'You: Shared a post' :
                          conv.lastMessage.text ? 
                            `You: ${conv.lastMessage.text.substring(0, 25)}${conv.lastMessage.text.length > 25 ? '...' : ''}` :
                          typeof conv.lastMessage === 'object' ? 
                            'You: Sent a message' :
                            conv.lastMessage
                        ) : (
                          conv.lastMessage.media && conv.lastMessage.media.type === 'image' ? 
                            'Sent a photo' :
                          conv.lastMessage.media && conv.lastMessage.media.type === 'video' ? 
                            'Sent a video' :
                          conv.lastMessage.sharedPost ? 
                            'Shared a post' :
                          conv.lastMessage.text ? 
                            `${conv.lastMessage.text.substring(0, 25)}${conv.lastMessage.text.length > 25 ? '...' : ''}` :
                          typeof conv.lastMessage === 'object' ? 
                            'Sent a message' :
                            conv.lastMessage
                        )
                      ) : (
                        conv._id?.startsWith('temp_') ? 'Start conversation...' : 'No messages'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`messages-main ${isChatOpen ? 'chat-open' : ''}`}>
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <button className="back-btn mobile-only-back" onClick={backToConversations}>
                <img src="/arrow-left.svg" alt="Back" width="24" height="24" />
              </button>
              <div 
                className="chat-header-content"
                onClick={() => {
                  if (selectedConversation.participant?.username) {
                    navigate(`/profile/${selectedConversation.participant.username}`);
                  }
                }}
                style={{ 
                  cursor: selectedConversation.participant?.username ? 'pointer' : 'default', 
                  display: 'flex', 
                  alignItems: 'center', 
                  flex: 1 
                }}
              >
                <img 
                  src={getAvatarThumbnailUrl(selectedConversation.participant?.avatar)} 
                  alt={selectedConversation.participant?.username}
                  className={`chat-avatar ${!selectedConversation.participant?.username ? 'deleted-user-avatar' : ''}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.png';
                  }}
                />
                <div className="chat-user-info">
                  <span className={`chat-username ${!selectedConversation.participant?.username ? 'deleted-user-name' : ''}`}>
                    {selectedConversation.participant?.username || 'DELETED USER'}
                  </span>
                  {selectedConversation.participant?.username && (() => {
                    const statusText = formatLastSeen(selectedConversation.participant?.lastActive, selectedConversation.participant?.isOnline);
                    const isOnline = statusText === 'Online';
                    return (
                      <span className={`chat-status ${isOnline ? 'online' : 'offline'}`}>
                        {statusText}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="messages-area">
              {totalMessages > messages.length && (
                <div className="load-older-messages">
                  <button 
                    className="load-older-btn"
                    onClick={loadOlderMessages}
                    disabled={loadingOlderMessages}
                  >
                    {loadingOlderMessages ? 'Loading...' : `Show older messages (${totalMessages - messages.length})`}
                  </button>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message ${message.sender?._id === currentUser?._id ? 'sent' : 'received'}`}
                >
                  {message.sender?._id !== currentUser?._id && (
                    <img
                      src={getAvatarThumbnailUrl(message.sender?.avatar)}
                      alt={message.sender?.username || 'User'}
                      className="message-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.png';
                      }}
                    />
                  )}
                  <div className="message-wrapper">
                    {message.sender?._id === currentUser?._id && (
                      <button 
                        className="message-options-btn"
                        onClick={() => handleDeleteClick(message._id)}
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                    {message.sender?._id !== currentUser?._id && (
                        <span className="message-author">{message.sender?.username || 'User'}</span>
                    )}
                    <div className="message-content">
                      {message.sharedPost?.post ? (
                        <SharedPost 
                          post={message.sharedPost.post} 
                          onPostClick={handlePostClickInMessage}
                        />
                      ) : (
                        (() => {
                          // Проверяем, есть ли YouTube-ссылка в тексте
                          const text = message.text;
                          const youtubeData = text ? createYouTubeData(text) : null;
                          if (youtubeData) {
                            return (
                              <div className="message-youtube" style={{ marginTop: '4px' }}>
                                <iframe
                                  width="370"
                                  height="208"
                                  src={youtubeData.embedUrl}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  style={{ borderRadius: '8px', maxWidth: '100%' }}
                                ></iframe>
                              </div>
                            );
                          } else if (text) {
                            return <p>{text}</p>;
                          }
                          return null;
                        })()
                      )}
                      {message.media && message.media.type === 'image' && (
                        <div 
                          className="message-image" 
                          onClick={() => {
                            // Извлекаем URL с максимальным приоритетом
                            const urlSources = [
                              message.media.url,
                              message.media.imageUrl,
                              message.media.thumbnailUrl,
                              message.media.image,
                              '/default-post-placeholder.png'
                            ].filter(Boolean);

                            const processedUrl = getImageUrl(urlSources[0]);
                            
                            // Проверка доступности изображения
                            const img = new Image();
                            img.onload = () => {
                              console.log('Image successfully loaded:', processedUrl);
                              openImageModal(processedUrl);
                            };
                            img.onerror = () => {
                              console.warn('Image load failed, using fallback:', processedUrl);
                              openImageModal(urlSources[urlSources.length - 1]);
                            };
                            img.src = processedUrl;
                          }}
                        >
                          {renderMessageMedia(message)}
                        </div>
                      )}
                      {message.media && message.media.type === 'video' && (
                        <div className="message-video" style={{ marginTop: '4px' }}>
                          <video 
                            src={getVideoUrl(message.media.url)} 
                            controls
                            poster={(() => {
                              // Создаем превью для Cloudinary видео
                              if (message.media.url && message.media.url.includes('cloudinary.com')) {
                                return message.media.url.replace(
                                  '/video/upload/',
                                  '/video/upload/w_400,c_limit,f_jpg,so_0,q_auto/'
                                );
                              }
                              return null;
                            })()}
                            style={{ 
                              maxWidth: '400px', 
                              maxHeight: '400px',
                              borderRadius: '8px',
                              width: '100%'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <span className="message-time">
                      {formatMessageTime(message.createdAt || Date.now())}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {imagePreview && (
              <div className="image-preview-container">
                {imageToSend && imageToSend.type.startsWith('video/') ? (
                  <video 
                    src={imagePreview} 
                    className="image-preview-thumb" 
                    controls
                    poster={(() => {
                      // Создаем превью для Cloudinary видео
                      if (imagePreview && imagePreview.includes('cloudinary.com')) {
                        return imagePreview.replace(
                          '/video/upload/',
                          '/video/upload/w_400,c_limit,f_jpg,so_0,q_auto/'
                        );
                      }
                      return null;
                    })()}
                  />
                ) : (
                  <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                )}
                <button onClick={clearImageToSend} className="remove-image-btn" title="Remove media">
                  &times;
                </button>
              </div>
            )}
            {selectedConversation.participant?.username ? (
              <form className="message-input-form" onSubmit={sendMessage}>
                <div className="message-input-wrapper">
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/mov,video/webm"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                    id="image-upload"
                    ref={fileInputRef}
                    disabled={isSending}
                  />
                  <label htmlFor="image-upload" className="image-btn">
                    <img src="/image-upload.svg" alt="Upload media" width="20" height="20" />
                  </label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Write a message..."
                    className="message-input"
                    rows={1}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    disabled={isSending}
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim() && !imageToSend}
                    className="send-btn"
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="deleted-user-message">
                <p>This user has been deleted</p>
              </div>
            )}
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="message-icon">
              <img src="/messenger.svg" alt="Messages" width="96" height="96" />
            </div>
            <h3>Your Messages</h3>
            <p>Send private photos and messages to friends.</p>
            <div style={{ marginTop: '20px' }}>
              <button className="send-message-btn" onClick={() => setShowNewMessageModal(true)}>
                Send message
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewMessageModal && (
        <div className="modal-overlay" onClick={() => setShowNewMessageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{sharedPost ? 'Send post' : 'New message'}</h3>
              <button className="modal-close" onClick={() => {
                setShowNewMessageModal(false);
                setSharedPost(null);
              }}>
                <img src="/close.svg" alt="Close" width="24" height="24" />
              </button>
            </div>
            
            {sharedPost && (
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #dbdbdb',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <PostPreview post={sharedPost} />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    Post by {sharedPost.author || 'Unknown'}
                  </div>
                  <div style={{ color: '#8e8e8e', fontSize: '12px' }}>
                    {sharedPost.caption?.substring(0, 50)}
                    {sharedPost.caption?.length > 50 ? '...' : ''}
                  </div>
                </div>
              </div>
            )}
            
            <div className="search-input-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="search-input"
              />
            </div>
            
            <div className="search-results">
              {searchLoading && <div className="loading">Searching...</div>}
              
              {/* Недавние пользователи показываем только если нет поискового запроса */}
              {!searchQuery.trim() && recentUsers.length > 0 && (
                <div className="recent-users-section">
                  <div className="section-title">Recent</div>
                  {recentUsers.map(user => (
                    <div 
                      key={user._id} 
                      className="user-result"
                      onClick={() => sharedPost ? sendPostToUser(user) : startConversation(user)}
                    >
                      <img 
                        src={user.avatar ? getAvatarThumbnailUrl(user.avatar) : '/default-avatar.png'}
                        alt={user.username || 'User'}
                        className="user-avatar"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/default-avatar.png';
                        }}
                      />
                      <span className="user-username">{user.username}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Результаты поиска */}
              {searchQuery.trim() && searchResults.map(user => (
                <div 
                  key={user._id} 
                  className="user-result"
                  onClick={() => sharedPost ? sendPostToUser(user) : startConversation(user)}
                >
                  <img 
                    src={user.avatar ? getAvatarThumbnailUrl(user.avatar) : '/default-avatar.png'} 
                    alt={user.username || 'User'}
                    className="user-avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <span className="user-username">{user.username}</span>
                </div>
              ))}
              
              {searchQuery.trim().length >= 1 && !searchLoading && searchResults.length === 0 && (
                <div className="no-results">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isPostModalOpen && selectedPostForModal && (
        <PostModal
          post={selectedPostForModal}
          isOpen={isPostModalOpen}
          onClose={closePostModal}
          currentUser={currentUser}
        />
      )}

      <ImageModal
        src={selectedImage}
        alt="Message image"
        isOpen={imageModalOpen}
        onClose={closeImageModal}
      />

              {showDeleteConfirm && (
         <div className="share-modal-overlay" onClick={cancelDelete}>
           <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
             <div className="share-modal-header">
               <h3>Delete Message</h3>
               <button onClick={cancelDelete} className="share-modal-close">
                 ×
               </button>
             </div>
             <div className="share-modal-body">
               <p style={{ marginBottom: '20px', color: '#8e8e8e', fontSize: '14px', textAlign: 'center' }}>
                 Are you sure you want to delete this message? This action cannot be undone.
               </p>
               <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                 <button onClick={cancelDelete} style={{
                   background: '#f5f5f5',
                   color: '#666',
                   border: 'none',
                   padding: '8px 16px',
                   borderRadius: '6px',
                   fontWeight: '600',
                   cursor: 'pointer',
                   fontSize: '14px'
                 }}>Cancel</button>
                 <button onClick={confirmDelete} style={{
                   background: '#ed4956',
                   color: 'white',
                   border: 'none',
                   padding: '8px 16px',
                   borderRadius: '6px',
                   fontWeight: '600',
                   cursor: 'pointer',
                   fontSize: '14px'
                 }}>Delete</button>
               </div>
             </div>
           </div>
         </div>
        )}
    </div>
  );
};

export default Messages; 