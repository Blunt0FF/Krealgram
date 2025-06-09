import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../components/Auth/Auth.css';
import { API_URL } from '../config';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: 'Password reset instructions have been sent to your email.'
        });
        setEmail('');
      } else {
        setStatus({
          type: 'error',
          message: data.message || 'An error occurred. Please try again.'
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
        <img src="/mockup-phone.png" alt="Instagram App" className="auth-side-image" />
      </div>
      <div className="auth-form-col">
        <div className="auth-box">
          <img src="/logo.png" alt="Krealgram" className="krealgram-logo" />
          <div className="trouble-logging">
            <h2>Trouble logging in?</h2>
            <p>Enter your email and we'll send you a link to get back into your account.</p>
          </div>
          {status.message && (
            <div className={`auth-message ${status.type}`}>
              {status.message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <button
              type="submit"
              className="auth-button"
              disabled={isSubmitting || !email}
            >
              {isSubmitting ? 'Sending...' : 'Send login link'}
            </button>
          </form>
          <div className="auth-or">
            <span>OR</span>
          </div>
          <Link to="/register" className="auth-switch">
            Create new account
          </Link>
        </div>
        <div className="auth-register-box">
          <Link to="/">Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 