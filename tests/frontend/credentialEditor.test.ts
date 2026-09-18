import { collectCredentialPairs } from '../../frontend/src/utils/credentialEditor';

describe('credential editor submission', () => {
  it('preserves values and carries explicit modes for reopening', () => {
    expect(
      collectCredentialPairs([
        { key: ' CONFIG ', value: '{"n":9007199254740993}', format: 'json' },
        { key: 'PEM', value: ' line1\r\nline2\n ', format: 'multiline' },
      ]),
    ).toEqual({
      fields: { CONFIG: '{"n":9007199254740993}', PEM: ' line1\r\nline2\n ' },
      formats: { CONFIG: 'json', PEM: 'multiline' },
    });
  });
  it('rejects duplicate keys instead of silently replacing a credential', () => {
    expect(
      collectCredentialPairs([
        { key: 'TOKEN', value: 'a' },
        { key: ' TOKEN ', value: 'b' },
      ]),
    ).toEqual({ error: 'duplicate' });
  });
  it('rejects invalid JSON, invalid names and oversized values before submission', () => {
    expect(collectCredentialPairs([{ key: 'CONFIG', value: '{', format: 'json' }])).toEqual({
      error: 'json',
    });
    expect(collectCredentialPairs([{ key: '1NAME', value: 'x' }])).toEqual({ error: 'key' });
    expect(collectCredentialPairs([{ key: 'TOKEN', value: 'x'.repeat(65537) }])).toEqual({
      error: 'size',
    });
  });
});
