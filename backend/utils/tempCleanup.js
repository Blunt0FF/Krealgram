const fs = require('fs');
const path = require('path');

const TEMP_INPUT_PATH = path.join(__dirname, '../temp/input');
const TEMP_OUTPUT_PATH = path.join(__dirname, '../temp/output');

function cleanupTempFolders() {
    try {
        // Очистка input папки
        if (fs.existsSync(TEMP_INPUT_PATH)) {
            const inputFiles = fs.readdirSync(TEMP_INPUT_PATH);
            inputFiles.forEach(file => {
                const filePath = path.join(TEMP_INPUT_PATH, file);
                const stats = fs.statSync(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                
                // Удаляем файлы старше 5 минут
                if (fileAge > 5 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    console.log(`Удален старый файл: ${file}`);
                }
            });
        }

        // Очистка output папки
        if (fs.existsSync(TEMP_OUTPUT_PATH)) {
            const outputFiles = fs.readdirSync(TEMP_OUTPUT_PATH);
            outputFiles.forEach(file => {
                const filePath = path.join(TEMP_OUTPUT_PATH, file);
                const stats = fs.statSync(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                
                // Удаляем файлы старше 5 минут
                if (fileAge > 5 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    console.log(`Удален старый файл: ${file}`);
                }
            });
        }
    } catch (error) {
        console.error('Ошибка при очистке temp папок:', error);
    }
}

// Запускаем очистку каждые 5 минут
setInterval(cleanupTempFolders, 5 * 60 * 1000);

// Запускаем первую очистку через 1 минуту после старта
setTimeout(cleanupTempFolders, 60 * 1000);

module.exports = { cleanupTempFolders }; 