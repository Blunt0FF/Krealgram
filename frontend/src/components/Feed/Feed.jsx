import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Post from '../Post/Post';
import PostModal from '../Post/PostModal';
import VideoStories from '../VideoStories/VideoStories';
import Toast from '../common/Toast';
import { API_URL } from '../../config';
import './Feed.css';

const Feed = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const location = useLocation();
  const [toast, setToast] = useState(null);

  const observer = useRef();
  const isFetching = useRef(false);

  // Сбрасываем page и прокручиваем в верх при монтировании компонента
  useEffect(() => {
    setPage(1);
    setPosts([]);
    window.scrollTo(0, 0);

    const toastMessage = sessionStorage.getItem('toastMessage');
    if (toastMessage) {
      setToast({ message: toastMessage, type: 'success' });
      sessionStorage.removeItem('toastMessage');
    }
  }, []);

  useEffect(() => {
    // Прокручиваем в верх при первой загрузке ленты
    if (page === 1) {
      window.scrollTo(0, 0);
    }
    
    const fetchPosts = async () => {
      if (isFetching.current) return;
      isFetching.current = true;
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/posts?page=${page}&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        setPosts(prevPosts => {
          const postMap = new Map(prevPosts.map(p => [p._id, p]));
          data.forEach(p => postMap.set(p._id, p));
          return Array.from(postMap.values());
        });

        setHasMore(data.length === 10);
      } catch (err) {
        setError('Could not fetch feed. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchPosts();
  }, [page]);

  const lastPostElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const handlePostUpdate = (postId, updates) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post._id === postId ? { ...post, ...updates } : post
      )
    );
    if (selectedPost && selectedPost._id === postId) {
      handleImageClick(selectedPost);
    }
  };

  const handleImageClick = async (post) => {
    // Останавливаем все видео в ленте
    const videos = document.querySelectorAll('.feed video');
    videos.forEach(video => {
      video.pause();
    });

    setIsModalOpen(true);
    setIsModalLoading(true);
    setSelectedPost(post);
    document.body.style.overflow = 'hidden';

    // Если пост уже есть в кэше, не делаем запрос
    const cachedPost = window.postCache?.get(post._id);
    if (cachedPost) {
      setSelectedPost(cachedPost);
      setIsModalLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/posts/${post._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch full post data');
      }
      
      const data = await response.json();
      
      // Кэшируем пост
      if (!window.postCache) {
        window.postCache = new Map();
      }
      window.postCache.set(post._id, data.post);
      
      setSelectedPost(data.post);
    } catch (error) {
      console.error("Error fetching full post:", error);
      // Используем initialPost если не удалось загрузить
    } finally {
      setIsModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
    document.body.style.overflow = 'auto';
  };

  const goToPreviousPost = () => {
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex > 0) {
      handleImageClick(posts[currentIndex - 1]);
    }
  };

  const goToNextPost = () => {
    const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
    if (currentIndex < posts.length - 1) {
      handleImageClick(posts[currentIndex + 1]);
    } else if (hasMore && !loading) {
      // Добавляем обработку загрузки следующей страницы
      const loadNextPageAndSelectFirst = async () => {
        setPage(p => p + 1);
        
        // Ожидаем загрузку следующей страницы
        const checkPostsLoaded = () => {
          return new Promise(resolve => {
            const checkInterval = setInterval(() => {
              if (posts.length > currentIndex + 1) {
                clearInterval(checkInterval);
                handleImageClick(posts[currentIndex + 1]);
                resolve();
              }
            }, 100);

            // Таймаут на случай, если загрузка не произойдет
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        };

        await checkPostsLoaded();
      };

      loadNextPageAndSelectFirst();
    }
  };
  
  const handleDeletePost = (postId) => {
    setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
    closeModal();
  };

  const getCurrentPostIndex = () => {
    return posts.findIndex(p => p._id === selectedPost._id);
  };

  const currentIndex = isModalOpen && selectedPost ? getCurrentPostIndex() : -1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = (currentIndex !== -1 && currentIndex < posts.length - 1) || (currentIndex === posts.length - 1 && hasMore);

  return (
    <div className="feed-container">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      <VideoStories />
      <div className="feed">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <div ref={posts.length === index + 1 ? lastPostElementRef : null} key={post._id}>
              <Post
                post={post}
                currentUser={user}
                onPostUpdate={handlePostUpdate}
                onImageClick={() => handleImageClick(post)}
              />
            </div>
          ))
        ) : (
          !loading && (
            <div className="no-posts">
              <h2>No posts yet</h2>
              <p>Be the first to share something!</p>
            </div>
          )
        )}
        {error && <div className="feed-error">{error}</div>}
      </div>

      {isModalOpen && selectedPost && (
        <PostModal
          post={selectedPost}
          isOpen={isModalOpen}
          onClose={closeModal}
          currentUser={user}
          onPostUpdate={handlePostUpdate}
          onDeletePost={handleDeletePost}
          onNext={goToNextPost}
          onPrevious={goToPreviousPost}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
        />
      )}
    </div>
  );
};

export default Feed; 