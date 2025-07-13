#!/bin/bash

# Проверка установки MongoDB
if ! command -v mongod &> /dev/null; then
    echo "MongoDB не установлена. Установите MongoDB через Homebrew: brew install mongodb"
    exit 1
fi

# Запуск MongoDB в фоновом режиме
brew services start mongodb-community

# Переход в директорию бэкенда
cd backend

# Установка зависимостей бэкенда
npm install

# Запуск бэкенда в фоновом режиме
npm run dev &

# Возврат в корневую директорию
cd ..

# Переход в директорию фронтенда
cd frontend

# Установка зависимостей фронтенда
npm install

# Запуск фронтенда
npm run dev
