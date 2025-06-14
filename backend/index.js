const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // Добавим path для работы с путями к статическим файлам
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db'); // Мы создадим этот файл далее
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const likeRoutes = require('./routes/likeRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const followRoutes = require('./routes/followRoutes');

// Загружаем переменные окружения
dotenv.config();

// Подключаемся к MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'https://krealgram.vercel.app',
    'https://krealgram.com',
    'https://www.krealgram.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

// Socket.IO setup
const io = new Server(server, {
  cors: corsOptions
});

app.set('io', io); // Сделаем io доступным в контроллерах

// Apply CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Раздача статических файлов из папки 'uploads'
// __dirname в ES Modules не работает так, как в CommonJS, но так как package.json указывает "type": "commonjs" (по умолчанию для npm init -y)
// то __dirname будет работать корректно.
// Если бы мы использовали "type": "module", пришлось бы использовать import.meta.url
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/follow', followRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'API is working' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Настройка Socket.IO
io.on('connection', (socket) => {
  // Присоединение к комнате по userId
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
  }

  socket.on('disconnect', () => {
    // Ничего не логируем при отключении
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server }; 