import React from 'react';
import { useTranslation } from 'react-i18next';

export interface McpRouterDraft {
  apiKey: string;
  referer: string;
  title: string;
  baseUrl: string;
}

interface McpRouterSectionProps {
  loading: boolean;
  draft: McpRouterDraft;
  onChange: (key: keyof McpRouterDraft, value: string) => void;
  onSave: (key: keyof McpRouterDraft) => void;
}

const McpRouterSection: React.FC<McpRouterSectionProps> = ({
  loading,
  draft,
  onChange,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-block">
        <div className="mb-2">
          <h3 className="settings-label">{t('settings.mcpRouterApiKey')}</h3>
          <p className="settings-help">{t('settings.mcpRouterApiKeyDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => onChange('apiKey', e.target.value)}
            placeholder={t('settings.mcpRouterApiKeyPlaceholder')}
            className="hub-input"
            disabled={loading}
          />
          <button
            onClick={() => onSave('apiKey')}
            disabled={loading}
            className="hub-btn primary"
          >
            {t('common.save')}
          </button>
        </div>
      </div>

      <div className="settings-block">
        <div className="mb-2">
          <h3 className="settings-label">{t('settings.mcpRouterBaseUrl')}</h3>
          <p className="settings-help">{t('settings.mcpRouterBaseUrlDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={draft.baseUrl}
            onChange={(e) => onChange('baseUrl', e.target.value)}
            placeholder={t('settings.mcpRouterBaseUrlPlaceholder')}
            className="hub-input"
            disabled={loading}
          />
          <button
            onClick={() => onSave('baseUrl')}
            disabled={loading}
            className="hub-btn primary"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </>
  );
};

export default McpRouterSection;
