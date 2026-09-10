/**
 * Generic name/value maps for credentials and targets.
 * Callers choose the keys; the hub does not ship per-product schemas.
 */

export const FIELD_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const MAX_FIELD_COUNT = 64;
export const MAX_FIELD_VALUE_LENGTH = 8192;

export class FieldMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldMapError';
  }
}

export type FieldMapOptions = {
  trimValues?: boolean;
  allowEmptyValues?: boolean;
};

const toStringValue = (value: unknown, trim: boolean): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return null;
  }
  const text = typeof value === 'string' ? value : String(value);
  return trim ? text.trim() : text;
};

const asObject = (input: unknown): Record<string, unknown> => {
  if (Array.isArray(input)) {
    const obj: Record<string, unknown> = {};
    const seen = new Set<string>();
    for (const row of input) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        continue;
      }
      const rawKey = (row as { key?: unknown }).key;
      const key = typeof rawKey === 'string' ? rawKey.trim() : '';
      if (!key) {
        continue;
      }
      if (seen.has(key)) {
        throw new FieldMapError(`Duplicate field: ${key}`);
      }
      seen.add(key);
      obj[key] = (row as { value?: unknown }).value;
    }
    return obj;
  }
  if (input && typeof input === 'object') {
    return input as Record<string, unknown>;
  }
  return {};
};

/** Lenient read path (existing rows). Drops invalid keys instead of failing. */
export const coerceFieldMap = (
  input: unknown,
  options: FieldMapOptions = {},
): Record<string, string> => {
  const trimValues = options.trimValues === true;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!FIELD_KEY_RE.test(key)) {
      continue;
    }
    const value = toStringValue(rawValue, trimValues);
    if (value === null || value === '') {
      continue;
    }
    out[key] = value;
  }
  return out;
};

/** Strict write path. Empty maps and illegal names fail. */
export const sanitizeFieldMap = (
  input: unknown,
  options: FieldMapOptions = {},
): Record<string, string> => {
  const trimValues = options.trimValues === true;
  const allowEmptyValues = options.allowEmptyValues === true;
  const raw = asObject(input);
  const out: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    if (!FIELD_KEY_RE.test(key)) {
      throw new FieldMapError(`Invalid field name: ${key}`);
    }
    if (rawValue !== null && rawValue !== undefined && typeof rawValue === 'object') {
      throw new FieldMapError(`Field ${key} must be a string`);
    }
    const value = toStringValue(rawValue, trimValues);
    if (value === null) {
      throw new FieldMapError(`Field ${key} must be a string`);
    }
    if (!allowEmptyValues && value === '') {
      throw new FieldMapError(`Field ${key} cannot be empty`);
    }
    if (value.length > MAX_FIELD_VALUE_LENGTH) {
      throw new FieldMapError(`Field ${key} is too long`);
    }
    if (key in out) {
      throw new FieldMapError(`Duplicate field: ${key}`);
    }
    out[key] = value;
  }

  const count = Object.keys(out).length;
  if (count === 0) {
    throw new FieldMapError('At least one field is required');
  }
  if (count > MAX_FIELD_COUNT) {
    throw new FieldMapError(`At most ${MAX_FIELD_COUNT} fields are allowed`);
  }
  return out;
};

/**
 * Decrypt envelope: `{ fields: { KEY: value } }`.
 * Legacy rows used `{ username, password }` or `{ token }`.
 */
export const payloadToCredentialFields = (payload: unknown): Record<string, string> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new FieldMapError('Credential payload is invalid');
  }
  const raw = payload as Record<string, unknown>;
  if (raw.fields && typeof raw.fields === 'object') {
    return sanitizeFieldMap(raw.fields, { trimValues: false });
  }
  const legacy: Record<string, unknown> = {};
  if (typeof raw.username === 'string' && raw.username) {
    legacy.username = raw.username;
  }
  if (typeof raw.password === 'string' && raw.password) {
    legacy.password = raw.password;
  }
  if (typeof raw.token === 'string' && raw.token) {
    legacy.token = raw.token;
  }
  return sanitizeFieldMap(legacy, { trimValues: false });
};
