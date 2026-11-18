import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Простые уведомления: useToast()('Текст', 'success' | 'error' | 'info').
// Тост живёт 4 секунды, стек показывается в правом нижнем углу.
const ToastContext = createContext(() => {});
let counter = 0;
const TOAST_TTL = 4200;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const push = useCallback((message, type = 'info') => {
    const id = ++counter;
    setToasts((list) => [...list, { id, message, type }]);
    timers.current[id] = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      delete timers.current[id];
    }, TOAST_TTL);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
