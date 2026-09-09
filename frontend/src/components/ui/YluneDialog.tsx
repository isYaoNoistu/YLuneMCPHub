import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface YluneDialogProps {
  children: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  raised?: boolean;
  className?: string;
  hideClose?: boolean;
}

const YluneDialog = ({
  children,
  title,
  footer,
  onClose,
  size = 'md',
  raised = false,
  className,
  hideClose = false,
}: YluneDialogProps) => {
  return (
    <div
      className={`ylune-dialog-backdrop${raised ? ' is-raised' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`ylune-dialog${size !== 'md' ? ` is-${size}` : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {title != null && (
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">{title}</h2>
            {onClose && !hideClose && (
              <button type="button" className="hub-icon-btn" onClick={onClose} aria-label="close">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="ylune-dialog-body">{children}</div>
        {footer != null && <div className="ylune-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
};

export default YluneDialog;
