const User = require('../models/userModel');
const { getAvatarUrl } = require('../utils/urlUtils');

// Добавляем функцию для обработки URL аватара
const processAvatarUrl = (avatarPath) => {
  if (!avatarPath) return '/default-avatar.png';

  // Если это Google Drive ID
  if (/^[a-zA-Z0-9_-]{33}$/.test(avatarPath)) {
    return `/api/proxy-drive/${avatarPath}`;
  }

  // Если это полный URL Google Drive
  const googleDrivePatterns = [
    /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/,
    /https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
    /https:\/\/drive\.google\.com\/open\?id=([^&]+)/
  ];

  for (const pattern of googleDrivePatterns) {
    const match = avatarPath.match(pattern);
    if (match && match[1]) {
      return `/api/proxy-drive/${match[1]}`;
    }
  }

  // Если уже полный URL, возвращаем как есть
  if (avatarPath.startsWith('http')) return avatarPath;

  // Локальные пути
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://krealgram-backend.onrender.com'
    : 'http://localhost:3000';

  // Если это относительный путь
  return `${baseUrl}/uploads/avatars/${avatarPath}`;
};

// @desc    Поиск пользователей по имени пользователя (username)
// @route   GET /api/search/users?q=query&page=1&limit=10
// @access  Private
exports.searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const currentUserId = req.user.id; // ID текущего пользователя, чтобы исключить его из поиска

    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query cannot be empty.' });
    }

    const searchQuery = q.trim();
    const regex = new RegExp(searchQuery, 'i'); // 'i' для регистронезависимого поиска

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Ищем пользователей, у которых username соответствует regex, и исключаем текущего пользователя
    const users = await User.find({
      username: regex,
      // _id: { $ne: currentUserId } // Временно закомментировано для теста
    })
    .select('username avatar bio followers following') // Выбираем только необходимые поля
    .skip(skip)
    .limit(limitNum)
    .lean();

    // Добавляем полный URL для аватаров
    const usersWithFullAvatarUrls = users.map(user => ({
      ...user,
      avatar: processAvatarUrl(user.avatar)
    }));

    const totalUsersFound = await User.countDocuments({
        username: regex,
        // _id: { $ne: currentUserId } // Временно закомментировано для теста
    });

    res.status(200).json({
      message: 'Users found successfully',
      users: usersWithFullAvatarUrls,
      currentPage: pageNum,
      totalPages: Math.ceil(totalUsersFound / limitNum),
      totalPosts: totalUsersFound
    });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ 
      message: 'Server error while searching users', 
      error: error.message 
    });
  }
}; 