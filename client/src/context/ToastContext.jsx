import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, isError, visible }
  const timerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    clearTimeout(timerRef.current);
    clearTimeout(hideTimerRef.current);

    setToast({ message, isError, visible: false });
    // Flip to visible on the next frame so the CSS transition runs.
    requestAnimationFrame(() => setToast((t) => (t ? { ...t, visible: true } : t)));

    timerRef.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, visible: false } : t));
      hideTimerRef.current = setTimeout(() => setToast(null), 220);
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${toast?.isError ? ' is-error' : ''}${toast?.visible ? ' is-visible' : ''}`} hidden={!toast}>
        {toast?.message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
