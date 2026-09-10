import { FieldMapError, payloadToCredentialFields, sanitizeFieldMap } from '../../src/utils/fieldMap.js';

describe('fieldMap', () => {
  it('accepts custom keys and stringifies numbers', () => {
    expect(
      sanitizeFieldMap({ HOST: 'db.internal', PORT: 5432, OPTIONS: 'sslmode=require' }, { trimValues: true }),
    ).toEqual({
      HOST: 'db.internal',
      PORT: '5432',
      OPTIONS: 'sslmode=require',
    });
  });

  it('rejects empty maps and illegal names', () => {
    expect(() => sanitizeFieldMap({})).toThrow(FieldMapError);
    expect(() => sanitizeFieldMap({ 'pg-host': 'x' })).toThrow(/Invalid field name/);
  });

  it('reads array rows', () => {
    expect(
      sanitizeFieldMap([
        { key: 'PGUSER', value: 'ro' },
        { key: 'PGPASSWORD', value: 's3cret' },
      ]),
    ).toEqual({ PGUSER: 'ro', PGPASSWORD: 's3cret' });
  });

  it('maps legacy credential envelopes', () => {
    expect(payloadToCredentialFields({ username: 'ro', password: 'x' })).toEqual({
      username: 'ro',
      password: 'x',
    });
    expect(payloadToCredentialFields({ token: 'abc' })).toEqual({ token: 'abc' });
    expect(payloadToCredentialFields({ fields: { JENKINS_TOKEN: 'abc' } })).toEqual({
      JENKINS_TOKEN: 'abc',
    });
  });
});
