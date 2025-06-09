import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import io from 'socket.io-client';
import { getRecentUsers, addRecentUser } from '../../utils/recentUsers';
import { getAvatarUrl } from '../../utils/imageUtils';
import PostModal from '../Feed/PostModal';
import SharedPost from './SharedPost';
import './Messages.css';

const API_URL = 'http://localhost:3000';

// Функция для проверки и извлечения YouTube ID
const extractYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Функция для создания данных YouTube
const createYouTubeData = (url) => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  
  return {
    type: 'video',
    youtubeId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    originalUrl: url
  };
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

  // Обработка пересылаемого поста
  useEffect(() => {
    const handleSharedPost = () => {
      if (location.state?.sharedPost && location.state?.timestamp) {
        const post = location.state.sharedPost;
        console.log('Получен пост для пересылки:', post);
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
      setRecentUsers(getRecentUsers());
    }
  }, [showNewMessageModal]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    if (currentUser && currentUser._id) {
        fetchConversations().then(fetchedConversations => {
          const queryParams = new URLSearchParams(location.search);
          const recipientId = queryParams.get('recipient');

          if (recipientId) {
            const existingConv = fetchedConversations?.find(c => c.participant?._id === recipientId);
            if (existingConv) {
              selectConversation(existingConv);
            } else {
              console.warn(`Диалог с recipientId=${recipientId} не найден среди существующих. Нужен API для получения user by ID.`);
              navigate(location.pathname, { replace: true });
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

  const selectConversation = async (conversation) => {
    if (!conversation || !conversation._id) {
        setSelectedConversation(null);
        setMessages([]);
        setIsChatOpen(false);
        return;
    }
    setSelectedConversation(conversation);
    setIsChatOpen(true); // Открываем чат на мобильных
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/${conversation._id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100); // Добавляем небольшую задержку для уверенности что DOM обновился
      } else {
        console.error('Error fetching messages:', await response.text());
        setMessages([]);
      }
    } catch (error) {
      console.error('Network error fetching messages:', error);
      setMessages([]);
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
      formData.append('sharedPost', JSON.stringify(postToShare));
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
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageToSend(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const startConversation = async (userToChatWith) => {
    if (!userToChatWith || !userToChatWith._id) return null;
    if (currentUser && userToChatWith._id === currentUser._id) {
        return null;
    }

    // Добавляем пользователя в недавние
    addRecentUser(userToChatWith);
    setRecentUsers(getRecentUsers());

    const existingConversation = conversations.find(
      (conv) => conv.participant && conv.participant._id === userToChatWith._id
    );

    if (existingConversation) {
      setSelectedConversation(existingConversation);
      setIsChatOpen(true);
      
      // Загружаем сообщения для существующего диалога
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/conversations/${existingConversation._id}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setMessages([]);
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
    
    // Закрываем модальное окно
    setShowNewMessageModal(false);
    return newConversation;
  };

  const sendPostToUser = async (userToChatWith) => {
    if (!userToChatWith || !sharedPost) {
      console.log('Missing data for sending post:', { userToChatWith, sharedPost });
      return;
    }

    try {
      const conversation = await startConversation(userToChatWith);
      if (conversation) {
        const postToShare = {
          id: sharedPost._id || sharedPost.id,
          image: sharedPost.imageUrl || sharedPost.image,
          caption: sharedPost.caption || '',
          author: typeof sharedPost.author === 'object' ? sharedPost.author.username : sharedPost.author,
          createdAt: sharedPost.createdAt || new Date().toISOString()
        };

        // Явно передаем ID получателя, чтобы избежать проблем с асинхронным состоянием
        await sendMessage(null, conversation.participant._id);
        
        setSharedPost(null);
        setShowNewMessageModal(false);
      }
    } catch (error) {
      console.error('Error sending post:', error);
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

  const backToConversations = () => {
    setIsChatOpen(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  const deleteMessage = async (messageId) => {
    if (!selectedConversation || !selectedConversation._id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/conversations/${selectedConversation._id}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Удаляем сообщение из локального состояния
        setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageId));
        
        // Обновляем список диалогов
        await fetchConversations();
      } else {
        const errorData = await response.json();
        console.error('Error deleting message:', errorData.message);
      }
    } catch (error) {
      console.error('Network error deleting message:', error);
    }
  };

  const handlePostClickInMessage = (post) => {
    setSelectedPostForModal(post);
    setPostModalOpen(true);
  };

  const closePostModal = () => {
    setPostModalOpen(false);
    setSelectedPostForModal(null);
  };

  // Если пользователь не загружен, показываем загрузку
  if (!currentUser) {
    return <div className="messages-loading">Loading user data...</div>;
  }

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
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
          </button>
        </div>
        
        <div className="conversations-list">
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
                className={`conversation-item ${selectedConversation?._id === conv._id || (selectedConversation?.participant?._id === conv.participant?._id && selectedConversation?._id?.startsWith('temp_')) ? 'active' : ''}`}
                onClick={() => selectConversation(conv)}
              >
                <div className="conversation-content"> 
                  <img 
                    src={getAvatarUrl(conv.participant?.avatar)} 
                    alt={conv.participant?.username}
                    className="conversation-avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <div className="conversation-info">
                    <span className="conversation-name">{conv.participant?.username || 'Unknown'}</span>
                    <span className="conversation-last-message">
                      {conv.lastMessage ? (
                        conv.lastMessage.media && conv.lastMessage.media.type === 'image' ? 
                          'Sent a photo' :
                        conv.lastMessage.sharedPost ? 
                          'Shared a post' :
                        conv.lastMessage.text ? 
                          `${conv.lastMessage.text.substring(0, 25)}${conv.lastMessage.text.length > 25 ? '...' : ''}` : 
                        typeof conv.lastMessage === 'object' ? 
                          'Sent a message' :
                          conv.lastMessage
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
        {selectedConversation && selectedConversation.participant ? (
          <>
            <div className="chat-header">
              <button className="back-btn mobile-only" onClick={backToConversations}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div 
                className="chat-header-content"
                onClick={() => navigate(`/profile/${selectedConversation.participant.username}`)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 1 }}
              >
                <img 
                  src={getAvatarUrl(selectedConversation.participant.avatar)} 
                  alt={selectedConversation.participant.username}
                  className="chat-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.png';
                  }}
                />
                <div className="chat-user-info">
                  <span className="chat-username">{selectedConversation.participant.username}</span>
                </div>
              </div>
            </div>

            <div className="messages-area">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message ${message.sender?._id === currentUser?._id ? 'sent' : 'received'}`}
                >
                  {message.sender?._id !== currentUser?._id && (
                    <img
                      src={getAvatarUrl(message.sender?.avatar)}
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
                        onClick={() => deleteMessage(message._id)}
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
                        message.text && <p>{message.text}</p>
                      )}
                      {message.media && message.media.type === 'image' && (
                        <div className="message-image" onClick={() => openImageModal(message.media.url)}>
                          <img 
                            src={message.media.url} 
                            alt="Shared image" 
                            style={{ 
                              maxWidth: '400px', 
                              maxHeight: '400px',
                              borderRadius: '8px',
                              marginTop: '4px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      )}
                      {message.media && message.media.type === 'video' && message.media.youtubeId && (
                        <div className="message-youtube" style={{ marginTop: '4px' }}>
                          <iframe
                            width="280"
                            height="157"
                            src={`https://www.youtube.com/embed/${message.media.youtubeId}`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ borderRadius: '8px' }}
                          ></iframe>
                        </div>
                      )}
                    </div>
                    <span className="message-time">
                      {new Date(message.createdAt || Date.now()).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {imagePreview && (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                <button onClick={clearImageToSend} className="remove-image-btn" title="Remove image">
                  &times;
                </button>
              </div>
            )}
            <form className="message-input-form" onSubmit={sendMessage}>
              <div className="message-input-wrapper">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                  id="image-upload"
                  ref={fileInputRef}
                  disabled={isSending}
                />
                <label htmlFor="image-upload" className="image-btn">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
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
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="message-icon">
              <svg width="96" height="96" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z"/>
              </svg>
            </div>
            <h3>Your Messages</h3>
            <p>Send private photos and messages to friends.</p>
            <button className="send-message-btn" onClick={() => setShowNewMessageModal(true)}>
              Send message
            </button>
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
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                <img 
                  src={sharedPost.image} 
                  alt="Post preview" 
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '4px', 
                    objectFit: 'cover' 
                  }}
                />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    Post by {sharedPost.author}
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
                        src={getAvatarUrl(user.avatar)} 
                        alt={user.username}
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
                    src={getAvatarUrl(user.avatar)} 
                    alt={user.username}
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

      {imageModalOpen && selectedImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={closeImageModal}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={selectedImage} 
              alt="Full size" 
              className="modal-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages; 