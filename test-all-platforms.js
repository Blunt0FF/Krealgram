const axios = require('axios');

const BACKEND_URL = 'https://krealgram-backend.onrender.com';

const testUrls = {
  tiktok: 'https://www.tiktok.com/@_zip.zipulia/video/7516089028127591686?lang=en',
  instagram: 'https://www.instagram.com/p/DLHXi9wsl1w/',
  vk: 'https://vkvideo.ru/video25655981_456239169',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
};

async function testPlatform(platform, url) {
  console.log(`\n🧪 Testing ${platform.toUpperCase()}: ${url}`);
  
  try {
    const endpoint = platform === 'youtube' ? 
      `${BACKEND_URL}/api/posts/external-video` : 
      `${BACKEND_URL}/api/posts/external-video/download`;
    
    const response = await axios.post(endpoint, { url }, {
      timeout: 30000
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
  console.log('🚀 Starting platform tests...');
  
  const results = {};
  
  for (const [platform, url] of Object.entries(testUrls)) {
    results[platform] = await testPlatform(platform, url);
    
    // Пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  
  for (const [platform, success] of Object.entries(results)) {
    console.log(`${platform.toUpperCase()}: ${success ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Summary: ${passedCount}/${totalCount} platforms working`);
}

runTests().catch(console.error); 