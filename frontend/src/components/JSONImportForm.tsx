import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '@/utils/fetchInterceptor';
import { ImportJsonFormat, normalizeImportedServers } from '../utils/jsonImport';
import YluneDialog from './ui/YluneDialog';

interface JSONImportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const JSONImportForm: React.FC<JSONImportFormProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewServers, setPreviewServers] = useState<Array<{ name: string; config: any }> | null>(
    null,
  );

  const examplePlaceholder = `{
  "mcpServers": {
    "stdio-server-example": {
      "command": "npx",
      "args": ["-y", "mcp-server-example"]
    },
    "sse-server-example": {
      "type": "sse",
      "url": "http://localhost:3000"
    },
    "http-server-example": {
      "type": "streamable-http",
      "url": "http://localhost:3001",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer your-token"
      }
    },
    "openapi-server-example": {
      "type": "openapi",
      "openapi": {
        "url": "https://petstore.swagger.io/v2/swagger.json"
      }
    }
  }
}

Supports: STDIO, SSE, HTTP (streamable-http), OpenAPI
All servers will be imported in a single efficient batch operation.`;

  const parseAndValidateJson = (input: string): ImportJsonFormat | null => {
    try {
      const parsed = JSON.parse(input.trim());

      // Validate structure
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        setError(t('jsonImport.invalidFormat'));
        return null;
      }

      return parsed as ImportJsonFormat;
    } catch (e) {
      setError(t('jsonImport.parseError'));
      return null;
    }
  };

  const handlePreview = () => {
    setError(null);
    const parsed = parseAndValidateJson(jsonInput);
    if (!parsed) return;

    const { servers, issues } = normalizeImportedServers(parsed);

    if (issues.length > 0) {
      const details = issues.map((issue) => `${issue.name}: ${issue.message}`).join('\n');
      setError(t('jsonImport.validationErrors') + '\n' + details);
      if (servers.length === 0) {
        return;
      }
    }

    setPreviewServers(servers);
  };

  const handleImport = async () => {
    if (!previewServers) return;

    setIsImporting(true);
    setError(null);

    try {
      // Use batch import API for better performance
      const result = await apiPost('/servers/batch', {
        servers: previewServers,
      });

      if (result.success && result.data) {
        const { successCount, failureCount, results } = result.data;

        if (failureCount > 0) {
          const errors = results
            .filter((r: any) => !r.success)
            .map((r: any) => `${r.name}: ${r.message || t('jsonImport.addFailed')}`);

          setError(
            t('jsonImport.partialSuccess', { count: successCount, total: previewServers.length }) +
              '\n' +
              errors.join('\n'),
          );
        }

        if (successCount > 0) {
          onSuccess();
        }
      } else {
        setError(result.message || t('jsonImport.importFailed'));
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(t('jsonImport.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <YluneDialog
      size="xl"
      title={t('jsonImport.title')}
      onClose={onCancel}
      footer={
        !previewServers ? (
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
              {t('jsonImport.preview')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPreviewServers(null)}
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
              {isImporting ? t('jsonImport.importing') : t('jsonImport.import')}
            </button>
          </>
        )
      }
    >
      {error && <div className="ylune-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

      {!previewServers ? (
        <div>
          <label className="ylune-label">{t('jsonImport.inputLabel')}</label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="hub-input area mono"
            style={{ minHeight: 280 }}
            placeholder={examplePlaceholder}
          />
          <p className="ylune-help">{t('jsonImport.inputHelp')}</p>
        </div>
      ) : (
        <div>
          <h3 className="ylune-section">{t('jsonImport.previewTitle')}</h3>
          {previewServers.map((server, index) => (
            <div key={index} className="ylune-preview">
              <h4>{server.name}</h4>
              <p className="ylune-help" style={{ margin: 0 }}>
                {t('server.type')}: {server.config.type || 'stdio'}
                {server.config.command ? ` · ${t('server.command')}: ${server.config.command}` : ''}
                {server.config.args?.length ? ` · ${t('server.arguments')}: ${server.config.args.join(' ')}` : ''}
                {server.config.url ? ` · ${t('server.url')}: ${server.config.url}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </YluneDialog>
  );
};

export default JSONImportForm;
