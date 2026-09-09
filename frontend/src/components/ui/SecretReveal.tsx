import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';

interface SecretRevealProps {
  value?: string | null;
  emptyLabel?: string;
  className?: string;
  variant?: 'field' | 'plain';
}

/** sk-66982*****dae8 — keep a short prefix, hide the middle, show the tail. */
export const maskSecret = (value: string): string =>
  value.length > 12 ? `${value.slice(0, 8)}*****${value.slice(-4)}` : '••••••••';

const SecretReveal = ({ value, emptyLabel = '—', className, variant = 'field' }: SecretRevealProps) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <span className={className} style={{ color: 'var(--hub-ink-3)' }}>
        {emptyLabel}
      </span>
    );
  }

  const copy = async () => {
    const ok = await copyToClipboard(value);
    if (!ok) {
      setCopied(false);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={`ylune-secret${variant === 'plain' ? ' is-plain' : ''} ${className || ''}`.trim()}>
      <code className="hub-mono ylune-secret-value" title={visible ? value : maskSecret(value)}>
        {visible ? value : maskSecret(value)}
      </code>
      <button
        type="button"
        className="hub-icon-btn sm"
        onClick={() => setVisible((open) => !open)}
        aria-label={visible ? 'hide' : 'show'}
      >
        {visible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button type="button" className="hub-icon-btn sm" onClick={copy} aria-label="copy">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
};

export default SecretReveal;
