const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // process.env.MONGO_URI будет загружен благодаря dotenv.config() в index.js
    await mongoose.connect(process.env.MONGO_URI, {
      // Настройки пула соединений для MongoDB Atlas
      maxPoolSize: 10, // Максимальное количество соединений в пуле
      minPoolSize: 2,  // Минимальное количество соединений в пуле
      maxIdleTimeMS: 30000, // Максимальное время бездействия соединения (30 секунд)
      serverSelectionTimeoutMS: 5000, // Таймаут выбора сервера (5 секунд)
      socketTimeoutMS: 45000, // Таймаут сокета (45 секунд)
      connectTimeoutMS: 10000, // Таймаут подключения (10 секунд)
      heartbeatFrequencyMS: 10000, // Частота проверки соединения (10 секунд)
      retryWrites: true, // Повторные попытки записи
      retryReads: true,  // Повторные попытки чтения
      w: 'majority', // Ожидание подтверждения от большинства реплик
      wtimeout: 10000, // Таймаут записи (10 секунд)
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Завершаем процесс с ошибкой, если не удалось подключиться к БД
    process.exit(1);
  }
};

// Обработчики событий подключения
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

// Обработка завершения процесса
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

module.exports = connectDB; 