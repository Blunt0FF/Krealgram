import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl, checkAndSetApiUrl } from '../config';
import '../components/Auth/Auth.css';

const Login = ({ setIsAuthenticated, setUser, fetchUnreadCount }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [userEmail, setUserEmail] = useState('');
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
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        credentials: 'include',
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        setCooldownTime(60);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Resend error:', error);
      setError('An error occurred while sending the email.');
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
    setIsLoading(true);
    setError('');
    setShowResendVerification(false);

    try {
      // Проверяем и устанавливаем корректный API URL
      await checkAndSetApiUrl();
      const apiUrl = getApiUrl();

      console.log('🔐 Login attempt', {
        apiUrl,
        identifier: formData.identifier.substring(0, 3) + '***'
      });

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin,
          'Access-Control-Allow-Origin': '*'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      console.log('🔐 Login response', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }

      if (!response.ok) {
        if (response.status === 403 && data.requiresVerification) {
          setShowResendVerification(true);
          setUserEmail(data.email);
          setError(data.message);
        } else {
          throw new Error(data.message || 'Login error');
        }
        return;
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid server response');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setIsAuthenticated(true);
      setUser(data.user);
      
      if (fetchUnreadCount) {
        fetchUnreadCount(data.token);
      }
      
      navigate('/feed');
    } catch (error) {
      console.error('Login error:', {
        message: error.message,
        stack: error.stack
      });

      // Расширенная обработка ошибок
      if (error.message.includes('Failed to fetch')) {
        setError('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      } else if (error.message.includes('CORS')) {
        setError('Ошибка CORS. Проверьте настройки сервера.');
      } else if (error.message.includes('Not allowed by CORS')) {
        setError('Домен не разрешен. Проверьте настройки CORS.');
      } else {
        setError(error.message || 'Произошла ошибка при входе. Пожалуйста, попробуйте снова.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-main-container">
      <div className="auth-image-col">
        {/* Здесь можно использовать локальную картинку или ссылку */}
        <img src="/mockup-phone.png" alt="Krealgram preview" className="auth-side-image" />
      </div>
      <div className="auth-form-col">
        <img src="/logo.png" alt="Krealgram" className="krealgram-logo" />
        <div className="auth-box">
          {error && <div className="auth-error">{error}</div>}
          
          {showResendVerification && (
            <div className="verification-reminder">
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
                    : 'Resend Verification Email'
                }
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <input
                type="text"
                name="identifier"
                placeholder="Username or email"
                value={formData.identifier}
                onChange={handleChange}
                required
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
            <button 
              type="submit" 
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Log in'}
            </button>
          </form>
          <div className="auth-or">
            <span>OR</span>
          </div>
          <div className="auth-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </div>
        <div className="auth-register-box">
          <span>Don't have an account?</span> <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
