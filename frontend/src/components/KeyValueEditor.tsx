import { useTranslation } from 'react-i18next';

export type KvPair = { key: string; value: string };

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
  pairs: KvPair[];
  onChange: (pairs: KvPair[]) => void;
  label: string;
  hint?: string;
  secret?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

const KeyValueEditor = ({
  pairs,
  onChange,
  label,
  hint,
  secret = false,
  keyPlaceholder,
  valuePlaceholder,
}: KeyValueEditorProps) => {
  const { t } = useTranslation();

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
      {pairs.map((row, index) => (
        <div key={index} className="ylune-kv-row">
          <input
            className="hub-input"
            value={row.key}
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
            value={row.value}
            placeholder={valuePlaceholder || t('credentials.fieldValue')}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <button
            type="button"
            className="hub-icon-btn sm"
            aria-label={t('common.delete')}
            onClick={() => {
              const next = pairs.filter((_, itemIndex) => itemIndex !== index);
              onChange(next.length ? next : emptyPairs(1));
            }}
          >
            -
          </button>
        </div>
      ))}
    </div>
  );
};

export default KeyValueEditor;
