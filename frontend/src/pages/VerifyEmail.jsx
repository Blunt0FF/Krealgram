import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Недействительная ссылка подтверждения.');
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
        setStatus('success');
        setMessage(data.message);
        
        // Автоматически логиним пользователя
        localStorage.setItem('token', data.token);
        
        // Перенаправляем в фид через 2 секунды
        setTimeout(() => {
          navigate('/feed');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(data.message);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Произошла ошибка при подтверждении email.');
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

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
      }
    } catch (error) {
      console.error('Resend error:', error);
      alert('Произошла ошибка при отправке письма.');
    } finally {
      setResendLoading(false);
    }
  };

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
            <p>Подтверждаем ваш email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="verification-status success">
            <div className="success-icon">✓</div>
            <h2>Email подтвержден!</h2>
            <p>{message}</p>
            <p>Вы будете автоматически перенаправлены...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="verification-status error">
            <div className="error-icon">✗</div>
            <h2>Ошибка подтверждения</h2>
            <p>{message}</p>
            
            <div className="resend-section">
              <h3>Отправить письмо повторно</h3>
              <form onSubmit={handleResendVerification}>
                <input
                  type="email"
                  placeholder="Введите ваш email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={resendLoading}
                  className="auth-button"
                >
                  {resendLoading ? 'Отправляется...' : 'Отправить'}
                </button>
              </form>
            </div>

            <div className="auth-links">
              <Link to="/login">Вернуться к входу</Link>
              <Link to="/register">Создать новый аккаунт</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail; 