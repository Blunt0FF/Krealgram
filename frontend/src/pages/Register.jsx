import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../components/Auth/Auth.css';

const Register = ({ setIsAuthenticated, setUser }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleResendVerification = async () => {
    if (cooldownTime > 0) return;
    
    setResendLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: registeredEmail }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        setError('');
        setCooldownTime(60);
      } else {
        setError(data.message);
        setSuccess('');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setError('An error occurred while sending the email.');
      setSuccess('');
    } finally {
      setResendLoading(false);
    }
  };

  React.useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(cooldownTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration error');
      }
      
      if (data.requiresVerification) {
        setShowEmailVerification(true);
        setRegisteredEmail(data.email);
        setSuccess(data.message);
        setError('');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setUser(data.user);
        navigate('/feed');
      }
    } catch (error) {
      setError(error.message);
      console.error('Registration error:', error);
    }
  };

  return (
    <div className="auth-main-container">
      <div className="auth-image-col">
        <img src="/mockup-phone.png" alt="Krealgram preview" className="auth-side-image" />
      </div>
      <div className="auth-form-col">
        <img src="/logo.png" alt="Krealgram" className="krealgram-logo" />
        <div className="auth-box">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          
          {showEmailVerification ? (
            <div className="email-verification-info">
              <h3>Check Your Email</h3>
              <p>We sent a verification email to <strong>{registeredEmail}</strong></p>
              <p>Click the link in the email to activate your account.</p>
              
              <div className="verification-actions">
                <button 
                  type="button" 
                  className="auth-button secondary"
                  onClick={handleResendVerification}
                  disabled={resendLoading || cooldownTime > 0}
                >
                  {resendLoading 
                    ? 'Sending...' 
                    : cooldownTime > 0 
                      ? `Resend in ${cooldownTime}s`
                      : 'Resend Email'
                  }
                </button>
                <Link to="/login" className="auth-link">
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                <button type="submit" className="auth-button">Sign up</button>
              </form>
              <div className="auth-or">
                <span>OR</span>
              </div>
              <div className="auth-forgot">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            </>
          )}
        </div>
        <div className="auth-register-box">
          <span>Already have an account?</span> <Link to="/">Log in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
