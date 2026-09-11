import { useTranslation } from 'react-i18next';
import { CredentialContract, UserServerCredential } from '@/types';

interface McpCredentialAssignProps {
  contracts: CredentialContract[];
  value: UserServerCredential[];
  onChange: (next: UserServerCredential[]) => void;
  disabled?: boolean;
}

const McpCredentialAssign = ({
  contracts,
  value,
  onChange,
  disabled,
}: McpCredentialAssignProps) => {
  const { t } = useTranslation();
  const rows = contracts.filter(
    (contract) => contract.credentials.length > 0 || contract.neededKeys.length > 0,
  );

  if (rows.length === 0) {
    return <p className="ylune-help">{t('users.noCredentialBound')}</p>;
  }

  const setForServer = (serverName: string, credentialIds: string[]) => {
    const rest = value.filter((row) => row.serverName !== serverName);
    onChange([
      ...rest,
      ...credentialIds.map((credentialId) => ({ serverName, credentialId })),
    ]);
  };

  const toggle = (serverName: string, credentialId: string) => {
    const current = value
      .filter((row) => row.serverName === serverName)
      .map((row) => row.credentialId);
    setForServer(
      serverName,
      current.includes(credentialId)
        ? current.filter((id) => id !== credentialId)
        : [...current, credentialId],
    );
  };

  return (
    <div className="mcp-assign-list">
      {rows.map((contract) => {
        const selected = new Set(
          value.filter((row) => row.serverName === contract.serverName).map((row) => row.credentialId),
        );
        const allSelected =
          contract.credentials.length > 0 &&
          contract.credentials.every((credential) => selected.has(credential.id));
        return (
          <div key={contract.serverName} className="mcp-assign-block">
            <div className="mcp-assign-head">
              <div className="mcp-assign-name">{contract.serverName}</div>
              {contract.credentials.length > 0 && (
                <button
                  type="button"
                  className="ylune-link-btn"
                  disabled={disabled}
                  onClick={() =>
                    setForServer(
                      contract.serverName,
                      allSelected ? [] : contract.credentials.map((credential) => credential.id),
                    )
                  }
                >
                  {allSelected ? t('groups.selectNone') : t('groups.selectAll')}
                </button>
              )}
            </div>
            {contract.credentials.length === 0 ? (
              <p className="ylune-help">{t('users.noCredentialBound')}</p>
            ) : (
              <div className="mcp-assign-checks">
                {contract.credentials.map((credential) => (
                  <label key={credential.id} className="ylune-check">
                    <input
                      type="checkbox"
                      checked={selected.has(credential.id)}
                      disabled={disabled}
                      onChange={() => toggle(contract.serverName, credential.id)}
                    />
                    {credential.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default McpCredentialAssign;
