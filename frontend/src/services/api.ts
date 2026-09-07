import axios from 'axios';

// Em produção a API vive em outro deploy da Vercel, então VITE_API_URL precisa
// apontar para ela (ex.: https://kaizen-api.vercel.app/api). Em desenvolvimento
// a variável fica vazia e o proxy do Vite encaminha /api para localhost:3333.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    '[api] VITE_API_URL não foi definida neste build de produção. ' +
      'As chamadas cairão em /api no próprio domínio do frontend e vão falhar.'
  );
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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