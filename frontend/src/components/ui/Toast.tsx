import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  visible: boolean;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  visible,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [visible, duration, onClose]);

  const icon =
    type === 'success' ? (
      <Check size={15} />
    ) : type === 'error' ? (
      <X size={15} />
    ) : type === 'warning' ? (
      <TriangleAlert size={15} />
    ) : (
      <Info size={15} />
    );

  return (
    <div className={`hub-toast is-${type}${visible ? ' is-on' : ''}`} role="status">
      <span className="hub-toast-icon">{icon}</span>
      <p className="hub-toast-msg">{message}</p>
      <button type="button" className="hub-icon-btn sm" onClick={onClose} aria-label={t('common.dismiss')}>
        <X size={13} />
      </button>
    </div>
  );
};

export default Toast;
