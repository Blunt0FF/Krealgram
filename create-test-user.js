const axios = require('axios');

const SERVER_URL = 'https://krealgram-backend.onrender.com';

async function createTestUser() {
  try {
    console.log('🔄 Creating test user...');
    
    const userData = {
      username: 'testuser2024',
      email: 'testuser2024@example.com',
      password: 'testpassword123',
      fullName: 'Test User'
    };
    
    const response = await axios.post(`${SERVER_URL}/api/auth/register`, userData);
    
    if (response.data && response.data.success) {
      console.log('✅ Test user created successfully:');
      console.log(`   - Username: ${userData.username}`);
      console.log(`   - Email: ${userData.email}`);
      console.log(`   - Password: ${userData.password}`);
      console.log(`   - Token: ${response.data.token}`);
      return true;
    } else {
      console.log('❌ Failed to create test user:', response.data?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('✅ Test user already exists, trying to login...');
      
      try {
        const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
          identifier: 'testuser2024',
          password: 'testpassword123'
        });
        
        if (loginResponse.data && loginResponse.data.token) {
          console.log('✅ Login successful with existing user');
          console.log(`   - Token: ${loginResponse.data.token}`);
          return true;
        }
      } catch (loginError) {
        console.log('❌ Login failed:', loginError.response?.data?.message || loginError.message);
      }
    }
    
    console.log('❌ Error creating test user:', error.response?.data?.message || error.message);
    return false;
  }
}

createTestUser().catch(console.error); 