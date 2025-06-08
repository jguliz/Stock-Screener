// backend/controllers/userController.js
const bcrypt = require('bcrypt');
const pool = require('../database').pool;

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    // Check database connection
    if (!pool) {
      return res.status(503).json({ 
        message: 'Database connection not established',
        error: 'Try again later'
      });
    }
    
    const userId = req.user.id;
    
    // Get user data
    const [users] = await pool.execute(
      'SELECT id, email, name, role, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user activity summary
    const [activitySummary] = await pool.execute(
      `SELECT COUNT(DISTINCT f.stock_id) AS favorite_count,
              COUNT(DISTINCT a.id) AS alert_count,
              MAX(al.created_at) AS last_activity
       FROM users u
       LEFT JOIN favorites f ON u.id = f.user_id
       LEFT JOIN alerts a ON u.id = a.user_id
       LEFT JOIN audit_log al ON u.id = al.user_id
       WHERE u.id = ?
       GROUP BY u.id`,
      [userId]
    );
    
    // Combine user data with activity summary
    const userData = {
      ...users[0],
      activity: activitySummary.length > 0 ? {
        favorite_count: activitySummary[0].favorite_count || 0,
        alert_count: activitySummary[0].alert_count || 0,
        last_activity: activitySummary[0].last_activity
      } : {
        favorite_count: 0,
        alert_count: 0,
        last_activity: null
      }
    };
    
    // Log the profile view
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
       VALUES (?, 'profile_viewed', 'user', ?)`,
      [userId, userId]
    );
    
    res.status(200).json({ user: userData });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  
  try {
    // Check database connection
    if (!pool) {
      return res.status(503).json({ 
        message: 'Database connection not established',
        error: 'Try again later'
      });
    }
    
    // Get user data
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    let updates = [];
    let params = [];
    let passwordChanged = false;
    
    // Update name if provided
    if (name && name !== user.name) {
      updates.push('name = ?');
      params.push(name);
    }
    
    // Update password if provided
    if (newPassword && currentPassword) {
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      
      if (!validPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      updates.push('password = ?');
      params.push(hashedPassword);
      passwordChanged = true;
    }
    
    // If nothing to update
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No changes provided' });
    }
    
    // Add user ID to params
    params.push(userId);
    
    // Update user
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    
    // Log the profile update
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'profile_updated', 'user', ?, ?)`,
      [
        userId, 
        userId,
        JSON.stringify({
          name_changed: name && name !== user.name,
          password_changed: passwordChanged
        })
      ]
    );
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      name_updated: name && name !== user.name,
      password_updated: passwordChanged
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get user activity history
 */
exports.getActivityHistory = async (req, res) => {
  try {
    // Check database connection
    if (!pool) {
      return res.status(503).json({ 
        message: 'Database connection not established',
        error: 'Try again later'
      });
    }
    
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get user activity log
    const [activities] = await pool.execute(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at,
              CASE 
                WHEN al.entity_type = 'stock' THEN s.symbol
                ELSE NULL
              END as stock_symbol,
              CASE 
                WHEN al.entity_type = 'stock' THEN s.name
                ELSE NULL
              END as stock_name
       FROM audit_log al
       LEFT JOIN stocks s ON al.entity_type = 'stock' AND al.entity_id = s.id
       WHERE al.user_id = ?
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    // Get total count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM audit_log WHERE user_id = ?',
      [userId]
    );
    
    const total = countResult[0].total;
    
    res.status(200).json({ 
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};