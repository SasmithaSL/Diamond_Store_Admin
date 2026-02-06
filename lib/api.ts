import axios from 'axios';
import Cookies from 'js-cookie';

const rawBaseURL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const baseURL =
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  rawBaseURL.startsWith('http://')
    ? rawBaseURL.replace('http://', 'https://')
    : rawBaseURL;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;




