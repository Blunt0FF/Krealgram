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
      "https://www.krealgram.com",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000"
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
  "http://127.0.0.1:4000",
  "http://localhost",
  "http://localhost:4000"  
];

const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://krealgram.vercel.app', 
      'https://krealgram.com',
      'https://krealgram-backend.onrender.com',
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
      'http://localhost',
      null // Разрешаем null для внутренних запросов
    ];

    console.log(`[CORS] Checking origin: ${origin}`);

    // Проверяем точное совпадение или вхождение домена
    const isAllowed = allowedOrigins.some(allowed => 
      allowed === origin || 
      (origin && origin.includes(allowed))
    );

    if (isAllowed) {
      console.log(`[CORS] Allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      // Мягкий возврат с разрешением
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Cache-Control',
    'X-Forwarded-For',
    'X-Real-IP',
    'Access-Control-Allow-Origin'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'Cache-Control', 
    'X-Proxy-Origin',
    'Access-Control-Allow-Origin'
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Глобальный middleware для CORS с расширенной логикой
app.use((req, res, next) => {
  const origin = req.get('origin') || req.get('referer') || '*';
  const requestMethod = req.method;
  const requestPath = req.path;

  console.log(`[CORS Debug] Full Request Details:`, {
    origin,
    host: req.get('host'),
    referer: req.get('referer'),
    method: requestMethod,
    path: requestPath,
    headers: req.headers
  });

  // Список разрешенных доменов с поддержкой поддоменов
  const allowedOrigins = [
    'https://krealgram.vercel.app', 
    'https://krealgram.com',
    'https://krealgram-backend.onrender.com',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
    'http://localhost'
  ];

  // Проверка и установка заголовков CORS с максимальной гибкостью
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const isAllowedOrigin = allowedOrigins.some(allowed => 
    normalizedOrigin === allowed || 
    normalizedOrigin.includes(allowed)
  );

  // Устанавливаем заголовки CORS
  res.header('Access-Control-Allow-Origin', isAllowedOrigin ? origin : '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Content-Length, X-Requested-With, Origin, Accept, Access-Control-Allow-Origin'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Обработка preflight-запросов
  if (requestMethod === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Применение CORS
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

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
app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const type = req.query.type || 'file';

  try {
    // Расширенное логирование
    console.log('[GOOGLE_DRIVE_PROXY] Входящий запрос:', {
      fileId,
      type,
      origin: req.get('origin'),
      referer: req.get('referer'),
      host: req.get('host'),
      headers: req.headers
    });

    // Разрешаем все домены
    const origin = req.get('origin') || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    let googleDriveUrl;
    try {
      // Пытаемся декодировать, если это закодированный внешний URL
      const decodedUrl = decodeURIComponent(fileId);
      if (decodedUrl.startsWith('http')) {
        googleDriveUrl = decodedUrl;
        console.log('[GOOGLE_DRIVE_PROXY] Проксирование внешнего URL:', googleDriveUrl);
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
      }
    });

    // Копируем заголовки ответа
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Кэширование на сутки
    res.set('X-Proxy-Origin', origin);

    // Логирование результата
    console.log('[GOOGLE_DRIVE_PROXY] Результат:', {
      contentType: response.headers['content-type'],
      status: response.status
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Google Drive proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy file',
      details: error.message,
      fileId: fileId,
      type: type
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

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR_HANDLER]', {
    message: err.message,
    stack: err.stack,
    origin: req.get('origin'),
    method: req.method,
    path: req.path
  });

  if (err.name === 'CorsError') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
      origin: req.get('origin')
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});