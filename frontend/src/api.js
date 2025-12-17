import axios from 'axios';

const api = axios.create({
  // Из-за настройки прокси в vite.config.js нам не нужен полный URL
  // Но если прокси нет, используй 'http://127.0.0.1:8000'
  baseURL: 'http://127.0.0.1:8000', 
});

// --- МАГИЯ ЗДЕСЬ ---
// Перед каждым запросом этот код проверяет localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Берем токен
    if (token) {
      // Если токен есть, добавляем его в заголовок
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Если сервер ответил 401 (Not Authorized), выбрасываем юзера
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;