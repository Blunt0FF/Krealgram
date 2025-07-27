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
    
    console.log('📧 Rendering template with data:', JSON.stringify(data, null, 2));
    
    // Сначала обрабатываем условные блоки
    template = this.processConditionalBlocks(template, data);
    
    // Затем подставляем переменные
    template = this.processVariables(template, data);
    
    console.log('📧 Final rendered template length:', template.length);
    
    return template;
  }

  /**
   * Обрабатывает условные блоки в шаблоне
   * @param {string} template - исходный шаблон
   * @param {Object} data - данные
   * @returns {string} обработанный шаблон
   */
  processConditionalBlocks(template, data) {
    // Обрабатываем вложенные условные блоки
    let processed = template;
    let maxIterations = 10; // Защита от бесконечного цикла
    
    while (maxIterations > 0 && (processed.includes('{{#if') || processed.includes('{{#unless'))) {
      // Обрабатываем {{#if nested.field}}...{{/if}} (сначала вложенные)
      processed = processed.replace(/\{\{#if\s+(\w+)\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, object, field, content) => {
        const value = (data[object] && data[object][field]) ? data[object][field] : null;
        console.log(`📧 Condition "if ${object}.${field}":`, value);
        return value ? content : '';
      });
      
      // Обрабатываем {{#unless nested.field}}...{{/unless}} (сначала вложенные)
      processed = processed.replace(/\{\{#unless\s+(\w+)\.(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, object, field, content) => {
        const value = (data[object] && data[object][field]) ? data[object][field] : null;
        console.log(`📧 Condition "unless ${object}.${field}":`, value);
        return !value ? content : '';
      });
      
      // Обрабатываем {{#if condition}}...{{/if}} (простые)
      processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
        const value = data[condition];
        console.log(`📧 Condition "if ${condition}":`, value);
        return value ? content : '';
      });
      
      // Обрабатываем {{#unless condition}}...{{/unless}} (простые)
      processed = processed.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
        const value = data[condition];
        console.log(`📧 Condition "unless ${condition}":`, value);
        return !value ? content : '';
      });
      
      maxIterations--;
    }
    
    return processed;
  }

  /**
   * Обрабатывает переменные в шаблоне
   * @param {string} template - исходный шаблон
   * @param {Object} data - данные
   * @returns {string} обработанный шаблон
   */
  processVariables(template, data) {
    // Подставляем простые переменные {{variable}}
    let processed = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      console.log(`📧 Variable "${key}":`, value);
      return value || '';
    });
    
    // Обрабатываем вложенные переменные для sharedPost
    processed = processed.replace(/\{\{sharedPost\.(\w+)\}\}/g, (match, field) => {
      const value = (data.sharedPost && data.sharedPost[field]) ? data.sharedPost[field] : '';
      console.log(`📧 Nested variable "sharedPost.${field}":`, value);
      return value;
    });
    
    return processed;
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
      mediaImage: null,
      appUrl: process.env.FRONTEND_URL || 'https://krealgram.com',
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Обрабатываем медиа вложения
    if (message.media && message.media.url) {
      if (message.media.type === 'image') {
        data.mediaImage = this.getProxiedImageUrl(message.media.url);
      }
      data.hasMedia = true;
    }

    // Обрабатываем mediaImage если передан отдельно
    if (message.mediaImage) {
      data.mediaImage = this.getProxiedImageUrl(message.mediaImage);
      data.hasMedia = true;
    }

    // Обрабатываем пересланный пост
    if (message.sharedPost) {
      try {
        const post = typeof message.sharedPost === 'string' 
          ? JSON.parse(message.sharedPost) 
          : message.sharedPost;

        data.sharedPost = {
          image: this.getProxiedImageUrl(post.image || post.imageUrl || post.thumbnailUrl),
          gif: this.getProxiedImageUrl(post.gif || post.gifUrl || post.gifPreview),
          caption: post.caption || '',
          author: post.author || 'Unknown'
        };
        
        console.log('📧 Template shared post data:', {
          image: data.sharedPost.image,
          gif: data.sharedPost.gif,
          caption: data.sharedPost.caption,
          author: data.sharedPost.author
        });
      } catch (error) {
        console.error('Error parsing shared post:', error);
      }
    }

    console.log('📧 Final template data:', {
      hasText: !!data.messageText,
      hasMedia: data.hasMedia,
      mediaImage: data.mediaImage,
      hasSharedPost: !!data.sharedPost,
      sharedPostImage: data.sharedPost?.image,
      sharedPostGif: data.sharedPost?.gif
    });

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
        const backendUrl = 'https://krealgram-backend.onrender.com';
        console.log(`📧 Proxying image: ${originalUrl} -> ${backendUrl}/api/proxy-drive/${fileId}?type=image`);
        return `${backendUrl}/api/proxy-drive/${fileId}?type=image`;
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