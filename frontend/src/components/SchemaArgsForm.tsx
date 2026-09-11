import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolInputSchema } from '@/types';

interface SchemaArgsFormProps {
  schema?: ToolInputSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

const SchemaArgsForm = ({ schema, value, onChange, disabled = false }: SchemaArgsFormProps) => {
  const { t } = useTranslation();
  const properties = schema?.properties || {};
  const required = schema?.required || [];
  const entries = useMemo(() => Object.entries(properties), [properties]);

  if (entries.length === 0) {
    return <p className="ylune-help">{t('lab.noSchema')}</p>;
  }

  const setField = (name: string, next: unknown) => {
    if (disabled) return;
    onChange({ ...value, [name]: next });
  };

  return (
    <div className="space-y-3">
      {entries.map(([name, raw]) => {
        const spec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const type = typeof spec.type === 'string' ? spec.type : 'string';
        const description = typeof spec.description === 'string' ? spec.description : '';
        const current = value[name];
        const isRequired = required.includes(name);
        if (type === 'boolean') {
          return (
            <label key={name} className="token-lifetime-option">
              <input
                type="checkbox"
                checked={Boolean(current)}
                onChange={(event) => setField(name, event.target.checked)}
                disabled={disabled}
              />
              {name}
              {isRequired ? ' *' : ''}
              {description ? <span className="ylune-help"> — {description}</span> : null}
            </label>
          );
        }
        if (type === 'number' || type === 'integer') {
          return (
            <div key={name}>
              <label className="ylune-label">
                {name}
                {isRequired ? ' *' : ''}
              </label>
              {description ? <p className="ylune-help">{description}</p> : null}
              <input
                className="hub-input"
                type="number"
                value={current === undefined || current === null ? '' : String(current)}
                onChange={(event) =>
                  setField(name, event.target.value === '' ? undefined : Number(event.target.value))
                }
                disabled={disabled}
                readOnly={disabled}
              />
            </div>
          );
        }
        if (type === 'object' || type === 'array') {
          return (
            <div key={name}>
              <label className="ylune-label">
                {name}
                {isRequired ? ' *' : ''}
              </label>
              {description ? <p className="ylune-help">{description}</p> : null}
              <textarea
                className="hub-input"
                rows={4}
                value={
                  typeof current === 'string' ? current : JSON.stringify(current ?? (type === 'array' ? [] : {}), null, 2)
                }
                onChange={(event) => {
                  try {
                    setField(name, JSON.parse(event.target.value));
                  } catch {
                    setField(name, event.target.value);
                  }
                }}
                disabled={disabled}
                readOnly={disabled}
              />
            </div>
          );
        }
        return (
          <div key={name}>
            <label className="ylune-label">
              {name}
              {isRequired ? ' *' : ''}
            </label>
            {description ? <p className="ylune-help">{description}</p> : null}
            <input
              className="hub-input"
              value={current === undefined || current === null ? '' : String(current)}
              onChange={(event) => setField(name, event.target.value)}
              disabled={disabled}
              readOnly={disabled}
            />
          </div>
        );
      })}
    </div>
  );
};

export const exampleFromSchema = (schema?: ToolInputSchema): Record<string, unknown> => {
  const properties = schema?.properties || {};
  const example: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(properties)) {
    const spec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (spec.example !== undefined) {
      example[name] = spec.example;
      continue;
    }
    if (Array.isArray(spec.examples) && spec.examples.length > 0) {
      example[name] = spec.examples[0];
      continue;
    }
    if (spec.default !== undefined) {
      example[name] = spec.default;
      continue;
    }
    const type = typeof spec.type === 'string' ? spec.type : 'string';
    if (type === 'boolean') example[name] = false;
    else if (type === 'number' || type === 'integer') example[name] = 0;
    else if (type === 'array') example[name] = [];
    else if (type === 'object') example[name] = {};
    else example[name] = '';
  }
  return example;
};

export default SchemaArgsForm;
