#!/bin/bash

echo "🚀 Простой деплой Krealgram (без мониторинга памяти)"

# Останавливаем все процессы Node.js
echo "🛑 Останавливаем процессы..."
pkill -f "node index.js" 2>/dev/null || true
pkill -f nodemon 2>/dev/null || true

# Очистка кэша
echo "🧹 Очистка кэша..."
npm cache clean --force

# Установка зависимостей backend
echo "📦 Установка зависимостей backend..."
cd backend
npm install --production

# Установка зависимостей frontend
echo "📦 Установка зависимостей frontend..."
cd ../frontend
npm install --production

# Сборка frontend
echo "🔨 Сборка frontend..."
npm run build

# Возвращаемся в корневую директорию
cd ..

echo "✅ Деплой завершен!"
echo ""
echo "📋 Для запуска:"
echo "cd backend && npm start"
echo ""
echo "🔍 Проверка:"
echo "curl http://localhost:3000/" 