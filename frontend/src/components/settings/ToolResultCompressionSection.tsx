import React from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/ToggleGroup';

export type ToolResultCompressionStrategy =
  | 'auto'
  | 'json'
  | 'log'
  | 'search'
  | 'diff'
  | 'text';

export interface ToolResultCompressionDraft {
  minTokens: string;
  maxOutputTokens: string;
  strategy: ToolResultCompressionStrategy;
}

interface ToolResultCompressionSectionProps {
  enabled: boolean;
  loading: boolean;
  draft: ToolResultCompressionDraft;
  onEnabledChange: (value: boolean) => void;
  onChange: (key: keyof ToolResultCompressionDraft, value: string) => void;
  onSave: () => void;
}

const ToolResultCompressionSection: React.FC<ToolResultCompressionSectionProps> = ({
  enabled,
  loading,
  draft,
  onEnabledChange,
  onChange,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-row">
        <div>
          <h3 className="settings-label">
            {t('settings.toolResultCompressionEnable') || 'Enable compression'}
          </h3>
          <p className="settings-help">
            {t('settings.toolResultCompressionDescription') ||
              'Reduce large text tool outputs before they reach MCP clients. Changes apply to the next tool call.'}
          </p>
        </div>
        <Switch
          disabled={loading}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      <div className="space-y-3">
        <div className="settings-block">
          <div className="mb-2">
            <h3 className="settings-label">
              {t('settings.toolResultCompressionStrategy') || 'Strategy'}
            </h3>
            <p className="settings-help">
              {t('settings.toolResultCompressionStrategyDescription') ||
                'Auto detects JSON, logs, search output, diffs, and plain text.'}
            </p>
          </div>
          <select
            value={draft.strategy}
            onChange={(e) => onChange('strategy', e.target.value)}
            className="hub-input"
            disabled={loading}
          >
            <option value="auto">Auto</option>
            <option value="json">JSON</option>
            <option value="log">Log</option>
            <option value="search">Search</option>
            <option value="diff">Diff</option>
            <option value="text">Text</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="settings-block">
            <div className="mb-2">
              <h3 className="settings-label">
                {t('settings.toolResultCompressionMinTokens') || 'Minimum tokens'}
              </h3>
              <p className="settings-help">
                {t('settings.toolResultCompressionMinTokensDescription') ||
                  'Only compress text blocks at or above this size.'}
              </p>
            </div>
            <input
              type="number"
              min="1"
              value={draft.minTokens}
              onChange={(e) => onChange('minTokens', e.target.value)}
              className="hub-input"
              disabled={loading}
            />
          </div>

          <div className="settings-block">
            <div className="mb-2">
              <h3 className="settings-label">
                {t('settings.toolResultCompressionMaxOutputTokens') ||
                  'Output token budget'}
              </h3>
              <p className="settings-help">
                {t('settings.toolResultCompressionMaxOutputTokensDescription') ||
                  'Target maximum tokens for each compressed text block.'}
              </p>
            </div>
            <input
              type="number"
              min="1"
              value={draft.maxOutputTokens}
              onChange={(e) => onChange('maxOutputTokens', e.target.value)}
              className="hub-input"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button onClick={onSave} disabled={loading} className="hub-btn primary">
          {t('common.save')}
        </button>
      </div>
    </>
  );
};

export default ToolResultCompressionSection;
