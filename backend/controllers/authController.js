const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // We use bcrypt as installed
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    // Check for required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all required fields: username, email, and password.' });
    }

    // Check for existing user by email or username
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ message: `User with email ${email} already exists.` });
      }
      if (existingUser.username === username) {
        return res.status(409).json({ message: `User with username ${username} already exists.` });
      }
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10); // Generate salt
    const hashedPassword = await bcrypt.hash(password, salt); // Hash password

    // Create a new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: avatar || '' // Use an empty string if avatar is not provided (according to the model)
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username }, // Token payload
      process.env.JWT_SECRET, 
      { expiresIn: '7d' } // Token expiration
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) { // Handle duplicates at the DB level (just in case)
        return res.status(409).json({ message: 'User with this email or username already exists.'});
    }
    res.status(500).json({ message: 'A server error occurred during registration.', error: error.message });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please enter your username/email and password.' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: { $regex: new RegExp('^' + identifier + '$', 'i') } }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'User not found or invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password or invalid credentials.' });
    }

    // Update lastActive and isOnline
    user.lastActive = new Date();
    user.isOnline = true;
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      token,
      user: userResponse,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'A server error occurred during login.', error: error.message });
  }
};

// Get info about the currently authenticated user
exports.getCurrentUser = async (req, res) => {
  // Assumes req.user is set by authMiddleware
  if (!req.user) {
    return res.status(401).json({ message: 'User is not authenticated or token is invalid.' });
  }
  // User has already been fetched from DB in authMiddleware and does not contain the password
  res.status(200).json({ 
    valid: true,
    user: req.user 
  });
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email address.' });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Send email
    await sendPasswordResetEmail(email, resetToken);

    res.status(200).json({
      message: 'Password reset instructions have been sent to your email.'
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({
      message: 'Error sending password reset email.',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Password reset token is invalid or has expired.'
      });
    }

    // Set new password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      message: 'Error resetting password.',
      error: error.message
    });
  }
}; 