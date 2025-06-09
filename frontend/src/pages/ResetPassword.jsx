import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Auth/Auth.css';

const API_URL = 'http://localhost:3000';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus({
        type: 'error',
        message: 'Invalid or missing reset token. Please request a new password reset.'
      });
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setStatus({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setStatus({
        type: 'error',
        message: 'Passwords do not match.'
      });
      return;
    }

    if (formData.password.length < 6) {
      setStatus({
        type: 'error',
        message: 'Password must be at least 6 characters long.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          newPassword: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: 'Password has been successfully reset. You can now log in with your new password.'
        });
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus({
          type: 'error',
          message: data.message || 'Failed to reset password. Please try again.'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-main-container">
      <div className="auth-image-col">
        <img src="/mockup-phone.png" alt="Krealgram App" className="auth-side-image" />
      </div>
      <div className="auth-form-col">
        <img src="/logo.png" alt="Krealgram" className="krealgram-logo" />
        <div className="auth-box">
          <div className="trouble-logging">
            <h2>Reset Your Password</h2>
            <p>Please enter your new password below.</p>
          </div>
          {status.message && (
            <div className={`auth-message ${status.type}`}>
              {status.message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="New password"
                required
                disabled={!token || isSubmitting}
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                required
                disabled={!token || isSubmitting}
              />
            </div>
            <button
              type="submit"
              className="auth-button"
              disabled={!token || isSubmitting}
            >
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
          <div className="auth-or">
            <span>OR</span>
          </div>
          <Link to="/" className="auth-switch">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 