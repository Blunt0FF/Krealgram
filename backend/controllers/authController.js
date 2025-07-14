const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // We use bcrypt as installed
const crypto = require('crypto');
const { sendPasswordResetEmail, sendEmailVerificationEmail } = require('../utils/emailService');

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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // The model's pre-save hook will handle password hashing.
    const user = new User({
      username: trimmedUsername, // Save with original case
      email: normalizedEmail,
      password: password, // Pass plain password
      avatar: avatar || '',
      emailVerificationToken: verificationToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      isEmailVerified: false
    });

    await user.save();

    // Send verification email
    await sendEmailVerificationEmail(normalizedEmail, verificationToken, trimmedUsername);

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      requiresVerification: true,
      email: normalizedEmail
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

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in. Check your email for the verification link.',
        requiresVerification: true,
        email: user.email
      });
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

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Email verification token is invalid or has expired.'
      });
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Generate JWT token for automatic login
    const authToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: 'Email verified successfully! Welcome to Krealgram.',
      token: authToken,
      user: userResponse
    });
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    res.status(500).json({
      message: 'Error verifying email.',
      error: error.message
    });
  }
};

// @desc    Resend email verification
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email address.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    await sendEmailVerificationEmail(user.email, verificationToken, user.username);

    res.status(200).json({
      message: 'Verification email has been sent to your email address.'
    });
  } catch (error) {
    console.error('Error in resendVerification:', error);
    res.status(500).json({
      message: 'Error sending verification email.',
      error: error.message
    });
  }
}; 