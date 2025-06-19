export const formatLastSeen = (lastActive, isOnline) => {
  if (isOnline) {
    return 'Active now';
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
      return 'Active now';
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