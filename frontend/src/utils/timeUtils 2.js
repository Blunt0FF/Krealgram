export const formatLastSeen = (lastActive, isOnline) => {
  if (isOnline) {
    return 'Online';
  }

  if (!lastActive) {
    return '';
  }

  const now = new Date();
  const lastActiveDate = new Date(lastActive);
  const diffInMs = now - lastActiveDate;
  const diffInHours = diffInMs / (1000 * 60 * 60);

  // Если меньше 12 часов - показываем относительное время
  if (diffInHours < 12) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHoursFloor = Math.floor(diffInHours);

    if (diffInMinutes < 1) {
      return 'Online';
    } else if (diffInMinutes < 60) {
      return `Active ${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else {
      return `Active ${diffInHoursFloor} hour${diffInHoursFloor !== 1 ? 's' : ''} ago`;
    }
  } else {
    // Если больше 12 часов - показываем дату и время
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day = lastActiveDate.getDate();
    const month = months[lastActiveDate.getMonth()];
    const hours = lastActiveDate.getHours().toString().padStart(2, '0');
    const minutes = lastActiveDate.getMinutes().toString().padStart(2, '0');
    
    return `was online ${day} ${month} at ${hours}:${minutes}`;
  }
};

export const formatMessageTime = (timestamp) => {
  const messageDate = new Date(timestamp);
  const now = new Date();
  
  const hours = messageDate.getHours().toString().padStart(2, '0');
  const minutes = messageDate.getMinutes().toString().padStart(2, '0');
  const timeString = `${hours}:${minutes}`;
  
  // Проверяем, сегодня ли сообщение
  const isToday = messageDate.toDateString() === now.toDateString();
  
  if (isToday) {
    return timeString; // Только время для сегодняшних сообщений
  }
  
  // Вчера
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = messageDate.toDateString() === yesterday.toDateString();
  
  if (isYesterday) {
    return `Yesterday ${timeString}`;
  }
  
  // Проверяем, в этом ли году
  const isThisYear = messageDate.getFullYear() === now.getFullYear();
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const day = messageDate.getDate();
  const month = months[messageDate.getMonth()];
  
  if (isThisYear) {
    return `${day} ${month} ${timeString}`;
  } else {
    const year = messageDate.getFullYear();
    return `${day} ${month} ${year} ${timeString}`;
  }
}; 