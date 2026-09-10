import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { User } from '@/types';
import TokenLifetimeFields, {
  TokenLifetimeValue,
  isCustomExpiryInPast,
  isCustomExpiryMissing,
  toExpiryPayload,
} from './TokenLifetimeFields';
import PastExpiryAlert from './ui/PastExpiryAlert';
import SecretReveal from './ui/SecretReveal';
import McpJsonPanel from './McpJsonPanel';

interface AddAdminFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddAdminForm = ({ onAdd, onCancel }: AddAdminFormProps) => {
  const { t } = useTranslation();
  const { createUser } = useUserData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remark, setRemark] = useState('');
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [tokenLifetime, setTokenLifetime] = useState<TokenLifetimeValue>('permanent');
  const [tokenCustomAt, setTokenCustomAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [pastAlertOpen, setPastAlertOpen] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError(t('users.usernameRequired'));
      return;
    }
    if (!password.trim()) {
      setError(t('users.passwordRequired'));
      return;
    }
    if (mcpEnabled && isCustomExpiryMissing(tokenLifetime, tokenCustomAt)) {
      setError(t('users.tokenCustomRequired'));
      return;
    }
    if (mcpEnabled && isCustomExpiryInPast(tokenLifetime, tokenCustomAt)) {
      setPastAlertOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createUser({
        username: username.trim(),
        password,
        remark: remark.trim() || undefined,
        isAdmin: true,
        consoleEnabled: true,
        mcpEnabled,
        ...(mcpEnabled ? toExpiryPayload(tokenLifetime, tokenCustomAt) : {}),
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
              {t('users.createAdminSuccessHint', { username: createdUser.username })}
            </p>
            {createdUser.token ? (
              <>
                <label className="ylune-label">{t('users.token')}</label>
                <SecretReveal value={createdUser.token} emptyLabel={t('users.tokenMissing')} />
                <McpJsonPanel username={createdUser.username} token={createdUser.token} />
              </>
            ) : (
              <p className="ylune-help">{t('users.adminNoMcp')}</p>
            )}
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
      <div className="ylune-dialog">
        <form onSubmit={handleSubmit}>
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">{t('users.addAdmin')}</h2>
          </div>
          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}
            <div>
              <label className="ylune-label" htmlFor="admin-username">
                {t('users.username')} <span className="ylune-req">*</span>
              </label>
              <input
                id="admin-username"
                className="hub-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="ylune-label" htmlFor="admin-password">
                {t('users.password')} <span className="ylune-req">*</span>
              </label>
              <input
                id="admin-password"
                type="password"
                className="hub-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="ylune-label" htmlFor="admin-remark">
                {t('users.remark')}
              </label>
              <input
                id="admin-remark"
                className="hub-input"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <label className="token-lifetime-option">
              <input
                type="checkbox"
                checked={mcpEnabled}
                onChange={(event) => setMcpEnabled(event.target.checked)}
                disabled={isSubmitting}
              />
              {t('users.allowMcp')}
            </label>
            {mcpEnabled && (
              <TokenLifetimeFields
                lifetime={tokenLifetime}
                customAt={tokenCustomAt}
                onLifetimeChange={setTokenLifetime}
                onCustomAtChange={setTokenCustomAt}
                disabled={isSubmitting}
              />
            )}
          </div>
          <div className="ylune-dialog-foot">
            <button type="button" className="hub-btn" onClick={onCancel} disabled={isSubmitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.processing') : t('users.create')}
            </button>
          </div>
        </form>
        <PastExpiryAlert isOpen={pastAlertOpen} onClose={() => setPastAlertOpen(false)} />
      </div>
    </div>
  );
};

export default AddAdminForm;
