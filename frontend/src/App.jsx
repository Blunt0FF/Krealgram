import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Feed from './components/Feed/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import SearchPage from './pages/SearchPage';
import CreatePost from './components/CreatePost/CreatePost';
import Profile from './components/User/Profile';
import EditProfile from './components/User/EditProfile';
import Messages from './components/Messages/Messages';
import Sidebar from './components/Sidebar/Sidebar';
import MobileNavigation from './components/Navigation/MobileNavigation';
import PostPage from './components/Post/PostPage';
import MobileNotificationsPage from './pages/MobileNotificationsPage';
import { API_URL } from './config';
import './App.css';

const PublicRoute = ({ children, isAuthenticated }) => {
  return !isAuthenticated ? children : <Navigate to="/feed" />;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setUnreadCount(0);
  };

  const fetchUnreadCount = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=1`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread notifications count:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
        setUnreadCount(0);
        throw new Error('Token verification failed or session expired');
      })
      .then(userData => {
        setIsAuthenticated(true);
        setUser(userData.user);
        localStorage.setItem('user', JSON.stringify(userData.user));
        fetchUnreadCount(token);
      })
      .catch(error => {
        console.error('Authentication check error:', error.message);
        if (error.message !== 'Token verification failed or session expired') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsAuthenticated(false);
            setUser(null);
            setUnreadCount(0);
        }
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
      setIsAuthenticated(false);
      setUser(null);
      setUnreadCount(0);
    }
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#8e8e8e'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="app">
        <Routes>
          <Route path="/" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} fetchUnreadCount={fetchUnreadCount} />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <Register setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <ForgotPassword />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <ResetPassword />
            </PublicRoute>
          } />
          {/* Приватные маршруты с Sidebar и мобильной навигацией */}
          <Route path="/*" element={
            isAuthenticated ? (
              <div className="main-layout">
                <Sidebar user={user} onLogout={handleLogout} unreadCount={unreadCount} setUnreadCount={setUnreadCount} />
                <main className="main-content main-content-with-sidebar">
                  <Routes>
                    <Route path="feed" element={<Feed user={user} />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="messages" element={<Messages currentUser={user} />} />
                    <Route path="profile/:username" element={<Profile user={user} />} />
                    <Route path="edit-profile" element={<EditProfile user={user} setUser={setUser} />} />
                    <Route path="create-post" element={<CreatePost />} />
                    <Route path="post/:id" element={<PostPage />} />
                    <Route path="notifications_mobile" element={<MobileNotificationsPage setUnreadCountGlobal={setUnreadCount} />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <MobileNavigation user={user} onLogout={handleLogout} unreadCount={unreadCount} />
              </div>
            ) : <Navigate to="/" replace />
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App; 