import axios from 'axios';
import { API_URL } from './config';

const api = axios.create({
  baseURL: API_URL, 
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // токен
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Если сервер ответил 401 , выбрасывает юзера
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