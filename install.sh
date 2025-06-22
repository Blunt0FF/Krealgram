#!/bin/bash
# Установка yt-dlp на Render

# Exit on error
set -e

# Install node dependencies
npm install

# Create a bin directory in the backend folder
mkdir -p backend/bin

# Install yt-dlp into the local bin directory
echo "Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o backend/bin/yt-dlp
chmod a+rx backend/bin/yt-dlp
echo "yt-dlp installed successfully in backend/bin."

 