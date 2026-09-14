import { useTranslation } from 'react-i18next';
import type {
  CredentialContract,
  IGroupServerConfig,
  Server,
  ServerCost,
  UserServerCredential,
} from '@/types';
import GrantPreview from '../GrantPreview';
import { ServerToolConfig } from '../ServerToolConfig';

interface UserGrantFieldsProps {
  servers: Server[];
  grants: IGroupServerConfig[];
  onGrantsChange: (grants: IGroupServerConfig[]) => void;
  serverCosts: ServerCost[];
  contracts: CredentialContract[];
  serverCredentials: UserServerCredential[];
  onServerCredentialsChange: (credentials: UserServerCredential[]) => void;
  disabled: boolean;
}

const UserGrantFields = ({
  servers,
  grants,
  onGrantsChange,
  serverCosts,
  contracts,
  serverCredentials,
  onServerCredentialsChange,
  disabled,
}: UserGrantFieldsProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="ylune-label">{t('users.grants')}</label>
      <p className="ylune-help">{t('users.grantsHint')}</p>
      <ServerToolConfig
        servers={servers}
        value={grants}
        onChange={onGrantsChange}
        serverCosts={serverCosts}
        contracts={contracts}
        serverCredentials={serverCredentials}
        onServerCredentialsChange={onServerCredentialsChange}
        credentialsDisabled={disabled}
      />
      <GrantPreview grants={grants} servers={servers} />
    </div>
  );
};

export default UserGrantFields;
