const fetch = require('node-fetch');

// Тест новой функции downloadExternalVideo
async function testExternalVideo() {
  console.log('🎬 Testing external video API...');
  
  try {
    const response = await fetch('https://krealgram-backend.onrender.com/api/posts/external-video/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-test' // Fake token для теста
      },
      body: JSON.stringify({
        url: 'https://www.tiktok.com/@_zip.zipulia/video/7516089028127591686?lang=en'
      })
    });

    const data = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📄 Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Test passed! External video processing works.');
    } else {
      console.log('⚠️ Expected error (no valid auth token):', data.message);
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

testExternalVideo(); 