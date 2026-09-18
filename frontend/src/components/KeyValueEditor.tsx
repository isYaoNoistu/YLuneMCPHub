import { useTranslation } from 'react-i18next';
import { useId, useState } from 'react';
import {
  formatCredentialJson,
  inferCredentialFormat,
  jsonIssue,
  utf8Length,
  FIELD_VALUE_BYTES,
  type CredentialFormat,
} from '../../../src/utils/credentialFormats';

export type KvPair = { key: string; value: string; format?: CredentialFormat };

export const emptyPairs = (count = 1): KvPair[] =>
  Array.from({ length: count }, () => ({ key: '', value: '' }));

export const keysToEmptyPairs = (keys: string[]): KvPair[] => {
  if (!keys.length) {
    return emptyPairs(1);
  }
  return keys.map((key) => ({ key, value: '' }));
};

export const recordToPairs = (record: Record<string, string>): KvPair[] => {
  const entries = Object.entries(record);
  if (!entries.length) {
    return emptyPairs(1);
  }
  return entries.map(([key, value]) => ({ key, value }));
};

export const pairsToRecord = (pairs: KvPair[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const row of pairs) {
    const key = row.key.trim();
    if (!key) {
      continue;
    }
    out[key] = row.value;
  }
  return out;
};

export const collectFilledPairs = (
  pairs: KvPair[],
): { fields: Record<string, string> } | { error: 'empty' | 'incomplete' } => {
  const fields: Record<string, string> = {};
  for (const row of pairs) {
    const key = row.key.trim();
    const emptyValue = row.value === '';
    if (!key && emptyValue) {
      continue;
    }
    if (!key || emptyValue) {
      return { error: 'incomplete' };
    }
    fields[key] = row.value;
  }
  if (Object.keys(fields).length === 0) {
    return { error: 'empty' };
  }
  return { fields };
};

interface KeyValueEditorProps {
  structured?: boolean;
  pairs: KvPair[];
  onChange: (pairs: KvPair[]) => void;
  label: string;
  hint?: string;
  secret?: boolean;
  disabled?: boolean;
  lockedKeys?: string[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

const KeyValueEditor = ({
  pairs,
  onChange,
  label,
  hint,
  secret = false,
  disabled = false,
  lockedKeys = [],
  keyPlaceholder,
  valuePlaceholder,
  structured = false,
}: KeyValueEditorProps) => {
  const { t } = useTranslation();
  const editorId = useId();
  const [hidden, setHidden] = useState<Record<number, boolean>>({});
  const locked = new Set(lockedKeys);

  const update = (index: number, patch: Partial<KvPair>) => {
    const next = [...pairs];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="ylune-label" style={{ marginBottom: 0 }}>
          {label}
        </label>
        <button
          type="button"
          className="hub-icon-btn"
          disabled={disabled}
          onClick={() => onChange([...pairs, { key: '', value: '' }])}
          aria-label={t('credentials.addField')}
        >
          +
        </button>
      </div>
      {hint ? (
        <p className="ylune-help" style={{ marginTop: 4, marginBottom: 0 }}>
          {hint}
        </p>
      ) : null}
      {pairs.map((row, index) => {
        const keyLocked = locked.has(row.key);
        if (structured) {
          const format = row.format || inferCredentialFormat(row.key, row.value);
          const issue = format === 'json' && row.value ? jsonIssue(row.value) : null;
          const size = utf8Length(row.value);
          const invalid = Boolean(issue) || size > FIELD_VALUE_BYTES;
          const id = `${editorId}-${index}`;
          return (
            <div key={index} className="ylune-credential-field">
              <div className="ylune-credential-field-header">
                <input
                  className="hub-input"
                  aria-label={t('credentials.fieldKey')}
                  value={row.key}
                  readOnly={keyLocked}
                  disabled={disabled}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={keyPlaceholder || t('credentials.fieldKey')}
                  onChange={(event) => update(index, { key: event.target.value })}
                />
                <select
                  className="hub-input"
                  aria-label={t('credentials.editor.mode')}
                  value={format}
                  disabled={disabled}
                  onChange={(event) =>
                    update(index, { format: event.target.value as CredentialFormat })
                  }
                >
                  {(['text', 'multiline', 'json'] as const).map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`credentials.editor.${mode}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hub-icon-btn sm"
                  aria-label={t('common.delete')}
                  disabled={disabled || keyLocked}
                  onClick={() => {
                    const next = pairs.filter((_, i) => i !== index);
                    onChange(next.length ? next : emptyPairs(1));
                    setHidden({});
                  }}
                >
                  −
                </button>
              </div>
              {hidden[index] ? (
                <input
                  className="hub-input"
                  aria-label={t('credentials.fieldValue')}
                  type="password"
                  value={row.value ? '••••••••' : ''}
                  readOnly
                />
              ) : (
                <textarea
                  id={id}
                  className={`hub-input ylune-credential-value${format === 'json' ? ' is-json' : ''}`}
                  aria-label={t('credentials.fieldValue')}
                  aria-invalid={invalid}
                  aria-describedby={`${id}-status`}
                  rows={format === 'text' ? 2 : 8}
                  value={row.value}
                  disabled={disabled}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={valuePlaceholder || t('credentials.fieldValue')}
                  onChange={(event) => update(index, { value: event.target.value })}
                />
              )}
              <div className="ylune-credential-field-footer">
                <div className="ylune-credential-field-actions">
                  <button
                    type="button"
                    className="hub-btn"
                    disabled={disabled}
                    onClick={() =>
                      setHidden((previous) => ({ ...previous, [index]: !previous[index] }))
                    }
                  >
                    {t(hidden[index] ? 'credentials.editor.show' : 'credentials.editor.hide')}
                  </button>
                  {format === 'json' && (
                    <button
                      type="button"
                      className="hub-btn"
                      disabled={
                        disabled || !row.value || Boolean(issue) || size > FIELD_VALUE_BYTES
                      }
                      onClick={() => update(index, { value: formatCredentialJson(row.value) })}
                    >
                      {t('credentials.editor.format')}
                    </button>
                  )}
                </div>
                <span className="ylune-help">{(size / 1024).toFixed(1)} / 64 KiB</span>
              </div>
              <p
                id={`${id}-status`}
                className={invalid ? 'ylune-error' : 'ylune-help'}
                role={invalid ? 'alert' : undefined}
              >
                {size > FIELD_VALUE_BYTES
                  ? t('credentials.editor.errors.size')
                  : issue
                    ? issue.line
                      ? t('credentials.editor.jsonPosition', {
                          line: issue.line,
                          column: issue.column,
                        })
                      : t('credentials.editor.errors.json')
                    : t(
                        format === 'json' && row.value
                          ? 'credentials.editor.validJson'
                          : 'credentials.editor.preserve',
                      )}
              </p>
            </div>
          );
        }
        return (
          <div key={index} className="ylune-kv-row">
            <input
              className={`hub-input${keyLocked ? ' is-locked' : ''}`}
              value={row.key}
              readOnly={keyLocked || disabled}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder={keyPlaceholder || t('credentials.fieldKey')}
              onChange={(event) => update(index, { key: event.target.value })}
            />
            <span>:</span>
            <input
              className="hub-input"
              type={secret ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={row.value}
              placeholder={valuePlaceholder || t('credentials.fieldValue')}
              onChange={(event) => update(index, { value: event.target.value })}
            />
            <button
              type="button"
              className="hub-icon-btn sm"
              aria-label={t('common.delete')}
              disabled={keyLocked || disabled}
              onClick={() => {
                if (keyLocked) {
                  return;
                }
                const next = pairs.filter((_, itemIndex) => itemIndex !== index);
                onChange(next.length ? next : emptyPairs(1));
              }}
            >
              -
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default KeyValueEditor;
