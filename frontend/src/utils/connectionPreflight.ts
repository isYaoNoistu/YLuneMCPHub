import type { Credential, CredentialContract } from '../types';

export const sortCredentialsByName = (credentials: Credential[]): Credential[] =>
  [...credentials].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });

export const boundCredentialIdSet = (
  contract?: Pick<CredentialContract, 'credentialIds'> | null,
): Set<string> => new Set(contract?.credentialIds || []);

export const missingNeededKeys = (neededKeys: string[], credentialKeys: string[]): string[] => {
  const have = new Set(credentialKeys);
  return neededKeys.filter((key) => !have.has(key));
};

export const appendBoundCredentialId = (boundIds: string[], credentialId: string): string[] => [
  ...new Set([...boundIds, credentialId]),
];

export const canBindAfterSuccess = (
  credentialId: string | null | undefined,
  boundIds: string[],
  testSucceeded: boolean,
): boolean => Boolean(credentialId) && testSucceeded && !boundIds.includes(credentialId as string);
