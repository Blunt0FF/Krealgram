const emailTemplateManager = require('./utils/emailTemplateManager');
const path = require('path');

async function testEmailTemplate() {
  try {
    // Тестовые данные
    const testMessage = {
      text: "Привет! Как дела? Посмотри на этот крутой пост!",
      sharedPost: {
        image: "https://drive.google.com/uc?id=1MSb8H6KkGrqernaQwnwJhiRi7HpY320U",
        caption: "Красивый закат сегодня! 🌅 #nature #sunset",
        author: "john_doe"
      },
      media: {
        url: "https://example.com/image.jpg"
      }
    };

    const testSender = {
      username: "alice_smith",
      avatar: "https://drive.google.com/uc?id=1bM4Sixjv5E-nzzNHFkH-xRGnX7JPvMPp"
    };

    const testRecipient = {
      username: "bob_jones",
      email: "bob@example.com"
    };

    // Подготавливаем данные для шаблона
    const templateData = emailTemplateManager.prepareMessageNotificationData(
      testMessage, 
      testSender, 
      testRecipient
    );

    console.log('Template data:', JSON.stringify(templateData, null, 2));

    // Рендерим шаблон
    const htmlContent = await emailTemplateManager.renderTemplate('new-message-notification', templateData);

    // Сохраняем результат в файл для просмотра
    const fs = require('fs').promises;
    const outputPath = path.join(__dirname, 'test-email-output.html');
    await fs.writeFile(outputPath, htmlContent);

    console.log(`✅ Email template rendered successfully!`);
    console.log(`📄 Output saved to: ${outputPath}`);
    console.log(`📧 Subject: New message from ${testSender.username} on Krealgram`);
    console.log(`👤 Sender: ${testSender.username}`);
    console.log(`📱 Message preview: ${testMessage.text.substring(0, 50)}...`);

  } catch (error) {
    console.error('❌ Error testing email template:', error);
  }
}

// Запускаем тест
testEmailTemplate(); 