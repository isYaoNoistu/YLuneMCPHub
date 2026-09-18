import {
  FIELD_VALUE_BYTES,
  FIELD_TOTAL_BYTES,
  utf8Length,
  inferCredentialFormat,
  jsonIssue,
  type CredentialFormat,
} from '../../../src/utils/credentialFormats';

export type CredentialPair = { key: string; value: string; format?: CredentialFormat };
export const collectCredentialPairs = (pairs: CredentialPair[]) => {
  const fields: Record<string, string> = Object.create(null);
  const formats: Record<string, CredentialFormat> = Object.create(null);
  let total = 0;
  for (const row of pairs) {
    const key = row.key.trim();
    if (!key && !row.value) continue;
    if (!key || !row.value) return { error: 'incomplete' as const };
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return { error: 'key' as const };
    if (Object.prototype.hasOwnProperty.call(fields, key)) return { error: 'duplicate' as const };
    if (utf8Length(row.value) > FIELD_VALUE_BYTES) return { error: 'size' as const };
    total += utf8Length(key) + utf8Length(row.value);
    const format = row.format || inferCredentialFormat(key, row.value);
    if (format === 'json' && jsonIssue(row.value)) return { error: 'json' as const };
    fields[key] = row.value;
    formats[key] = format;
  }
  if (!Object.keys(fields).length) return { error: 'incomplete' as const };
  if (Object.keys(fields).length > 64 || total > FIELD_TOTAL_BYTES)
    return { error: 'total' as const };
  return { fields, formats };
};
