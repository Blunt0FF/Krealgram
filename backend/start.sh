#!/bin/bash

echo "🚀 Запуск Instagram Clone Backend..."

# Проверяем наличие node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
    echo "⚠️  Внимание: Создайте файл .env с настройками:"
    echo "JWT_SECRET=your_secret_key"
    echo "MONGO_URI=mongodb://localhost:27017/instagram_clone"
    echo "PORT=3000"
    echo ""
fi

# Запускаем приложение
echo "🌐 Запускаем API на порту 3000..."
npm start 