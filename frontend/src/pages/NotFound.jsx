import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <h1>Oops! Page Not Found (404 Error)</h1>
        <p>We're sorry, but the page you're looking for doesn't seem to exist.</p>
        <p>If you typed the URL manually, please double-check the spelling.</p>
        <p>If you clicked on a link, it may be outdated or broken.</p>
        <div className="not-found-actions">
          <Link to="/" className="not-found-button">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 