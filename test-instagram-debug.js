const axios = require('axios');

const BACKEND_URL = 'https://krealgram-backend.onrender.com';

async function testInstagram() {
  try {
    // Получаем токен
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      identifier: 'test@example.com',
      password: 'testpassword123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Got auth token');
    
    // Тестируем Instagram
    console.log('🧪 Testing Instagram extraction...');
    
    const response = await axios.post(`${BACKEND_URL}/api/posts/external-video/download`, {
      url: 'https://www.instagram.com/p/DLHXi9wsl1w/'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 120000 // 2 минуты
    });
    
    console.log('✅ Instagram SUCCESS:', response.data);
    
  } catch (error) {
    console.log('❌ Instagram FAILED:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message);
    console.log('Error:', error.response?.data?.error);
    console.log('Full response:', JSON.stringify(error.response?.data, null, 2));
  }
}

testInstagram(); 