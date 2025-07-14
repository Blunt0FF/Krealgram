const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // process.env.MONGO_URI будет загружен благодаря dotenv.config() в index.js
    await mongoose.connect(process.env.MONGO_URI, {
      // Опции для нового драйвера MongoDB, чтобы избежать предупреждений
      // useNewUrlParser: true, // больше не нужны в последних версиях Mongoose
      // useUnifiedTopology: true,
      // useCreateIndex: true, // больше не поддерживается, индексы создаются через ensureIndexes или model.syncIndexes()
      // useFindAndModify: false // больше не поддерживается
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Завершаем процесс с ошибкой, если не удалось подключиться к БД
    process.exit(1);
  }
};

module.exports = connectDB; 