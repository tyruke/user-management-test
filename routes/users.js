const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

const resetCodes = new Map();

// User registration
router.post('/register', [
  body('username').notEmpty().trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  // Validation check
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const [existingUsers] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Insert user into database
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// User login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  // Validation check
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await comparePassword(password, users[0].password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign({ userId: users[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ token, userId: users[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Get user account information
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email FROM users WHERE id = ?', [req.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching user data' });
  }
});


// Change password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get the user from the database
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if the current password is correct
    const validPassword = await comparePassword(currentPassword, users[0].password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password in the database
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.userId]);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Error changing password' });
  }
});



// Request password reset
router.post('/reset-password-request', [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(err => err.msg).join(', ') });
  }

  try {
    const { email } = req.body;
    
    // Check if user exists
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate a random 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the reset code with the user's email (expires in 1 hour)
    resetCodes.set(email, {
      code: resetCode,
      expires: Date.now() + 3600000
    });
    
    // In a real application, you would send an email here
    console.log(`Reset code for ${email}: ${resetCode}`);
    
    res.json({ message: 'Password reset code sent to your email' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: 'Error requesting password reset' });
  }
});

// Reset password
router.post('/reset-password', [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('code').isString().withMessage('Invalid reset code'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(err => err.msg).join(', ') });
  }

  try {
    const { email, code, newPassword } = req.body;
    
    // Check if the reset code is valid and not expired
    const resetData = resetCodes.get(email);
    if (!resetData || resetData.code !== code || Date.now() > resetData.expires) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password in the database
    await pool.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    
    // Remove the used reset code
    resetCodes.delete(email);
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

module.exports = router;