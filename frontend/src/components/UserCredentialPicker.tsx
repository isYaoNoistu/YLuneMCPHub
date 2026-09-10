import { useTranslation } from 'react-i18next';
import { CredentialContract, IGroupServerConfig, UserServerCredential } from '@/types';

interface UserCredentialPickerProps {
  grants: IGroupServerConfig[];
  contracts: CredentialContract[];
  value: UserServerCredential[];
  onChange: (next: UserServerCredential[]) => void;
  disabled?: boolean;
}

const UserCredentialPicker = ({
  grants,
  contracts,
  value,
  onChange,
  disabled,
}: UserCredentialPickerProps) => {
  const { t } = useTranslation();
  const grantedNames = grants.map((grant) => grant.name);
  const relevant = contracts.filter(
    (contract) =>
      grantedNames.includes(contract.serverName) &&
      (contract.credentialIds.length > 0 || contract.neededKeys.length > 0),
  );

  if (relevant.length === 0) {
    return null;
  }

  const setPick = (serverName: string, credentialId: string) => {
    const rest = value.filter((row) => row.serverName !== serverName);
    if (!credentialId) {
      onChange(rest);
      return;
    }
    onChange([...rest, { serverName, credentialId }]);
  };

  return (
    <div>
      <label className="ylune-label">{t('users.serverCredentials')}</label>
      <p className="ylune-help">{t('users.serverCredentialsHint')}</p>
      {relevant.map((contract) => {
        const current = value.find((row) => row.serverName === contract.serverName)?.credentialId || '';
        const needsPick = contract.credentialIds.length > 0;
        return (
          <div key={contract.serverName} style={{ marginBottom: 10 }}>
            <label className="ylune-label">
              {contract.serverName}
              {needsPick ? <span className="ylune-req"> *</span> : null}
            </label>
            {contract.neededKeys.length > 0 && (
              <div className="hub-key-chips" style={{ marginBottom: 6 }}>
                {contract.neededKeys.map((key) => (
                  <span key={key} className="hub-kbd">
                    {key}
                  </span>
                ))}
              </div>
            )}
            {needsPick ? (
              <select
                className="hub-input"
                value={current}
                disabled={disabled}
                onChange={(event) => setPick(contract.serverName, event.target.value)}
              >
                <option value="">{t('users.pickCredential')}</option>
                {contract.credentials.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="ylune-help">{t('users.noCredentialBound')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const missingRequiredCredentials = (
  grants: IGroupServerConfig[],
  contracts: CredentialContract[],
  picks: UserServerCredential[],
): string[] => {
  const granted = new Set(grants.map((grant) => grant.name));
  const picked = new Set(picks.map((row) => row.serverName));
  return contracts
    .filter(
      (contract) => granted.has(contract.serverName) && contract.credentialIds.length > 0 && !picked.has(contract.serverName),
    )
    .map((contract) => contract.serverName);
};

export default UserCredentialPicker;
