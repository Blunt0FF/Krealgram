#!/bin/bash
# install.sh

set -e

# Обновляем список пакетов
echo "Updating package list..."
apt-get update

npm install

echo "Installation completed successfully."