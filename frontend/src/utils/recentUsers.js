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