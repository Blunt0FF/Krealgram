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
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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

app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');

  console.group(`[PROXY-DRIVE] Incoming request for file ${fileId}`);
  console.log('Request details:', {
    fileId,
    headers: req.headers,
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    referer: req.headers.referer,
    isInitialized: drive.isInitialized
  });

  // Добавляем заголовки CORS для всех ответов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // Обработка preflight OPTIONS запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!drive.isInitialized) {
      console.error('[PROXY-DRIVE] Google Drive not initialized');
      console.groupEnd();
      return res.status(500).send('Google Drive not initialized');
    }

    // Проверка доступности файла
    try {
      const fileMetadata = await drive.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, permissions'
      });

      console.log('File metadata:', {
        id: fileMetadata.data.id,
        name: fileMetadata.data.name,
        mimeType: fileMetadata.data.mimeType,
        size: fileMetadata.data.size
      });

      // Проверка разрешений
      const permissions = await drive.drive.permissions.list({
        fileId,
        fields: 'permissions(role, type)'
      });

      const hasPublicAccess = permissions.data.permissions.some(
        perm => perm.role === 'reader' && perm.type === 'anyone'
      );

      console.log('File permissions:', {
        hasPublicAccess,
        permissionDetails: permissions.data.permissions
      });

      if (!hasPublicAccess) {
        console.warn('[PROXY-DRIVE] File is not publicly accessible');
        console.groupEnd();
        return res.status(403).send('File is not publicly accessible');
      }
    } catch (metaError) {
      console.error('[PROXY-DRIVE] Error fetching file metadata:', metaError);
      console.groupEnd();
      return res.status(404).send('File not found or inaccessible');
    }

    const fileRes = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    const mimeType = fileRes.headers['content-type'] || 'application/octet-stream';
    const fileName = fileRes.headers['x-goog-stored-content-filename'] || 'file';
    const fileSize = parseInt(fileRes.headers['content-length'], 10) || 0;

    console.log('File streaming details:', {
      mimeType,
      fileName,
      fileSize
    });

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

    fileRes.data.on('error', (err) => {
      console.error('[PROXY-DRIVE] Streaming error:', err);
      res.status(500).send('Error streaming file');
    });

    fileRes.data.pipe(res);
    console.log('[PROXY-DRIVE] File streaming started successfully');
    console.groupEnd();
  } catch (error) {
    console.error('[PROXY-DRIVE] Unexpected error:', error);
    console.groupEnd();
    res.status(500).send('Unexpected error during file proxy');
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
  console.log(`[SERVER] 🌐 CORS whitelist: ${whitelist.join(', ')}`);
  console.log(`[SERVER] 📡 Socket.IO ready`);
});