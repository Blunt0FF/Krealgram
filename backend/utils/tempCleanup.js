const fs = require('fs');
const path = require('path');

const TEMP_ROOT_PATH = path.join(__dirname, '../temp');

// Функция для получения размера директории
function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        const subDirSize = getDirectorySize(itemPath);
        totalSize += subDirSize.size;
        fileCount += subDirSize.count;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    console.log(`[TEMP_CLEANUP] Ошибка при подсчете размера ${dirPath}:`, error.message);
  }
  
  return { size: totalSize, count: fileCount };
}

// Функция для очистки temp папок
function cleanupTempFolders() {
  try {
    const tempDirs = ['input', 'output', 'preview'];
    
    for (const dirName of tempDirs) {
      const dirPath = path.join(TEMP_ROOT_PATH, dirName);
      
      if (!fs.existsSync(dirPath)) {
        continue;
      }
      
      const files = fs.readdirSync(dirPath);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = Date.now() - stats.mtime.getTime();
          
          // Удаляем файлы старше 5 минут (было 30 секунд)
          if (fileAge > 5 * 60 * 1000) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            deletedCount++;
          }
        } catch (error) {
          console.log(`[TEMP_CLEANUP] Ошибка при удалении ${filePath}:`, error.message);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[TEMP_CLEANUP] Удалено ${deletedCount} файлов из ${dirName}`);
      }
    }
    
    // Проверяем общий размер temp папки
    const totalSize = getDirectorySize(TEMP_ROOT_PATH);
    const totalSizeMB = Math.round(totalSize.size / (1024 * 1024));
    
    if (totalSizeMB > 100) {
      console.log(`[TEMP_CLEANUP] ⚠️ Temp папка большая: ${totalSizeMB}MB (${totalSize.count} файлов)`);
    }
    
  } catch (error) {
    console.log('[TEMP_CLEANUP] Ошибка при очистке:', error.message);
  }
}

// Функция для принудительной очистки (вызывается после завершения операций)
function forceCleanupAfterOperation() {
  console.log('[TEMP_CLEANUP] 🧹 Принудительная очистка после операции...');
  
  try {
    const tempDirs = ['input', 'output', 'preview'];
    
    for (const dirName of tempDirs) {
      const dirPath = path.join(TEMP_ROOT_PATH, dirName);
      
      if (!fs.existsSync(dirPath)) {
        continue;
      }
      
      const files = fs.readdirSync(dirPath);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = Date.now() - stats.mtime.getTime();
          
          // Удаляем файлы старше 1 минуты после завершения операции
          if (fileAge > 1 * 60 * 1000) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            deletedCount++;
          }
        } catch (error) {
          console.log(`[TEMP_CLEANUP] Ошибка при принудительной очистке ${filePath}:`, error.message);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[TEMP_CLEANUP] Принудительно удалено ${deletedCount} файлов из ${dirName}`);
      }
    }
    
    const totalSize = getDirectorySize(TEMP_ROOT_PATH);
    const totalSizeMB = Math.round(totalSize.size / (1024 * 1024));
    console.log(`[TEMP_CLEANUP] ✅ Temp папка после очистки: ${totalSizeMB}MB (${totalSize.count} файлов)`);
    
  } catch (error) {
    console.log('[TEMP_CLEANUP] Ошибка при принудительной очистке:', error.message);
  }
}

// Экспортируем функции для использования в других модулях
module.exports = {
  cleanupTempFolders,
  forceCleanupAfterOperation,
  getDirectorySize
};

// Запускаем очистку только при запуске сервера (не по интервалу)
console.log('[TEMP_CLEANUP] 🚀 Инициализирован - очистка по факту завершения операций');
cleanupTempFolders(); // Первая очистка при запуске 