import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressPostImage } from '../../utils/imageUtils';
import { API_URL } from '../../config';
import './CreatePost.css';

const CreatePost = () => {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compressedFile, setCompressedFile] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('');
  const [compressing, setCompressing] = useState(false);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      setOriginalFileName(file.name);
      setError('');
      setCompressing(true);
      setCompressedFile(null);
      
      try {
        const compressedBlob = await compressPostImage(file);
        setCompressedFile(compressedBlob);
        console.log(`Оригинал: ${file.size} байт, Сжатый Blob: ${compressedBlob.size} байт, Тип: ${compressedBlob.type}`);
      } catch (err) {
        setError('Ошибка сжатия изображения');
        console.error('Compression error:', err);
      } finally {
        setCompressing(false);
      }
    }
  };

  const handleCaptionChange = (e) => {
    setCaption(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!compressedFile) {
      setError('Please select and wait for image processing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      // Отправляем изображение как FormData
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('image', compressedFile, originalFileName);

      const response = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        navigate('/feed');
      } else {
        const data = await response.json();
        setError(data.message || 'Error creating post');
      }
    } catch (error) {
      setError('Network or server error');
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-container">
      <div className="create-post-box">
        <h2>Create new post</h2>
        <form className="create-post-form" onSubmit={handleSubmit}>
          <label className="file-input-label">
            Choose Image
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={compressing} />
          </label>
          {compressing && (
            <div className="compression-status">
              Compressing image...
            </div>
          )}
          {previewUrl && (
            <div className="image-preview">
              <img src={previewUrl} alt="Preview" />
            </div>
          )}

          <div className="form-group">
            <textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={handleCaptionChange}
              disabled={loading || compressing}
              maxLength={500}
            />
            <div className={`char-count ${caption.length > 450 ? 'danger' : caption.length > 400 ? 'warning' : ''}`}>
              {caption.length}/500
            </div>
          </div>
          {error && <div className="create-post-error">{error}</div>}
          <button 
            type="submit" 
            className="create-post-button" 
            disabled={loading || compressing || !compressedFile}
          >
            {loading ? 'Publishing...' : compressing ? 'Processing...' : 'Share'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePost; 