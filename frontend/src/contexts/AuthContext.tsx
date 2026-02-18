import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { authApi, setAuthToken, AuthUser } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        if (res?.data) {
          setUser(res.data);
        } else {
          setAuthToken(null);
        }
      })
      .catch((err) => {
        console.error('Auth check failed:', err);
        setAuthToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // При 401 (истёкший/неверный токен) сбрасываем авторизацию и показываем экран входа
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          const url = err.config?.url ?? '';
          if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
            setAuthToken(null);
            setUser(null);
          }
        }
        return Promise.reject(err);
      }
    );
    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (res?.data?.token && res?.data?.user) {
      setAuthToken(res.data.token);
      setUser(res.data.user);
    } else {
      throw new Error('Неверный ответ от сервера');
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await authApi.register({ email, password, name });
    if (res?.data?.token && res?.data?.user) {
      setAuthToken(res.data.token);
      setUser(res.data.user);
    } else {
      throw new Error('Неверный ответ от сервера');
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
