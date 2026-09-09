import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '@/utils/fetchInterceptor';
import YluneDialog from './ui/YluneDialog';

interface GroupImportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ImportGroupConfig {
  name: string;
  description?: string;
  servers?: string[] | Array<{
    name: string;
    tools?: string[] | 'all';
    prompts?: string[] | 'all';
    resources?: string[] | 'all';
  }>;
}

interface ImportJsonFormat {
  groups: ImportGroupConfig[];
}

const GroupImportForm: React.FC<GroupImportFormProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewGroups, setPreviewGroups] = useState<ImportGroupConfig[] | null>(null);

  const examplePlaceholder = `{
  "groups": [
    {
      "name": "AI Assistants",
      "servers": ["openai-server", "anthropic-server"]
    },
    {
      "name": "Development Tools",
      "servers": [
        {
          "name": "github-server",
          "tools": ["create_issue", "list_repos"],
          "prompts": ["triage_prompt"],
          "resources": ["resource://docs/repo-guide"]
        },
        {
          "name": "gitlab-server",
          "tools": "all",
          "prompts": "all",
          "resources": "all"
        }
      ]
    }
  ]
}

Supports:
- Simple server list: ["server1", "server2"]
- Advanced server config: [{"name": "server1", "tools": ["tool1"], "prompts": ["prompt1"], "resources": ["resource://docs/guide"]}]
- All groups will be imported in a single efficient batch operation.`;

  const parseAndValidateJson = (input: string): ImportJsonFormat | null => {
    try {
      const parsed = JSON.parse(input.trim());

      // Validate structure
      if (!parsed.groups || !Array.isArray(parsed.groups)) {
        setError(t('groupImport.invalidFormat'));
        return null;
      }

      // Validate each group
      for (const group of parsed.groups) {
        if (!group.name || typeof group.name !== 'string') {
          setError(t('groupImport.missingName'));
          return null;
        }
      }

      return parsed as ImportJsonFormat;
    } catch (e) {
      setError(t('groupImport.parseError'));
      return null;
    }
  };

  const handlePreview = () => {
    setError(null);
    const parsed = parseAndValidateJson(jsonInput);
    if (!parsed) return;

    setPreviewGroups(parsed.groups);
  };

  const handleImport = async () => {
    if (!previewGroups) return;

    setIsImporting(true);
    setError(null);

    try {
      // Use batch import API for better performance
      const result = await apiPost('/groups/batch', {
        groups: previewGroups,
      });

      if (result.success) {
        const { successCount, failureCount, results } = result;

        if (failureCount > 0) {
          const errors = results
            .filter((r: any) => !r.success)
            .map((r: any) => `${r.name}: ${r.message || t('groupImport.addFailed')}`);

          setError(
            t('groupImport.partialSuccess', { count: successCount, total: previewGroups.length }) +
              '\n' +
              errors.join('\n'),
          );
        }

        if (successCount > 0) {
          onSuccess();
        }
      } else {
        setError(result.message || t('groupImport.importFailed'));
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(t('groupImport.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const renderAllCapabilitiesLabel = (
    key: 'previewAllTools' | 'previewAllPrompts' | 'previewAllResources',
  ) => <span className="text-gray-500 ml-2">{t(`groups.${key}`)}</span>;

  const renderCapabilityPreview = (
    key: 'previewPrompts' | 'previewResources',
    value: string[] | 'all' | undefined,
  ) => {
    if (!value || value === 'all') {
      return null;
    }

    const items = Array.isArray(value) ? value.join(', ') : value;
    return <span className="text-gray-500 ml-2">{t(`groups.${key}`, { items })}</span>;
  };

  const renderServerList = (
    servers?: string[] | Array<{
      name: string;
      tools?: string[] | 'all';
      prompts?: string[] | 'all';
      resources?: string[] | 'all';
    }>,
  ) => {
    if (!servers || servers.length === 0) {
      return <span className="text-gray-500">{t('groups.noServers')}</span>;
    }

    return (
      <div className="space-y-1">
        {servers.map((server, idx) => {
          if (typeof server === 'string') {
            return (
              <div key={idx} className="text-sm">
                • {server}
              </div>
            );
          } else {
            return (
              <div key={idx} className="text-sm">
                • {server.name}
                {server.tools && server.tools !== 'all' && (
                  <span className="text-gray-500 ml-2">
                    ({Array.isArray(server.tools) ? server.tools.join(', ') : server.tools})
                  </span>
                )}
                {server.tools === 'all' && renderAllCapabilitiesLabel('previewAllTools')}
                {renderCapabilityPreview('previewPrompts', server.prompts)}
                {server.prompts === 'all' && renderAllCapabilitiesLabel('previewAllPrompts')}
                {renderCapabilityPreview('previewResources', server.resources)}
                {server.resources === 'all' && renderAllCapabilitiesLabel('previewAllResources')}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <YluneDialog
      size="xl"
      title={t('groupImport.title')}
      onClose={onCancel}
      footer={
        !previewGroups ? (
          <>
            <button type="button" onClick={onCancel} className="hub-btn">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!jsonInput.trim()}
              className="hub-btn primary"
            >
              {t('groupImport.preview')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPreviewGroups(null)}
              disabled={isImporting}
              className="hub-btn"
            >
              {t('common.back')}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
              className="hub-btn primary"
            >
              {isImporting ? t('groupImport.importing') : t('groupImport.import')}
            </button>
          </>
        )
      }
    >
      {error && <div className="ylune-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {!previewGroups ? (
        <div>
          <label className="ylune-label">{t('groupImport.inputLabel')}</label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="hub-input area mono"
            style={{ minHeight: 280 }}
            placeholder={examplePlaceholder}
          />
          <p className="ylune-help">{t('groupImport.inputHelp')}</p>
        </div>
      ) : (
        <div>
          <h3 className="ylune-section">{t('groupImport.previewTitle')}</h3>
          {previewGroups.map((group, index) => (
            <div key={index} className="ylune-preview">
              <h4>{group.name}</h4>
              {group.description && <p className="ylune-help">{group.description}</p>}
              <div className="ylune-help">{renderServerList(group.servers)}</div>
            </div>
          ))}
        </div>
      )}
    </YluneDialog>
  );
};

export default GroupImportForm;
