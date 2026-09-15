import {
  appendBoundCredentialId,
  boundCredentialIdSet,
  canBindAfterSuccess,
  missingNeededKeys,
  sortCredentialsByName,
} from '../../frontend/src/utils/connectionPreflight';
import type { Credential } from '../../frontend/src/types';

const cred = (id: string, name: string, keys: string[] = ['TOKEN']): Credential => ({
  id,
  name,
  enabled: true,
  keys,
  secretConfigured: true,
});

describe('connection preflight helpers', () => {
  it('sorts credentials by name then id', () => {
    expect(
      sortCredentialsByName([cred('b', 'Jenkins UAT'), cred('a', 'Jenkins Prod'), cred('c', 'Jenkins Prod')]).map(
        (item) => item.id,
      ),
    ).toEqual(['a', 'c', 'b']);
  });

  it('marks bound ids from the server contract', () => {
    expect(
      boundCredentialIdSet({
        serverName: 'jenkins',
        neededKeys: ['JENKINS_API_TOKEN'],
        credentialIds: ['cred-b', 'cred-a'],
        credentials: [],
      }),
    ).toEqual(new Set(['cred-a', 'cred-b']));
  });

  it('computes missing needed keys from public credential keys', () => {
    expect(
      missingNeededKeys(
        ['JENKINS_URL', 'JENKINS_USER', 'JENKINS_API_TOKEN'],
        ['JENKINS_URL', 'JENKINS_API_TOKEN'],
      ),
    ).toEqual(['JENKINS_USER']);
  });

  it('appends a tested credential id without removing existing bindings', () => {
    expect(appendBoundCredentialId(['cred-a'], 'cred-b')).toEqual(['cred-a', 'cred-b']);
    expect(appendBoundCredentialId(['cred-a'], 'cred-a')).toEqual(['cred-a']);
  });

  it('offers bind-after-success only for an unbound credential that just tested ok', () => {
    expect(canBindAfterSuccess('cred-b', ['cred-a'], true)).toBe(true);
    expect(canBindAfterSuccess('cred-a', ['cred-a'], true)).toBe(false);
    expect(canBindAfterSuccess('cred-b', ['cred-a'], false)).toBe(false);
    expect(canBindAfterSuccess(null, ['cred-a'], true)).toBe(false);
  });
});
