const fs = require('fs').promises;
const path = require('path');

class EmailTemplateManager {
  constructor() {
    this.templatesDir = path.join(__dirname, '../email-templates');
    this.cache = new Map();
  }

  /**
   * Загружает HTML шаблон из файла
   * @param {string} templateName - имя файла шаблона (без расширения)
   * @returns {Promise<string>} содержимое HTML шаблона
   */
  async loadTemplate(templateName) {
    if (this.cache.has(templateName)) {
      return this.cache.get(templateName);
    }

    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`);
      const template = await fs.readFile(templatePath, 'utf8');
      this.cache.set(templateName, template);
      return template;
    } catch (error) {
      console.error(`Error loading email template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  /**
   * Рендерит HTML шаблон с переданными данными
   * @param {string} templateName - имя шаблона
   * @param {Object} data - данные для подстановки в шаблон
   * @returns {Promise<string>} готовый HTML
   */
  async renderTemplate(templateName, data) {
    let template = await this.loadTemplate(templateName);
    
    // Обработка условных блоков {{#if condition}}...{{/if}}
    template = template.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Обработка вложенных условных блоков для sharedPost
    template = template.replace(/\{\{#if\s+sharedPost\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
      return (data.sharedPost && data.sharedPost[field]) ? content : '';
    });

    // Обработка циклов {{#each array}}...{{/each}}
    template = template.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, content) => {
      const array = data[arrayKey];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = content;
        // Заменяем переменные в контексте элемента массива
        itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return item[key] || '';
        });
        return itemContent;
      }).join('');
    });

    // Простая подстановка переменных {{variable}}
    template = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || '';
    });

    // Обработка вложенных переменных для sharedPost
    template = template.replace(/\{\{sharedPost\.(\w+)\}\}/g, (match, field) => {
      return (data.sharedPost && data.sharedPost[field]) ? data.sharedPost[field] : '';
    });

    return template;
  }

  /**
   * Подготавливает данные для шаблона уведомления о новом сообщении
   * @param {Object} message - объект сообщения
   * @param {Object} sender - объект отправителя
   * @param {Object} recipient - объект получателя
   * @returns {Object} данные для шаблона
   */
  prepareMessageNotificationData(message, sender, recipient) {
    const data = {
      senderName: sender.username || 'Unknown User',
      senderAvatar: sender.avatar || 'https://krealgram.com/default-avatar.png',
      messageText: message.text || '',
      hasMedia: !!(message.media && message.media.url),
      sharedPost: null,
      appUrl: process.env.FRONTEND_URL || 'https://krealgram.com',
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Обрабатываем пересланный пост
    if (message.sharedPost) {
      try {
        const post = typeof message.sharedPost === 'string' 
          ? JSON.parse(message.sharedPost) 
          : message.sharedPost;

        data.sharedPost = true; // Флаг для показа блока
        data.sharedPostImage = post.image || post.imageUrl || post.thumbnailUrl;
        data.sharedPostCaption = post.caption || '';
        data.sharedPostAuthor = post.author || 'Unknown';
      } catch (error) {
        console.error('Error parsing shared post:', error);
      }
    }

    return data;
  }

  /**
   * Создает превью текста сообщения (обрезает длинный текст)
   * @param {string} text - исходный текст
   * @param {number} maxLength - максимальная длина
   * @returns {string} обрезанный текст
   */
  truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Получает URL изображения для email (проксирует через наш сервер)
   * @param {string} originalUrl - оригинальный URL
   * @returns {string} проксированный URL
   */
  getProxiedImageUrl(originalUrl) {
    if (!originalUrl) return '';
    
    // Если это уже наш прокси URL, возвращаем как есть
    if (originalUrl.includes('/api/proxy-drive/')) {
      return originalUrl;
    }

    // Если это Google Drive URL, проксируем через наш сервер
    if (originalUrl.includes('drive.google.com')) {
      const fileId = this.extractGoogleDriveId(originalUrl);
      if (fileId) {
        return `${process.env.BACKEND_URL || 'https://krealgram-backend.onrender.com'}/api/proxy-drive/${fileId}?type=image`;
      }
    }

    return originalUrl;
  }

  /**
   * Извлекает ID файла из Google Drive URL
   * @param {string} url - Google Drive URL
   * @returns {string|null} ID файла
   */
  extractGoogleDriveId(url) {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /\/uc\?id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

module.exports = new EmailTemplateManager(); 