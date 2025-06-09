# Cloudinary Setup Instructions

## 1. Create Cloudinary Account
1. Go to https://cloudinary.com/
2. Sign up for a free account
3. Go to your Dashboard to get credentials

## 2. Update .env File
Replace placeholder values in `backend-2/.env`:

```env
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret
```

## 3. Install Required Dependencies
```bash
cd backend-2
npm install cloudinary multer-storage-cloudinary
```

## 4. Migrate Existing Images
Run the migration script to move local images to Cloudinary:

```bash
cd backend-2
node migrate-to-cloudinary.js
```

## 5. Restart Backend
```bash
cd backend-2
npm start
```

## Features Enabled
- ✅ All new uploads go directly to Cloudinary
- ✅ Automatic image optimization and resizing
- ✅ CDN delivery for faster loading
- ✅ Support for images and videos
- ✅ Organized folders: posts/, avatars/, messages/

## Cloudinary Transformations Applied
- **Posts**: Max 1080x1080px, auto quality
- **Avatars**: 400x400px, face-centered cropping
- **Messages**: Max 800x800px, auto quality

## Fallback
If Cloudinary fails, the system will still work with local storage. Set `USE_CLOUDINARY=false` to disable. 