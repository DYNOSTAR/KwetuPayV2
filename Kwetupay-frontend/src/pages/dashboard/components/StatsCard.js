import React from 'react';
import { useNavigate } from 'react-router-dom';

const StatsCard = ({ title, value, icon, color = 'primary', link }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (link) {
      navigate(link);
    }
  };

  return (
    <div 
      className={`stat-card stat-card--${color} ${link ? 'clickable' : ''}`}
      onClick={handleClick}
    >
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <h4 className="stat-title">{title}</h4>
      </div>
      <div className="stat-value">{value}</div>
      {link && <div className="stat-arrow">→</div>}
    </div>
  );
};

export default StatsCard;