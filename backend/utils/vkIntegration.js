const axios = require('axios');

const VK_API_VERSION = '5.131';
const VK_API_BASE = 'https://api.vk.com/method';

class VKIntegration {
  constructor() {
    this.clientId = process.env.VK_CLIENT_ID;
    this.clientSecret = process.env.VK_CLIENT_SECRET;
    this.redirectUri = process.env.VK_REDIRECT_URI;
  }

  // Получить URL для авторизации VK
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      display: 'popup',
      redirect_uri: this.redirectUri,
      scope: 'photos',
      response_type: 'code',
      v: VK_API_VERSION
    });

    return `https://oauth.vk.com/authorize?${params.toString()}`;
  }

  // Обменять код на токен доступа
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post('https://oauth.vk.com/access_token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code
      });

      return response.data;
    } catch (error) {
      throw new Error('Failed to exchange code for token: ' + error.message);
    }
  }

  // Получить список альбомов пользователя
  async getUserAlbums(accessToken, userId = null) {
    try {
      const response = await axios.get(`${VK_API_BASE}/photos.getAlbums`, {
        params: {
          access_token: accessToken,
          owner_id: userId || null, // если null, то получит альбомы текущего пользователя
          need_system: 1,
          need_covers: 1,
          photo_sizes: 1,
          v: VK_API_VERSION
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error.error_msg);
      }

      return response.data.response;
    } catch (error) {
      throw new Error('Failed to get albums: ' + error.message);
    }
  }

  // Получить фотографии из альбома
  async getAlbumPhotos(accessToken, albumId, ownerId = null, offset = 0, count = 200) {
    try {
      const response = await axios.get(`${VK_API_BASE}/photos.get`, {
        params: {
          access_token: accessToken,
          owner_id: ownerId || null,
          album_id: albumId,
          photo_sizes: 1,
          offset: offset,
          count: count,
          v: VK_API_VERSION
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error.error_msg);
      }

      return response.data.response;
    } catch (error) {
      throw new Error('Failed to get album photos: ' + error.message);
    }
  }

  // Синхронизировать альбом с локальной базой данных
  async syncAlbum(accessToken, albumId, ownerId, User, Post) {
    try {
      const photos = await this.getAlbumPhotos(accessToken, albumId, ownerId);
      const syncedPosts = [];

      for (const photo of photos.items) {
        // Находим самое большое изображение
        const largestPhoto = photo.sizes.reduce((prev, current) => 
          (prev.width * prev.height) > (current.width * current.height) ? prev : current
        );

        // Создаем пост в нашей системе
        const postData = {
          image: largestPhoto.url,
          mediaType: 'image',
          caption: photo.text || '',
          author: ownerId, // ID пользователя в нашей системе
          vkPhotoId: photo.id,
          vkAlbumId: albumId,
          isFromVK: true
        };

        // Проверяем, не существует ли уже этот пост
        const existingPost = await Post.findOne({ vkPhotoId: photo.id });
        if (!existingPost) {
          const newPost = new Post(postData);
          await newPost.save();
          syncedPosts.push(newPost);
        }
      }

      return { syncedCount: syncedPosts.length, posts: syncedPosts };
    } catch (error) {
      throw new Error('Failed to sync album: ' + error.message);
    }
  }

  // Проверить валидность токена
  async validateToken(accessToken) {
    try {
      const response = await axios.get(`${VK_API_BASE}/users.get`, {
        params: {
          access_token: accessToken,
          v: VK_API_VERSION
        }
      });

      return !response.data.error;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new VKIntegration(); 