/** Browser-safe credential editor contract. Values remain opaque strings at runtime. */
export type CredentialFormat = 'text' | 'multiline' | 'json';
export const FIELD_VALUE_BYTES = 64 * 1024;
export const FIELD_TOTAL_BYTES = 256 * 1024;
export const utf8Length = (value: string): number => new TextEncoder().encode(value).length;

export const inferCredentialFormat = (key: string, value: string): CredentialFormat => {
  if (key.endsWith('_JSON') || /^[\s]*[[{]/.test(value)) return 'json';
  return /[\r\n]/.test(value) ? 'multiline' : 'text';
};

export const jsonIssue = (value: string): { line?: number; column?: number } | null => {
  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    // Never display engine error text: it may contain fragments of a password.
    const match = String(error).match(/position (\d+)/);
    if (!match) return {};
    const before = value.slice(0, Number(match[1])).split('\n');
    return { line: before.length, column: before[before.length - 1].length + 1 };
  }
};

export const validateCredentialFormats = (
  fields: Record<string, string>,
  input: unknown,
): Record<string, CredentialFormat> => {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid credential formats');
  const result: Record<string, CredentialFormat> = {};
  for (const [key, format] of Object.entries(input)) {
    if (
      !Object.prototype.hasOwnProperty.call(fields, key) ||
      typeof format !== 'string' ||
      !['text', 'multiline', 'json'].includes(format)
    ) {
      throw new Error('Invalid credential format');
    }
    if (format === 'json' && jsonIssue(fields[key]))
      throw new Error(`Invalid JSON in field ${key}`);
    result[key] = format as CredentialFormat;
  }
  return result;
};

/** Whitespace-only formatting: preserve number precision, duplicate keys and string escapes. */
export const formatCredentialJson = (value: string): string => {
  if (jsonIssue(value)) throw new Error('Invalid JSON');
  const tokens = value.match(/"(?:\\.|[^"\\])*"|[^\s{}[\],:]+|[{}[\],:]/g) || [];
  let depth = 0;
  let result = '';
  const newline = () => '\n' + '  '.repeat(Math.min(depth, 64));
  for (const [i, token] of tokens.entries()) {
    if (result.length > FIELD_VALUE_BYTES) return value;
    if (token === '{' || token === '[') {
      result += token;
      depth++;
      if (tokens[i + 1] !== (token === '{' ? '}' : ']')) result += newline();
    } else if (token === '}' || token === ']') {
      depth--;
      if (tokens[i - 1] !== (token === '}' ? '{' : '[')) result += newline();
      result += token;
    } else if (token === ',') result += token + newline();
    else if (token === ':') result += ': ';
    else result += token;
  }
  return utf8Length(result) <= FIELD_VALUE_BYTES ? result : value;
};
