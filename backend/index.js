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
const whitelist = [
  "http://localhost:4000",
  "http://127.0.0.1:4000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://krealgram.vercel.app",
  "https://krealgram.com",
  "https://www.krealgram.com"
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('[CORS] Incoming origin:', origin);
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
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
    'Cache-Control',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'Cache-Control', 
    'Access-Control-Allow-Origin'
  ],
  credentials: true,
  maxAge: 86400
};

const io = new Server(server, {
  cors: corsOptions
});

app.set('io', io);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Krealgram API is working!');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
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
const indexRoutes = require('./routes/index');

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', indexRoutes);

app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!drive.isInitialized) {
      return res.status(500).send('Google Drive not initialized');
    }

    const fileMetadata = await drive.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, permissions'
    });

    const permissions = await drive.drive.permissions.list({
      fileId,
      fields: 'permissions(role, type)'
    });

    const hasPublicAccess = permissions.data.permissions.some(
      perm => perm.role === 'reader' && perm.type === 'anyone'
    );

    if (!hasPublicAccess) {
      return res.status(403).send('File is not publicly accessible');
    }

    const fileRes = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    const mimeType = fileRes.headers['content-type'] || 'application/octet-stream';
    const fileName = fileRes.headers['x-goog-stored-content-filename'] || 'file';
    const fileSize = parseInt(fileRes.headers['content-length'], 10) || 0;

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType
      });
    } else {
      res.setHeader('Content-Length', fileSize);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fileRes.data.pipe(res);
  } catch (err) {
    console.error('[PROXY-DRIVE] Error:', err);
    res.status(500).send('Proxy error');
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

resetAllUsersToOffline().catch((error) => {
  console.error('Failed to reset user statuses:', error);
});

startUserStatusUpdater();

server.listen(PORT, () => {
  console.log(`[SERVER] ✅ Server running on port ${PORT}`);
  console.log(`[SERVER] 🌐 CORS whitelist: ${whitelist.join(', ')}`);
  console.log(`[SERVER] 📡 Socket.IO ready`);
});

// Добавим отладочную информацию о маршрутах
console.log('Загруженные маршруты:');
console.log('Маршруты auth:', Object.keys(authRoutes.stack || {}));
console.log('Маршруты posts:', Object.keys(postRoutes.stack || {}));
console.log('Маршруты users:', Object.keys(userRoutes.stack || {}));
console.log('Маршруты admin:', Object.keys(adminRoutes.stack || {}));

// Глобальный обработчик ошибок с расширенным логированием
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR_HANDLER] Полная информация об ошибке:', {
    message: err.message,
    name: err.name,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  // Специфические обработчики для разных типов ошибок
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Ошибка валидации данных',
      errors: err.errors
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Требуется аутентификация'
    });
  }

  // Общий обработчик для всех остальных ошибок
  res.status(err.status || 500).json({
    message: err.message || 'Внутренняя ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Обработчик для неопределенных маршрутов
app.use((req, res, next) => {
  console.warn(`[404_HANDLER] Маршрут не найден: ${req.method} ${req.path}`);
  res.status(404).json({
    message: 'Маршрут не найден',
    path: req.path
  });
});
