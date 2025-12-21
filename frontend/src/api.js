import axios from 'axios';
import { API_URL } from './config'; // Импортируем ссылку

const api = axios.create({
  baseURL: API_URL, // Используем её здесь
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