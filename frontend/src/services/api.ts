import axios from 'axios';

const PROD = import.meta.env.PROD;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (PROD ? '/_/backend/api' : '/api'),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@kaizen:token') || sessionStorage.getItem('@kaizen:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('@kaizen:user');
      localStorage.removeItem('@kaizen:token');
      sessionStorage.removeItem('@kaizen:token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(error: unknown): string {
  const data = (error as any)?.response?.data;
  if (data?.error) return data.error;
  const message = (error as any)?.message;
  if (message) return message;
  return 'Erro inesperado. Tente novamente.';
}