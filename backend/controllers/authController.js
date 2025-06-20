const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // We use bcrypt as installed
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all required fields: username, email, and password.' });
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    
    // Manual, case-insensitive check for duplicates before attempting to save.
    // This is a robust safeguard against race conditions and configuration issues.
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") } }
      ]
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(409).json({ message: `User with email ${email} already exists.` });
      }
      // If found by case-insensitive username, it's a duplicate.
        return res.status(409).json({ message: `User with username ${username} already exists.` });
      }

    // The model's pre-save hook will handle password hashing.
    const user = new User({
      username: trimmedUsername, // Save with original case
      email: normalizedEmail,
      password: password, // Pass plain password
      avatar: avatar || ''
    });

    await user.save();

    // Generate JWT token
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
    console.error('Registration error:', error);
    // The pre-check should prevent most duplicate errors, but this is a fallback.
    if (error.code === 11000) {
        return res.status(409).json({ message: 'User with this email or username already exists.'});
    }
    res.status(500).json({ message: 'A server error occurred during registration.', error: error.message });
  }
};

// User logout
exports.logout = async (req, res) => {
  try {
    const user = req.user;
    
    // Устанавливаем пользователя как offline
    user.isOnline = false;
    user.lastActive = new Date();
    await user.save();

    res.status(200).json({
      message: 'Logout successful',
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'A server error occurred during logout.', error: error.message });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please enter your username/email and password.' });
    }

    const trimmedIdentifier = identifier.trim();

    // Find user by either email or a case-insensitive username match.
    // This works for all users, new and old.
    const user = await User.findOne({
      $or: [
        { email: trimmedIdentifier.toLowerCase() }, 
        { username: { $regex: new RegExp(`^${trimmedIdentifier}$`, "i") } }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'User not found or invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password or invalid credentials.' });
    }

    // Update only lastActive on login
    // isOnline will be set when WebSocket connects
    user.lastActive = new Date();
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