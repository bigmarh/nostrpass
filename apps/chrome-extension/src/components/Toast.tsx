import { Component, createSignal, createEffect, For, Show, createContext, useContext } from 'solid-js';
import { ErrorCode } from '@nostrpass/types';
import { useI18n } from '../i18n';
import { announceToScreenReader } from '../utils/a11y';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: () => Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType>();

export const ToastProvider: Component<{ children: any }> = (props) => {
  const [toasts, setToasts] = createSignal<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  const contextValue: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {props.children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const ToastContainer: Component = () => {
  const { toasts } = useToast();

  return (
    <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <For each={toasts()}>
        {(toast) => <ToastItem toast={toast} />}
      </For>
    </div>
  );
};

const ToastItem: Component<{ toast: Toast }> = (props) => {
  const { removeToast } = useToast();
  const { t } = useI18n();
  const [isVisible, setIsVisible] = createSignal(false);

  createEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);
    
    // Announce to screen readers
    announceToScreenReader(`${props.toast.title}: ${props.toast.message}`, 'polite');
  });

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => removeToast(props.toast.id), 150);
  };

  const getToastStyles = () => {
    const baseStyles = "transform transition-all duration-300 ease-in-out";
    const visibilityStyles = isVisible() 
      ? "translate-x-0 opacity-100" 
      : "translate-x-full opacity-0";

    switch (props.toast.type) {
      case 'success':
        return `${baseStyles} ${visibilityStyles} bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200`;
      case 'error':
        return `${baseStyles} ${visibilityStyles} bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200`;
      case 'warning':
        return `${baseStyles} ${visibilityStyles} bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200`;
      case 'info':
        return `${baseStyles} ${visibilityStyles} bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200`;
      default:
        return `${baseStyles} ${visibilityStyles} bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200`;
    }
  };

  const getIcon = () => {
    switch (props.toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div 
      class={`${getToastStyles()} border rounded-lg p-4 shadow-lg`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="flex items-start gap-3">
        <div 
          class="flex-shrink-0 w-5 h-5 flex items-center justify-center text-sm font-bold"
          aria-hidden="true"
        >
          {getIcon()}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm" id={`toast-title-${props.toast.id}`}>
            {props.toast.title}
          </h4>
          <p class="text-sm mt-1 opacity-90" id={`toast-message-${props.toast.id}`}>
            {props.toast.message}
          </p>
          <Show when={props.toast.action}>
            <button
              onClick={props.toast.action!.onClick}
              class="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              aria-describedby={`toast-title-${props.toast.id} toast-message-${props.toast.id}`}
            >
              {props.toast.action!.label}
            </button>
          </Show>
        </div>
        <button
          onClick={handleRemove}
          class="flex-shrink-0 text-lg leading-none opacity-50 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label={t('a11y.closeModal')}
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Error code to user-friendly message mapping
export const getErrorMessage = (errorCode: ErrorCode, context?: any): { title: string; message: string } => {
  switch (errorCode) {
    case ErrorCode.INVALID_REQUEST:
      return {
        title: 'Invalid Request',
        message: 'The request was malformed or missing required parameters.'
      };
    case ErrorCode.USER_NOT_AUTHENTICATED:
      return {
        title: 'Not Authenticated',
        message: 'Please unlock your vault to continue.'
      };
    case ErrorCode.VAULT_LOCKED:
      return {
        title: 'Vault Locked',
        message: 'Your vault is locked. Please enter your PIN to unlock.'
      };
    case ErrorCode.INVALID_PIN:
      return {
        title: 'Invalid PIN',
        message: 'The PIN you entered is incorrect. Please try again.'
      };
    case ErrorCode.TOO_MANY_ATTEMPTS:
      return {
        title: 'Too Many Attempts',
        message: 'You have exceeded the maximum number of PIN attempts. Please wait before trying again.'
      };
    case ErrorCode.PERMISSION_DENIED:
      return {
        title: 'Permission Denied',
        message: context?.appName 
          ? `Permission denied for ${context.appName}.`
          : 'Permission denied for this operation.'
      };
    case ErrorCode.SESSION_EXPIRED:
      return {
        title: 'Session Expired',
        message: 'Your session has expired. Please unlock your vault again.'
      };
    case ErrorCode.NETWORK_ERROR:
      return {
        title: 'Network Error',
        message: 'Unable to connect to the network. Please check your connection and try again.'
      };
    case ErrorCode.ENCRYPTION_ERROR:
      return {
        title: 'Encryption Error',
        message: 'Failed to encrypt or decrypt data. Please try again.'
      };
    case ErrorCode.STORAGE_ERROR:
      return {
        title: 'Storage Error',
        message: 'Failed to save or load data. Please try again.'
      };
    case ErrorCode.INVALID_SIGNATURE:
      return {
        title: 'Invalid Signature',
        message: 'The signature verification failed. Please try again.'
      };
    case ErrorCode.UNSUPPORTED_OPERATION:
      return {
        title: 'Unsupported Operation',
        message: 'This operation is not supported in the current context.'
      };
    case ErrorCode.RATE_LIMITED:
      return {
        title: 'Rate Limited',
        message: 'Too many requests. Please wait a moment before trying again.'
      };
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return {
        title: 'Insufficient Permissions',
        message: 'You do not have the required permissions for this operation.'
      };
    case ErrorCode.INVALID_IDENTITY:
      return {
        title: 'Invalid Identity',
        message: 'The selected identity is not valid or has been removed.'
      };
    case ErrorCode.SYNC_ERROR:
      return {
        title: 'Sync Error',
        message: 'Failed to sync data with Nostr. Your data is saved locally.'
      };
    default:
      return {
        title: 'Unknown Error',
        message: 'An unexpected error occurred. Please try again.'
      };
  }
};

// Helper function to show error toast
export const showErrorToast = (errorCode: ErrorCode, context?: any) => {
  try {
    const { addToast } = useToast();
    const { title, message } = getErrorMessage(errorCode, context);
    
    addToast({
      type: 'error',
      title,
      message,
      duration: 8000
    });
  } catch (error) {
    // Toast provider not available, just log to console
    const { title, message } = getErrorMessage(errorCode, context);
    console.error(`[Toast Error] ${title}: ${message}`);
  }
};

// Helper function to show success toast
export const showSuccessToast = (title: string, message: string, action?: { label: string; onClick: () => void }) => {
  try {
    const { addToast } = useToast();
    
    addToast({
      type: 'success',
      title,
      message,
      duration: 4000,
      action
    });
  } catch (error) {
    console.log(`[Toast Success] ${title}: ${message}`);
  }
};

// Helper function to show warning toast
export const showWarningToast = (title: string, message: string, action?: { label: string; onClick: () => void }) => {
  try {
    const { addToast } = useToast();
    
    addToast({
      type: 'warning',
      title,
      message,
      duration: 6000,
      action
    });
  } catch (error) {
    console.warn(`[Toast Warning] ${title}: ${message}`);
  }
};

// Helper function to show info toast
export const showInfoToast = (title: string, message: string, action?: { label: string; onClick: () => void }) => {
  try {
    const { addToast } = useToast();
    
    addToast({
      type: 'info',
      title,
      message,
      duration: 5000,
      action
    });
  } catch (error) {
    console.info(`[Toast Info] ${title}: ${message}`);
  }
};
