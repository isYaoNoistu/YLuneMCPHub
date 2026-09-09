import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/contexts/ToastContext';
import { copyToClipboard } from '@/utils/clipboard';

interface CopyableCodeProps {
  title: string;
  value: string;
  emptyLabel?: string;
}

const CopyableCode = ({ title, value, emptyLabel = '—' }: CopyableCodeProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const text = value.trim();

  const copy = async () => {
    if (!text) {
      showToast(t('common.copyFailed') || 'Copy failed', 'error');
      return;
    }
    const ok = await copyToClipboard(text);
    if (!ok) {
      showToast(t('common.copyFailed') || 'Copy failed', 'error');
      return;
    }
    setCopied(true);
    showToast(t('common.copySuccess') || 'Copied', 'success');
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="copyable-code">
      <div className="copyable-code-head">
        <span className="ylune-label" style={{ margin: 0 }}>
          {title}
        </span>
        <button type="button" className="hub-btn" onClick={copy} disabled={!text}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('common.copied') : t('common.copyJson')}
        </button>
      </div>
      {text ? <pre className="ylune-code">{text}</pre> : <p className="ylune-help">{emptyLabel}</p>}
    </div>
  );
};

export default CopyableCode;
