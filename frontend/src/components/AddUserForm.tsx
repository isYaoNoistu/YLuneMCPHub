import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { IGroupServerConfig, User, UserFormData } from '@/types';
import SecretReveal from './ui/SecretReveal';
import { ServerToolConfig } from './ServerToolConfig';
import McpJsonPanel from './McpJsonPanel';
import TokenLifetimeFields, {
  TokenLifetimeValue,
  isCustomExpiryMissing,
  toExpiryPayload,
} from './TokenLifetimeFields';

interface AddUserFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddUserForm = ({ onAdd, onCancel }: AddUserFormProps) => {
  const { t } = useTranslation();
  const { createUser } = useUserData();
  const { allServers } = useServerData();
  const { serverCosts } = useCostData();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [grants, setGrants] = useState<IGroupServerConfig[]>([]);
  const [tokenLifetime, setTokenLifetime] = useState<TokenLifetimeValue>('permanent');
  const [tokenCustomAt, setTokenCustomAt] = useState('');

  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    remark: '',
  });

  const [availableServers, setAvailableServers] = useState(allServers.filter((s) => s.enabled !== false));
  useEffect(() => {
    setAvailableServers(allServers.filter((server) => server.enabled !== false));
  }, [allServers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.username.trim()) {
      setError(t('users.usernameRequired'));
      return;
    }

    if (isCustomExpiryMissing(tokenLifetime, tokenCustomAt)) {
      setError(t('users.tokenCustomRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createUser({
        username: formData.username.trim(),
        remark: formData.remark?.trim() || undefined,
        grants,
        ...toExpiryPayload(tokenLifetime, tokenCustomAt),
      });
      if (result?.success && result.data) {
        setCreatedUser(result.data);
      } else {
        setError(result?.message || t('users.createError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('users.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdUser) {
    return (
      <div className="ylune-dialog-backdrop">
        <div className="ylune-dialog is-lg">
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">{t('users.createSuccess')}</h2>
          </div>
          <div className="ylune-dialog-body">
            <p className="ylune-help" style={{ marginTop: 0 }}>
              {t('users.createSuccessHint', { username: createdUser.username })}
            </p>
            <p className="ylune-help">{t('users.mcpJsonAlwaysHint')}</p>

            <div>
              <label className="ylune-label">{t('users.token')}</label>
              <SecretReveal value={createdUser.token} emptyLabel={t('users.tokenMissing')} />
            </div>

            <McpJsonPanel username={createdUser.username} token={createdUser.token} />
          </div>
          <div className="ylune-dialog-foot">
            <button type="button" className="hub-btn primary" onClick={onAdd}>
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ylune-dialog-backdrop">
      <div className="ylune-dialog is-lg">
        <form onSubmit={handleSubmit}>
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">{t('users.addNew')}</h2>
          </div>

          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}

            <div>
              <label htmlFor="username" className="ylune-label">
                {t('users.username')} <span className="ylune-req">*</span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder={t('users.usernamePlaceholder')}
                className="hub-input"
                required
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="remark" className="ylune-label">
                {t('users.remark')}
              </label>
              <input
                type="text"
                id="remark"
                name="remark"
                value={formData.remark || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, remark: e.target.value }))}
                placeholder={t('users.remarkPlaceholder')}
                className="hub-input"
                disabled={isSubmitting}
              />
            </div>

            <TokenLifetimeFields
              lifetime={tokenLifetime}
              customAt={tokenCustomAt}
              onLifetimeChange={setTokenLifetime}
              onCustomAtChange={setTokenCustomAt}
              disabled={isSubmitting}
            />

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
          </div>

          <div className="ylune-dialog-foot">
            <button type="button" onClick={onCancel} className="hub-btn" disabled={isSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.creating') : t('users.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserForm;
