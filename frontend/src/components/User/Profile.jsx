import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import LikesModal from '../Post/LikesModal';
import ShareModal from '../Post/ShareModal';
import EditPostModal from '../Post/EditPostModal';
import PostModal from '../Post/PostModal';
import ImageModal from '../common/ImageModal';
import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { getMediaThumbnail } from '../../utils/videoUtils';
import videoManager from '../../utils/videoManager';
import { API_URL } from '../../config';
import { formatLastSeen } from '../../utils/timeUtils';
import './Profile.css';

// Компонент мобильной навигации
const MobileBottomNav = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="mobile-bottom-nav">
      <Link to="/feed" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V12.5L12 2 2 12.5V22h7.005v-5.455z" />
        </svg>
      </Link>
      <Link to="/search" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Link>
      <Link to="/create-post" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Link>
      <Link to="/messages" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z" fillRule="evenodd" />
        </svg>
      </Link>
      <Link to="/notifications_mobile" className="nav-item">
        <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.003 2.001a9.705 9.705 0 1 1 0 19.4 10.876 10.876 0 0 1-2.895-.384.798.798 0 0 0-.533.04l-1.984.876a.801.801 0 0 1-1.123-.708l-.054-1.78a.806.806 0 0 0-.27-.569 9.49 9.49 0 0 1-3.14-7.175 9.65 9.65 0 0 1 10-9.7Z" fillRule="evenodd" />
        </svg>
      </Link>
      <Link to={`/profile/${user?.username}`} className="nav-item">
        <img
          src={getAvatarUrl(user?.avatar)}
          alt="Profile"
          className="nav-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default-avatar.png';
          }}
        />
      </Link>
    </div>
  );
};

// Компонент для превью поста с асинхронной загрузкой изображения
const PostThumbnail = ({ post, onClick }) => {
  const image = post.imageUrl || post.image;

  const getThumbnailSrc = React.useMemo(() => {
    // Проверяем YouTube видео первым делом - всегда показываем thumbnail
    if (post.youtubeData || (post.videoUrl && (post.videoUrl.includes('youtube') || post.videoUrl.includes('youtu.be')))) {
      // Для YouTube видео ВСЕГДА показываем статичный thumbnail, НЕ iframe
      const thumbnail = getMediaThumbnail(post, { forProfile: true, width: 300, height: 300 });

      return thumbnail || '/video-placeholder.svg';
    }
    
    // Для видео всегда показываем thumbnail или placeholder
    if (post.mediaType === 'video') {
      // Если есть videoUrl (внешнее видео), получаем thumbnail через videoUtils
      if (post.videoUrl) {
        const thumbnail = getMediaThumbnail(post, { forProfile: true, width: 300, height: 300 });
        return thumbnail || '/video-placeholder.svg';
      }
      
      // Для загруженных видео показываем GIF всегда, но с разными настройками
      if (post.imageUrl || image) {
        const videoUrl = image || post.imageUrl;
        
        // Если это Cloudinary видео
        if (videoUrl && videoUrl.includes('cloudinary.com')) {
          // Проверяем размер экрана
          const isMobile = window.innerWidth <= 768;
          
          if (isMobile) {
            // На мобильных: зацикленные 10 сек, 30 FPS
            const gifUrl = videoUrl.replace(
              '/video/upload/',
              `/video/upload/w_300,h_300,c_fill,q_auto,f_gif,so_0,eo_10,fps_30,fl_loop/`
            );

            return gifUrl;
          } else {
            // На десктопе: зацикленные 10 сек, 30 FPS
            const gifUrl = videoUrl.replace(
              '/video/upload/',
              `/video/upload/w_300,h_300,c_fill,q_auto,f_gif,so_0,eo_10,fps_30,fl_loop/`
            );

            return gifUrl;
          }
        }
        
        return videoUrl;
      }
      
      return '/video-placeholder.svg';
    }
    
    // Определяем видео по URL если mediaType не указан
    if (image && image.includes('cloudinary.com') && image.includes('/video/')) {
      // Это Cloudinary видео без правильного mediaType
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // На мобильных: зацикленные 10 сек, 30 FPS
        const gifUrl = image.replace(
          '/video/upload/',
          `/video/upload/w_300,h_300,c_fill,q_auto,f_gif,so_0,eo_10,fps_30,fl_loop/`
        );
        return gifUrl;
      } else {
        // На десктопе: зацикленные 10 сек, 30 FPS
        const gifUrl = image.replace(
          '/video/upload/',
          `/video/upload/w_300,h_300,c_fill,q_auto,f_gif,so_0,eo_10,fps_30,fl_loop/`
        );
        return gifUrl;
      }
    }
    
    // Для обычных изображений
    const imageSrc = image || post.imageUrl;
    return imageSrc || '/video-placeholder.svg';
  }, [post._id, post.mediaType, post.videoUrl, post.imageUrl, image]);

  // Определяем, является ли это видео для показа индикатора
  const isVideo = React.useMemo(() => {
    return post.mediaType === 'video' || 
           (image && image.includes('cloudinary.com') && image.includes('/video/')) ||
           post.videoUrl ||
           post.youtubeData;
  }, [post.mediaType, post.videoUrl, post.youtubeData, image]);

  return (
    <div className="post-thumbnail" onClick={onClick}>
      <div className="thumbnail-container">
        <img 
          src={getThumbnailSrc} 
          alt={post.caption || 'Post'} 
          loading="lazy"
          onError={(e) => {
            // Если thumbnail не загрузился, пробуем альтернативные варианты
            if (isVideo) {
              // Для YouTube видео пробуем fallback thumbnail
              if (e.target.src.includes('youtube.com') && e.target.src.includes('maxresdefault')) {
                // Пробуем hqdefault если maxresdefault не доступен
                const fallbackUrl = e.target.src.replace('maxresdefault', 'hqdefault');
                e.target.src = fallbackUrl;
                return;
              }
              
              // Для Cloudinary видео пробуем другой формат
              if (e.target.src.includes('cloudinary.com') && !e.target.src.includes('f_auto')) {
                const fallbackUrl = e.target.src.replace('f_jpg', 'f_auto');
                e.target.src = fallbackUrl;
                return;
              }
              
              // Если все не работает, показываем placeholder
              e.target.src = '/video-placeholder.svg';
            } else {
              // Для изображений скрываем элемент
              e.target.style.display = 'none';
            }
          }}
        />
        {isVideo && (
          <div className="video-indicator">
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
      </div>
      <div className="post-overlay">
        <div className="post-stats">
          <span className="stat-item">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.likesCount || 0}
          </span>
          <span className="stat-item">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentsCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

// Компонент модального окна для подписчиков/подписок
const FollowersModal = ({ isOpen, onClose, title, users, loading, currentUser, onRemoveFollower }) => {
  // Блокируем скролл при открытии модалки
  React.useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '0';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '0';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemoveFollower = async (userToRemove) => {
    if (onRemoveFollower) {
      await onRemoveFollower(userToRemove);
    }
  };

  return (
    <div className="followers-modal-overlay" onClick={onClose}>
      <div className="followers-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="followers-modal-header">
          <h3>{title}</h3>
          <button className="followers-modal-close" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="followers-modal-body">
          {loading ? (
            <div className="followers-loading">Loading...</div>
          ) : users.length === 0 ? (
            <div className="followers-empty">No {title.toLowerCase()} yet</div>
          ) : (
            users.map(user => (
              <div key={user._id || `deleted-${Math.random()}`} className="follower-item">
                <div className="follower-content">
                  {user.username ? (
                    <Link to={`/profile/${user.username}`} onClick={onClose} className="follower-link">
                      <img
                        src={getAvatarUrl(user.avatar)}
                        alt={user.username}
                        className="follower-avatar"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/default-avatar.png';
                        }}
                      />
                      <span className="follower-username">{user.username}</span>
                    </Link>
                  ) : (
                    <div className="follower-link deleted-user">
                      <img
                        src="/default-avatar.png"
                        alt="Deleted user"
                        className="follower-avatar deleted-avatar"
                      />
                      <span className="follower-username deleted-username">DELETED USER</span>
                    </div>
                  )}
                  
                  {/* Показываем кнопку удаления для подписчиков (включая удаленных) и только владельцу профиля */}
                  {title === 'Followers' && currentUser && onRemoveFollower && (
                    <button
                      className="remove-follower-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveFollower(user);
                      }}
                      title={user.username ? "Remove follower" : "Remove deleted user"}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Profile = ({ user: currentUserProp }) => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followInfo, setFollowInfo] = useState({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalUsers, setModalUsers] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const handlePostClick = (post) => {
    const postWithLikeStatus = {
      ...post,
      isLikedByCurrentUser: post.isLikedByCurrentUser
    };
    setSelectedPost(postWithLikeStatus);
    setIsModalOpen(true);
  };

  const goToPreviousPost = () => {
    if (!selectedPost || posts.length === 0) return;
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex > 0) {
      setSelectedPost(posts[currentIndex - 1]);
    }
  };

  const goToNextPost = () => {
    if (!selectedPost || posts.length === 0) return;
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex < posts.length - 1) {
      setSelectedPost(posts[currentIndex + 1]);
    }
  };

  const getCurrentPostIndex = () => {
    if (!selectedPost || posts.length === 0) return { current: 1, total: posts.length };
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    return { current: currentIndex + 1, total: posts.length };
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
    // Восстанавливаем скролл
    document.body.style.overflow = 'unset';
  };

  // Блокировка скролла и остановка фоновых видео при открытии модалки
  useEffect(() => {
    if (isModalOpen) {
      // Блокируем скролл
      document.body.style.overflow = 'hidden';
      
      // Останавливаем все видео в ленте при открытии модалки
      videoManager.pauseAllFeedVideos();
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const handlePostUpdate = (postId, updates) => {
    setPosts(prevPosts => prevPosts.map(p =>
      p._id === postId ? { ...p, ...updates } : p
    ));
    // Всегда обновляем selectedPost для синхронизации состояния
    if (selectedPost && selectedPost._id === postId) {
      setSelectedPost(prevSelectedPost => ({ ...prevSelectedPost, ...updates }));
    }
  };

  const handleDeletePost = async (postIdToDelete) => {
    if (!currentUserProp || !isOwner) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/posts/${postIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPosts(prevPosts => prevPosts.filter(p => p._id !== postIdToDelete));
        closeModal();
        if (profile && profile.user) {
          setProfile(prev => ({
            ...prev,
            user: {
              ...prev.user,
              postsCount: prev.user.postsCount !== undefined ? Math.max(0, prev.user.postsCount - 1) : (prev.posts?.filter(p => p._id !== postIdToDelete).length || 0)
            }
          }));
        }
        console.log('Post deleted successfully');
      } else {
        console.error('Error deleting post:', data.message);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      console.error('Network error when deleting post:', error);
    }
  };

  const openFollowersModal = async () => {
    if (!profile || !profile.user) return;

    setFollowersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/followers`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setModalTitle('Followers');
        setModalUsers(data.followers || []);
        setIsFollowersModalOpen(true);
      } else {
        console.error('Failed to load followers:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  const openFollowingModal = async () => {
    if (!profile || !profile.user) return;

    setFollowingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/following`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setModalTitle('Following');
        setModalUsers(data.following || []);
        setIsFollowersModalOpen(true);
      } else {
        console.error('Failed to load following:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setFollowingLoading(false);
    }
  };

  const removeFollower = async (followerToRemove) => {
    if (!isOwner || !profile?.user?._id) return;

    try {
      const token = localStorage.getItem('token');
      
      // Для удаленных пользователей используем специальный ID
      const followerId = followerToRemove._id || (followerToRemove.isDeleted ? 'deleted' : null);
      
      if (!followerId) {
        console.error('No valid follower ID found');
        return;
      }
      
      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/followers/${followerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Для удаленных пользователей удаляем всех с isDeleted: true
        if (followerToRemove.isDeleted) {
          setModalUsers(prevUsers => prevUsers.filter(user => !user.isDeleted));
        } else {
          // Для обычных пользователей удаляем по ID
          setModalUsers(prevUsers => prevUsers.filter(user => user._id !== followerToRemove._id));
        }
        
        // Обновляем счетчики из ответа API
        setFollowInfo(prev => ({
          ...prev,
          followersCount: data.followersCount,
          followingCount: data.followingCount
        }));

        console.log('Follower removed successfully');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to remove follower:', errorData);
      }
    } catch (error) {
      console.error('Error removing follower:', error);
    }
  };

  const toggleFollow = async () => {
    if (!currentUserProp || isOwner) return;

    const wasFollowing = followInfo.isFollowing;

    setFollowInfo(prev => ({
      ...prev,
      isFollowing: !wasFollowing,
      followersCount: wasFollowing ? (prev.followersCount || 0) - 1 : (prev.followersCount || 0) + 1
    }));

    try {
      const token = localStorage.getItem('token');
      const method = wasFollowing ? 'DELETE' : 'POST';

      const response = await fetch(`${API_URL}/api/users/${profile.user._id}/follow`, {
        method: method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Если API возвращает обновленные счетчики, используем их
        setFollowInfo({
          isFollowing: data.isFollowing,
          followersCount: data.followersCount,
          followingCount: data.followingCount || followInfo.followingCount
        });
      } else {
        // Откатываем изменения при ошибке
        setFollowInfo(prev => ({
          ...prev,
          isFollowing: wasFollowing,
          followersCount: wasFollowing ? (prev.followersCount || 0) + 1 : (prev.followersCount || 0) - 1
        }));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Откатываем изменения при ошибке
      setFollowInfo(prev => ({
        ...prev,
        isFollowing: wasFollowing,
        followersCount: wasFollowing ? (prev.followersCount || 0) + 1 : (prev.followersCount || 0) - 1
      }));
    }
  };

  useEffect(() => {
    if (selectedPost) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedPost]);

  useEffect(() => {
    // Прокручиваем в верх при переходе на профиль
    window.scrollTo(0, 0);
    
    setLoadingProfile(true);
    setProfile(null);
    setPosts([]);
    setSelectedPost(null);
    setIsModalOpen(false);
    setFollowInfo({ isFollowing: false, followersCount: 0, followingCount: 0 });
    setIsOwner(false);

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/api/users/profile/${username}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            console.error('User not found');
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.user) {
          setProfile(data);

          const processedPosts = (data.user.posts || []).map(p => {
            // Проверяем, лайкнул ли текущий пользователь этот пост
            const isLikedByCurrentUser = currentUserProp && p.likes ?
              p.likes.some(like =>
                like.user === currentUserProp._id ||
                like.user?._id === currentUserProp._id ||
                like === currentUserProp._id
              ) : false;

            // Обрабатываем лайки поста

            return {
              ...p,
              likesCount: p.likes?.length || 0,
              commentsCount: p.comments?.length || 0,
              imageUrl: getImageUrl(p.imageUrl || p.image),
              isLikedByCurrentUser: isLikedByCurrentUser,
              // Сохраняем все данные о видео
              mediaType: p.mediaType,
              videoUrl: p.videoUrl,
              youtubeData: p.youtubeData,
              author: p.author || p.user
            };
          });
          setPosts(processedPosts);

          setFollowInfo({
            isFollowing: data.user.isFollowedByCurrentUser || false,
            followersCount: data.user.followersCount || 0,
            followingCount: data.user.followingCount || 0
          });

          // Проверяем владельца профиля - используем как currentUser, так и localStorage
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = currentUserProp?._id || storedUser?._id;
          if (userId) {
            setIsOwner(userId === data.user._id);
          }
        } else {
          console.error("User data not found in response:", data);
          setProfile(null);
        }
        setLoadingProfile(false);
      })
      .catch(err => {
        console.error('Error fetching profile:', err);
        setLoadingProfile(false);
        setProfile(null);
      });
  }, [username, currentUserProp]);

  if (loadingProfile) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  if (!profile || !profile.user) {
    return <div className="profile-container"><div className="no-posts"><h3>Profile not found.</h3></div></div>;
  }

  return (
    <>
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <img
              src={getAvatarUrl(profile.user.avatar)}
              alt={profile.user.username}
              loading="lazy"
              onClick={() => {
                // Проверяем, что аватарка не является дефолтной
                const avatarUrl = getAvatarUrl(profile.user.avatar);
                if (profile.user.avatar && avatarUrl && avatarUrl !== '/default-avatar.png' && !avatarUrl.includes('default-avatar.png')) {
                  setShowAvatarModal(true);
                }
              }}
              style={{ 
                cursor: profile.user.avatar && 
                        getAvatarUrl(profile.user.avatar) !== '/default-avatar.png' && 
                        !getAvatarUrl(profile.user.avatar).includes('default-avatar.png') ? 'pointer' : 'default' 
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>

          <div className="profile-info">
            <div className="profile-header-row">
              <div className="profile-username-container">
                <h1 className="profile-username">{profile.user.username}</h1>
                {!isOwner && (
                  <div className="profile-activity-status">
                    {(() => {
                      const statusText = formatLastSeen(profile.user.lastActive, profile.user.isOnline);
                      const isOnline = statusText === 'Online';
                      return (
                        <span className={`activity-status ${isOnline ? 'online' : 'offline'}`}>
                          {statusText}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="profile-actions">
                {isOwner ? (
                  <>
                    <Link to="/edit-profile" className="edit-profile-btn">
                      Edit profile
                    </Link>
                    <button
                      className="logout-btn mobile-only"
                      onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : currentUserProp ? (
                  <>
                    <button
                      className={`follow-btn ${followInfo.isFollowing ? 'following' : ''}`}
                      onClick={toggleFollow}
                    >
                      {followInfo.isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                    <Link to={`/messages?recipient=${profile.user._id}`} className="message-btn">Message</Link>
                  </>
                ) : null}
              </div>
            </div>

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{profile.user.postsCount !== undefined ? profile.user.postsCount : posts.length}</span>
                <span className="stat-label">posts</span>
              </div>
              <div className="stat-item clickable" onClick={openFollowersModal}>
                <span className="stat-number">{followInfo.followersCount}</span>
                <span className="stat-label">followers</span>
              </div>
              <div className="stat-item clickable" onClick={openFollowingModal}>
                <span className="stat-number">{followInfo.followingCount}</span>
                <span className="stat-label">following</span>
              </div>
            </div>

            {profile.user.bio && (
              <div className="profile-bio">
                <p>{profile.user.bio}</p>
              </div>
            )}

            {profile.user.website && (
              <div className="profile-website">
                <a href={profile.user.website} target="_blank" rel="noopener noreferrer">
                  {profile.user.website}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="profile-content">
          <div className={`posts-grid ${posts.length === 0 ? 'no-posts-container' : ''}`}>
            {posts.length === 0 ? (
              <div className="no-posts">
                <div className="no-posts-icon">📷</div>
                <h3>No posts yet</h3>
              </div>
            ) : (
              posts.map((post) => (
                <PostThumbnail
                  key={post._id}
                  post={post}
                  onClick={() => handlePostClick(post)}
                />
              ))
            )}
          </div>
        </div>

        {selectedPost && (
          <PostModal
            isOpen={isModalOpen}
            onClose={closeModal}
            post={selectedPost}
            currentUser={currentUserProp}
            onPostUpdate={handlePostUpdate}
            onDeletePost={handleDeletePost}
            onPrevious={goToPreviousPost}
            onNext={goToNextPost}
            canGoPrevious={posts.findIndex(p => p._id === selectedPost._id) > 0}
            canGoNext={posts.findIndex(p => p._id === selectedPost._id) < posts.length - 1}
          />
        )}
        
        {/* ОТЛАДКА */}
  

        <FollowersModal
          isOpen={isFollowersModalOpen}
          onClose={() => setIsFollowersModalOpen(false)}
          title={modalTitle}
          users={modalUsers}
          loading={modalTitle === 'Followers' ? followersLoading : followingLoading}
          currentUser={isOwner ? currentUserProp : null}
          onRemoveFollower={isOwner ? removeFollower : null}
        />

        <ImageModal
          src={getAvatarUrl(profile.user.avatar)}
          alt={`${profile.user.username}'s avatar`}
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
        />
      </div>

      <MobileBottomNav user={currentUserProp} />
    </>
  );
};

export default Profile;