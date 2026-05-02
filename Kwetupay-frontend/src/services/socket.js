import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(userId) {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      query: { userId }
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join user's personal room
      this.socket.emit('user:join', userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error);
      this.isConnected = false;
      this.handleReconnection(userId);
    });

    return this.socket;
  }

  handleReconnection(userId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 10000);
      
      console.log(`🔄 Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect(userId);
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  joinConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('conversation:join', conversationId);
    }
  }

  leaveConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('conversation:leave', conversationId);
    }
  }

  onMessageReceived(callback) {
    if (this.socket) {
      this.socket.on('message:new', callback);
    }
  }

  onMessageSent(callback) {
    if (this.socket) {
      this.socket.on('message:sent', callback);
    }
  }

  onMessagesRead(callback) {
    if (this.socket) {
      this.socket.on('messages:read', callback);
    }
  }

  onUserStatusChange(callback) {
    if (this.socket) {
      this.socket.on('user:status', callback);
    }
  }

  onTypingStart(callback) {
    if (this.socket) {
      this.socket.on('typing:start', callback);
    }
  }

  onTypingStop(callback) {
    if (this.socket) {
      this.socket.on('typing:stop', callback);
    }
  }

  sendTypingStart(conversationId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:start', { conversationId, userId });
    }
  }

  sendTypingStop(conversationId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:stop', { conversationId, userId });
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export const connectSocket = (userId) => socketService.connect(userId);
export const disconnectSocket = () => socketService.disconnect();
export const getSocket = () => socketService.getSocket();
export const joinConversation = (conversationId) => socketService.joinConversation(conversationId);
export const leaveConversation = (conversationId) => socketService.leaveConversation(conversationId);
export const onMessageReceived = (callback) => socketService.onMessageReceived(callback);
export const onMessageSent = (callback) => socketService.onMessageSent(callback);
export const onMessagesRead = (callback) => socketService.onMessagesRead(callback);
export const onUserStatusChange = (callback) => socketService.onUserStatusChange(callback);
export const onTypingStart = (callback) => socketService.onTypingStart(callback);
export const onTypingStop = (callback) => socketService.onTypingStop(callback);
export const sendTypingStart = (conversationId, userId) => socketService.sendTypingStart(conversationId, userId);
export const sendTypingStop = (conversationId, userId) => socketService.sendTypingStop(conversationId, userId);
export const removeAllListeners = () => socketService.removeAllListeners();