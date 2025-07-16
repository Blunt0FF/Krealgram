import { API_URL } from '../config';

export const fetchPostDetails = async (postId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/posts/${postId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch post details');
    }

    const data = await response.json();
    
    console.log('[API_DEBUG] Post details:', {
      postId,
      mediaType: data.post.mediaType,
      imageUrl: data.post.image,
      videoUrl: data.post.videoUrl
    });

    return data.post;
  } catch (error) {
    console.error('[API_ERROR] Error fetching post details:', error);
    throw error;
  }
}; 