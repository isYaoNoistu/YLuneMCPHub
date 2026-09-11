import { CredentialContract, IGroupServerConfig, UserServerCredential } from '@/types';

export const missingRequiredCredentials = (
  grants: IGroupServerConfig[],
  contracts: CredentialContract[],
  picks: UserServerCredential[],
): string[] => {
  const granted = new Set(grants.map((grant) => grant.name));
  const picked = new Set(picks.map((row) => row.serverName));
  return contracts
    .filter(
      (contract) =>
        granted.has(contract.serverName) && contract.credentialIds.length > 0 && !picked.has(contract.serverName),
    )
    .map((contract) => contract.serverName);
};
