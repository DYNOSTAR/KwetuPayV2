const express = require('express');
const { query, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { emitToUser, getOnlineUsers } = require('../services/socketService');

const router = express.Router();

// Get user's conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        DISTINCT ON (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
        u.first_name, u.last_name, u.role, u.profile_image_url,
        m.message_text as last_message_content,
        m.created_at as last_message_at,
        m.is_read,
        COUNT(CASE WHEN m.receiver_id = $1 AND m.is_read = false THEN 1 END) as unread_count,
        p.property_id, p.title as property_title
       FROM messages m
       JOIN users u ON (u.user_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
       LEFT JOIN properties p ON (m.property_id = p.property_id)
       WHERE (m.sender_id = $1 OR m.receiver_id = $1)
       GROUP BY 
         other_user_id, u.first_name, u.last_name, u.role, u.profile_image_url,
         m.message_text, m.created_at, m.is_read, p.property_id, p.title
       ORDER BY other_user_id, m.created_at DESC`,
      [req.user.user_id]
    );

    const conversations = result.rows.map(conv => ({
      other_user_id: conv.other_user_id,
      first_name: conv.first_name,
      last_name: conv.last_name,
      role: conv.role,
      profile_image_url: conv.profile_image_url,
      last_message_content: conv.last_message_content,
      last_message_at: conv.last_message_at,
      unread_count: parseInt(conv.unread_count) || 0,
      property_title: conv.property_title,
      is_online: getOnlineUsers().has(conv.other_user_id.toString())
    }));

    res.json({
      status: 'success',
      data: {
        conversations,
        count: conversations.length
      }
    });

  } catch (error) {
    console.error('Conversations fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error fetching conversations'
    });
  }
});

// Send message - FIXED VERSION
router.post('/', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    const { recipient_id, property_id, content } = req.body;

    if (!recipient_id || !content) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Recipient ID and content are required'
      });
    }

    // Verify recipient exists
    const recipientCheck = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [recipient_id]
    );

    if (recipientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Recipient not found'
      });
    }

    // Insert message - USING CORRECT COLUMN NAMES
    const messageResult = await client.query(
      `INSERT INTO messages (sender_id, receiver_id, property_id, message_text, message_type, is_read)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.user_id, recipient_id, property_id, content, 'general', false]
    );

    await client.query('COMMIT');

    const message = messageResult.rows[0];

    // Emit real-time message to recipient
    emitToUser(recipient_id, 'message:new', {
      message: {
        ...message,
        sender_name: req.user.first_name + ' ' + req.user.last_name,
        sender_role: req.user.role,
        content: message.message_text
      }
    });

    res.json({
      status: 'success',
      message: 'Message sent successfully',
      data: {
        message: {
          ...message,
          content: message.message_text
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Message send error:', error);
    
    if (error.code === '23502') { // Not-null constraint violation
      return res.status(500).json({
        status: 'error',
        message: 'Database schema issue: required columns missing. Please run database migration.'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Internal server error sending message'
    });
  } finally {
    client.release();
  }
});

// Get full message history with a specific user
router.get('/with/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT
        m.message_id,
        m.sender_id,
        m.receiver_id as recipient_id,
        m.message_text as content,
        m.is_read,
        m.created_at,
        u.first_name as sender_name,
        u.role as sender_role
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [req.user.user_id, parseInt(userId)]
    );
    res.json({ status: 'success', data: { messages: result.rows } });
  } catch (error) {
    console.error('Messages fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch messages' });
  }
});

// Mark messages from a sender as read
router.put('/read', authenticateToken, async (req, res) => {
  try {
    const { sender_id } = req.body;
    await query(
      `UPDATE messages SET is_read = true
       WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false`,
      [req.user.user_id, sender_id]
    );
    res.json({ status: 'success', message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to mark messages as read' });
  }
});

// Get unread message count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) as unread FROM messages
       WHERE receiver_id = $1 AND is_read = false`,
      [req.user.user_id]
    );
    res.json({ status: 'success', data: { unread: parseInt(result.rows[0].unread) || 0 } });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get unread count' });
  }
});

// Get online status of a user
router.get('/online-status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOnline = getOnlineUsers().has(userId.toString());
    res.json({ status: 'success', data: { user_id: parseInt(userId), is_online: isOnline } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to get online status' });
  }
});

module.exports = router;