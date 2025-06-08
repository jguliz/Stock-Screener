// backend/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database').pool;

/**
 * Register a new user
 */
exports.register = async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Check database connection
    if (!pool) {
      return res.status(503).json({ 
        message: 'Database connection not established',
        error: 'Try again later'
      });
    }
    
    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name || email.split('@')[0]]
    );
    
    // Log the registration
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, details)
       VALUES (?, 'user_registered', 'user', ?, ?, ?)`,
      [
        result.insertId,
        result.insertId,
        req.ip || 'unknown',
        JSON.stringify({ name, email })
      ]
    );
    
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Login an existing user
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Check database connection
    if (!pool) {
      return res.status(503).json({ 
        message: 'Database connection not established',
        error: 'Try again later'
      });
    }
    
    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const user = users[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      // Log the failed login attempt
      await pool.execute(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, details)
         VALUES (?, 'login_failed', 'user', ?, ?, ?)`,
        [
          user.id,
          user.id,
          req.ip || 'unknown',
          JSON.stringify({ reason: 'invalid_password' })
        ]
      );
      
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Log the successful login
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, 'login_success', 'user', ?, ?)`,
      [
        user.id,
        user.id,
        req.ip || 'unknown'
      ]
    );
    
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Validate a token (useful for frontend to check if token is still valid)
 */
exports.validateToken = async (req, res) => {
  try {
    res.status(200).json({ 
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};