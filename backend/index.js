const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { startUserStatusUpdater } = require('./utils/userStatusUpdater');
const { resetAllUsersToOffline } = require('./utils/resetUserStatuses');
const axios = require('axios');

dotenv.config();
console.log('[SERVER] 🚀 Starting Krealgram backend...');

connectDB();

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

app.set('io', io);

const whitelist = [
  // Основные домены
  "https://krealgram.com",
  "https://www.krealgram.com",
  "https://krealgram.vercel.app",
  
  // Локальная разработка
  "http://localhost:3000",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4000"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) {
      return callback(null, true);
    }

    // Нормализуем origin для точного сравнения
    const normalizedOrigin = origin
      .replace(/^https?:\/\//, '')  // Удаляем протокол
      .replace(/^www\./, '')        // Удаляем www
      .replace(/\/$/, '');          // Удаляем trailing slash

    const isAllowed = whitelist.some(allowedOrigin => 
      allowedOrigin
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '') === normalizedOrigin
    );

    if (isAllowed) {
      console.log(`[CORS] Разрешен домен: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`[CORS] Заблокирован домен: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Cache-Control'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Cache-Control'],
  credentials: true,
  maxAge: 86400
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Глобальный middleware для CORS
app.use((req, res, next) => {
  const origin = req.get('origin');
  
  // Разрешаем все домены из белого списка
  if (whitelist.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', true);
  
  // Обработка preflight-запросов
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Krealgram API is working!');
});

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const commentRoutes = require('./routes/commentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const likeRoutes = require('./routes/likeRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Проксирование Google Drive с жесткой проверкой
app.get('/api/proxy-drive/:fileId', async (req, res) => {
  try {
    const origin = req.get('origin') || '';
    
    // Строгая проверка домена
    const isAllowedOrigin = whitelist.some(allowedOrigin => 
      origin.includes(allowedOrigin.replace(/^https?:\/\//, ''))
    );

    if (!isAllowedOrigin) {
      console.warn(`[GOOGLE_DRIVE_PROXY] Неавторизованный доступ с домена: ${origin}`);
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const fileId = req.params.fileId;
    const type = req.query.type || 'file';

    console.log('[GOOGLE_DRIVE_PROXY] Безопасный запрос:', {
      fileId,
      type,
      origin
    });

    // Строгая настройка CORS
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Vary', 'Origin');

    // Проверяем, является ли fileId закодированным URL
    let googleDriveUrl;
    try {
      const decodedUrl = decodeURIComponent(fileId);
      if (decodedUrl.startsWith('http')) {
        // Дополнительная проверка внешних URL
        const parsedUrl = new URL(decodedUrl);
        if (!['drive.google.com', 'googleusercontent.com'].includes(parsedUrl.hostname)) {
          console.warn(`[GOOGLE_DRIVE_PROXY] Недопустимый внешний URL: ${decodedUrl}`);
          return res.status(403).json({ error: 'Недопустимый URL' });
        }
        googleDriveUrl = decodedUrl;
      } else {
        googleDriveUrl = type === 'thumbnail'
          ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
          : `https://drive.google.com/uc?id=${fileId}`;
      }
    } catch {
      googleDriveUrl = type === 'thumbnail'
        ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
        : `https://drive.google.com/uc?id=${fileId}`;
    }

    console.log('[GOOGLE_DRIVE_PROXY] Проксируемый URL:', googleDriveUrl);

    const response = await axios({
      method: 'get',
      url: googleDriveUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://drive.google.com'
      },
      // Ограничиваем размер файла
      maxContentLength: 50 * 1024 * 1024, // 50 МБ
      maxBodyLength: 50 * 1024 * 1024
    });

    // Копируем заголовки ответа с ограничениями
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600'); // Кэширование на час
    res.set('X-Proxy-Origin', origin);

    response.data.pipe(res);
  } catch (error) {
    console.error('Google Drive proxy error:', error);
    res.status(500).json({ 
      error: 'Не удалось проксировать файл', 
      details: error.message
    });
  }
});

io.on('connection', async (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
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

resetAllUsersToOffline().then(() => {
}).catch((error) => {
  console.error('Failed to reset user statuses:', error);
});

startUserStatusUpdater();

server.listen(PORT, () => {
  console.log(`[SERVER] 📡 Socket.IO ready`);
});