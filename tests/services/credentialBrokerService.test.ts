import { randomBytes } from 'node:crypto';
import {
  createCredentialLease,
  clearCredentialLeases,
  peekCredentialLease,
  resolveCredentialLease,
  LEASE_TTL_MS,
} from '../../src/services/credentialBrokerService.js';
import { encryptJson, MASTER_KEY_ENV } from '../../src/utils/secretBox.js';

const originalKey = process.env[MASTER_KEY_ENV];

describe('credentialBrokerService', () => {
  afterEach(() => {
    clearCredentialLeases();
    if (originalKey === undefined) {
      delete process.env[MASTER_KEY_ENV];
    } else {
      process.env[MASTER_KEY_ENV] = originalKey;
    }
  });

  it('issues a short-lived lease without embedding a password', () => {
    const lease = createCredentialLease({
      username: 'alice',
      serverName: 'postgres',
      targetId: 't1',
      targetName: 'energy-prod',
      credentialId: 'c1',
      credentialName: 'pg-ro',
      credentialVersion: 2,
      resourceGroupId: 'g1',
      resourceGroupName: 'prod',
    });
    expect(lease.id).toBeTruthy();
    expect(lease.expiresAt - Date.now()).toBeLessThanOrEqual(LEASE_TTL_MS);
    expect(JSON.stringify(lease)).not.toMatch(/"password"|"token"/i);
    expect(peekCredentialLease(lease.id)?.targetName).toBe('energy-prod');
  });

  it('resolves a lease as a field map, not a typed username/password schema', async () => {
    process.env[MASTER_KEY_ENV] = randomBytes(32).toString('base64');
    const sealed = encryptJson({ fields: { PGUSER: 'ro', PGPASSWORD: 's3cret' } });
    const lease = createCredentialLease({
      username: 'alice',
      serverName: 'postgres',
      targetId: 't1',
      targetName: 'energy-prod',
      credentialId: 'c1',
      credentialName: 'pg-ro',
      credentialVersion: 2,
    });
    const resolved = await resolveCredentialLease(
      lease.id,
      {
        id: 't1',
        name: 'energy-prod',
        type: 'custom',
        config: { HOST: 'db.internal' },
        enabled: true,
      },
      {
        id: 'c1',
        name: 'pg-ro',
        type: 'fields',
        encryptedPayload: sealed.payload,
        keyVersion: sealed.keyVersion,
        enabled: true,
      },
    );
    expect(resolved.credential.fields).toEqual({ PGUSER: 'ro', PGPASSWORD: 's3cret' });
    expect(resolved.credential).not.toHaveProperty('password');
    expect(resolved.credential).not.toHaveProperty('username');
  });

  it('resolves a lease with no target id', async () => {
    process.env[MASTER_KEY_ENV] = randomBytes(32).toString('base64');
    const sealed = encryptJson({ fields: { N9E_TOKEN: 'n9e' } });
    const lease = createCredentialLease({
      username: 'alice',
      serverName: 'n9e',
      targetId: '',
      targetName: 'n9e',
      credentialId: 'c2',
      credentialName: 'n9e-ro',
      credentialVersion: 1,
    });
    const resolved = await resolveCredentialLease(
      lease.id,
      null,
      {
        id: 'c2',
        name: 'n9e-ro',
        type: 'fields',
        encryptedPayload: sealed.payload,
        keyVersion: sealed.keyVersion,
        enabled: true,
      },
    );
    expect(resolved.target).toBeNull();
    expect(resolved.credential.fields).toEqual({ N9E_TOKEN: 'n9e' });
  });
});
