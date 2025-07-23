const { sendNewMessageNotification } = require('./utils/emailService');

async function testEmailIntegration() {
  console.log('🧪 Testing Email Integration...\n');

  // Тестовые данные
  const testCases = [
    {
      name: 'Simple Text Message',
      message: {
        text: "Привет! Как дела? 😊"
      },
      sender: {
        username: "alice_smith",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "bob_jones",
        email: "test@example.com", // Замените на реальный email для тестирования
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      }
    },
    {
      name: 'Message with Shared Post',
      message: {
        text: "Посмотри на этот крутой пост!",
        sharedPost: {
          image: "https://drive.google.com/uc?id=1MSb8H6KkGrqernaQwnwJhiRi7HpY320U",
          caption: "Красивый закат сегодня! 🌅 #nature #sunset",
          author: "john_doe"
        }
      },
      sender: {
        username: "maria_garcia",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "david_wilson",
        email: "test@example.com", // Замените на реальный email для тестирования
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      }
    },
    {
      name: 'Message with Media',
      message: {
        text: "Отправляю тебе фото!",
        media: {
          type: "image",
          url: "https://example.com/image.jpg"
        }
      },
      sender: {
        username: "sarah_johnson",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "mike_brown",
        email: "test@example.com", // Замените на реальный email для тестирования
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📧 Testing: ${testCase.name}`);
    console.log(`👤 Sender: ${testCase.sender.username}`);
    console.log(`📱 Message: ${testCase.message.text.substring(0, 30)}...`);
    
    if (testCase.message.sharedPost) {
      console.log(`📎 Shared post: ${testCase.message.sharedPost.caption.substring(0, 30)}...`);
    }
    
    if (testCase.message.media) {
      console.log(`📎 Media: ${testCase.message.media.type}`);
    }

    try {
      await sendNewMessageNotification(
        testCase.recipient.email,
        testCase.message,
        testCase.sender,
        testCase.recipient
      );
      
      console.log(`✅ Email sent successfully to ${testCase.recipient.email}\n`);
    } catch (error) {
      console.error(`❌ Failed to send email:`, error.message);
      console.log(`💡 Note: Make sure EMAIL_USER and EMAIL_PASSWORD are set in environment variables\n`);
    }
  }

  console.log('🎉 Email integration test completed!');
  console.log('\n📝 To test with real emails:');
  console.log('1. Set EMAIL_USER and EMAIL_PASSWORD in your .env file');
  console.log('2. Replace "test@example.com" with a real email address');
  console.log('3. Run this test again');
}

// Запускаем тест
testEmailIntegration(); 