const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // Добавим path для работы с путями к статическим файлам
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db'); // Мы создадим этот файл далее
const { startUserStatusUpdater } = require('./utils/userStatusUpdater');
const { resetAllUsersToOffline } = require('./utils/resetUserStatuses');

// Загружаем переменные окружения
dotenv.config();

console.log('[SERVER] 🚀 Starting Krealgram backend...');

// Подключаемся к MongoDB
connectDB();

// Инициализируем Google Drive асинхронно, но не блокируем запуск сервера
const googleDrive = require('./config/googleDrive');
googleDrive.initialize().then(() => {
  console.log('[SERVER] ✅ Google Drive initialization completed');
}).catch((error) => {
  console.error('[SERVER] ❌ Google Drive initialization failed:', error.message);
  console.log('[SERVER] ⚠️ Server will continue without Google Drive');
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4000",
      "http://127.0.0.1:4000",
      "https://krealgram.vercel.app",
      "https://krealgram.com",
      "https://www.krealgram.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true
  }
});

app.set('io', io); // Сделаем io доступным в контроллерах

// Настройки CORS для Express
const whitelist = [
  "http://localhost:4000",
  "http://127.0.0.1:4000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://krealgram.vercel.app",
  "https://krealgram.com",
  "https://www.krealgram.com",
];
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:4000', 
      'http://127.0.0.1:4000',
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'https://krealgram-backend.onrender.com',
      'https://krealgram.vercel.app',
      'https://krealgram.com',
      'https://www.krealgram.com'
    ];

    // Разрешаем все локальные источники и список доменов
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Origin', 
    'X-Requested-With', 
    'Accept',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Сначала обрабатываем OPTIONS-запросы для всех маршрутов.
// Это критически важно для "непростых" запросов (POST, PUT, DELETE с кастомными заголовками),
// которые требуют preflight-запроса от браузера.
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));

// Важно: middleware для парсинга JSON должен идти после CORS
app.use(express.json({ limit: '50mb' })); // Увеличим лимит для base64 аватаров и других данных
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статических файлов из папки 'uploads'
// __dirname в ES Modules не работает так, как в CommonJS, но так как package.json указывает "type": "commonjs" (по умолчанию для npm init -y)
// то __dirname будет работать корректно.
// Если бы мы использовали "type": "module", пришлось бы использовать import.meta.url
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.send('Krealgram API is working!');
});

// Эндпоинт для проверки доступности бэкенда
app.get('/health', (req, res) => {
  try {
    // Проверяем подключение к MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    // Проверяем статус Google Drive
    const googleDriveStatus = require('./config/googleDrive').isInitialized ? 'Initialized' : 'Not Initialized';

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        mongodb: mongoStatus,
        googleDrive: googleDriveStatus
      },
      version: process.env.npm_package_version || 'unknown'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during health check'
    });
  }
});

// TODO: Подключить маршруты (routes)
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const commentRoutes = require('./routes/commentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const likeRoutes = require('./routes/likeRoutes');
const conversationRoutes = require('./routes/conversationRoutes'); // Добавляем маршруты для диалогов
const notificationRoutes = require('./routes/notificationRoutes'); // Импортируем маршруты уведомлений
const adminRoutes = require('./routes/adminRoutes'); // Админские маршруты

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Прокси-эндпоинт для Google Drive
app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');

  try {
    console.log(`[PROXY-DRIVE] Запрос на проксирование файла ${fileId}`);
    if (!drive.isInitialized) {
      console.error('[PROXY-DRIVE] Google Drive не инициализирован');
      return res.status(500).send('Google Drive not initialized');
    }

    // Получаем метаданные файла
    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType'
    });
    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = meta.data.name || 'file';
    console.log(`[PROXY-DRIVE] mimeType: ${mimeType}, fileName: ${fileName}`);

    // Получаем сам файл как stream
    const fileRes = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fileRes.data.on('end', () => {
      console.log(`[PROXY-DRIVE] Файл ${fileId} успешно отправлен на фронт`);
    });
    fileRes.data.on('error', (err) => {
      console.error('[PROXY-DRIVE] Ошибка при отправке файла:', err);
      res.status(500).send('Error streaming file');
    });
    fileRes.data.pipe(res);
  } catch (err) {
    if (err.message && err.message.includes('File not found')) {
      console.warn(`[PROXY-DRIVE] ⚠️ Файл не найден: ${fileId}`);
      return res.status(404).send('File not found');
    }
    console.error('[PROXY-DRIVE] ❌ Ошибка:', err.message);
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// Настройка Socket.IO
io.on('connection', async (socket) => {
  // Присоединение к комнате по userId
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);

    // Устанавливаем пользователя как онлайн
    try {
      const User = require('./models/userModel');
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastActive: new Date()
      });
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  socket.on('disconnect', async () => {
    // Устанавливаем пользователя как оффлайн при отключении
    if (userId) {
      try {
        const User = require('./models/userModel');
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: new Date()
        });
      } catch (error) {
        console.error('Error updating user offline status:', error);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

// Сбрасываем всех пользователей в offline при запуске сервера
resetAllUsersToOffline().then(() => {
  // console.log('All users set to offline on server start');
}).catch((error) => {
  console.error('Failed to reset user statuses:', error);
});

// Запускаем сервис обновления статуса пользователей
startUserStatusUpdater();

server.listen(PORT, () => {
  console.log(`[SERVER] ✅ Server running on port ${PORT}`);
  if (Array.isArray(corsOptions.origin)) {
    console.log(`[SERVER] 🌐 CORS origins: ${corsOptions.origin.join(', ')}`);
  } else {
    console.log(`[SERVER] 🌐 CORS origins: ${corsOptions.origin}`);
  }
  console.log(`[SERVER] 📡 Socket.IO ready`);
}); 