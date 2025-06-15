const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
// const { sendPasswordResetEmail } = require('../utils/emailService'); // Предполагаем, что сервис есть

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }
    
    const escapedUsername = username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() }, 
        { username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } }
      ] 
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ message: `User with username '${username}' already exists.` });
      }
      if (existingUser.email === email.toLowerCase()) {
        return res.status(409).json({ message: `User with email '${email}' already exists.` });
      }
    }

    const user = new User({
      username,
      email,
      password, // Передаем пароль как есть. Модель сама его захеширует.
      avatar: avatar || ''
    });

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar },
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
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

    const escapedIdentifier = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
        { username: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
      ]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    user.lastActive = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({ token, user: userResponse, message: 'Login successful' });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'A server error occurred during login.', error: error.message });
  }
};

// Get info about the currently authenticated user
exports.getCurrentUser = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User is not authenticated or token is invalid.' });
  }
  res.status(200).json({ valid: true, user: req.user });
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();
    // await sendPasswordResetEmail(email, resetToken);
    res.status(200).json({ message: 'Password reset email sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending email.', error: error.message });
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
      return res.status(400).json({ message: 'Token is invalid or has expired.' });
    }
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(200).json({ message: 'Password has been reset.' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password.', error: error.message });
  }
}; 