require('dotenv').config(); // Загружаем переменные окружения в самом начале

// Принудительная установка переменных окружения для Google Drive
process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID = process.env.GOOGLE_DRIVE_MESSAGES_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';
process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID = process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';
process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID = process.env.GOOGLE_DRIVE_POSTS_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';
process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID = process.env.GOOGLE_DRIVE_PREVIEWS_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';
process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID = process.env.GOOGLE_DRIVE_VIDEOS_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';
process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID = process.env.GOOGLE_DRIVE_GIFS_FOLDER_ID || '1QwV41ZAO90B_zdnP9jiC4bddvZ4bS_is';

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const { startUserStatusUpdater } = require('./utils/userStatusUpdater');
const { resetAllUsersToOffline } = require('./utils/resetUserStatuses');

// Уменьшаем количество логов
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'info';

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
  "http://krealgram.vercel.app",
  "https://krealgram.com",
  "http://krealgram.com",
  "https://www.krealgram.com",
  "http://www.krealgram.com",
  "krealgram.vercel.app",
  "krealgram.com",
  "www.krealgram.com"
];

// Настройки CORS
const corsOptions = {
  origin: [
    'http://localhost:4000', 
    'https://localhost:4000', 
      'https://krealgram.com',
    'https://www.krealgram.com',
    /\.krealgram\.com$/  // Поддержка поддоменов
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
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

app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { type } = req.query;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');
  const axios = require('axios');

  console.log(`[PROXY-DRIVE_FULL_DEBUG] Incoming request details:`, {
    fileId,
    headers: req.headers,
    method: req.method,
    url: req.url,
    isInitialized: drive.isInitialized
  });

  try {
    console.log(`[PROXY-DRIVE] Запрос на проксирование файла ${fileId}`);
    
    // Поддержка внешних URL
    if (fileId.startsWith('http')) {
      const decodedUrl = decodeURIComponent(fileId);
      try {
        const response = await axios.get(decodedUrl, { 
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        res.set('Content-Type', response.headers['content-type']);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(response.data);
        return;
      } catch (externalErr) {
        console.error('[PROXY-DRIVE] Ошибка загрузки внешнего файла:', externalErr);
        return res.status(404).send('External file not found');
      }
    }

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
    let headersSent = false;
    
    const sendHeaders = (statusCode, headers) => {
      if (!headersSent) {
        res.writeHead(statusCode, {
          ...headers,
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        });
        headersSent = true;
      }
    };

    if (range) {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Range request:`, range);
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      sendHeaders(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType
      });
    } else {
      sendHeaders(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType
      });
    }

    fileRes.data.on('data', (chunk) => {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Chunk received: ${chunk.length} bytes`);
    });

    fileRes.data.on('end', () => {
      console.log(`[PROXY-DRIVE_FULL_DEBUG] Файл ${fileId} полностью отправлен на фронт`);
    });

    fileRes.data.on('error', (err) => {
      console.error('[PROXY-DRIVE_FULL_DEBUG] Ошибка при отправке файла:', err);
      if (!headersSent) {
      res.status(500).send('Error streaming file');
      }
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

server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Server running on port ${PORT}`);
  startUserStatusUpdater();
  resetAllUsersToOffline();
});