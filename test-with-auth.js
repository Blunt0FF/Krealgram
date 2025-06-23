const axios = require('axios');

const BACKEND_URL = 'https://krealgram-backend.onrender.com';

// Тестовые данные пользователя
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123'
};

const testUrls = {
  tiktok: 'https://www.tiktok.com/@_zip.zipulia/video/7516089028127591686?lang=en',
  instagram: 'https://www.instagram.com/p/DLHXi9wsl1w/',
  vk: 'https://vkvideo.ru/video25655981_456239169',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
};

async function getAuthToken() {
  try {
    console.log('🔐 Attempting to login...');
    
    // Пытаемся войти
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      identifier: testUser.email,
      password: testUser.password
    });
    
    console.log('✅ Login successful');
    return loginResponse.data.token;
    
  } catch (loginError) {
    console.log('❌ Login failed, trying to register...');
    
    try {
      // Пытаемся зарегистрироваться
      const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, testUser);
      console.log('✅ Registration successful');
      return registerResponse.data.token;
      
    } catch (registerError) {
      console.log('❌ Registration failed:', registerError.response?.data?.message || registerError.message);
      
      // Если пользователь уже существует, попробуем войти еще раз
      if (registerError.response?.data?.message?.includes('already exists')) {
        try {
          console.log('🔄 User exists, trying login again...');
          const retryLoginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
            identifier: testUser.email,
            password: testUser.password
          });
          console.log('✅ Login successful on retry');
          return retryLoginResponse.data.token;
        } catch (retryError) {
          console.log('❌ Retry login failed:', retryError.response?.data?.message || retryError.message);
        }
      }
      
      throw new Error('Could not get auth token');
    }
  }
}

async function testPlatform(platform, url, token) {
  console.log(`\n🧪 Testing ${platform.toUpperCase()}: ${url}`);
  
  try {
    const endpoint = platform === 'youtube' ? 
      `${BACKEND_URL}/api/posts/external-video` : 
      `${BACKEND_URL}/api/posts/external-video/download`;
    
    const response = await axios.post(endpoint, { url }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 60000 // Увеличиваем таймаут для скачивания
    });
    
    console.log(`✅ ${platform.toUpperCase()} SUCCESS:`, {
      platform: response.data.platform,
      title: response.data.title?.substring(0, 50) + '...',
      videoUrl: response.data.videoUrl?.substring(0, 80) + '...',
      thumbnailUrl: response.data.thumbnailUrl?.substring(0, 80) + '...'
    });
    
    return true;
  } catch (error) {
    console.log(`❌ ${platform.toUpperCase()} FAILED:`, error.response?.data?.message || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting authenticated platform tests...');
  
  try {
    const token = await getAuthToken();
    console.log('🎫 Got auth token');
    
    const results = {};
    
    for (const [platform, url] of Object.entries(testUrls)) {
      results[platform] = await testPlatform(platform, url, token);
      
      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n📊 Test Results:');
    console.log('================');
    
    for (const [platform, success] of Object.entries(results)) {
      console.log(`${platform.toUpperCase()}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    }
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\n🎯 Summary: ${passedCount}/${totalCount} platforms working`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests().catch(console.error); 