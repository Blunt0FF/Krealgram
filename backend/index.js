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
      "http://localhost:3000",
      "http://localhost:4000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:4000",
      "https://krealgram.vercel.app",
      "https://krealgram.com",
      "https://www.krealgram.com",
      "https://krealgram-backend.onrender.com",
      /\.krealgram\.com$/,
      /\.vercel\.app$/
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Origin', 
      'X-Requested-With', 
      'Accept', 
      'Range'
    ]
  }
});

app.set('io', io);

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://localhost:4000',
      'https://krealgram.com', 
      'https://www.krealgram.com', 
      'http://krealgram.com',
      'http://www.krealgram.com',
      'https://krealgram.vercel.app',
      'https://krealgram-backend.onrender.com',
      'https://krealgram.com:4000',
      'https://krealgram.vercel.app:4000',
      /^https?:\/\/(www\.)?krealgram\.com$/,
      /^https?:\/\/([\w-]+\.)?krealgram\.com$/,
      /\.vercel\.app$/
    ];

    console.log('[CORS_DEBUG] Входящий origin:', origin);

    if (!origin || allowedOrigins.some(allowed => 
      typeof allowed === 'string' 
        ? origin === allowed 
        : allowed.test(origin)
    )) {
      console.log('[CORS_DEBUG] Origin разрешен:', origin);
      callback(null, true);
    } else {
      console.log('[CORS_DEBUG] Origin запрещен:', origin);
      callback(null, true); // Временно разрешаем все
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Origin', 
    'X-Requested-With', 
    'Accept', 
    'Range',
    'x-requested-with'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'Authorization'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

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
  console.group('[PROXY-DRIVE] Request Processing');
  console.log('[PROXY-DRIVE] Request details:', {
    fileId: req.params.id,
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent']
  });

  const origin = req.headers.origin || req.headers.referer || '*';
  const allowedOrigins = [
    'https://krealgram.com',
    'https://www.krealgram.com',
    'https://krealgram.vercel.app',
    'http://localhost:3000',
    'http://localhost:4000'
  ];

  console.log('[PROXY-DRIVE] Checking origin:', {
    origin,
    isAllowed: allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)
  });

  if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!googleDrive.isInitialized) {
      console.error('[PROXY-DRIVE] Google Drive not initialized');
      return res.status(500).json({ message: 'Google Drive не инициализирован' });
    }

    const fileId = req.params.id;
    console.log('[PROXY-DRIVE] Fetching file metadata:', fileId);

    const fileRes = await googleDrive.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });

    const fileName = fileRes.data.name || `file_${fileId}`;
    const mimeType = fileRes.headers['content-type'] || 'application/octet-stream';

    console.log('[PROXY-DRIVE] File metadata:', {
      fileName,
      mimeType,
      fileSize: fileRes.headers['content-length']
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Disposition');

    fileRes.data.on('error', (err) => {
      console.error('[PROXY-DRIVE] Stream error:', err);
      res.status(500).send('Ошибка потоковой передачи файла');
    });

    fileRes.data.pipe(res);
    console.log('[PROXY-DRIVE] File streaming started');
    console.groupEnd();
  } catch (error) {
    console.error('[PROXY-DRIVE] Unexpected error:', error);
    console.groupEnd();
    res.status(500).send('Непредвиденная ошибка при проксировании файла');
  }
});

app.options('/api/proxy-drive/:id', cors(corsOptions), (req, res) => {
  res.sendStatus(200);
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

const whitelist = [
  'http://localhost:3000',
  'http://localhost:4000',
  'https://krealgram.com',
  'https://www.krealgram.com',
  'https://krealgram.vercel.app'
];

server.listen(PORT, () => {
  console.log(`[SERVER] 🌐 CORS whitelist: ${whitelist.join(', ')}`);
  console.log(`[SERVER] 📡 Socket.IO ready`);
});

app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '*';
  const allowedOrigins = [
    'https://krealgram.com',
    'https://www.krealgram.com',
    'https://krealgram.vercel.app',
    'http://localhost:3000',
    'http://localhost:4000'
  ];

  if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers',
    'X-Requested-With,content-type,Authorization,Accept,Origin,x-requested-with,Range');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Authorization, Content-Range, X-Content-Range');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((err, req, res, next) => {
  if (err.name === 'CorsError') {
    return res.status(403).json({
      error: 'CORS не разрешен',
      message: 'Доступ с вашего домена запрещен'
    });
  }
  next(err);
});
