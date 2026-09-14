import type { CSSProperties, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingControlProps {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  overlayStyle?: CSSProperties;
  spinnerSize?: number;
}

const LoadingControl = ({
  isLoading,
  children,
  className,
  overlayStyle,
  spinnerSize = 12,
}: LoadingControlProps) => (
  <div
    className={className ? `relative flex items-center ${className}` : 'relative flex items-center'}
    aria-busy={isLoading}
  >
    <div
      className="flex w-full items-center justify-center"
      style={{
        visibility: isLoading ? 'hidden' : 'visible',
        pointerEvents: isLoading ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
    {isLoading && (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          background: 'var(--hub-surface)',
          border: '1px solid var(--hub-line-2)',
          borderRadius: 8,
          ...overlayStyle,
        }}
      >
        <RefreshCw
          size={spinnerSize}
          className="animate-spin"
          style={{ color: 'var(--hub-ink-3)' }}
        />
      </div>
    )}
  </div>
);

export default LoadingControl;
