import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../../utils/imageUtils';
// import { compressAvatar } from '../../utils/imageUtils'; // Сжатие будет либо удалено, либо изменено
import './EditProfile.css';

const API_URL = 'http://localhost:3000';

const EditProfile = ({ user, setUser }) => {
  const navigate = useNavigate();
  // Изменяем структуру formData, убираем avatar отсюда
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    bio: ''
  });
  const [avatarFile, setAvatarFile] = useState(null); // Для хранения объекта File нового аватара
  const [avatarPreview, setAvatarPreview] = useState('/default-avatar.png'); // URL для превью (строка)
  const [initialAvatarUrl, setInitialAvatarUrl] = useState(null); // URL текущего аватара пользователя (строка)
  const [markAvatarForRemoval, setMarkAvatarForRemoval] = useState(false); // Флаг для удаления аватара

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  // const [compressing, setCompressing] = useState(false); // Удаляем, если не будем сжимать на клиенте перед отправкой файла

  useEffect(() => {
    if (user) {
      setUserData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || ''
      });

      // Устанавливаем аватар для превью
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    const formDataToSend = new FormData();

    formDataToSend.append('bio', userData.bio);
    // Username и email не отправляем, так как они readOnly и не должны меняться здесь

    if (avatarFile) { // Если выбран новый файл аватара
      formDataToSend.append('avatar', avatarFile);
    } else if (markAvatarForRemoval && initialAvatarUrl) { // Если текущий аватар помечен к удалению и он был
      formDataToSend.append('removeAvatar', 'true');
    }

    try {
      const response = await fetch(`${API_URL}/api/users/profile`, { // Используем правильный endpoint
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // Content-Type не указываем для FormData
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      
      // Обновляем данные в localStorage и глобальное состояние
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        const newUserData = { ...storedUser, bio: updatedUser.bio, avatar: updatedUser.avatar };
        localStorage.setItem('user', JSON.stringify(newUserData));
        // Обновляем глобальное состояние пользователя
        setUser(newUserData);
      }

      // Обновляем состояние для превью и начального аватара после успешного обновления
      if (updatedUser.avatar) {
        // Если аватар - это полный URL (начинается с http), используем его как есть
        // Иначе добавляем префикс для относительного пути
        const newAvatarUrl = getAvatarUrl(updatedUser.avatar);
        setAvatarPreview(newAvatarUrl);
        setInitialAvatarUrl(newAvatarUrl);
      } else {
        setAvatarPreview('/default-avatar.png');
        setInitialAvatarUrl(null);
      }
      setAvatarFile(null); // Сбрасываем выбранный файл
      setMarkAvatarForRemoval(false); // Сбрасываем флаг удаления

      // Profile updated successfully - removed alert
      navigate(`/profile/${updatedUser.username}`);

    } catch (err) {
      setError(err.message);
      console.error('Profile update error:', err);
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

          <div className="form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              value={userData.bio} // Используем userData
              onChange={handleUserInputChange} // Используем новый обработчик
              className={validationErrors.bio ? 'error' : ''}
              rows="4"
            />
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