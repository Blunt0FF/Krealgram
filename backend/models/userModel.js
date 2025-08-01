const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot be more than 30 characters long'],
    match: [/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, hyphens and periods']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Do not return password by default
  },
  avatar: {
    type: String,
    default: '/default-avatar.png',
    validate: {
      validator: function(v) {
        // Добавляем проверку на null или undefined
        if (v === null || v === undefined) return true; 
        return v === '' || v === '/default-avatar.png' || v.startsWith('http');
      },
      message: 'Avatar must be a valid URL or empty string'
    }
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [150, 'Bio cannot be more than 150 characters long'],
    default: ''
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  savedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Индексы (username и email уже индексированы из-за unique: true)
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ likes: 1 }); // Добавляем индекс для быстрого поиска по лайкам
// Можно добавить текстовый индекс для поиска по username и bio, если потребуется
// userSchema.index({ username: 'text', bio: 'text' });

// Virtuals for follower and following counts
userSchema.virtual('followerCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// Pre-save hook to hash password if it's modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Виртуальные поля для подсчета
userSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

userSchema.virtual('postsCount').get(function() {
  return this.posts ? this.posts.length : 0;
});

module.exports = mongoose.model('User', userSchema); 