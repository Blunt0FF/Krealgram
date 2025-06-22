#!/bin/bash
# Установка yt-dlp на Render

# Exit on error
set -e

# Install node dependencies
npm install

# Install yt-dlp using pip
echo "Installing yt-dlp via pip..."
pip3 install yt-dlp
echo "yt-dlp installed successfully."

 