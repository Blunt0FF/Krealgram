#!/bin/bash
# Установка yt-dlp на Render

# Exit on error
set -e

# Install node dependencies
npm install

# Install yt-dlp globally
echo "Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
echo "yt-dlp installed successfully."

 