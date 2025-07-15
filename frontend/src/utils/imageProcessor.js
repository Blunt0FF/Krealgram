// Утилита для обработки изображений на клиенте
class ImageProcessor {
  // Максимальные параметры для сжатия
  static MAX_WIDTH = 2048;
  static MAX_HEIGHT = 2048;
  static QUALITY = 0.7;

  // Метод для сжатия изображения
  static async compressImage(file, options = {}) {
    const {
      maxWidth = this.MAX_WIDTH,
      maxHeight = this.MAX_HEIGHT,
      quality = this.QUALITY
    } = options;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Пропорциональное масштабирование
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Конвертация в Blob с указанным качеством
          canvas.toBlob((blob) => {
            // Создаем новый File из Blob с ОРИГИНАЛЬНЫМ именем
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          }, file.type, quality);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  // Метод для предварительного просмотра изображения
  static createImagePreview(file, maxSize = 300) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Пропорциональное масштабирование превью
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL(file.type));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  // Метод для создания превью БЕЗ сохранения в папку постов
  static async createTemporaryPreview(file, maxSize = 300) {
    if (file.type.startsWith('video/')) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d');
          
          // Устанавливаем время на 10% от длительности
          video.currentTime = video.duration * 0.1;
          
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, maxSize, maxSize);
            resolve(canvas.toDataURL('image/jpeg'));
          };
        };
        video.onerror = reject;
        video.src = URL.createObjectURL(file);
      });
    }
    
    // Для изображений используем существующий метод
    return this.createImagePreview(file, maxSize);
  }

  // Проверка типа и размера файла
  static validateImageFile(file, options = {}) {
    const {
      maxSizeInMB = 10,  // Максимальный размер файла
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
    } = options;

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Неподдерживаемый тип файла: ${file.type}`);
    }

    if (file.size > maxSizeInMB * 1024 * 1024) {
      throw new Error(`Размер файла превышает ${maxSizeInMB} МБ`);
    }

    return true;
  }

  // Определение ориентации изображения
  static getImageOrientation(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const view = new DataView(event.target.result);
        
        if (view.getUint16(0, false) !== 0xFFD8) {
          resolve(null);
          return;
        }

        const length = view.byteLength;
        let offset = 2;

        while (offset < length) {
          const marker = view.getUint16(offset, false);
          offset += 2;

          if (marker === 0xFFE1) {
            if (view.getUint32(offset + 8, false) !== 0x45786966) {
              resolve(null);
              return;
            }

            const little = view.getUint16(offset + 18, false) === 0x4949;
            offset += 10;

            const tags = view.getUint16(offset, little);
            offset += 2;

            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                const orientation = view.getUint16(offset + (i * 12) + 8, little);
                resolve(orientation);
                return;
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }

        resolve(null);
      };
      reader.readAsArrayBuffer(file);
      reader.onerror = reject;
    });
  }

  // Корректировка изображения с учетом ориентации
  static async correctImageOrientation(file) {
    const orientation = await this.getImageOrientation(file);
    
    if (!orientation || orientation === 1) {
      return file;  // Без изменений
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Поворот и отражение в зависимости от ориентации
          switch (orientation) {
            case 3:  // 180 градусов
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.rotate(Math.PI);
              ctx.drawImage(img, -img.width, -img.height);
              break;
            case 6:  // 90 градусов по часовой
              canvas.width = img.height;
              canvas.height = img.width;
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(img, 0, -img.height);
              break;
            case 8:  // 90 градусов против часовой
              canvas.width = img.height;
              canvas.height = img.width;
              ctx.rotate(-Math.PI / 2);
              ctx.drawImage(img, -img.width, 0);
              break;
          }

          canvas.toBlob((blob) => {
            const correctedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(correctedFile);
          }, file.type);
        };
        img.src = event.target.result;
        img.onerror = reject;
      };
      reader.readAsDataURL(file);
      reader.onerror = reject;
    });
  }
}

export default ImageProcessor; 