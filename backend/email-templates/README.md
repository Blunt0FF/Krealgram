# 📧 Email Templates for Krealgram

This directory contains HTML email templates for Krealgram notifications.

## 📁 Files

- `new-message-notification.html` - Template for new message notifications
- `README.md` - This documentation file

## 🎨 Template Features

### New Message Notification Template

**Purpose**: Notifies users when they receive a new message

**Features**:
- ✅ Responsive design (mobile & desktop)
- ✅ Beautiful gradient header with Krealgram branding
- ✅ Sender information with avatar
- ✅ Message text preview
- ✅ Shared post preview with image and caption
- ✅ Media attachment indicator
- ✅ Call-to-action button to reply
- ✅ Professional footer with links
- ✅ Timestamp and unsubscribe options

## 🔧 Template Variables

The templates use Handlebars-like syntax with the following variables:

### Basic Variables
- `{{senderName}}` - Username of the message sender
- `{{senderAvatar}}` - Avatar URL of the sender
- `{{messageText}}` - Text content of the message
- `{{appUrl}}` - Frontend application URL
- `{{timestamp}}` - Formatted timestamp

### Conditional Variables
- `{{hasMedia}}` - Boolean indicating if message has media attachments
- `{{sharedPost}}` - Object containing shared post data

### Shared Post Object
- `{{sharedPost.image}}` - Image URL of shared post
- `{{sharedPost.caption}}` - Caption of shared post
- `{{sharedPost.author}}` - Author of shared post

## 🚀 Usage

### 1. Template Rendering

```javascript
const emailTemplateManager = require('./utils/emailTemplateManager');

// Prepare data
const templateData = emailTemplateManager.prepareMessageNotificationData(
  message, 
  sender, 
  recipient
);

// Render template
const htmlContent = await emailTemplateManager.renderTemplate(
  'new-message-notification', 
  templateData
);
```

### 2. Sending Email

```javascript
const { sendNewMessageNotification } = require('./utils/emailService');

await sendNewMessageNotification(
  recipientEmail,
  message,
  sender,
  recipient
);
```

## 🧪 Testing

### Test Template Rendering
```bash
cd backend
node test-email-template.js
```

### Preview Generated HTML
```bash
# Open in browser
open test-email-output.html
# or
open email-preview.html
```

## 📱 Responsive Design

The templates are designed to work well on:
- Desktop email clients (Gmail, Outlook, Apple Mail)
- Mobile email clients (iOS Mail, Gmail Mobile)
- Web-based email clients

## 🎨 Styling

- **Colors**: Uses Krealgram brand colors (#0095f6, #262626, etc.)
- **Fonts**: System fonts for optimal rendering
- **Layout**: Flexbox and CSS Grid for modern layouts
- **Images**: Responsive images with fallbacks

## 🔒 Security

- All external images are proxied through our server
- No external CSS or JavaScript dependencies
- Inline styles for maximum compatibility

## 📧 Email Client Compatibility

Tested and optimized for:
- Gmail (Web & Mobile)
- Outlook (Desktop & Web)
- Apple Mail (iOS & macOS)
- Yahoo Mail
- Thunderbird

## 🛠️ Development

### Adding New Templates

1. Create HTML file in `email-templates/` directory
2. Use Handlebars-like syntax for variables
3. Test with `test-email-template.js`
4. Add rendering function to `emailTemplateManager.js`
5. Add sending function to `emailService.js`

### Template Best Practices

- Use inline CSS for maximum compatibility
- Keep images under 200KB
- Test on multiple email clients
- Use web-safe fonts
- Include alt text for images
- Keep HTML structure simple

## 📞 Support

For questions or issues with email templates, contact the development team. 