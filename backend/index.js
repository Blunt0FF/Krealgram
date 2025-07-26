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

connectDB();

const googleDrive = require('./config/googleDrive');

// Инициализируем Google Drive
googleDrive.initialize().then(() => {
  // Запускаем автообновление токенов через 10 секунд после инициализации
  setTimeout(() => {
    if (googleDrive.isInitialized) {
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
      "https://www.krealgram.com",
      "https://krealgram-backend.onrender.com"
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
  "https://krealgram-backend.onrender.com",
  "krealgram.vercel.app",
  "krealgram.com",
  "www.krealgram.com"
];

// Настройки CORS - простая рабочая версия от 2 июля
const corsOptions = {
  origin: [
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "https://krealgram.vercel.app",
    "https://krealgram.com",
    "https://www.krealgram.com",
    "https://krealgram-backend.onrender.com"
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400, // 24 часа
  optionsSuccessStatus: 200 // для поддержки legacy браузеров
};

app.use(cors(corsOptions));

// Дополнительная обработка preflight OPTIONS запросов
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Логирование всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} - Origin: ${req.get('Origin')} - User-Agent: ${req.get('User-Agent')}`);
  next();
});

// Увеличиваем лимиты для больших файлов
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
    
    // Исправляем кодировку имени файла
    let fileName = meta.data.name || 'file';
    try {
      // Пытаемся исправить кодировку для кириллицы
      if (fileName.includes('Ð')) {
        fileName = decodeURIComponent(escape(fileName));
      }
    } catch (e) {
      console.log(`[PROXY-DRIVE] Не удалось исправить кодировку для ${fileId}:`, e.message);
    }
    
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

// Тестовый endpoint для проверки видео
app.get('/api/test-video/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const drive = require('./config/googleDrive');
  
  try {
    console.log(`[TEST-VIDEO] Тестируем видео файл ${fileId}`);
    
    // Получаем метаданные
    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    
    console.log(`[TEST-VIDEO] Метаданные:`, meta.data);
    
    // Загружаем первые 1024 байта для проверки
    const testBuffer = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { 
      responseType: 'arraybuffer',
      headers: {
        'Range': 'bytes=0-1023'
      }
    });
    
    console.log(`[TEST-VIDEO] Первые 1024 байта:`, testBuffer.data.byteLength);
    console.log(`[TEST-VIDEO] Первые 16 байт:`, Buffer.from(testBuffer.data.slice(0, 16)).toString('hex'));
    
    res.json({
      success: true,
      metadata: meta.data,
      testBytes: testBuffer.data.byteLength,
      firstBytes: Buffer.from(testBuffer.data.slice(0, 16)).toString('hex')
    });
  } catch (error) {
    console.error(`[TEST-VIDEO] Ошибка:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/proxy-drive/:id', async (req, res) => {
  const fileId = req.params.id;
  const { type } = req.query;
  const { google } = require('googleapis');
  const drive = require('./config/googleDrive');
  const axios = require('axios');

  try {
    // Обработка thumbnail для аватаров
    if (type === 'thumbnail') {
      
      try {
        // Получаем метаданные основного файла
        const mainFileMeta = await drive.drive.files.get({
          fileId,
          fields: 'name'
        });
        
        const mainFileName = mainFileMeta.data.name;
        
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
          
          for (const thumbnailName of possibleThumbnailNames) {
            try {
              const searchResult = await drive.drive.files.list({
                q: `name='${thumbnailName}' and '${process.env.GOOGLE_DRIVE_AVATARS_FOLDER_ID}' in parents and trashed=false`,
                fields: 'files(id, name, createdTime, modifiedTime)',
                pageSize: 10,
                orderBy: 'modifiedTime desc'
              });
              
              if (searchResult.data.files && searchResult.data.files.length > 0) {
                // Берем самый новый файл
                const thumbnailFile = searchResult.data.files[0];
                
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
              // Ошибка поиска thumbnail
            }
          }
        }
      } catch (error) {
        // Ошибка обработки thumbnail
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
        res.send(response.data);
        return;
      } catch (externalErr) {
        return res.status(404).send('External file not found');
      }
    }

    if (!drive.isInitialized) {
      return res.status(500).send('Google Drive not initialized');
    }

    const meta = await drive.drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });
    

    
    const mimeType = meta.data.mimeType || 'application/octet-stream';
    
    // Исправляем кодировку имени файла
    let fileName = meta.data.name || 'file';
    try {
      // Пытаемся исправить кодировку для кириллицы
      if (fileName.includes('Ð')) {
        fileName = decodeURIComponent(escape(fileName));
      }
    } catch (e) {
      console.log(`[PROXY-DRIVE] Не удалось исправить кодировку для ${fileId}:`, e.message);
    }
    
    const fileSize = meta.data.size || 0;
    
    // Исправляем MIME тип для видео, если он неправильный
    let correctedMimeType = mimeType;
    if (fileName.toLowerCase().endsWith('.mp4') && !mimeType.startsWith('video/')) {
      correctedMimeType = 'video/mp4';
    } else if (fileName.toLowerCase().endsWith('.webm') && !mimeType.startsWith('video/')) {
      correctedMimeType = 'video/webm';
    } else if (fileName.toLowerCase().endsWith('.avi') && !mimeType.startsWith('video/')) {
      correctedMimeType = 'video/x-msvideo';
    } else if (fileName.toLowerCase().endsWith('.mov') && !mimeType.startsWith('video/')) {
      correctedMimeType = 'video/quicktime';
    }
    
    // Принудительно устанавливаем правильный MIME тип для видео
    if (correctedMimeType.startsWith('video/')) {
      // Принудительно устанавливаем video/mp4 для всех .mp4 файлов
      if (fileName.toLowerCase().endsWith('.mp4')) {
        correctedMimeType = 'video/mp4';
      }
    } else if (fileName.toLowerCase().endsWith('.mp4')) {
      // Если MIME тип не video/, но файл .mp4 - принудительно устанавливаем
      correctedMimeType = 'video/mp4';
    }
    
    // Проверяем первые байты файла для определения реального формата
    if (correctedMimeType.startsWith('video/')) {
      try {
        const testBuffer = await drive.drive.files.get({
          fileId,
          alt: 'media'
        }, { 
          responseType: 'arraybuffer',
          headers: {
            'Range': 'bytes=0-15'
          }
        });
        
        const firstBytes = Buffer.from(testBuffer.data.slice(0, 16)).toString('hex');
        
        // Проверяем сигнатуры видео форматов
        if (firstBytes.startsWith('0000002066747970')) {
          // ISO Media (MP4, MOV, etc.)
          correctedMimeType = 'video/mp4';
        } else if (firstBytes.startsWith('52494646')) {
          // AVI
          correctedMimeType = 'video/x-msvideo';
        } else if (firstBytes.startsWith('1a45dfa3')) {
          // WebM
          correctedMimeType = 'video/webm';
        }
      } catch (error) {
        // Ошибка проверки формата
      }
    }
    
    // Принудительно загружаем весь файл для видео
    if (correctedMimeType.startsWith('video/')) {
      
      try {
        const fileBuffer = await drive.drive.files.get({
          fileId,
          alt: 'media'
        }, { responseType: 'arraybuffer' });
        
        // Упрощенные заголовки для видео
        res.set({
          'Content-Type': correctedMimeType,
          'Content-Length': fileBuffer.data.byteLength,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        });
        
        // Отправляем весь файл
        res.end(Buffer.from(fileBuffer.data));
        return;
      } catch (error) {
        // Fallback к стриму
      }
    }

    const fileRes = await drive.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'stream' });
    


    const range = req.headers.range;
    let headersSent = false;
    
    const sendHeaders = (statusCode, headers) => {
      if (!headersSent) {
        // Специальные заголовки для видео
        const videoHeaders = correctedMimeType.startsWith('video/') ? {
          'Accept-Ranges': 'bytes',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN'
        } : {};
        
        const finalHeaders = {
          ...headers,
          ...videoHeaders,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000',
          'Accept-Ranges': 'bytes'
        };
        

        
        res.writeHead(statusCode, finalHeaders);
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
        'Content-Type': correctedMimeType
      });
    } else {
      sendHeaders(200, {
        'Content-Length': fileSize,
        'Content-Type': correctedMimeType,
        'Accept-Ranges': 'bytes'
      });
    }

    fileRes.data.on('error', (err) => {
      if (!headersSent) {
        res.status(500).send('Error streaming file');
      } else {
        res.end();
      }
    });

    fileRes.data.on('end', () => {
      // Очищаем ресурсы после завершения стрима
      if (fileRes.data && !fileRes.data.destroyed) {
        fileRes.data.destroy();
      }
    });

    fileRes.data.on('close', () => {
      // Стрим данных закрыт
    });

    // Обработка ошибок ответа
    res.on('error', (err) => {
      if (fileRes.data && !fileRes.data.destroyed) {
        fileRes.data.destroy();
      }
    });

    res.on('finish', () => {
      // Ответ завершен
    });

    res.on('close', () => {
      // Ответ закрыт
    });

    // Добавляем обработку данных стрима
    fileRes.data.on('data', (chunk) => {
      // Получен чанк данных
    });

    // Передаем стрим в ответ
    fileRes.data.pipe(res);

    // Обработка отключения клиента
    req.on('close', () => {
      if (fileRes.data && !fileRes.data.destroyed) {
        fileRes.data.destroy();
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('File not found')) {
      return res.status(404).send('File not found');
    }
    
    if (err.message && err.message.includes('Permission denied')) {
      return res.status(403).send('Access denied');
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

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION]', reason);
  process.exit(1);
});

// Обработка ошибок памяти
process.on('warning', (warning) => {
  console.warn('[PROCESS_WARNING]', warning.name, warning.message);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Server running on port ${PORT}`);
  startUserStatusUpdater();
  resetAllUsersToOffline();
});