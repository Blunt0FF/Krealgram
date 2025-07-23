# 📧 Email Notifications Setup for Krealgram

## 🎯 Overview

Krealgram now supports email notifications for new messages. When a user receives a message, they will get a beautifully formatted email with a preview of the message content.

## 🚀 Features

- ✅ **Text Messages** - Preview of message text
- ✅ **Shared Posts** - Preview of shared post with caption and author
- ✅ **Media Attachments** - Indicator for media files
- ✅ **Responsive Design** - Works on all email clients
- ✅ **Branded Templates** - Consistent with Krealgram design

## ⚙️ Configuration

### 1. Environment Variables

Add these variables to your `.env` file:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=https://krealgram.com
BACKEND_URL=https://krealgram-backend.onrender.com
```

### 2. Gmail App Password Setup

For Gmail, you need to create an App Password:

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification**
3. Scroll down to **App passwords**
4. Generate a new app password for "Mail"
5. Use this password in `EMAIL_PASSWORD`

### 3. Alternative Email Providers

You can use other providers by modifying the transporter in `emailService.js`:

```javascript
// For Outlook/Hotmail
const transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// For custom SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

## 🧪 Testing

### 1. Test Email Templates

```bash
cd backend
node test-email-template.js
```

### 2. Test Email Variants

```bash
node test-email-variants.js
```

### 3. Test Email Integration

```bash
node test-email-integration.js
```

### 4. Preview Generated HTML

Open the generated HTML files in your browser:
- `test-email-output.html`
- `test-email-text-only.html`
- `test-email-shared-post.html`
- `test-email-media-attachment.html`
- `test-email-combined.html`

## 📧 Email Template Structure

### Template Location
```
backend/
├── email-templates/
│   └── new-message-notification.html
├── utils/
│   ├── emailService.js
│   └── emailTemplateManager.js
└── test-email-*.js
```

### Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{senderName}}` | Username of message sender | "alice_smith" |
| `{{messageText}}` | Text content of message | "Hello! How are you?" |
| `{{sharedPostCaption}}` | Caption of shared post | "Beautiful sunset! 🌅" |
| `{{sharedPostAuthor}}` | Author of shared post | "john_doe" |
| `{{appUrl}}` | Frontend application URL | "https://krealgram.com" |

### Conditional Blocks

```html
{{#if messageText}}
  <!-- Show message text -->
{{/if}}

{{#if sharedPost}}
  <!-- Show shared post preview -->
{{/if}}

{{#if hasMedia}}
  <!-- Show media attachment indicator -->
{{/if}}
```

## 🔧 Integration

### Automatic Email Sending

Email notifications are automatically sent when:

1. A user sends a message via the API
2. The recipient has a valid email address
3. Email service is properly configured

### Code Integration

The email sending is integrated in `conversationController.js`:

```javascript
// Email notification is sent after successful message save
sendNewMessageNotification(recipient.email, messageData, senderData, recipient)
  .then(() => {
    console.log(`📧 Email notification sent to ${recipient.email}`);
  })
  .catch((error) => {
    console.error(`❌ Failed to send email notification:`, error);
  });
```

## 📱 Email Client Compatibility

Tested and optimized for:

- ✅ **Gmail** (Web & Mobile)
- ✅ **Outlook** (Desktop & Web)
- ✅ **Apple Mail** (iOS & macOS)
- ✅ **Yahoo Mail**
- ✅ **Thunderbird**

## 🎨 Customization

### Modifying Email Template

1. Edit `backend/email-templates/new-message-notification.html`
2. Test with `node test-email-template.js`
3. Preview the generated HTML

### Adding New Email Types

1. Create new template in `email-templates/`
2. Add rendering function to `emailTemplateManager.js`
3. Add sending function to `emailService.js`
4. Test thoroughly

### Styling Guidelines

- Use inline CSS for maximum compatibility
- Keep images under 200KB
- Use web-safe fonts (Arial, sans-serif)
- Test on multiple email clients
- Include alt text for images

## 🚨 Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Check EMAIL_USER and EMAIL_PASSWORD
   - Verify Gmail App Password is correct
   - Enable "Less secure app access" (not recommended)

2. **"Template not found"**
   - Verify template file exists
   - Check file permissions
   - Restart the server

3. **"Email not sending"**
   - Check console logs for errors
   - Verify recipient email is valid
   - Check email service configuration

### Debug Mode

Enable debug logging by adding to your code:

```javascript
console.log('Email data:', {
  recipient: recipient.email,
  sender: senderData.username,
  message: messageData
});
```

## 📞 Support

For issues with email notifications:

1. Check the console logs
2. Verify environment variables
3. Test with the provided test scripts
4. Check email client spam folder

## 🔒 Security

- Email credentials are stored in environment variables
- No sensitive data is logged
- Email sending is non-blocking (async)
- Failed emails don't break message sending

## 📈 Performance

- Email templates are cached for performance
- Email sending is asynchronous
- No impact on message sending speed
- Graceful error handling 