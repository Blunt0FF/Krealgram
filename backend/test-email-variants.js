const emailTemplateManager = require('./utils/emailTemplateManager');
const fs = require('fs').promises;
const path = require('path');

async function testEmailVariants() {
  const variants = [
    {
      name: 'text-only',
      message: {
        text: "Привет! Как дела? Надеюсь, у тебя все хорошо! 😊"
      },
      sender: {
        username: "alice_smith",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "bob_jones",
        email: "bob@example.com"
      }
    },
    {
      name: 'shared-post',
      message: {
        text: "Посмотри на этот крутой пост!",
        sharedPost: {
          image: "https://drive.google.com/uc?id=1MSb8H6KkGrqernaQwnwJhiRi7HpY320U",
          caption: "Красивый закат сегодня! 🌅 #nature #sunset #photography",
          author: "john_doe"
        }
      },
      sender: {
        username: "maria_garcia",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "david_wilson",
        email: "david@example.com"
      }
    },
    {
      name: 'media-attachment',
      message: {
        text: "Отправляю тебе фото!",
        media: {
          url: "https://example.com/image.jpg"
        }
      },
      sender: {
        username: "sarah_johnson",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "mike_brown",
        email: "mike@example.com"
      }
    },
    {
      name: 'combined',
      message: {
        text: "Привет! Посмотри на этот пост и фото!",
        sharedPost: {
          image: "https://drive.google.com/uc?id=1MSb8H6KkGrqernaQwnwJhiRi7HpY320U",
          caption: "Мой новый пост! 🎉",
          author: "alex_turner"
        },
        media: {
          url: "https://example.com/video.mp4"
        }
      },
      sender: {
        username: "emma_davis",
        avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
      },
      recipient: {
        username: "chris_lee",
        email: "chris@example.com"
      }
    }
  ];

  for (const variant of variants) {
    try {
      console.log(`\n📧 Testing variant: ${variant.name}`);
      
      // Подготавливаем данные для шаблона
      const templateData = emailTemplateManager.prepareMessageNotificationData(
        variant.message, 
        variant.sender, 
        variant.recipient
      );

      // Рендерим шаблон
      const htmlContent = await emailTemplateManager.renderTemplate('new-message-notification', templateData);

      // Сохраняем результат
      const outputPath = path.join(__dirname, `test-email-${variant.name}.html`);
      await fs.writeFile(outputPath, htmlContent);

      console.log(`✅ Generated: test-email-${variant.name}.html`);
      console.log(`👤 Sender: ${variant.sender.username}`);
      console.log(`📱 Message: ${variant.message.text.substring(0, 30)}...`);
      
      if (variant.message.sharedPost) {
        console.log(`📎 Shared post: ${variant.message.sharedPost.caption.substring(0, 30)}...`);
      }
      
      if (variant.message.media) {
        console.log(`📎 Media attachment: Yes`);
      }

    } catch (error) {
      console.error(`❌ Error testing variant ${variant.name}:`, error);
    }
  }

  console.log(`\n🎉 All variants tested! Check the generated HTML files:`);
  variants.forEach(v => {
    console.log(`   - test-email-${v.name}.html`);
  });
}

// Запускаем тест
testEmailVariants(); 