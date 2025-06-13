import React, { useState, useEffect, useCallback, useRef } from 'react';
import Post from '../Post/Post';
import PostModal from './PostModal';
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

  const observer = useRef();
  const isFetching = useRef(false);
  const navigatedFromEnd = useRef(false);

  useEffect(() => {
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

  useEffect(() => {
    if (navigatedFromEnd.current && selectedPost) {
        const currentIndex = posts.findIndex(p => p._id === selectedPost._id);
        if (currentIndex < posts.length - 1) {
            handleImageClick(posts[currentIndex + 1]);
            navigatedFromEnd.current = false;
        }
    }
  }, [posts, selectedPost]);

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
    setIsModalOpen(true);
    setIsModalLoading(true);
    setSelectedPost(post);
    document.body.style.overflow = 'hidden';

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
      setSelectedPost(data.post);
    } catch (error) {
      console.error("Error fetching full post:", error);
      closeModal();
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
      navigatedFromEnd.current = true;
      setPage(p => p + 1);
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
        {loading && <div className="feed-loading">Loading...</div>}
        {error && <div className="feed-error">{error}</div>}
      </div>

      {isModalOpen && selectedPost && (
        <PostModal
          key={selectedPost._id}
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