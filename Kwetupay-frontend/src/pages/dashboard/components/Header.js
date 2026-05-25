import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { messageAPI, bookingAPI } from '../../../services/api';
import { connectSocket, getSocket } from '../../../services/socket';

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const buildNotifications = useCallback(async () => {
    try {
      if (user?.role === 'landlord') {
        const resp = await bookingAPI.getLandlordRequests();
        const items = resp.data?.data?.requests || resp.data?.data?.bookings || resp.data?.data || [];
        const list = Array.isArray(items) ? items : [];
        setNotifications(list.slice(0, 8).map(b => ({
          id: b.booking_id,
          text: `New booking from ${b.tenant_name || 'a tenant'}`,
          sub: b.property_title || '',
          path: '/bookings/requests',
          time: b.created_at,
          icon: '📝',
        })));
      } else {
        const [msgResp, bookResp] = await Promise.all([
          messageAPI.getUnreadCount(),
          bookingAPI.getMyBookings().catch(() => ({ data: { data: { bookings: [] } } })),
        ]);
        const unread = msgResp.data?.data?.unread || 0;
        const bookings = bookResp.data?.data?.bookings || [];
        const notifs = [];
        if (unread > 0) {
          notifs.push({ id: 'msg', text: `${unread} unread message${unread !== 1 ? 's' : ''}`, sub: 'Tap to open messages', path: '/messages', icon: '💬', time: null });
        }
        bookings
          .filter(b => b.booking_status === 'approved')
          .slice(0, 5)
          .forEach(b => notifs.push({
            id: b.booking_id,
            text: `Booking approved — payment required`,
            sub: b.property_title || '',
            path: '/payments',
            icon: '✅',
            time: b.updated_at,
          }));
        setNotifications(notifs);
      }
    } catch { /* silent */ }
  }, [user?.role]);

  useEffect(() => {
    buildNotifications();
    if (!user?.user_id) return;
    connectSocket(user.user_id);
    const s = getSocket();
    if (!s) return;
    const onNew = () => buildNotifications();
    s.on('message:new', onNew);
    s.on('booking:new', onNew);
    s.on('booking:updated', onNew);
    return () => {
      s.off('message:new', onNew);
      s.off('booking:new', onNew);
      s.off('booking:updated', onNew);
    };
  }, [user?.user_id, buildNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (path) => {
    setShowDropdown(false);
    navigate(path);
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <nav className="landing-nav kp-header">
      <div className="nav-brand">
        <Link to="/" className="logo-link">
          <img src="/images/logo.png" alt="Kwetupay Logo" className="logo-img" />
          <span className="brand-name">Kwetupay</span>
        </Link>
      </div>

      <div className="nav-actions">
        <div className="kp-user-welcome">
          <span className="kp-welcome-name">{user.first_name} {user.last_name}</span>
          <span className="kp-role-chip">{user.role}</span>
        </div>

        {/* Notification Bell */}
        <div className="kp-bell-wrapper" ref={dropdownRef}>
          <button
            className="kp-bell-btn"
            onClick={() => setShowDropdown(v => !v)}
            aria-label="Notifications"
          >
            🔔
            {notifications.length > 0 && (
              <span className="kp-notif-badge">{notifications.length}</span>
            )}
          </button>

          {showDropdown && (
            <div className="kp-notif-dropdown">
              <div className="kp-notif-header">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <span className="kp-notif-count">{notifications.length}</span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="kp-notif-empty">No new notifications</div>
              ) : (
                <ul className="kp-notif-list">
                  {notifications.map((n, i) => (
                    <li key={n.id || i} className="kp-notif-item" onClick={() => handleNotifClick(n.path)}>
                      <span className="kp-notif-icon">{n.icon}</span>
                      <div className="kp-notif-body">
                        <p className="kp-notif-text">{n.text}</p>
                        {n.sub && <p className="kp-notif-sub">{n.sub}</p>}
                      </div>
                      {n.time && <span className="kp-notif-time">{timeAgo(n.time)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="kp-notif-footer" onClick={() => handleNotifClick(user.role === 'landlord' ? '/bookings/requests' : '/messages')}>
                View all
              </div>
            </div>
          )}
        </div>

        <button onClick={onLogout} className="kp-logout-btn">
          Sign Out
        </button>
      </div>
    </nav>
  );
};

export default Header;
