const RECENT_USERS_KEY = 'recentUsers';
const MAX_RECENT_USERS = 8;

export const getRecentUsers = () => {
  try {
    const stored = localStorage.getItem(RECENT_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting recent users:', error);
    return [];
  }
};

export const addRecentUser = (user) => {
  try {
    const recent = getRecentUsers();
    
    // Убираем пользователя если он уже есть
    const filtered = recent.filter(u => u._id !== user._id);
    
    // Добавляем в начало списка
    const updated = [user, ...filtered].slice(0, MAX_RECENT_USERS);
    
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error adding recent user:', error);
    return getRecentUsers();
  }
};

export const clearRecentUsers = () => {
  try {
    localStorage.removeItem(RECENT_USERS_KEY);
  } catch (error) {
    console.error('Error clearing recent users:', error);
  }
}; 

// Функция для обновления данных конкретного пользователя в недавних
export const updateRecentUser = (userId, newData) => {
  try {
    const recent = getRecentUsers();
    const updated = recent.map(user => 
      user._id === userId ? { ...user, ...newData } : user
    );
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error updating recent user:', error);
    return getRecentUsers();
  }
}; 

// Функция для очистки кэша аватаров в localStorage
export const clearAvatarCache = () => {
  try {
    // Очищаем недавних пользователей, чтобы принудительно обновить их данные
    localStorage.removeItem(RECENT_USERS_KEY);
    console.log('Avatar cache cleared from localStorage');
  } catch (error) {
    console.error('Error clearing avatar cache:', error);
  }
};

// Функция для принудительного обновления всех аватаров на странице
export const forceRefreshAllAvatars = () => {
  try {
    // Очищаем кэш браузера для изображений
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('image') || cacheName.includes('avatar')) {
            caches.delete(cacheName);
          }
        });
      });
    }
    
    // Принудительно перезагружаем все аватары на странице
    const avatarImages = document.querySelectorAll('img[src*="avatar"], img[src*="proxy-drive"]');
    avatarImages.forEach(img => {
      const currentSrc = img.src;
      if (currentSrc && !currentSrc.includes('default-avatar.png')) {
        const separator = currentSrc.includes('?') ? '&' : '?';
        img.src = `${currentSrc}${separator}t=${Date.now()}`;
      }
    });
    
    console.log(`Refreshed ${avatarImages.length} avatar images`);
  } catch (error) {
    console.error('Error refreshing avatars:', error);
  }
}; 