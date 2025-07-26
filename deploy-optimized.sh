#!/bin/bash

echo "🚀 Оптимизированный деплой Krealgram"

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен"
    exit 1
fi

# Проверяем версию Node.js
NODE_VERSION=$(node -v)
echo "📦 Node.js версия: $NODE_VERSION"

# Очистка кэша npm
echo "🧹 Очистка npm кэша..."
npm cache clean --force

# Установка зависимостей для backend
echo "📦 Установка зависимостей backend..."
cd backend
npm install --production

# Проверка переменных окружения
echo "🔧 Проверка переменных окружения..."
if [ -z "$GOOGLE_DRIVE_CLIENT_ID" ]; then
    echo "⚠️  GOOGLE_DRIVE_CLIENT_ID не установлен"
fi

if [ -z "$GOOGLE_DRIVE_CLIENT_SECRET" ]; then
    echo "⚠️  GOOGLE_DRIVE_CLIENT_SECRET не установлен"
fi

if [ -z "$MONGODB_URI" ]; then
    echo "⚠️  MONGODB_URI не установлен"
fi

# Установка зависимостей для frontend
echo "📦 Установка зависимостей frontend..."
cd ../frontend
npm install --production

# Сборка frontend
echo "🔨 Сборка frontend..."
npm run build

# Возвращаемся в корневую директорию
cd ..

# Создание .env файла для production
echo "📝 Создание .env файла..."
cat > backend/.env << EOF
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=512"
PORT=3000
EOF

echo "✅ Деплой завершен!"
echo ""
echo "📋 Рекомендации для Render:"
echo "1. Установите переменную NODE_OPTIONS='--max-old-space-size=512'"
echo "2. Включите автоматический перезапуск при ошибках"
echo "3. Настройте мониторинг памяти"
echo ""
echo "🔍 Для проверки здоровья сервера:"
echo "curl https://your-app.onrender.com/api/health"
echo ""
echo "📊 Для мониторинга памяти:"
echo "curl https://your-app.onrender.com/api/health/memory" 