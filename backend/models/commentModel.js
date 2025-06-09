const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'Comment must belong to a post']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Comment must have an author']
  },
  text: {
    type: String,
    required: [true, 'Comment text cannot be empty'],
    trim: true,
    minlength: [1, 'Comment must be at least 1 character long'],
    maxlength: [500, 'Comment cannot be more than 500 characters long']
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { 
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
commentSchema.index({ post: 1 }); // For quickly getting comments for a post
commentSchema.index({ user: 1 }); // For quickly getting a user's comments
commentSchema.index({ createdAt: -1 });

// Index for querying comments for a specific post
commentSchema.index({ post: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema); 