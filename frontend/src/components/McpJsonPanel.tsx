import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';
import { copyToClipboard } from '@/utils/clipboard';
import { formatUserMcpJson } from '@/utils/userMcpConfig';

interface McpJsonPanelProps {
  username: string;
  token?: string;
  compact?: boolean;
}

const McpJsonPanel = ({ username, token, compact = false }: McpJsonPanelProps) => {
  const { t } = useTranslation();
  const { installConfig } = useSettingsData();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const json = token ? formatUserMcpJson(token, username, installConfig?.baseUrl) : '';

  const copy = async () => {
    if (!json) {
      showToast(t('users.tokenMissing'), 'error');
      return;
    }
    const ok = await copyToClipboard(json);
    if (!ok) {
      showToast(t('common.copyFailed') || 'Copy failed', 'error');
      return;
    }
    setCopied(true);
    showToast(t('common.copySuccess') || 'Copied', 'success');
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (compact) {
    return (
      <button
        type="button"
        className="hub-btn"
        onClick={copy}
        disabled={!token}
        title={t('users.copyMcpJson')}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? t('common.copied') : t('users.copyMcpJson')}
      </button>
    );
  }

  return (
    <div>
      <label className="ylune-label">{t('users.mcpJsonTitle')}</label>
      <p className="ylune-help">{t('users.mcpJsonHint')}</p>
      {json ? <pre className="ylune-code">{json}</pre> : <p className="ylune-help">{t('users.tokenMissing')}</p>}
      <button type="button" className="hub-btn" onClick={copy} disabled={!json} style={{ marginTop: 8 }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t('common.copied') : t('users.copyMcpJson')}
      </button>
    </div>
  );
};

export default McpJsonPanel;
