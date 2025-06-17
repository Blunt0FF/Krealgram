import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import LikesModal from '../Post/LikesModal';
import ShareModal from '../Post/ShareModal';
import EditPostModal from '../Post/EditPostModal';
import PostModal from '../Post/PostModal';
import { getImageUrl, getAvatarUrl } from '../../utils/imageUtils';
import { API_URL } from '../../config';
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
  const [image, setImage] = useState(post.imageUrl || null);
  const [imageLoaded, setImageLoaded] = useState(!!post.imageUrl);

  useEffect(() => {
    if (post._id && !imageLoaded && !post.imageUrl) {
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/api/posts/${post._id}/image`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data.imageUrl) {
            setImage(data.imageUrl);
            setImageLoaded(true);
          }
        })
        .catch(err => console.error('Error loading thumbnail:', err));
    } else if (post.imageUrl && !image) {
      setImage(post.imageUrl);
      setImageLoaded(true);
    }
  }, [post._id, post.imageUrl, imageLoaded, image]);

  return (
    <div className="post-thumbnail" onClick={onClick}>
      {image ? (
        <img src={image} alt={post.caption || 'Post'} loading="lazy" />
      ) : (
        <div className="thumbnail-placeholder">
          <div className="loading-spinner"></div>
        </div>
      )}
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
const FollowersModal = ({ isOpen, onClose, title, users, loading }) => {
  if (!isOpen) return null;

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
              <div key={user._id} className="follower-item">
                <Link to={`/profile/${user.username}`} onClick={onClose}>
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
  };

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
      }
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setFollowingLoading(false);
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
              isLikedByCurrentUser: isLikedByCurrentUser
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
                if (profile.user.avatar && profile.user.avatar !== '/default-avatar.png') {
                  setShowAvatarModal(true);
                }
              }}
              style={{ cursor: profile.user.avatar && profile.user.avatar !== '/default-avatar.png' ? 'pointer' : 'default' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>

          <div className="profile-info">
            <div className="profile-header-row">
              <h1 className="profile-username">{profile.user.username}</h1>
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
            isOpen={!!selectedPost}
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

        <FollowersModal
          isOpen={isFollowersModalOpen}
          onClose={() => setIsFollowersModalOpen(false)}
          title={modalTitle}
          users={modalUsers}
          loading={modalTitle === 'Followers' ? followersLoading : followingLoading}
        />

        {/* Avatar Modal */}
        {showAvatarModal && (
          <div className="avatar-modal-overlay" onClick={() => setShowAvatarModal(false)}>
            <div className="avatar-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="avatar-modal-close" onClick={() => setShowAvatarModal(false)}>
                ×
              </button>
              <img
                src={getAvatarUrl(profile.user.avatar)}
                alt={profile.user.username}
                className="avatar-modal-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.png';
                }}
              />
            </div>
          </div>
        )}
      </div>

      <MobileBottomNav user={currentUserProp} />
    </>
  );
};

export default Profile;