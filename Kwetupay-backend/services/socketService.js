// services/socketService.js
const socketIO = require('socket.io');

let io;
const onlineUsers = new Map(); // user_id -> socket_id

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3001",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // User joins their personal room
    socket.on('user:join', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        onlineUsers.set(userId.toString(), socket.id);
        console.log(`👤 User ${userId} joined room user_${userId}`);
        
        // Broadcast online status to relevant users
        broadcastUserStatus(userId, true);
      }
    });

    // Join conversation room (for real-time messaging between two users)
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`💬 User joined conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { conversationId, userId } = data;
      socket.to(`conversation_${conversationId}`).emit('typing:start', {
        userId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('typing:stop', (data) => {
      const { conversationId, userId } = data;
      socket.to(`conversation_${conversationId}`).emit('typing:stop', {
        userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
      
      // Remove from online users
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          broadcastUserStatus(userId, false);
          break;
        }
      }
    });
  });

  return io;
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// Emit to conversation
const emitToConversation = (conversationId, event, data) => {
  if (io && conversationId) {
    io.to(`conversation_${conversationId}`).emit(event, data);
  }
};

// Broadcast user online status
const broadcastUserStatus = (userId, isOnline) => {
  // In a real app, you'd emit to users who have conversations with this user
  // For now, we'll emit to all users in the same conversations
  emitToUser(userId, 'user:status', {
    user_id: userId,
    is_online: isOnline,
    timestamp: new Date().toISOString()
  });
};

// Get online users
const getOnlineUsers = () => {
  return new Set(onlineUsers.keys());
};

// Get user's socket ID
const getUserSocket = (userId) => {
  return onlineUsers.get(userId.toString());
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToConversation,
  getOnlineUsers,
  getUserSocket
};