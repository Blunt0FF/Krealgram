const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // Добавим path для работы с путями к статическим файлам
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db'); // Мы создадим этот файл далее
const { startUserStatusUpdater } = require('./utils/userStatusUpdater');
const { resetAllUsersToOffline } = require('./utils/resetUserStatuses');

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
      "https://www.krealgram.com"
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
    'https://www.krealgram.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400 // 24 часа
};

app.use(cors(corsOptions));

// Важно: middleware для парсинга JSON должен идти после CORS
app.use(express.json({ limit: '50mb' })); // Увеличим лимит для base64 аватаров и других данных
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статических файлов из папки 'uploads'
// __dirname в ES Modules не работает так, как в CommonJS, но так как package.json указывает "type": "commonjs" (по умолчанию для npm init -y)
// то __dirname будет работать корректно.
// Если бы мы использовали "type": "module", пришлось бы использовать import.meta.url
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.send('Krealgram API is working!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// TODO: Подключить маршруты (routes)
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const commentRoutes = require('./routes/commentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const likeRoutes = require('./routes/likeRoutes');
const conversationRoutes = require('./routes/conversationRoutes'); // Добавляем маршруты для диалогов
const notificationRoutes = require('./routes/notificationRoutes'); // Импортируем маршруты уведомлений
const adminRoutes = require('./routes/adminRoutes'); // Админские маршруты

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/conversations', conversationRoutes); // Подключаем маршруты для диалогов
app.use('/api/notifications', notificationRoutes); // Подключаем маршруты для уведомлений
app.use('/api/admin', adminRoutes); // Подключаем админские маршруты

// Настройка Socket.IO
io.on('connection', async (socket) => {
  // Присоединение к комнате по userId
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
    
    // Устанавливаем пользователя как онлайн
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
    // Устанавливаем пользователя как оффлайн при отключении
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

// Сбрасываем всех пользователей в offline при запуске сервера
resetAllUsersToOffline().then(() => {
  console.log('All users set to offline on server start');
}).catch((error) => {
  console.error('Failed to reset user statuses:', error);
});

// Запускаем сервис обновления статуса пользователей
startUserStatusUpdater();

server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 