#!/bin/bash
# install.sh

set -e

echo "🚀 Starting Krealgram installation..."

# Обновляем список пакетов
echo "📦 Updating package list..."
apt-get update

# Устанавливаем wget и curl
echo "🔧 Installing basic tools..."
apt-get install -y wget curl gnupg2 software-properties-common

# Добавляем Google Chrome repository
echo "🌐 Adding Google Chrome repository..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Обновляем список пакетов снова
apt-get update

# Устанавливаем Google Chrome
echo "🌍 Installing Google Chrome..."
apt-get install -y google-chrome-stable

# Проверяем установку
echo "✅ Checking Chrome installation..."
google-chrome-stable --version || echo "Chrome installation might have issues"

# Устанавливаем дополнительные зависимости для Puppeteer
echo "🎭 Installing Puppeteer dependencies..."
apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libxshmfence1 \
    libglu1-mesa

# Устанавливаем ffmpeg для обработки видео
echo "🎬 Installing ffmpeg..."
apt-get install -y ffmpeg

# Устанавливаем libvips для обработки изображений
echo "🖼️ Installing libvips..."
apt-get install -y libvips

# Создаем символические ссылки
echo "🔗 Creating symlinks..."
if [ -f /usr/bin/google-chrome-stable ]; then
    ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome
    ln -sf /usr/bin/google-chrome-stable /usr/bin/chrome
fi

# Устанавливаем npm зависимости
echo "📚 Installing npm dependencies..."
npm install

# Выводим информацию о браузере
echo "🔍 Browser information:"
which google-chrome-stable || echo "google-chrome-stable not found"
which google-chrome || echo "google-chrome not found"
which chrome || echo "chrome not found"

echo "✅ Installation completed successfully!"