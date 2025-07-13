const express = require('express');
const router = express.Router();
const { migrateCloudinaryToDriveOnRender } = require('../migrate-render');

// Middleware для логирования запросов
router.use((req, res, next) => {
  console.log(`[ADMIN_ROUTES] Входящий запрос: ${req.method} ${req.path}`);
  next();
});

// Обработчик миграции с расширенной обработкой ошибок
router.post('/migrate-media', async (req, res, next) => {
  try {
    console.log('[ADMIN_ROUTES] Начало миграции медиафайлов');
    
    const result = await migrateCloudinaryToDriveOnRender();
    
    console.log('[ADMIN_ROUTES] Миграция завершена:', result);
    
    res.status(200).json({ 
      message: 'Миграция медиафайлов выполнена',
      status: 'completed',
      result 
    });
  } catch (error) {
    console.error('[ADMIN_ROUTES] Ошибка миграции:', error);
    
    // Передаем ошибку в глобальный обработчик ошибок
    next(error);
  }
});

// Обработчик неизвестных маршрутов
router.use((req, res, next) => {
  console.warn(`[ADMIN_ROUTES] Неизвестный маршрут: ${req.method} ${req.path}`);
  res.status(404).json({ 
    message: 'Маршрут не найден',
    path: req.path 
  });
});

module.exports = router; 