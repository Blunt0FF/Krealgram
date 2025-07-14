const User = require('../models/userModel');

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

    const totalUsersFound = await User.countDocuments({
        username: regex,
        // _id: { $ne: currentUserId } // Временно закомментировано для теста
    });

    res.status(200).json({
      message: 'Users found successfully',
      users,
      currentPage: pageNum,
      totalPages: Math.ceil(totalUsersFound / limitNum),
      totalResults: totalUsersFound
    });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error occurred while searching users.', error: error.message });
  }
}; 