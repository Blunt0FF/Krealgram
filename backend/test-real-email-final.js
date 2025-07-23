require('dotenv').config();
const { sendNewMessageNotification } = require('./utils/emailService');

async function testRealEmailFinal() {
  console.log('🧪 Testing Final Email with Proxied Images...\n');

  // Замените на реальный email для тестирования
  const testEmail = 'your-test-email@gmail.com'; // ← ЗАМЕНИТЕ НА ВАШ EMAIL

  // Тест 1: Сообщение с пересланным видео постом
  const videoMessage = {
    text: "Привет! Посмотри на это крутое видео!",
    sharedPost: {
      image: null,
      gif: "https://drive.google.com/uc?id=1MSb8H6KkGrqernaQwnwJhiRi7HpY320U",
      caption: "Крутое видео! 🎥 #fun #video",
      author: "john_doe"
    },
    media: null
  };

  // Тест 2: Сообщение с медиа изображением
  const mediaMessage = {
    text: "Вот фото!",
    sharedPost: null,
    mediaImage: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp",
    hasMedia: true
  };

  const testSender = {
    username: "test_user",
    avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
  };

  const testRecipient = {
    username: "recipient",
    email: testEmail,
    avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
  };

  console.log('🔧 Environment Check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Not set');
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL || '❌ Not set');
  console.log('BACKEND_URL:', process.env.BACKEND_URL || '❌ Not set');
  console.log('');

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ Email credentials not configured!');
    console.log('Please set EMAIL_USER and EMAIL_PASSWORD in your .env file');
    process.exit(1);
  }

  // Тест 1: Видео пост
  console.log('📧 Test 1: Video post with GIF preview');
  console.log(`Sending to: ${testEmail}`);
  console.log(`Message: ${videoMessage.text}`);
  console.log(`GIF: ${videoMessage.sharedPost.gif}`);
  console.log(`Caption: ${videoMessage.sharedPost.caption}`);

  try {
    await sendNewMessageNotification(
      testEmail,
      videoMessage,
      testSender,
      testRecipient
    );
    console.log('✅ Video email sent successfully!');
  } catch (error) {
    console.error('❌ Video email failed:', error.message);
  }

  // Ждем 2 секунды между отправками
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Тест 2: Медиа изображение
  console.log('\n📧 Test 2: Message with media image');
  console.log(`Sending to: ${testEmail}`);
  console.log(`Message: ${mediaMessage.text}`);
  console.log(`Media: ${mediaMessage.mediaImage}`);

  try {
    await sendNewMessageNotification(
      testEmail,
      mediaMessage,
      testSender,
      testRecipient
    );
    console.log('✅ Media email sent successfully!');
  } catch (error) {
    console.error('❌ Media email failed:', error.message);
  }

  console.log('\n📬 Check your email inbox (and spam folder)');
  console.log('🎯 You should now see:');
  console.log('   - GIF preview for video posts');
  console.log('   - Real images for media attachments');
  console.log('   - Proper Russian font rendering');
  console.log('   - No template code artifacts');
}

testRealEmailFinal(); 