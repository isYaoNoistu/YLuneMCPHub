import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { CredentialContract, IGroupServerConfig, ResourceGroup, User, UserServerCredential } from '@/types';
import SecretReveal from './ui/SecretReveal';
import { ServerToolConfig } from './ServerToolConfig';
import McpJsonPanel from './McpJsonPanel';
import GrantPreview from './GrantPreview';
import { getResourceGroups, setUserResourceGroups } from '@/services/resourceBindingService';
import { getCredentialContracts } from '@/services/credentialService';
import UserCredentialPicker, { missingRequiredCredentials } from './UserCredentialPicker';
import TokenLifetimeFields, {
  TokenLifetimeValue,
  isCustomExpiryInPast,
  isCustomExpiryMissing,
  lifetimeFromExpiresAt,
  toExpiryPayload,
  toLocalDateTimeValue,
} from './TokenLifetimeFields';
import PastExpiryAlert from './ui/PastExpiryAlert';

interface EditUserFormProps {
  user: User;
  onEdit: () => void;
  onCancel: () => void;
}

const EditUserForm = ({ user, onEdit, onCancel }: EditUserFormProps) => {
  const { t } = useTranslation();
  const { updateUser } = useUserData();
  const { allServers } = useServerData();
  const { serverCosts } = useCostData();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remark, setRemark] = useState(user.remark || '');
  const [mcpEnabled, setMcpEnabled] = useState(user.mcpEnabled !== false);
  const [grants, setGrants] = useState<IGroupServerConfig[]>(user.grants || []);
  const [resourceGroupIds, setResourceGroupIds] = useState<string[]>(user.resourceGroupIds || []);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [contracts, setContracts] = useState<CredentialContract[]>([]);
  const [serverCredentials, setServerCredentials] = useState<UserServerCredential[]>(
    user.serverCredentials || [],
  );
  const [tokenLifetime, setTokenLifetime] = useState<TokenLifetimeValue>(
    lifetimeFromExpiresAt(user.tokenExpiresAt),
  );
  const [tokenCustomAt, setTokenCustomAt] = useState(toLocalDateTimeValue(user.tokenExpiresAt));
  const [pastAlertOpen, setPastAlertOpen] = useState(false);
  const [availableServers, setAvailableServers] = useState(
    allServers.filter((server) => server.enabled !== false),
  );

  useEffect(() => {
    setAvailableServers(allServers.filter((server) => server.enabled !== false));
  }, [allServers]);

  useEffect(() => {
    void getResourceGroups().then((response) => {
      if (response?.success && Array.isArray(response.data)) {
        setResourceGroups(response.data);
      }
    });
    void getCredentialContracts().then((response) => {
      if (response?.success && Array.isArray(response.data)) {
        setContracts(response.data);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mcpEnabled && isCustomExpiryMissing(tokenLifetime, tokenCustomAt)) {
      setError(t('users.tokenCustomRequired'));
      return;
    }
    const expiryChanged =
      mcpEnabled &&
      (tokenLifetime !== lifetimeFromExpiresAt(user.tokenExpiresAt) ||
        tokenCustomAt !== toLocalDateTimeValue(user.tokenExpiresAt));
    if (expiryChanged && isCustomExpiryInPast(tokenLifetime, tokenCustomAt)) {
      setPastAlertOpen(true);
      return;
    }
    if (!user.isAdmin) {
      const missing = missingRequiredCredentials(grants, contracts, serverCredentials);
      if (missing.length > 0) {
        setError(t('users.credentialRequired', { server: missing.join(', ') }));
        return;
      }
    }
    setIsSubmitting(true);

    try {
      const result = await updateUser(user.username, {
        remark,
        mcpEnabled,
        ...(user.isAdmin ? {} : { grants, serverCredentials }),
        ...(mcpEnabled && expiryChanged ? toExpiryPayload(tokenLifetime, tokenCustomAt) : {}),
      });
      if (result?.success) {
        await setUserResourceGroups(user.username, resourceGroupIds);
        onEdit();
      } else {
        setError(result?.message || t('users.updateError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ylune-dialog-backdrop">
      <div className="ylune-dialog is-lg">
        <form onSubmit={handleSubmit}>
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">
              {t('users.edit')} · {user.username}
            </h2>
          </div>

          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}

            <div>
              <label className="ylune-label">{t('users.username')}</label>
              <input className="hub-input" value={user.username} disabled />
            </div>

            <div>
              <label htmlFor="remark" className="ylune-label">
                {t('users.remark')}
              </label>
              <input
                type="text"
                id="remark"
                name="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={t('users.remarkPlaceholder')}
                className="hub-input"
                disabled={isSubmitting}
              />
            </div>

            {user.isAdmin && (
              <label className="token-lifetime-option">
                <input
                  type="checkbox"
                  checked={mcpEnabled}
                  onChange={(event) => setMcpEnabled(event.target.checked)}
                  disabled={isSubmitting}
                />
                {t('users.allowMcp')}
              </label>
            )}

            {mcpEnabled ? (
              <>
                <div>
                  <label className="ylune-label">{t('users.token')}</label>
                  <SecretReveal value={user.token} emptyLabel={t('users.tokenMissing')} />
                  <p className="ylune-help">{t('users.tokenHint')}</p>
                </div>

                {user.token ? <McpJsonPanel username={user.username} token={user.token} /> : null}

                <TokenLifetimeFields
                  lifetime={tokenLifetime}
                  customAt={tokenCustomAt}
                  onLifetimeChange={setTokenLifetime}
                  onCustomAtChange={setTokenCustomAt}
                  disabled={isSubmitting}
                />

                {!user.isAdmin && (
                  <div>
                    <label className="ylune-label">{t('users.grants')}</label>
                    <p className="ylune-help">{t('users.grantsHint')}</p>
                    <ServerToolConfig
                      servers={availableServers}
                      value={grants}
                      onChange={setGrants}
                      serverCosts={serverCosts}
                    />
                    <GrantPreview grants={grants} servers={availableServers} />
                    <UserCredentialPicker
                      grants={grants}
                      contracts={contracts}
                      value={serverCredentials}
                      onChange={setServerCredentials}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                {user.isAdmin && <p className="ylune-help">{t('users.adminUnrestricted')}</p>}
                {resourceGroups.length > 0 && (
                  <div>
                    <label className="ylune-label">{t('resourceGroups.assign')}</label>
                    <p className="ylune-help">{t('resourceGroups.assignHint')}</p>
                    {resourceGroups.map((group) => (
                      <label key={group.id} className="token-lifetime-option">
                        <input
                          type="checkbox"
                          checked={resourceGroupIds.includes(group.id)}
                          onChange={(event) => {
                            setResourceGroupIds(
                              event.target.checked
                                ? [...resourceGroupIds, group.id]
                                : resourceGroupIds.filter((id) => id !== group.id),
                            );
                          }}
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="ylune-help">{t('users.adminNoMcp')}</p>
            )}
          </div>

          <div className="ylune-dialog-foot">
            <button type="button" onClick={onCancel} className="hub-btn" disabled={isSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.updating') : t('users.update')}
            </button>
          </div>
        </form>
      </div>
      <PastExpiryAlert isOpen={pastAlertOpen} onClose={() => setPastAlertOpen(false)} />
    </div>
  );
};

export default EditUserForm;
