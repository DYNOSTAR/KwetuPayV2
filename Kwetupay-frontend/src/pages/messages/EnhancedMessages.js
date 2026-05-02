import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertiesLayout from '../properties/PropertiesLayout';
import { messageAPI } from '../../services/api';
import { 
  connectSocket, 
  getSocket, 
  joinConversation, 
  leaveConversation,
  onMessageReceived,
  onMessageSent,
  onMessagesRead,
  onUserStatusChange,
  onTypingStart,
  onTypingStop,
  sendTypingStart,
  sendTypingStop,
  removeAllListeners
} from '../../services/socket';
import './EnhancedMessages.css';

const EnhancedMessages = () => {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Initialize user and socket
  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      
      // Connect to socket
      connectSocket(u.user_id);
      
      // Set up socket listeners
      setupSocketListeners();
      
      loadConversations();
    } else {
      navigate('/login');
    }

    return () => {
      // Cleanup
      removeAllListeners();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [navigate]);

  // Socket event listeners
  const setupSocketListeners = () => {
    // New message received
    onMessageReceived((data) => {
      const receivedMessage = data.message;
      
      // Add to messages if in the current conversation
      if (selectedConversation && 
          (receivedMessage.sender_id === selectedConversation.other_user_id || 
           receivedMessage.recipient_id === selectedConversation.other_user_id)) {
        setMessages(prev => [...prev, receivedMessage]);
        
        // Mark as read if we're in the conversation
        if (receivedMessage.sender_id === selectedConversation.other_user_id) {
          markMessagesAsRead(selectedConversation.other_user_id);
        }
      }

      // Update conversations list
      updateConversationPreview(receivedMessage);
    });

    // Message sent confirmation
    onMessageSent((data) => {
      const sentMessage = data.message;
      setMessages(prev => prev.map(msg => 
        msg.tempId === sentMessage.tempId ? { ...sentMessage, tempId: undefined } : msg
      ));
      setSending(false);
    });

    // Messages read receipt
    onMessagesRead((data) => {
      if (selectedConversation && data.reader_id === selectedConversation.other_user_id) {
        setMessages(prev => prev.map(msg => 
          msg.sender_id === user.user_id ? { ...msg, is_read: true, read_at: new Date().toISOString() } : msg
        ));
      }
    });

    // User status changes
    onUserStatusChange((data) => {
      setOnlineUsers(prev => {
        const newOnlineUsers = new Set(prev);
        if (data.is_online) {
          newOnlineUsers.add(data.user_id.toString());
        } else {
          newOnlineUsers.delete(data.user_id.toString());
        }
        return newOnlineUsers;
      });

      // Update conversation online status
      setConversations(prev => prev.map(conv => 
        conv.other_user_id.toString() === data.user_id.toString()
          ? { ...conv, is_online: data.is_online }
          : conv
      ));
    });

    // Typing indicators
    onTypingStart((data) => {
      if (selectedConversation && data.userId === selectedConversation.other_user_id) {
        setTypingUsers(prev => new Set(prev).add(data.userId));
      }
    });

    onTypingStop((data) => {
      if (selectedConversation && data.userId === selectedConversation.other_user_id) {
        setTypingUsers(prev => {
          const newTyping = new Set(prev);
          newTyping.delete(data.userId);
          return newTyping;
        });
      }
    });
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await messageAPI.getConversations();
      
      if (response.data.status === 'success') {
        const conversationsData = response.data.data.conversations.map(conv => ({
          ...conv,
          is_online: onlineUsers.has(conv.other_user_id.toString())
        }));
        setConversations(conversationsData);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (otherUserId) => {
    try {
      const response = await messageAPI.getWithUser(otherUserId);
      
      if (response.data.status === 'success') {
        setMessages(response.data.data.messages || []);
        
        // Join conversation room for real-time updates
        joinConversation(otherUserId);
        
        // Mark messages as read
        markMessagesAsRead(otherUserId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async (senderId) => {
    try {
      await messageAPI.markAsRead(senderId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Update conversation preview when new message arrives
  const updateConversationPreview = useCallback((message) => {
    setConversations(prev => {
      const otherUserId = message.sender_id === user.user_id ? message.recipient_id : message.sender_id;
      const existingConvIndex = prev.findIndex(conv => conv.other_user_id === otherUserId);
      
      if (existingConvIndex >= 0) {
        const updated = [...prev];
        updated[existingConvIndex] = {
          ...updated[existingConvIndex],
          last_message_content: message.content,
          last_message_at: message.created_at,
          unread_count: message.sender_id === otherUserId ? 
            (updated[existingConvIndex].unread_count || 0) + 1 : 0
        };
        return updated.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
      } else {
        // This would be a new conversation - you might want to fetch user details
        return prev;
      }
    });
  }, [user]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const content = newMessage.trim();
    const tempId = Date.now().toString();

    // Create temporary message for immediate UI update
    const tempMessage = {
      tempId,
      sender_id: user.user_id,
      recipient_id: selectedConversation.other_user_id,
      content,
      created_at: new Date().toISOString(),
      is_read: false
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setSending(true);

    // Stop typing indicator
    sendTypingStop(selectedConversation.other_user_id, user.user_id);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await messageAPI.send({
        recipient_id: selectedConversation.other_user_id,
        property_id: selectedConversation.property_id,
        content
      });

      // Update conversation preview
      updateConversationPreview(tempMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => msg.tempId !== tempId));
      setSending(false);
    }
  };

  // Handle typing
  const handleTyping = useCallback(() => {
    if (!selectedConversation) return;

    // Send typing start
    sendTypingStart(selectedConversation.other_user_id, user.user_id);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop(selectedConversation.other_user_id, user.user_id);
    }, 3000);
  }, [selectedConversation, user]);

  // Select conversation
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.other_user_id);
    
    // Reset unread count for this conversation
    setConversations(prev => prev.map(conv => 
      conv.other_user_id === conversation.other_user_id 
        ? { ...conv, unread_count: 0 }
        : conv
    ));
  };

  // Handle pre-selected contact from PropertyCard
  useEffect(() => {
    const locationState = window.history.state;
    if (locationState?.usr?.contactUser) {
      const { contactUser, property } = locationState.usr;
      
      // Create or select conversation
      const existingConv = conversations.find(c => c.other_user_id === contactUser.id);
      if (existingConv) {
        handleSelectConversation(existingConv);
      } else {
        const newConversation = {
          other_user_id: contactUser.id,
          first_name: contactUser.name,
          last_name: '',
          role: contactUser.role,
          profile_image_url: null,
          last_message_content: '',
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          property_title: property?.title,
          property_id: property?.id,
          is_online: onlineUsers.has(contactUser.id.toString())
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversation(newConversation);
        loadMessages(contactUser.id);
      }

      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [conversations, onlineUsers]);

  const handleLogout = () => {
    localStorage.removeItem('kwetupay_token');
    localStorage.removeItem('kwetupay_user');
    navigate('/login');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (!user) {
    return <div>Loading...</div>;
  }

  const messagesContent = (
    <div className="enhanced-messages-page">
      <div className="messages-header">
        <img 
          src="/images/logo.png" 
          alt="Kwetupay Logo" 
          className="messages-header-logo"
        />
        <div className="messages-header-content">
          <h1>💬 Messages</h1>
          <p>Real-time communication with {user.role === 'landlord' ? 'tenants' : 'landlords'}</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-error">&times;</button>
        </div>
      )}

      <div className="messages-container">
        {/* Conversations Sidebar */}
        <div className="conversations-sidebar">
          <div className="conversations-header">
            <h3>Conversations</h3>
            <span className="online-count">
              {Array.from(onlineUsers).length} online
            </span>
          </div>

          {loading ? (
            <div className="loading-conversations">
              <div className="loading-spinner"></div>
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations">
              <div className="empty-icon">💬</div>
              <h4>No conversations yet</h4>
              <p>
                {user.role === 'tenant' 
                  ? 'Start a conversation by contacting a landlord about a property.'
                  : 'Tenants will appear here when they contact you about your properties.'
                }
              </p>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map(conversation => (
                <div
                  key={conversation.other_user_id}
                  className={`conversation-item ${
                    selectedConversation?.other_user_id === conversation.other_user_id ? 'active' : ''
                  } ${conversation.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="conversation-avatar">
                    {conversation.first_name?.charAt(0).toUpperCase()}
                    {conversation.is_online && <div className="online-indicator"></div>}
                  </div>
                  
                  <div className="conversation-content">
                    <div className="conversation-header">
                      <h4>
                        {conversation.first_name} {conversation.last_name}
                        <span className="user-role">({conversation.role})</span>
                      </h4>
                      <span className="conversation-time">
                        {formatTime(conversation.last_message_at)}
                      </span>
                    </div>
                    
                    <p className="conversation-preview">
                      {conversation.last_message_content || 'No messages yet'}
                    </p>
                    
                    {conversation.property_title && (
                      <div className="conversation-property">
                        🏠 {conversation.property_title}
                      </div>
                    )}
                  </div>

                  {conversation.unread_count > 0 && (
                    <div className="unread-badge">
                      {conversation.unread_count}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Area */}
        <div className="message-area">
          {selectedConversation ? (
            <>
              <div className="message-header">
                <div className="message-contact">
                  <div className="contact-avatar">
                    {selectedConversation.first_name?.charAt(0).toUpperCase()}
                    {selectedConversation.is_online && <div className="online-indicator"></div>}
                  </div>
                  <div className="contact-info">
                    <h3>
                      {selectedConversation.first_name} {selectedConversation.last_name}
                      <span className="contact-role">({selectedConversation.role})</span>
                    </h3>
                    <p className="contact-status">
                      {selectedConversation.is_online ? '🟢 Online' : '⚫ Offline'}
                      {selectedConversation.property_title && ` • 🏠 ${selectedConversation.property_title}`}
                    </p>
                  </div>
                </div>
                
                <div className="message-actions">
                  <button className="action-btn" title="Call">
                    📞
                  </button>
                  <button className="action-btn" title="View Property">
                    🏠
                  </button>
                </div>
              </div>

              <div className="messages-display">
                {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                  <div key={date}>
                    <div className="message-date-divider">
                      {date}
                    </div>
                    {dateMessages.map(message => (
                      <div 
                        key={message.message_id || message.tempId} 
                        className={`message ${message.sender_id === user.user_id ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          <p>{message.content}</p>
                          <div className="message-meta">
                            <span className="message-time">
                              {formatTime(message.created_at)}
                            </span>
                            {message.sender_id === user.user_id && (
                              <span className="read-status">
                                {message.is_read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-area">
                <div className="message-input-container">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type your message..."
                    className="message-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sending}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="send-btn"
                  >
                    {sending ? '⏳' : '📤'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="no-conversation-selected">
              <div className="selection-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <PropertiesLayout user={user} onLogout={handleLogout}>
      {messagesContent}
    </PropertiesLayout>
  );
};

export default EnhancedMessages;