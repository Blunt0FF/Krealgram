import React, { useEffect, useState } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'success', duration = 3000, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDone) {
            setTimeout(onDone, 300);
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, duration, onDone]);

  if (!message) {
    return null;
  }

  return (
    <div className={`toast ${type} ${visible ? 'show' : ''}`}>
      {message}
    </div>
  );
};

export default Toast; 