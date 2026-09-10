import {
  createCredentialLease,
  clearCredentialLeases,
  peekCredentialLease,
  LEASE_TTL_MS,
} from '../../src/services/credentialBrokerService.js';

describe('credentialBrokerService', () => {
  afterEach(() => {
    clearCredentialLeases();
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
    expect(JSON.stringify(lease)).not.toMatch(/password|token/i);
    expect(peekCredentialLease(lease.id)?.targetName).toBe('energy-prod');
  });
});
