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

// Добавляем расширенную CORS-конфигурацию
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'https://krealgram.com',
  'https://krealgram.vercel.app',
  'https://krealgram-backend.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
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

// Проксирование Google Drive
app.get('/api/proxy-drive/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const type = req.query.type || 'file';

    const googleDriveUrl = type === 'thumbnail'
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
      : `https://drive.google.com/uc?id=${fileId}`;

    const response = await axios({
      method: 'get',
      url: googleDriveUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    // Копируем заголовки ответа
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // Кэширование на сутки

    response.data.pipe(res);
  } catch (error) {
    console.error('Google Drive proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy file' });
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