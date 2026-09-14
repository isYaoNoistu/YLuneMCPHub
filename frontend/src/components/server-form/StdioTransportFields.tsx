import { useTranslation } from 'react-i18next';
import type { EnvVar, ServerFormData } from '@/types';
import type { KeyValueField } from './types';

interface StdioTransportFieldsProps {
  formData: ServerFormData;
  envVars: EnvVar[];
  onCommandChange: (value: string) => void;
  onArgsChange: (value: string) => void;
  onAddEnvVar: () => void;
  onEnvVarChange: (index: number, field: KeyValueField, value: string) => void;
  onRemoveEnvVar: (index: number) => void;
}

const StdioTransportFields = ({
  formData,
  envVars,
  onCommandChange,
  onArgsChange,
  onAddEnvVar,
  onEnvVarChange,
  onRemoveEnvVar,
}: StdioTransportFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4">
        <label className="ylune-label" htmlFor="command">
          {t('server.command')}
        </label>
        <input
          type="text"
          name="command"
          id="command"
          value={formData.command}
          onChange={(event) => onCommandChange(event.target.value)}
          className="hub-input"
          placeholder="e.g.: npx"
          required
        />
      </div>
      <div className="mb-4">
        <label className="ylune-label" htmlFor="arguments">
          {t('server.arguments')}
        </label>
        <input
          type="text"
          name="arguments"
          id="arguments"
          value={formData.arguments}
          onChange={(event) => onArgsChange(event.target.value)}
          className="hub-input"
          placeholder="e.g.: -y time-mcp"
        />
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

export default StdioTransportFields;
