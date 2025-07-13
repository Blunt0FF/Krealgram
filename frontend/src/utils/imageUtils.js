import { API_URL } from '../config';
import { getBaseUrl } from '../config';

export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.8, type = 'image/jpeg') => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Ошибка создания Blob из canvas'));
        },
        type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Ошибка загрузки изображения'));

    const reader = new FileReader();
    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
};

export const compressAvatar = (file) => {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) return reject(new Error('Файл не является изображением.'));

    const img = new Image();
    img.onload = () => {
      const size = 250;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      if (img.width > img.height) {
        sourceX = (img.width - img.height) / 2;
        sourceWidth = img.height;
      } else if (img.height > img.width) {
        sourceY = (img.height - img.width) / 2;
        sourceHeight = img.width;
      }

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);

      try {
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        resolve(dataUrl);
      } catch (error) {
        try {
          const dataUrlJpeg = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrlJpeg);
        } catch (jpegError) {
          reject(new Error('Ошибка конвертации изображения: ' + jpegError.message));
        }
      }
    };
    img.onerror = () => reject(new Error('Ошибка загрузки изображения для аватара.'));

    const reader = new FileReader();
    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = () => reject(new Error('Ошибка FileReader при чтении файла аватара.'));
    reader.readAsDataURL(file);
  });
};

export const compressPostImage = (file) => Promise.resolve(file);

export const compressMessageImage = (file, maxSizeKB = 100) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxWidth = 800;
      const maxHeight = 600;
      let { width, height } = img;

      if (width > height && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      while (compressedDataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(compressedDataUrl);
    };

    img.src = URL.createObjectURL(file);
  });
};

export const compressAvatarAdvanced = (file, maxSizeKB = 50) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const size = 400;
      canvas.width = size;
      canvas.height = size;

      const { width, height } = img;
      const minDimension = Math.min(width, height);
      const startX = (width - minDimension) / 2;
      const startY = (height - minDimension) / 2;

      ctx.drawImage(img, startX, startY, minDimension, minDimension, 0, 0, size, size);

      let quality = 0.8;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      while (compressedDataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(compressedDataUrl);
    };

    img.src = URL.createObjectURL(file);
  });
};

// --- Утилиты ---

export const isImageFile = (file) => {
  return file && file.type.startsWith('image/');
};

export const getFileSizeKB = (dataUrl) => {
  return Math.round(dataUrl.length / 1024);
};

export const getImageUrl = (imagePath, options = {}) => {
  if (typeof imagePath === 'object' && imagePath !== null) {
    imagePath =
      imagePath.imageUrl ||
      imagePath.image ||
      imagePath.thumbnailUrl ||
      imagePath.url ||
      '/default-post-placeholder.png';
  }

  if (!imagePath) return '/default-post-placeholder.png';

  const baseUrl = getBaseUrl();

  if (imagePath.startsWith('/Users/') || imagePath.startsWith('/home/')) {
    const fileName = imagePath.split('/').pop();
    return `${baseUrl}/uploads/${fileName}`;
  }

  if (imagePath.includes('drive.google.com')) {
    try {
      const url = new URL(imagePath);
      const fileId =
        url.searchParams.get('id') ||
        url.pathname.split('/').pop() ||
        imagePath.match(/\/file\/d\/([^/]+)/)?.[1];

      if (fileId) {
        return `${baseUrl}/api/proxy-drive/${fileId}`;
      }
    } catch {
      return '/default-post-placeholder.png';
    }
  }

  if (imagePath.startsWith('http')) return imagePath;

  return `${baseUrl}/uploads/${imagePath}`;
};

export const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return '/default-avatar.png';

  if (avatarPath.includes('drive.google.com')) {
    return `${API_URL}/api/proxy-drive/${avatarPath.split('id=')[1]}`;
  }

  if (avatarPath.startsWith('http')) {
    return avatarPath;
  }

  return `${API_URL}/uploads/${avatarPath}`;
};

export const getVideoUrl = (videoPath, options = {}) => {
  if (!videoPath) return null;

  if (videoPath.includes('drive.google.com')) {
    try {
      const url = new URL(videoPath);
      const fileId = url.searchParams.get('id');
      if (fileId) {
        const secureApiUrl = API_URL.replace(/^http:/, 'https');
        return `${secureApiUrl}/api/proxy-drive/${fileId}`;
      }
    } catch {
      return videoPath;
    }
  }

  if (videoPath.startsWith('http') || videoPath.startsWith('data:')) return videoPath;

  return `${API_URL}/uploads/${videoPath}`;
};

export const generateVideoPreviewUrl = (videoPath) => {
  return `https://drive.google.com/uc?id=${videoPath}`;
};

export const isValidMediaUrl = (url) => {
  return url && (url.startsWith('http') || url.startsWith('/') || url.includes('drive.google.com'));
};