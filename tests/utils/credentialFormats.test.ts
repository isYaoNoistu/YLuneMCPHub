import {
  formatCredentialJson,
  inferCredentialFormat,
  validateCredentialFormats,
} from '../../src/utils/credentialFormats.js';
import { sanitizeFieldMap } from '../../src/utils/fieldMap.js';

describe('structured credential values', () => {
  it('preserves large integer literals and string contents when formatting', () => {
    const raw = '{"id":9007199254740993,"password":" x \\n y ","list":[true,null]}';
    const pretty = formatCredentialJson(raw);
    expect(pretty).toContain('9007199254740993');
    expect(pretty).toContain('" x \\n y "');
    expect(JSON.parse(pretty)).toEqual(JSON.parse(raw));
  });
  it('validates modes without echoing JSON secrets', () => {
    expect(() =>
      validateCredentialFormats({ CONFIG: '{"secret":"DO_NOT_ECHO"' }, { CONFIG: 'json' }),
    ).toThrow(/Invalid JSON/);
    try {
      validateCredentialFormats({ CONFIG: '{"secret":"DO_NOT_ECHO"' }, { CONFIG: 'json' });
    } catch (e) {
      expect(String(e)).not.toContain('DO_NOT_ECHO');
    }
    expect(() => validateCredentialFormats({ A: 'x' }, { A: 'file' })).toThrow();
    expect(() => validateCredentialFormats({ A: 'x' }, { B: 'text' })).toThrow();
  });
  it('preserves whitespace and supports larger bounded JSON and PEM', () => {
    const value = ' \r\n' + 'a'.repeat(12000) + '\n ';
    expect(sanitizeFieldMap({ PEM: value }).PEM).toBe(value);
    expect(() => sanitizeFieldMap({ BIG: 'a'.repeat(65537) })).toThrow();
    expect(() => sanitizeFieldMap({ BIG: '汉'.repeat(22000) })).toThrow();
    expect(() =>
      sanitizeFieldMap(
        Object.fromEntries(Array.from({ length: 5 }, (_, i) => ['K' + i, 'a'.repeat(65536)])),
      ),
    ).toThrow();
  });
  it('detects legacy JSON and multiline strings without treating every token as JSON', () => {
    expect(inferCredentialFormat('CONFIG', '{"a":1}')).toBe('json');
    expect(inferCredentialFormat('PEM', 'a\nb')).toBe('multiline');
    expect(inferCredentialFormat('TOKEN', '123')).toBe('text');
  });
});
