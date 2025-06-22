#!/bin/bash
# install.sh

set -e
npm install

echo "Creating backend/bin directory..."
mkdir -p backend/bin

echo "Downloading yt-dlp to backend/bin/yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o backend/bin/yt-dlp

echo "Making yt-dlp executable..."
chmod +x backend/bin/yt-dlp

echo "yt-dlp setup finished."

 