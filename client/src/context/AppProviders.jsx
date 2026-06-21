import { ToastProvider } from './ToastContext';
import { AuthProvider } from './AuthContext';
import { SocketProvider } from './SocketContext';
import { NotificationProvider } from './NotificationContext';
import { AuthModalProvider } from './AuthModalContext';

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <AuthModalProvider>{children}</AuthModalProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
