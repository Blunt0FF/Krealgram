#!/bin/bash

echo "🚀 Запуск Instagram Clone (Backend + Frontend)"
echo "================================================="

# Функция для проверки доступности порта
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Порт $1 уже занят"
        return 1
    else
        return 0
    fi
}

# Проверяем порты
echo "🔍 Проверяем доступность портов..."
check_port 3000 || (echo "Backend порт 3000 занят" && exit 1)
check_port 4000 || (echo "Frontend порт 4000 занят" && exit 1)

echo "✅ Порты свободны"

# Запускаем backend в фоне
echo "🖥️  Запускаем Backend (порт 3000)..."
cd backend-2 && npm install && npm start &
BACKEND_PID=$!

# Ждем 3 секунды чтобы backend успел запуститься
sleep 3

# Запускаем frontend в фоне
echo "🌐 Запускаем Frontend (порт 4000)..."
cd ../frontend && npm install && npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 Приложение запущено!"
echo "Frontend: http://localhost:4000"
echo "Backend API: http://localhost:3000"
echo ""
echo "Нажмите Ctrl+C для остановки..."

# Функция для корректного завершения процессов
cleanup() {
    echo ""
    echo "🛑 Останавливаем сервисы..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Готово!"
    exit 0
}

# Ловим сигнал прерывания
trap cleanup SIGINT

# Ждем завершения
wait 