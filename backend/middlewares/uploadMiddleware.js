const multer = require('multer');
const path = require('path');
const GoogleDriveManager = require('../config/googleDriveOAuth');

// Инициализируем Google Drive
const googleDrive = new GoogleDriveManager();
googleDrive.initialize().catch(console.error);

// Настройка multer для временного хранения файлов в памяти
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Проверяем тип файла
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Поддерживаются только изображения и видео файлы!'), false);
    }
  }
});

// Middleware для загрузки файлов на Google Drive
const uploadToGoogleDrive = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    console.log('[UPLOAD] Загружаем файл на Google Drive...');
    
    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(req.file.originalname);
    const filename = `${timestamp}_${randomString}${ext}`;

    // Загружаем файл на Google Drive
    const result = await googleDrive.uploadFile(
      req.file.buffer,
      filename,
      req.file.mimetype
    );

    // Сохраняем результат в req для дальнейшего использования
    req.uploadResult = {
      secure_url: result.secure_url,
      public_id: result.fileId,
      resource_type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      format: ext.substring(1),
      bytes: req.file.size,
      url: result.secure_url
    };

    console.log('[UPLOAD] ✅ Файл загружен на Google Drive:', result.secure_url);
    next();
  } catch (error) {
    console.error('[UPLOAD] ❌ Ошибка загрузки на Google Drive:', error);
    next(error);
  }
};

module.exports = {
  upload,
  uploadToGoogleDrive
}; 