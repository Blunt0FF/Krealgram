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
const { setupSocketServer } = require('./socket');

// Загружаем переменные окружения
dotenv.config();

// Подключаемся к MongoDB
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
      "https://www.krealgram.com",
      "https://krealgram-lmnau82av-kreals-projects-83af4312.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true
  }
});

app.set('io', io); // Сделаем io доступным в контроллерах

// Настройки CORS для Express
const corsOptions = {
  origin: [
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'https://krealgram.vercel.app',
    'https://krealgram.com',
    'https://www.krealgram.com',
    'https://krealgram-lmnau82av-kreals-projects-83af4312.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Добавляем обработку OPTIONS запросов
app.options('*', cors(corsOptions));

// Добавляем базовый маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.json({ message: 'API is working' });
});

// Раздача статических файлов из папки 'uploads'
// __dirname в ES Modules не работает так, как в CommonJS, но так как package.json указывает "type": "commonjs" (по умолчанию для npm init -y)
// то __dirname будет работать корректно.
// Если бы мы использовали "type": "module", пришлось бы использовать import.meta.url
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/follow', followRoutes);

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

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    setupSocketServer(server);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
}); 