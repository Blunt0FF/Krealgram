import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import '../components/Auth/Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('toastMessage', 'Account confirmed!');
        window.location.href = '/feed';
      } else {
        setStatus('error');
        setMessage(data.message);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('An error occurred while verifying your email.');
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim() || cooldownTime > 0) return;

    setResendLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();
      alert(data.message);
      
      if (response.ok) {
        setResendEmail('');
        // Запускаем таймер на 60 секунд
        setCooldownTime(60);
      }
    } catch (error) {
      console.error('Resend error:', error);
      alert('An error occurred while sending the email.');
    } finally {
      setResendLoading(false);
    }
  };

  // Таймер для кнопки повторной отправки
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(cooldownTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-logo">
          <img src="/logo.png" alt="Krealgram" />
          <h1>Krealgram</h1>
        </div>

        {status === 'verifying' && (
          <div className="verification-status">
            <div className="spinner"></div>
            <p>Verifying your email...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="verification-status error">
            <div className="error-icon">✗</div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            
            <div className="resend-section">
              <h3>Resend Verification Email</h3>
              <form onSubmit={handleResendVerification}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={resendLoading || cooldownTime > 0}
                  className="auth-button resend-button"
                >
                  {resendLoading 
                    ? 'Sending...' 
                    : cooldownTime > 0 
                      ? `Resend in ${cooldownTime}s`
                      : 'Resend Email'
                  }
                </button>
              </form>
            </div>

            <div className="auth-links">
              <Link to="/login">Back to Login</Link>
              <Link to="/register">Create New Account</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail; 