const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const User = require('../models/userModel');

// Подписаться на пользователя
router.post('/:userId', auth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (currentUser.following.includes(req.params.userId)) {
      return res.status(400).json({ message: 'Вы уже подписаны на этого пользователя' });
    }

    currentUser.following.push(req.params.userId);
    userToFollow.followers.push(req.user.id);

    await currentUser.save();
    await userToFollow.save();

    res.json({ message: 'Успешно подписались на пользователя' });
  } catch (error) {
    console.error('Ошибка при подписке:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Отписаться от пользователя
router.delete('/:userId', auth, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.id);

    if (!userToUnfollow) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!currentUser.following.includes(req.params.userId)) {
      return res.status(400).json({ message: 'Вы не подписаны на этого пользователя' });
    }

    currentUser.following = currentUser.following.filter(
      id => id.toString() !== req.params.userId
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== req.user.id
    );

    await currentUser.save();
    await userToUnfollow.save();

    res.json({ message: 'Успешно отписались от пользователя' });
  } catch (error) {
    console.error('Ошибка при отписке:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 