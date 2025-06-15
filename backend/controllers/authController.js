const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;
    
    console.log('Registration attempt:', { username, email }); // Логируем попытку регистрации

    if (!process.env.JWT_SECRET) {
      console.error('FATAL ERROR: JWT_SECRET is not defined.');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    // Check for required fields
    if (!username || !email || !password) {
      console.log('Missing required fields:', { username: !!username, email: !!email, password: !!password });
      return res.status(400).json({ message: 'Please fill in all required fields: username, email, and password.' });
    }

    // Экранируем специальные символы для регулярного выражения
    const escapedUsername = username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    console.log('Escaped username:', escapedUsername);

    // Check for existing user by email or username (case-insensitive)
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } }
      ]
    });

    if (existingUser) {
      console.log('User already exists:', { 
        existingEmail: existingUser.email, 
        existingUsername: existingUser.username 
      });
      if (existingUser.email === email.toLowerCase()) {
        return res.status(409).json({ message: `User with email ${email} already exists.` });
      }
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ message: `User with username ${username} already exists.` });
      }
    }

    // Хешируем пароль здесь
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword, // Сохраняем хешированный пароль
      avatar: avatar || ''
    });

    console.log('Attempting to save user...');
    await user.save();
    console.log('User saved successfully:', user._id);

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
    console.error('Registration error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        message: `User with this ${field} already exists.`,
        field: field
      });
    }

    res.status(500).json({ 
      message: 'A server error occurred during registration.',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    console.log('Login attempt:', { identifier }); // Логируем попытку входа

    if (!identifier || !password) {
      console.log('Missing credentials:', { identifier: !!identifier, password: !!password });
      return res.status(400).json({ message: 'Please enter your username/email and password.' });
    }

    // Экранируем специальные символы для регулярного выражения
    const escapedIdentifier = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    console.log('Escaped identifier:', escapedIdentifier);

    // Case-insensitive search for both email and username
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
        { username: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
      ]
    }).select('+password');

    if (!user) {
      console.log('User not found:', identifier);
      return res.status(401).json({ message: 'User not found or invalid credentials.' });
    }

    console.log('User found, comparing password...');
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log('Password mismatch for user:', user.username);
      return res.status(401).json({ message: 'Invalid password or invalid credentials.' });
    }

    console.log('Password match, generating token...');
    user.lastActive = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false }); // Skip validation on login

    if (!process.env.JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined.');
        return res.status(500).json({ message: 'Server configuration error.' });
    }

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
    console.error('Login error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'A server error occurred during login.',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

    const user = await User.findOne({ email: email.toLowerCase() });
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