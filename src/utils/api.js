import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const examAPI = {
  start: () => api.get('/exam/start'),
  submit: (data) => api.post('/exam/submit', data),
  reportCheat: (data) => api.post('/exam/anti-cheat/report', data),
  getResult: () => api.get('/exam/result'),
};

export const adminAPI = {
  getResults: () => api.get('/admin/results'),
  getShortlist: () => api.get('/admin/shortlist'),
  getStats: () => api.get('/admin/stats'),
};

export default api;
