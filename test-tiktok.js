const fetch = require('node-fetch');

async function testTikTokAPI() {
  const testUrl = 'https://www.tiktok.com/@charlidamelio/video/6929179927155977478';
  const testCaption = 'Test TikTok video';
  
  try {
    console.log('🎬 Testing TikTok external video API...');
    
    const response = await fetch('http://localhost:3000/api/posts/external-video/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TEST_TOKEN' // Замените на реальный токен
      },
      body: JSON.stringify({
        url: testUrl,
        caption: testCaption
      })
    });
    
    const data = await response.json();
    
    console.log('📋 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ TikTok video processed successfully!');
    } else {
      console.log('❌ Failed to process TikTok video:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Запускаем тест
testTikTokAPI(); 