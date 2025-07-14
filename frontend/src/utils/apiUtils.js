import { API_URL } from '../config';

const smartFetch = async (endpoint, options = {}) => {
  const url = `${API_URL}/${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    // Обработка ошибок
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || 'Что-то пошло не так');
      error.status = response.status;
      throw error;
    }

    return response;
  } catch (error) {
    console.error(`API Error: ${error.message}`, error);
    throw error;
  }
};

export default smartFetch; 