import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
// import { compressAvatar } from '../../utils/imageUtils'; // Сжатие будет либо удалено, либо изменено
import { API_URL } from '../../config';
import EmojiPicker from 'emoji-picker-react';
import './EditProfile.css';

const EditProfile = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    bio: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('/default-avatar.png');
  const [initialAvatarUrl, setInitialAvatarUrl] = useState(null);
  const [markAvatarForRemoval, setMarkAvatarForRemoval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // const [compressing, setCompressing] = useState(false); // Удаляем, если не будем сжимать на клиенте перед отправкой файла

  useEffect(() => {
    // Прокручиваем в верх при переходе на страницу редактирования профиля
    window.scrollTo(0, 0);
    
    if (user) {
      setUserData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || ''
      });

      if (user.avatar) {
        const avatarUrl = getAvatarUrl(user.avatar);
        setAvatarPreview(avatarUrl);
        setInitialAvatarUrl(avatarUrl);
      } else {
        setAvatarPreview('/default-avatar.png');
        setInitialAvatarUrl(null);
      }
      setLoading(false);
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const validateForm = () => {
    const errors = {};
    if (!userData.username.trim()) errors.username = 'Username is required';
    else if (userData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    else if (userData.username.length > 30) errors.username = 'Username must not exceed 30 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) errors.username = 'Username can only contain letters, numbers and underscore';
    
    if (!userData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) errors.email = 'Please enter a valid email address';
    
    if (userData.bio && userData.bio.length > 150) errors.bio = 'Bio must not exceed 150 characters';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAvatarChange = (e) => {
      const file = e.target.files[0];
    e.target.value = null; // Сброс инпута
      if (file) {
      // Валидация файла (размер, тип)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
        setValidationErrors(prev => ({ ...prev, avatar: 'File size must not exceed 5MB' }));
          return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
        setValidationErrors(prev => ({ ...prev, avatar: 'Supported formats: JPEG, PNG, GIF, WebP' }));
          return;
        }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setMarkAvatarForRemoval(false); // Если выбран новый файл, отменяем пометку на удаление
        setValidationErrors(prev => ({ ...prev, avatar: null }));
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('/default-avatar.png');
    setMarkAvatarForRemoval(true);
    if (validationErrors.avatar) {
      setValidationErrors(prev => ({ ...prev, avatar: null }));
    }
  };

  const handleEmojiClick = (emojiData) => {
    const { emoji } = emojiData;
    const textArea = document.querySelector('textarea[name="bio"]');
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const text = userData.bio;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    
    setUserData(prev => ({
      ...prev,
      bio: newText
    }));
    
    // Закрываем picker после выбора
    setShowEmojiPicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    const formDataToSend = new FormData();

    formDataToSend.append('bio', userData.bio);

    if (avatarFile) {
      console.log('Uploading avatar file:', {
        name: avatarFile.name,
        type: avatarFile.type,
        size: avatarFile.size
      });
      
      // Используем только поле 'image', которое ожидает сервер
      formDataToSend.append('image', avatarFile);

      // Проверяем содержимое FormData
      console.log('FormData contents:');
      for (let pair of formDataToSend.entries()) {
        console.log(pair[0], pair[1]);
        if (pair[1] instanceof File) {
          console.log('File details:', {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size
          });
        }
      }
    } else if (markAvatarForRemoval && initialAvatarUrl) {
      console.log('Removing avatar');
      formDataToSend.append('removeAvatar', 'true');
    }

    try {
      console.log('Sending request to:', `${API_URL}/api/users/profile`);
      
      // Добавим явные заголовки для multipart/form-data
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Не указываем Content-Type, браузер сам добавит с boundary
        },
        credentials: 'include',
        body: formDataToSend
      });

      // Добавим проверку заголовков ответа
      console.log('Response headers:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: 'Failed to parse error response' };
        }
        console.error('Profile update error response:', errorData);
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const updatedUser = JSON.parse(responseText);
      console.log('Profile update success:', updatedUser);
      
      // Обновляем данные в localStorage и глобальное состояние
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        const newUserData = { ...storedUser, bio: updatedUser.bio, avatar: updatedUser.avatar };
        console.log('Updating user data:', newUserData);
        localStorage.setItem('user', JSON.stringify(newUserData));
        setUser(newUserData);
      }

      // Обновляем состояние для превью и начального аватара после успешного обновления
      if (updatedUser.avatar) {
        const newAvatarUrl = getAvatarUrl(updatedUser.avatar);
        console.log('New avatar URL:', newAvatarUrl);
        setAvatarPreview(newAvatarUrl);
        setInitialAvatarUrl(newAvatarUrl);
      } else {
        console.log('No avatar in response, using default');
        setAvatarPreview('/default-avatar.png');
        setInitialAvatarUrl(null);
      }
      setAvatarFile(null);
      setMarkAvatarForRemoval(false);

      navigate(`/profile/${updatedUser.username}`);

    } catch (err) {
      console.error('Profile update error details:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !userData.username) { // Показываем загрузку, только если начальных данных еще нет
    return <div className="edit-profile-loading">Loading...</div>;
  }

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-box">
        <h2>Edit profile</h2>
        {error && <div className="edit-profile-error">{error}</div>}
        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="avatar-upload">
            <img 
              src={avatarPreview} 
              alt="Avatar preview"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
            <label className="avatar-upload-label">
              <input
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                // disabled={compressing} // Удаляем, если нет compressing
              />
              {/* <span>{compressing ? 'Сжатие...' : 'Изменить фото профиля'}</span> */}
              <span>Change profile photo</span>
            </label>
            {/* {compressing && ( <div className="compression-status">Сжатие аватара...</div> )} */}
            {validationErrors.avatar && (
              <div className="error-message">{validationErrors.avatar}</div>
            )}
            {/* Кнопка удаления показывается если есть текущий аватар (initialAvatarUrl) ИЛИ выбран новый файл (avatarFile)*/}
            {(initialAvatarUrl || avatarFile) && avatarPreview !== '/default-avatar.png' && (
                 <button type="button" onClick={handleRemoveAvatar} className="remove-avatar-button">
                    Remove profile photo
                 </button>
            )}
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={userData.username} // Используем userData
              onChange={handleUserInputChange} // Используем новый обработчик
              className={validationErrors.username ? 'error' : ''}
              required
              readOnly // Имя пользователя не редактируется
            />
            {validationErrors.username && (
              <div className="error-message">{validationErrors.username}</div>
            )}
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={userData.email} // Используем userData
              onChange={handleUserInputChange} // Используем новый обработчик
              className={validationErrors.email ? 'error' : ''}
              required
              readOnly // Email не редактируется
            />
            {validationErrors.email && (
              <div className="error-message">{validationErrors.email}</div>
            )}
          </div>

          <div className="form-group bio-group">
            <label>Bio</label>
            <div className="bio-input-container">
              <textarea
                name="bio"
                value={userData.bio} // Используем userData
                onChange={handleUserInputChange} // Используем новый обработчик
                className={validationErrors.bio ? 'error' : ''}
                rows="4"
              />
              <button
                type="button"
                className="emoji-button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker-container">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>
            {validationErrors.bio && (
              <div className="error-message">{validationErrors.bio}</div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="save-button" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile; 