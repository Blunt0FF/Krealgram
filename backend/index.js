require('dotenv').config(); // Загружаем переменные окружения в самом начале

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
const tokenAutoRefresher = require('./utils/tokenAutoRefresher');
require('./utils/tempCleanup'); // Автоматическая очистка temp папок

// Уменьшаем количество логов
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'info';

console.log('[SERVER] 🚀 Starting Krealgram backend...');

connectDB();

const googleDrive = require('./config/googleDrive');

// Инициализируем Google Drive
googleDrive.initialize().then(() => {
  console.log('[SERVER] ✅ Google Drive initialization completed');
  
  // Запускаем автообновление токенов через 10 секунд после инициализации
  setTimeout(() => {
    if (googleDrive.isInitialized) {
      console.log('[SERVER] 🔄 Запуск автообновления токенов...');
      tokenAutoRefresher.initialize();
      
      // Загружаем токен из файла если есть
      tokenAutoRefresher.loadTokenFromFile().then(() => {
        // Запускаем автообновление каждые 30 минут
        tokenAutoRefresher.startAutoRefresh(30);
      });
    }
  }, 10000);
  
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

// API для проверки статуса автообновления токенов
app.get('/api/token-status', (req, res) => {
  const status = tokenAutoRefresher.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// API для ручного обновления токена
app.post('/api/refresh-token', async (req, res) => {
  try {
    const success = await tokenAutoRefresher.refreshToken();
    res.json({
      success,
      message: success ? 'Токен обновлен' : 'Не удалось обновить токен'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Роут для обработки Google OAuth callback
app.get('/auth/google/callback', (req, res) => {
  const { code } = req.query;
  
  if (code) {
    res.send(`
      <html>
        <head><title>Google Drive Authorization</title></head>
        <body>
          <h2>✅ Код авторизации получен!</h2>
          <p>Код: <code>${code}</code></p>
          <p>Теперь запустите в терминале:</p>
          <pre>node simple-token.js "${code}"</pre>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head><title>Google Drive Authorization</title></head>
        <body>
          <h2>❌ Ошибка авторизации</h2>
          <p>Код авторизации не получен.</p>
        </body>
      </html>
    `);
  }
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

// Обработка OPTIONS запросов для прокси
app.options('/api/proxy-drive/:id', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Range, Accept-Ranges');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  res.sendStatus(200);
});

// Обработка HEAD запросов для прокси (для получения метаданных)
app.head('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const drive = require('./config/googleDrive');
  
  try {
    if (!drive.isInitialized) {
      return res.status(500).send();
    }

    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = meta.data.name || 'file';
    const fileSize = meta.data.size || 0;
    
    res.set('Content-Type', meta.data.mimeType || 'application/octet-stream');
    res.set('Content-Length', meta.data.size || 0);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send();
  } catch (err) {
    res.status(404).send();
  }
});

app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { type } = req.query;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');
  const axios = require('axios');

  try {
    // Убираем избыточное логирование в продакшене
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PROXY-DRIVE] Запрос на проксирование файла ${fileId}${type ? ` (type: ${type})` : ''}`);
    }

    // Обработка thumbnail для аватаров
    if (type === 'thumbnail') {
      console.log(`[PROXY-DRIVE] 🔍 Ищем thumbnail для аватара ${fileId}`);
      
      try {
        // Получаем метаданные основного файла
        const mainFileMeta = await drive.drive.files.get({
          fileId,
          fields: 'name'
        });
        
        const mainFileName = mainFileMeta.data.name;
        console.log(`[PROXY-DRIVE] Основной файл: ${mainFileName}`);
        
        // Извлекаем username из имени файла (avatar_username.ext)
        const usernameMatch = mainFileName.match(/^avatar_(.+)\./);
        if (usernameMatch) {
          const username = usernameMatch[1];
          const safeUsername = username.replace(/[^a-zA-Z0-9]/g, '_');
          
          // Ищем thumbnail файлы (все возможные форматы)
          const possibleThumbnailNames = [
            `thumb_${safeUsername}.jpeg`,
            `thumb_${safeUsername}.jpg`,
            `thumb_${safeUsername}.png`,
            `thumb_${safeUsername}.webp` // для старых файлов
          ];
          
          console.log(`[PROXY-DRIVE] Ищем thumbnail файлы:`, possibleThumbnailNames);
          
          for (const thumbnailName of possibleThumbnailNames) {
            try {
              const searchResult = await drive.drive.files.list({
                q: `name='${thumbnailName}' and '${process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID}' in parents and trashed=false`,
                fields: 'files(id, name, createdTime, modifiedTime)',
                pageSize: 10,
                orderBy: 'modifiedTime desc'
              });
              
              if (searchResult.data.files && searchResult.data.files.length > 0) {
                console.log(`[PROXY-DRIVE] Найдено ${searchResult.data.files.length} файлов с именем ${thumbnailName}:`);
                searchResult.data.files.forEach((file, index) => {
                  console.log(`[PROXY-DRIVE] ${index + 1}. ${file.name} (${file.id}) - создан: ${file.createdTime}, изменен: ${file.modifiedTime}`);
                });
                
                // Берем самый новый файл
                const thumbnailFile = searchResult.data.files[0];
                console.log(`[PROXY-DRIVE] ✅ Используем самый новый thumbnail: ${thumbnailFile.name} (${thumbnailFile.id})`);
                
                // Проксируем thumbnail файл
                const thumbnailRes = await drive.drive.files.get({
                  fileId: thumbnailFile.id,
                  alt: 'media'
                }, { responseType: 'stream' });
                
                const thumbnailMeta = await drive.drive.files.get({
                  fileId: thumbnailFile.id,
                  fields: 'mimeType, size'
                });
                
                res.set('Content-Type', thumbnailMeta.data.mimeType || 'image/webp');
                res.set('Content-Length', thumbnailMeta.data.size || 0);
                res.set('Cache-Control', 'public, max-age=31536000');
                res.set('Access-Control-Allow-Origin', '*');
                
                thumbnailRes.data.pipe(res);
                return;
              }
            } catch (error) {
              console.error(`[PROXY-DRIVE] Ошибка поиска thumbnail ${thumbnailName}:`, error.message);
            }
          }
          
          console.log(`[PROXY-DRIVE] ⚠️ Thumbnail не найден, возвращаем оригинал`);
        }
      } catch (error) {
        console.error('[PROXY-DRIVE] Ошибка обработки thumbnail:', error.message);
      }
    }
    
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
        res.set('Access-Control-Allow-Origin', '*');
        res.send(response.data);
        return;
      } catch (externalErr) {
        console.error('[PROXY-DRIVE] Ошибка загрузки внешнего файла:', externalErr);
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(404).send('External file not found');
      }
    }

    if (!drive.isInitialized) {
      console.error('[PROXY-DRIVE] Google Drive не инициализирован');
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(500).send('Google Drive not initialized');
    }

    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = meta.data.name || 'file';
    const fileSize = meta.data.size || 0;

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

    fileRes.data.on('error', (err) => {
      if (!headersSent) {
        res.set('Access-Control-Allow-Origin', '*');
        res.status(500).send('Error streaming file');
      }
    });

    fileRes.data.on('end', () => {
      // Очищаем ресурсы после завершения стрима
      fileRes.data.destroy();
    });

    fileRes.data.pipe(res);

    // Обработка отключения клиента
    req.on('close', () => {
      if (fileRes.data && !fileRes.data.destroyed) {
        fileRes.data.destroy();
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('File not found')) {
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(404).send('File not found');
    }
    res.set('Access-Control-Allow-Origin', '*');
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