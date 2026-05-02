const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const userController = {
  /**
   * Get current user profile
   */
  getProfile: async (req, res) => {
    try {
      const userId = req.user.user_id;

      const result = await query(
        `SELECT 
          u.user_id, u.email, u.first_name, u.last_name, 
          u.role, u.phone_number, u.profile_image_url, 
          u.is_verified, u.is_active, u.created_at, u.updated_at,
          up.date_of_birth, up.emergency_contact_name, 
          up.emergency_contact_phone, up.occupation, up.id_number,
          up.about_me, up.preferences
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch user profile'
      });
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.user_id;
      const {
        first_name,
        last_name,
        phone_number,
        date_of_birth,
        emergency_contact_name,
        emergency_contact_phone,
        occupation,
        id_number,
        about_me,
        preferences
      } = req.body;

      // Validate required fields
      if (!first_name || !last_name) {
        return res.status(400).json({
          status: 'error',
          message: 'First name and last name are required'
        });
      }

      // Start transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Update users table
        const userUpdate = await client.query(
          `UPDATE users 
           SET first_name = $1, last_name = $2, phone_number = $3, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4
           RETURNING user_id, email, first_name, last_name, role, phone_number, profile_image_url`,
          [first_name, last_name, phone_number, userId]
        );

        // Update or insert user_profiles
        const profileExists = await client.query(
          'SELECT profile_id FROM user_profiles WHERE user_id = $1',
          [userId]
        );

        if (profileExists.rows.length > 0) {
          await client.query(
            `UPDATE user_profiles 
             SET date_of_birth = $1, emergency_contact_name = $2, 
                 emergency_contact_phone = $3, occupation = $4, 
                 id_number = $5, about_me = $6, preferences = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $8`,
            [
              date_of_birth,
              emergency_contact_name,
              emergency_contact_phone,
              occupation,
              id_number,
              about_me,
              preferences ? JSON.stringify(preferences) : null,
              userId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO user_profiles 
             (user_id, date_of_birth, emergency_contact_name, emergency_contact_phone, 
              occupation, id_number, about_me, preferences)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId,
              date_of_birth,
              emergency_contact_name,
              emergency_contact_phone,
              occupation,
              id_number,
              about_me,
              preferences ? JSON.stringify(preferences) : null
            ]
          );
        }

        await client.query('COMMIT');

        res.json({
          status: 'success',
          data: {
            user: userUpdate.rows[0]
          },
          message: 'Profile updated successfully'
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update profile'
      });
    }
  },

  /**
   * Get user by ID (Admin only)
   */
  getUserById: async (req, res) => {
    try {
      const { userId } = req.params;

      // Authorization check
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions to access user data'
        });
      }

      const result = await query(
        `SELECT 
          u.user_id, u.email, u.first_name, u.last_name, 
          u.role, u.phone_number, u.profile_image_url, 
          u.is_verified, u.is_active, u.created_at, u.updated_at,
          u.landlord_id,
          up.date_of_birth, up.emergency_contact_name, 
          up.emergency_contact_phone, up.occupation, up.id_number
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch user'
      });
    }
  },

  /**
   * Update user by ID (Admin only)
   */
  updateUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        first_name,
        last_name,
        phone_number,
        role,
        is_verified,
        is_active
      } = req.body;

      // Authorization check
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions to update user'
        });
      }

      // Prevent admins from modifying super_admin users
      if (req.user.role === 'admin') {
        const targetUser = await query(
          'SELECT role FROM users WHERE user_id = $1',
          [userId]
        );
        
        if (targetUser.rows[0]?.role === 'super_admin') {
          return res.status(403).json({
            status: 'error',
            message: 'Cannot modify super admin users'
          });
        }
      }

      const result = await query(
        `UPDATE users 
         SET first_name = $1, last_name = $2, phone_number = $3, 
             role = $4, is_verified = $5, is_active = $6, 
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $7
         RETURNING user_id, email, first_name, last_name, role, 
                   phone_number, is_verified, is_active, created_at, updated_at`,
        [first_name, last_name, phone_number, role, is_verified, is_active, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        data: {
          user: result.rows[0]
        },
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update user'
      });
    }
  },

  /**
   * Delete user (Admin only)
   */
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;

      // Authorization check
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions to delete user'
        });
      }

      // Prevent users from deleting themselves
      if (parseInt(userId) === req.user.user_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete your own account'
        });
      }

      // Prevent deletion of super_admin users
      if (req.user.role === 'admin') {
        const targetUser = await query(
          'SELECT role FROM users WHERE user_id = $1',
          [userId]
        );
        
        if (targetUser.rows[0]?.role === 'super_admin') {
          return res.status(403).json({
            status: 'error',
            message: 'Cannot delete super admin users'
          });
        }
      }

      // Check if user has associated data
      const hasProperties = await query(
        'SELECT COUNT(*) FROM properties WHERE landlord_id = $1',
        [userId]
      );

      const hasBookings = await query(
        'SELECT COUNT(*) FROM bookings WHERE tenant_id = $1',
        [userId]
      );

      if (parseInt(hasProperties.rows[0].count) > 0 || parseInt(hasBookings.rows[0].count) > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete user with associated properties or bookings. Deactivate instead.'
        });
      }

      const result = await query(
        'DELETE FROM users WHERE user_id = $1 RETURNING user_id, email',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        message: 'User deleted successfully',
        data: {
          deleted_user: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete user'
      });
    }
  },

  /**
   * Get all users (Admin only)
   */
  getAllUsers: async (req, res) => {
    try {
      // Authorization check
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions to access users list'
        });
      }

      const { page = 1, limit = 10, role, search, is_active } = req.query;
      const offset = (page - 1) * limit;

      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 1;

      if (role) {
        whereConditions.push(`u.role = $${paramCount}`);
        queryParams.push(role);
        paramCount++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`u.is_active = $${paramCount}`);
        queryParams.push(is_active === 'true');
        paramCount++;
      }

      if (search) {
        whereConditions.push(`(
          u.first_name ILIKE $${paramCount} OR 
          u.last_name ILIKE $${paramCount} OR 
          u.email ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
        paramCount++;
      }

      queryParams.push(limit, offset);

      const result = await query(
        `SELECT 
          u.user_id, u.email, u.first_name, u.last_name, 
          u.role, u.phone_number, u.profile_image_url, 
          u.is_verified, u.is_active, u.created_at, u.updated_at,
          u.landlord_id,
          COUNT(*) OVER() as total_count
         FROM users u
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY u.created_at DESC
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        queryParams
      );

      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      res.json({
        status: 'success',
        data: {
          users: result.rows.map(row => {
            const { total_count, ...user } = row;
            return user;
          }),
          pagination: {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_items: total,
            items_per_page: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch users'
      });
    }
  }
};

module.exports = userController;