import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    authAPI.verifyEmail(token)
      .then(res => {
        if (res.data.status === 'success') {
          setStatus('success');
          setMessage(res.data.message);
        } else {
          setStatus('error');
          setMessage(res.data.message || 'Verification failed');
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may have expired.');
      });
  }, [searchParams]);

  return (
    <div
      className="auth-container"
      style={{
        backgroundImage: `url('/images/apartment.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="auth-overlay">
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <div className="form-logo-large" style={{ justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Kwetupay" className="form-logo-img-large" />
            <span className="brand-name-large">Kwetupay</span>
          </div>

          {status === 'verifying' && (
            <>
              <div style={{ fontSize: '48px', margin: '24px 0' }}>⏳</div>
              <h2>Verifying your email...</h2>
              <p style={{ color: '#6b7280' }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ fontSize: '48px', margin: '24px 0' }}>✅</div>
              <h2>Email Verified!</h2>
              <p style={{ color: '#374151', marginBottom: '24px' }}>{message}</p>
              <button className="login-btn" onClick={() => navigate('/login')}>
                Go to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize: '48px', margin: '24px 0' }}>❌</div>
              <h2>Verification Failed</h2>
              <p style={{ color: '#374151', marginBottom: '24px' }}>{message}</p>
              <button className="login-btn" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
