const fetch = require('node-fetch');

// Тест реальной загрузки TikTok видео
async function testRealVideoDownload() {
  console.log('🎬 Testing REAL TikTok video download...');
  
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
    
    if (response.status === 401) {
      console.log('⚠️ Expected auth error - endpoint is working!');
    } else if (response.ok && data.success && !data.isExternalLink) {
      console.log('✅ SUCCESS! Video was really downloaded and uploaded to Cloudinary!');
      console.log('🎥 Video URL:', data.videoUrl);
      console.log('🖼️ Thumbnail URL:', data.thumbnailUrl);
    } else if (data.isExternalLink) {
      console.log('❌ FAIL! Still creating external links instead of downloading');
    } else {
      console.log('❓ Unexpected response:', data);
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

testRealVideoDownload(); 