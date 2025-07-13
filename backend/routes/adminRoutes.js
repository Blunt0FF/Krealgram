const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const { migrateUserAvatars } = require('../migrate-user-avatars');
const { migrateCloudinaryToDriveOnRender } = require('../migrate-render');

// @desc    Migrate all user avatars to Google Drive
router.post('/migrate-avatars', protect, admin, async (req, res) => {
  try {
    const result = await migrateUserAvatars();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка миграции аватаров', error: error.message });
  }
});

// @desc    Migrate all media files to Google Drive
router.post('/migrate-media', protect, admin, async (req, res) => {
  try {
    const result = await migrateCloudinaryToDriveOnRender();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка миграции медиафайлов', error: error.message });
  }
});

module.exports = router; 