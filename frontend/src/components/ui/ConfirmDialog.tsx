import React from 'react';
import { useTranslation } from 'react-i18next';
import YluneDialog from './YluneDialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  confirmDisabled = false,
  variant = 'warning',
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <YluneDialog
      raised
      size="lg"
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="hub-btn" autoFocus>
            {cancelText || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'hub-btn danger' : 'hub-btn primary'}
            disabled={confirmDisabled}
          >
            {confirmText || t('common.confirm')}
          </button>
        </>
      }
    >
      <div className="ylune-help" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>
        {message}
      </div>
    </YluneDialog>
  );
};

export default ConfirmDialog;
