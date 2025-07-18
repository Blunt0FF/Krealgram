import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Post from '../Post/Post';
import PostModal from '../Post/PostModal';
import VideoStories from '../VideoStories/VideoStories';
import Toast from '../common/Toast';
import FeedVideoPreloader from './FeedVideoPreloader';
import videoManager from '../../utils/videoManager';
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
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
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
          const newPosts = Array.from(postMap.values());
          
          // Если это первая загрузка (page === 1), устанавливаем currentIndex в 0
          if (page === 1) {
            setCurrentPostIndex(0);
          }
          
          return newPosts;
        });

        setHasMore(data.length === 10);
      } catch (err) {
        setError('Could not fetch feed. Please try again.');
        // Убираем лишнее логирование ошибок
        // console.error(err);
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

  // Отслеживаем видимые посты для предзагрузки видео
  useEffect(() => {
    const handleScroll = () => {
      const posts = document.querySelectorAll('.feed > div');
      const windowHeight = window.innerHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Находим центральный видимый пост
      let centerIndex = 0;
      let minDistance = Infinity;
      
      posts.forEach((postElement, index) => {
        const rect = postElement.getBoundingClientRect();
        const postCenter = rect.top + rect.height / 2;
        const distance = Math.abs(postCenter - windowHeight / 2);
        
        if (distance < minDistance) {
          minDistance = distance;
          centerIndex = index;
        }
      });
      
      // Обновляем currentIndex только если он значительно изменился
      if (Math.abs(centerIndex - currentPostIndex) > 2) {
        setCurrentPostIndex(centerIndex);
      }
    };

    // Добавляем throttling для производительности
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => window.removeEventListener('scroll', throttledHandleScroll);
  }, [currentPostIndex]);

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

    // Обновляем индекс текущего поста для предзагрузки
    const postIndex = posts.findIndex(p => p._id === post._id);
    setCurrentPostIndex(postIndex);

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
    // Восстанавливаем возможность воспроизведения видео в ленте
    videoManager.resumeFeedVideos();
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
        try {
          // Принудительно загружаем следующую страницу
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/api/posts?page=${page + 1}&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) throw new Error('Network response was not ok');
          
          const newPosts = await response.json();
          
          // Обновляем посты и состояние
          setPosts(prevPosts => {
            const postMap = new Map(prevPosts.map(p => [p._id, p]));
            newPosts.forEach(p => postMap.set(p._id, p));
            return Array.from(postMap.values());
          });
          
          setPage(prevPage => prevPage + 1);
          setHasMore(newPosts.length === 10);
          
          // Если есть новые посты, открываем первый
          if (newPosts.length > 0) {
            handleImageClick(newPosts[0]);
          }
        } catch (error) {
          console.error("Ошибка загрузки следующей страницы:", error);
        }
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
      {/* Предзагрузка видео */}
      <FeedVideoPreloader 
        posts={posts} 
        currentIndex={currentPostIndex}
      />
      
      {/* Video Stories */}
      <VideoStories user={user} />
      
      {/* Posts */}
      <div className="feed">
        {posts.map((post, index) => (
          <div key={post._id} ref={index === posts.length - 1 ? lastPostElementRef : null}>
              <Post
                post={post}
                currentUser={user}
                onPostUpdate={handlePostUpdate}
              onImageClick={handleImageClick}
              onDeletePost={handleDeletePost}
              />
            </div>
        ))}
        
        {error && <div className="feed-error">{error}</div>}
        
        {!loading && !hasMore && posts.length > 0 && (
          <div className="end-of-feed">
            <p>You've reached the end of your feed!</p>
          </div>
        )}
      </div>

      {/* Loading spinner - вынесен из .feed для правильного центрирования */}
      {loading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      )}

      {/* Post Modal */}
      {isModalOpen && selectedPost && (
        <PostModal
          post={selectedPost}
          isOpen={isModalOpen}
          onClose={closeModal}
          currentUser={user}
          onPostUpdate={handlePostUpdate}
          onDeletePost={handleDeletePost}
          onPrevious={goToPreviousPost}
          onNext={goToNextPost}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Feed; 