import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { messageAPI, bookingAPI } from '../../../services/api';
import { connectSocket, getSocket } from '../../../services/socket';

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      if (user?.role === 'landlord') {
        const resp = await bookingAPI.getLandlordRequests();
        if (resp.data?.status === 'success') {
          const items = resp.data.data?.requests || resp.data.data?.bookings || resp.data.data || [];
          setNotifCount(Array.isArray(items) ? items.length : 0);
        }
      } else {
        const resp = await messageAPI.getUnreadCount();
        if (resp.data?.status === 'success') {
          setNotifCount(resp.data.data?.unread || 0);
        }
      }
    } catch (e) {
      // ignore errors silently
    }
  }, [user?.role]);

  useEffect(() => {
    refreshCount();
    if (!user?.user_id) return;
    connectSocket(user.user_id);
    const s = getSocket();
    if (!s) return;

    const onMessageNew = () => { if (user?.role !== 'landlord') refreshCount(); };
    const onBookingNew = () => { if (user?.role === 'landlord') refreshCount(); };

    s.on('message:new', onMessageNew);
    s.on('booking:new', onBookingNew);

    return () => {
      s.off('message:new', onMessageNew);
      s.off('booking:new', onBookingNew);
    };
  }, [user?.user_id, refreshCount]);

  const handleBellClick = () => {
    if (user?.role === 'landlord') {
      navigate('/dashboard/bookings');
    } else {
      navigate('/messages');
    }
  };

  return (
    <nav className="landing-nav">
      <div className="nav-brand">
        <Link to="/" className="logo-link">
          <img src="/images/logo.png" alt="Kwetupay Logo" className="logo-img" />
          <span className="brand-name">Kwetupay</span>
        </Link>
      </div>
      <div className="nav-actions">
        <div className="user-welcome">
          Welcome, {user.first_name}!
          <span className="user-role">({user.role})</span>
        </div>

        {/* Notifications bell - visible always */}
        <button
          onClick={handleBellClick}
          className="nav-btn bell-btn"
          aria-label="Notifications"
          title="Notifications"
          type="button"
        >
          🔔
          {notifCount > 0 && <span className="badge">{notifCount}</span>}
        </button>

        <button onClick={onLogout} className="nav-btn login-btn">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Header;