import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Messages.css';
import { messageAPI } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';

const Messages = () => {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('kwetupay_user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      connectSocket(u.user_id);
      loadConversations();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Handle pre-selected contact from PropertyCard
  useEffect(() => {
    const location = window.location;
    if (location.state?.contactUser) {
      const { contactUser, property } = location.state;
      // Create a conversation object for the contact
      const contactConversation = {
        id: contactUser.id,
        otherUser: {
          id: contactUser.id,
          name: contactUser.name,
          role: contactUser.role,
          phone: contactUser.phone
        },
        property: property,
        lastMessage: '',
        timestamp: new Date().toISOString(),
        unread: false,
        unreadCount: 0
      };
      
      // Add to conversations if not already there
      setConversations(prev => {
        const exists = prev.find(c => c.id === contactUser.id);
        if (!exists) {
          return [contactConversation, ...prev];
        }
        return prev;
      });
      
      // Select the conversation and load messages
      setSelectedConversation(contactConversation);
      loadMessages(contactUser.id);
      
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const resp = await messageAPI.getConversations();
      if (resp.data?.status === 'success') {
        const mapped = resp.data.data.conversations.map(c => ({
          id: c.other_user_id,
          otherUser: {
            id: c.other_user_id,
            name: `${c.first_name} ${c.last_name}`.trim(),
            role: c.role,
          },
          lastMessage: c.last_message_content,
          timestamp: c.last_message_at,
          unread: (c.unread_count || 0) > 0,
          unreadCount: c.unread_count || 0,
        }));
        setConversations(mapped);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      const resp = await messageAPI.getWithUser(otherUserId);
      if (resp.data?.status === 'success') {
        setMessages(resp.data.data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const content = newMessage.trim();
    try {
      await messageAPI.send({
        recipient_id: selectedConversation.otherUser.id,
        property_id: selectedConversation.property?.id,
        content,
      });
      
      // Add message to local state immediately
      const newMsg = {
        message_id: Date.now(), // temporary ID
        sender_id: user.user_id,
        recipient_id: selectedConversation.otherUser.id,
        content,
        created_at: new Date().toISOString(),
        is_read: true
      };
      setMessages(prev => [...prev, newMsg]);
      
      // Update conversation preview
      const updated = conversations.map(conv => (
        conv.id === selectedConversation.id
          ? { ...conv, lastMessage: content, timestamp: new Date().toISOString(), unread: false, unreadCount: 0 }
          : conv
      ));
      setConversations(updated);
      setNewMessage('');
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const onIncomingMessage = useCallback((payload) => {
    const msg = payload?.message;
    if (!msg) return;
    // If message belongs to an existing conversation, update it; else prepend
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === msg.sender_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unread: true,
          unreadCount: (next[idx].unreadCount || 0) + 1,
        };
        return next;
      }
      return [
        {
          id: msg.sender_id,
          otherUser: { id: msg.sender_id, name: 'New message', role: '' },
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unread: true,
          unreadCount: 1,
        },
        ...prev,
      ];
    });
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    s.on('message:new', onIncomingMessage);
    return () => {
      s.off('message:new', onIncomingMessage);
    };
  }, [onIncomingMessage]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="messages-page">
        <div className="loading-center">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-header">
        <h1>💬 Messages</h1>
        <p>Communicate with {user?.role === 'landlord' ? 'tenants' : 'landlords'}</p>
      </div>

      <div className="messages-container">
        {/* Conversations List */}
        <div className="conversations-list">
          <div className="conversations-header">
            <h3>Conversations</h3>
            <span className="conversations-count">
              {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
            </span>
          </div>

          {conversations.length === 0 ? (
            <div className="empty-conversations">
              <div className="empty-icon">💬</div>
              <h4>No conversations yet</h4>
              <p>
                {user?.role === 'tenant' 
                  ? 'Start a conversation by contacting a landlord about a property.'
                  : 'Tenants will appear here when they contact you about your properties.'
                }
              </p>
            </div>
          ) : (
            <div className="conversations">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    selectedConversation?.id === conversation.id ? 'active' : ''
                  } ${conversation.unread ? 'unread' : ''}`}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    loadMessages(conversation.otherUser.id);
                  }}
                >
                  <div className="conversation-avatar">
                    {conversation.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="conversation-content">
                    <div className="conversation-header">
                      <h4>{conversation.otherUser.name}</h4>
                      <span className="conversation-time">
                        {formatTime(conversation.timestamp)}
                      </span>
                    </div>
                    <p className="conversation-preview">
                      {conversation.lastMessage}
                    </p>
                    <div className="conversation-property">
                      {conversation.property.title}
                    </div>
                  </div>
                  {conversation.unread && (
                    <div className="unread-indicator"></div>
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
                    {selectedConversation.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <h3>{selectedConversation.otherUser.name}</h3>
                    <p>{selectedConversation.otherUser.role}</p>
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
                {messages.length > 0 && (
                  <div className="message-date">
                    {formatDate(messages[0].created_at)}
                  </div>
                )}
                
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(message => (
                    <div 
                      key={message.message_id} 
                      className={`message ${message.sender_id === user.user_id ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">
                        <p>{message.content}</p>
                        <span className="message-time">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="message-input-area">
                <div className="message-input-container">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="message-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="send-btn"
                  >
                    Send
                  </button>
                </div>
                <div className="message-options">
                  <small>
                    You can also contact {selectedConversation.otherUser.name} directly at: {' '}
                    <a href={`tel:${selectedConversation.otherUser.phone}`}>
                      {selectedConversation.otherUser.phone}
                    </a>
                  </small>
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
};

export default Messages;