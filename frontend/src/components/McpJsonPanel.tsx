import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';
import { copyToClipboard } from '@/utils/clipboard';
import { formatUserMcpSnippet, McpCopyFormat } from '@/utils/userMcpConfig';

interface McpJsonPanelProps {
  username: string;
  token?: string;
  compact?: boolean;
}

const FORMAT_KEY = 'ylune.mcpCopyFormat';

const readFormat = (): McpCopyFormat => {
  try {
    return localStorage.getItem(FORMAT_KEY) === 'toml' ? 'toml' : 'json';
  } catch {
    return 'json';
  }
};

const McpJsonPanel = ({ username, token, compact = false }: McpJsonPanelProps) => {
  const { t } = useTranslation();
  const { installConfig } = useSettingsData();
  const { showToast } = useToast();
  const [format, setFormat] = useState<McpCopyFormat>(readFormat);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FORMAT_KEY, format);
    } catch {
      /* ignore */
    }
  }, [format]);

  const snippet = token ? formatUserMcpSnippet(format, token, username, installConfig?.baseUrl) : '';

  const copy = async () => {
    if (!snippet) {
      showToast(t('users.tokenMissing'), 'error');
      return;
    }
    const ok = await copyToClipboard(snippet);
    if (!ok) {
      showToast(t('common.copyFailed') || 'Copy failed', 'error');
      return;
    }
    setCopied(true);
    showToast(t('common.copySuccess') || 'Copied', 'success');
    window.setTimeout(() => setCopied(false), 1500);
  };

  const formatButtons = (
    <div className="mcp-copy-formats">
      <button
        type="button"
        className={`hub-btn${compact ? ' sm' : ''}${format === 'json' ? ' primary' : ''}`}
        onClick={() => setFormat('json')}
        aria-pressed={format === 'json'}
      >
        JSON
      </button>
      <button
        type="button"
        className={`hub-btn${compact ? ' sm' : ''}${format === 'toml' ? ' primary' : ''}`}
        onClick={() => setFormat('toml')}
        aria-pressed={format === 'toml'}
      >
        TOML
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className="mcp-copy-bar is-compact">
        {formatButtons}
        <button
          type="button"
          className={`hub-btn${compact ? ' sm' : ''}`}
          onClick={() => void copy()}
          disabled={!token}
          title={format === 'toml' ? t('users.copyMcpToml') : t('users.copyMcpJson')}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('common.copied') : t('users.copyMcpSnippet')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="ylune-label">
        {format === 'toml' ? t('users.mcpTomlTitle') : t('users.mcpJsonTitle')}
      </label>
      <p className="ylune-help">
        {format === 'toml' ? t('users.mcpTomlHint') : t('users.mcpJsonHint')}
      </p>
      {snippet ? <pre className="ylune-code">{snippet}</pre> : <p className="ylune-help">{t('users.tokenMissing')}</p>}
      <div className="mcp-copy-bar">
        {formatButtons}
        <button type="button" className="hub-btn" onClick={() => void copy()} disabled={!snippet}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('common.copied') : t('users.copyMcpSnippet')}
        </button>
      </div>
    </div>
  );
};

export default McpJsonPanel;
