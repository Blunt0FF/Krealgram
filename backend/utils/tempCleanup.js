const fs = require('fs');
const path = require('path');

const TEMP_INPUT_PATH = path.join(__dirname, '../temp/input');
const TEMP_OUTPUT_PATH = path.join(__dirname, '../temp/output');
const TEMP_ROOT_PATH = path.join(__dirname, '../temp');

function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error calculating directory size for ${dirPath}:`, error.message);
  }
  return totalSize;
}

function cleanupTempFolders() {
    try {
        console.log('🧹 Starting temp cleanup...');
        
        // Очистка всех temp папок
        const tempDirs = [TEMP_INPUT_PATH, TEMP_OUTPUT_PATH, TEMP_ROOT_PATH];
        
        for (const tempDir of tempDirs) {
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                let deletedCount = 0;
                let totalDeletedSize = 0;
                
                for (const file of files) {
                    const filePath = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        const fileAge = Date.now() - stats.mtime.getTime();
                        
                        // Удаляем файлы старше 30 секунд (было 1 минута)
                        if (fileAge > 30 * 1000) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                            totalDeletedSize += stats.size;
                        }
                    } catch (fileError) {
                        console.warn(`Failed to process file ${file}:`, fileError.message);
                    }
                }
                
                if (deletedCount > 0) {
                    console.log(`🗑️ Cleaned ${tempDir}: ${deletedCount} files, ${(totalDeletedSize / 1024 / 1024).toFixed(2)}MB freed`);
                }
            }
        }
        
        // Логируем текущий размер temp папки
        const totalSize = getDirectorySize(TEMP_ROOT_PATH);
        console.log(`📊 Current temp directory size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        
        // Если temp папка больше 500MB, принудительно очищаем все файлы старше 10 секунд
        if (totalSize > 500 * 1024 * 1024) {
            console.warn('⚠️ Temp directory too large, aggressive cleanup...');
            for (const tempDir of tempDirs) {
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        const filePath = path.join(tempDir, file);
                        try {
                            const stats = fs.statSync(filePath);
                            const fileAge = Date.now() - stats.mtime.getTime();
                            if (fileAge > 10 * 1000) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (fileError) {
                            // Игнорируем ошибки при удалении
                        }
                    }
                }
            }
            const newSize = getDirectorySize(TEMP_ROOT_PATH);
            console.log(`✅ Aggressive cleanup completed. New size: ${(newSize / 1024 / 1024).toFixed(2)}MB`);
        }
        
    } catch (error) {
        console.error('Ошибка при очистке temp папок:', error);
    }
}

// Запускаем очистку каждые 30 секунд (было 2 минуты)
setInterval(cleanupTempFolders, 30 * 1000);

// Первая очистка сразу при запуске
cleanupTempFolders();

module.exports = { cleanupTempFolders }; 