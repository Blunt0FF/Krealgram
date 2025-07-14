#!/bin/bash

echo "🚀 Запуск Instagram Clone Frontend..."

# Проверяем наличие node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Запускаем приложение
echo "🌐 Запускаем на порту 4000..."
npm run dev 