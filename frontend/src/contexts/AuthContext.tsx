import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isProfessor: boolean;
  isAluno: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; role: string; organizationSlug: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_USER = '@kaizen:user';
const STORAGE_TOKEN = '@kaizen:token';

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(STORAGE_TOKEN) || sessionStorage.getItem(STORAGE_TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data);
        localStorage.setItem(STORAGE_USER, JSON.stringify(data));
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_TOKEN);
        sessionStorage.removeItem(STORAGE_TOKEN);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(STORAGE_TOKEN, data.token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (payload: { name: string; email: string; password: string; role: string; organizationSlug: string }) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem(STORAGE_TOKEN, data.token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = async () => {
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
    sessionStorage.removeItem(STORAGE_TOKEN);
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    isProfessor: user?.role === 'professor' || user?.role === 'admin',
    isAluno: user?.role === 'aluno',
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}