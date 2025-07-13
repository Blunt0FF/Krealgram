const axios = require('axios');

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Прокси для Google Drive
router.get('/api/proxy-drive/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log('[GOOGLE_DRIVE_PROXY] Получен запрос:', {
      fileId,
      headers: req.headers
    });

    if (!fileId) {
      return res.status(400).json({ error: 'Не указан ID файла' });
    }

    const googleDriveUrl = `https://drive.google.com/uc?id=${fileId}`;

    try {
      const response = await axios.get(googleDriveUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Определение MIME-типа
      const contentType = response.headers['content-type'] || 'application/octet-stream';

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=31536000'); // Кэширование на год
      res.send(response.data);

    } catch (proxyError) {
      console.error('[GOOGLE_DRIVE_PROXY_ERROR]', proxyError.message);
      res.status(500).json({ 
        error: 'Не удалось загрузить файл', 
        details: proxyError.message 
      });
    }
  } catch (error) {
    console.error('[GOOGLE_DRIVE_PROXY_UNEXPECTED_ERROR]', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}); 