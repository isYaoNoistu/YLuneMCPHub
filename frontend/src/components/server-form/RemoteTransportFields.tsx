import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnvVar, ServerFormData } from '@/types';
import type { KeyValueField, RemoteServerType } from './types';

interface RemoteTransportFieldsProps {
  serverType: RemoteServerType;
  formData: ServerFormData;
  headerVars: EnvVar[];
  envVars: EnvVar[];
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddHeaderVar: () => void;
  onHeaderVarChange: (index: number, field: KeyValueField, value: string) => void;
  onRemoveHeaderVar: (index: number) => void;
  onAddEnvVar: () => void;
  onEnvVarChange: (index: number, field: KeyValueField, value: string) => void;
  onRemoveEnvVar: (index: number) => void;
}

const RemoteTransportFields = ({
  serverType,
  formData,
  headerVars,
  envVars,
  onInputChange,
  onAddHeaderVar,
  onHeaderVarChange,
  onRemoveHeaderVar,
  onAddEnvVar,
  onEnvVarChange,
  onRemoveEnvVar,
}: RemoteTransportFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4">
        <label className="ylune-label" htmlFor="url">
          {t('server.url')}
        </label>
        <input
          type="url"
          name="url"
          id="url"
          value={formData.url}
          onChange={onInputChange}
          className="hub-input"
          placeholder={
            serverType === 'streamable-http'
              ? 'e.g.: http://localhost:3000/mcp'
              : 'e.g.: http://localhost:3000/sse'
          }
          required={serverType === 'sse' || serverType === 'streamable-http'}
        />
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="ylune-label">{t('server.headers')}</label>
          <button type="button" onClick={onAddHeaderVar} className="hub-icon-btn">
            +
          </button>
        </div>
        {headerVars.length === 0 && (
          <div className="ylune-kv-empty">{t('server.headersEmpty')}</div>
        )}
        {headerVars.map((headerVar, index) => (
          <div key={index} className="ylune-kv-row">
            <input
              type="text"
              value={headerVar.key}
              onChange={(event) => onHeaderVarChange(index, 'key', event.target.value)}
              className="hub-input"
              placeholder="Authorization"
            />
            <span>:</span>
            <input
              type="text"
              value={headerVar.value}
              onChange={(event) => onHeaderVarChange(index, 'value', event.target.value)}
              className="hub-input"
              placeholder="Bearer token..."
            />
            <button
              type="button"
              onClick={() => onRemoveHeaderVar(index)}
              className="hub-icon-btn sm"
              aria-label="remove"
            >
              -
            </button>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="ylune-label">{t('server.envVars')}</label>
          <button
            type="button"
            onClick={onAddEnvVar}
            className="hub-icon-btn"
            aria-label="add"
          >
            +
          </button>
        </div>
        {envVars.length === 0 && (
          <div className="ylune-kv-empty">{t('server.envVarsEmpty')}</div>
        )}
        {envVars.map((envVar, index) => (
          <div key={index} className="ylune-kv-row">
            <input
              type="text"
              value={envVar.key}
              onChange={(event) => onEnvVarChange(index, 'key', event.target.value)}
              className="hub-input"
              placeholder={t('server.key')}
            />
            <span>:</span>
            <input
              type="text"
              value={envVar.value}
              onChange={(event) => onEnvVarChange(index, 'value', event.target.value)}
              className="hub-input"
              placeholder={t('server.value')}
            />
            <button
              type="button"
              onClick={() => onRemoveEnvVar(index)}
              className="hub-icon-btn sm"
              aria-label="remove"
            >
              -
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default RemoteTransportFields;
