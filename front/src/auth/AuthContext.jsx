import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

const USER_KEY = 'as_user';
const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Провайдер авторизации. Хранит текущего пользователя и JWT access-токен.
// Токен лежит в localStorage (ключ as_token), данные пользователя — рядом (as_user),
// поэтому после перезагрузки страницы интерфейс сразу знает роль, не дожидаясь /users/me.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? readStoredUser() : null));

  useEffect(() => {
    // 401 из любого запроса = токен истёк или недействителен: разлогиниваемся.
    // Защищённые маршруты сами перенаправят гостя на страницу входа.
    setUnauthorizedHandler(() => {
      setToken(null);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (name, email, password) => {
      await authApi.register(name, email, password);
      // Бэкенд после регистрации не выдаёт токен — сразу входим с теми же данными
      return login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Обновление данных текущего пользователя (после правки профиля)
  const updateUser = useCallback((next) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout, updateUser }),
    [user, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return ctx;
}
