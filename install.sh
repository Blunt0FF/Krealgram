#!/bin/bash
# install.sh

set -e

# Обновляем список пакетов
echo "Updating package list..."
apt-get update

# Устанавливаем дополнительные зависимости для Chromium
echo "Installing additional Chromium dependencies..."
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
    xdg-utils

# Создаем символическую ссылку для Chromium
if [ -f /usr/bin/chromium-browser ]; then
    echo "Creating chromium symlink..."
    ln -sf /usr/bin/chromium-browser /usr/bin/chromium
fi

npm install

echo "Installation completed successfully."