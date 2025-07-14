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
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) {
      return callback(null, true);
    }

    // Проверяем, есть ли origin в белом списке
    const normalizedOrigin = origin
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    const isAllowed = whitelist.some(allowedOrigin => 
      allowedOrigin
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '') === normalizedOrigin
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(null, true); // Временно разрешаем все, чтобы не блокировать
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
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
app.get('/api/proxy-drive/:id', async (req, res) => {
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');
  const fileId = req.params.id;

  console.log(`[PROXY-DRIVE_FULL_DEBUG] Incoming request details:`, {
    fileId,
    headers: req.headers,
    method: req.method,
    query: req.query
  });

  try {
    console.log(`[PROXY-DRIVE] Запрос на проксирование файла ${fileId}`);
    if (!drive.isInitialized) {
      console.error('[PROXY-DRIVE] Google Drive не инициализирован');
      return res.status(500).send('Google Drive not initialized');
    }

    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = meta.data.name || 'file';
    const fileSize = meta.data.size || 0;

    console.log(`[PROXY-DRIVE_FULL_DEBUG] File metadata:`, {
      mimeType,
      fileName,
      fileSize
    });

    const fileRes = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    const range = req.headers.range;
    if (range) {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Range request:`, range);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': mimeType
      });
    } else {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fileRes.data.on('data', (chunk) => {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Chunk received: ${chunk.length} bytes`);
    });

    fileRes.data.on('end', () => {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Файл ${fileId} полностью отправлен на фронт`);
    });

    fileRes.data.on('error', (err) => {
      console.error('[PROXY-DRIVE_FULL_DEBUG] Ошибка при отправке файла:', err);
      res.status(500).send('Error streaming file');
    });

    fileRes.data.pipe(res);
  } catch (err) {
    console.error('[PROXY-DRIVE_FULL_DEBUG] Полная ошибка:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.response ? err.response.data : null
    });

    if (err.message && err.message.includes('File not found')) {
      console.warn(`[PROXY-DRIVE_FULL_DEBUG] ⚠️ Файл не найден: ${fileId}`);
      return res.status(404).send('File not found');
    }
    res.status(500).send('Proxy error: ' + err.message);
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