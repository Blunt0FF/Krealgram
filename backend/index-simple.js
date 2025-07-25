require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');

console.log('[SERVER] 🚀 Starting Krealgram backend (simple version)...');

connectDB();

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

// Настройки CORS
const corsOptions = {
  origin: [
    'http://localhost:4000', 
    'https://localhost:4000', 
    'https://krealgram.com',
    'https://www.krealgram.com',
    /\.krealgram\.com$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Простой тестовый роут
app.get('/api/health', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running (simple version)'
  });
});

// Простой прокси роут для тестирования
app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  
  // Устанавливаем CORS заголовки
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
  
  try {
    // Простая заглушка для тестирования
    res.json({
      status: 'OK',
      fileId: fileId,
      message: 'Proxy route is working (simple version)',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Подключаем роуты
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

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('[SERVER] ❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;

server.on('error', (error) => {
  console.error('[SERVER] ❌ Server error:', error.message);
});

server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Server running on port ${PORT} (simple version)`);
}); 