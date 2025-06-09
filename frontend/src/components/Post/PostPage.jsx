import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Post from './Post';
import PostModal from '../Feed/PostModal';
import './PostPage.css';

const API_URL = 'http://localhost:3000';

const PostPage = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setUserLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (e) {
        console.error('Error fetching user:', e);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError("Authentication error: token not found.");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL}/api/posts/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: 'Post not found or server error.' }));
          throw new Error(errorData.message || `Error: ${res.status}`);
        }
        const data = await res.json();
        if (data && data.post) {
          setPost(data.post);
        } else {
          console.error("Server response does not contain expected post object:", data);
          throw new Error('Server response does not contain post data.');
        }
      } catch (e) {
        console.error('Error loading post:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  if (loading || userLoading) {
    return (
      <div className="post-page-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="post-page-container">
        <div className="error-state">Error: {error}</div>
      </div>
    );
  }
  
  if (!post) return null;

  const handlePostUpdate = (postId, updates) => {
    if (!post) return;
    
    setPost(prevPost => ({
      ...prevPost,
      ...updates,
      likes: updates.likes || prevPost.likes,
      comments: updates.comments || prevPost.comments,
      likesCount: typeof updates.likesCount === 'number' ? updates.likesCount : prevPost.likesCount,
      commentsCount: typeof updates.commentsCount === 'number' ? updates.commentsCount : prevPost.commentsCount
    }));
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Ошибка при удалении комментария');
      }

      // Обновляем состояние поста после удаления комментария
      setPost(prevPost => ({
        ...prevPost,
        comments: prevPost.comments.filter(comment => comment._id !== commentId),
        commentsCount: prevPost.commentsCount - 1
      }));

    } catch (error) {
      console.error('Ошибка при удалении комментария:', error);
    }
  };

  return (
    <div className="post-page-container">
      <div className="post-page-content">
        <Post 
          post={post} 
          currentUser={currentUser} 
          onPostUpdate={handlePostUpdate}
          onImageClick={handleImageClick}
        />
      </div>
      {isModalOpen && (
        <PostModal
          post={post}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          currentUser={currentUser}
          onPostUpdate={handlePostUpdate}
          onDeleteComment={handleDeleteComment}
        />
      )}
    </div>
  );
};

export default PostPage; 