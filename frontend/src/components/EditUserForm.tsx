import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { IGroupServerConfig, User } from '@/types';
import SecretReveal from './ui/SecretReveal';
import { ServerToolConfig } from './ServerToolConfig';
import McpJsonPanel from './McpJsonPanel';
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
  const [grants, setGrants] = useState<IGroupServerConfig[]>(user.grants || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isCustomExpiryMissing(tokenLifetime, tokenCustomAt)) {
      setError(t('users.tokenCustomRequired'));
      return;
    }
    const expiryChanged =
      tokenLifetime !== lifetimeFromExpiresAt(user.tokenExpiresAt) ||
      tokenCustomAt !== toLocalDateTimeValue(user.tokenExpiresAt);
    if (expiryChanged && isCustomExpiryInPast(tokenLifetime, tokenCustomAt)) {
      setPastAlertOpen(true);
      return;
    }
    setIsSubmitting(true);

    try {
      const result = await updateUser(user.username, {
        remark,
        grants,
        ...(expiryChanged ? toExpiryPayload(tokenLifetime, tokenCustomAt) : {}),
      });
      if (result?.success) {
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

            <div>
              <label className="ylune-label">{t('users.token')}</label>
              <SecretReveal value={user.token} emptyLabel={t('users.tokenMissing')} />
              <p className="ylune-help">{t('users.tokenHint')}</p>
            </div>

            <McpJsonPanel username={user.username} token={user.token} />

            {!user.isAdmin && (
              <TokenLifetimeFields
                lifetime={tokenLifetime}
                customAt={tokenCustomAt}
                onLifetimeChange={setTokenLifetime}
                onCustomAtChange={setTokenCustomAt}
                disabled={isSubmitting}
              />
            )}

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
              </div>
            )}
            {user.isAdmin && <p className="ylune-help">{t('users.adminUnrestricted')}</p>}
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
