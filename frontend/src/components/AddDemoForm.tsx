import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { User } from '@/types';

interface AddDemoFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddDemoForm = ({ onAdd, onCancel }: AddDemoFormProps) => {
  const { t } = useTranslation();
  const { createUser } = useUserData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);

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

    setIsSubmitting(true);
    try {
      const result = await createUser({
        username: username.trim(),
        password,
        remark: remark.trim() || undefined,
        demo: true,
        isAdmin: false,
        consoleEnabled: true,
        mcpEnabled: false,
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
        <div className="ylune-dialog">
          <div className="ylune-dialog-head">
            <h2 className="ylune-dialog-title">{t('users.createSuccess')}</h2>
          </div>
          <div className="ylune-dialog-body">
            <p className="ylune-help" style={{ marginTop: 0 }}>
              {t('users.createDemoSuccessHint', { username: createdUser.username })}
            </p>
            <p className="ylune-help">{t('users.demoNoKey')}</p>
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
            <h2 className="ylune-dialog-title">{t('users.addDemo')}</h2>
          </div>
          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}
            <p className="ylune-help" style={{ marginTop: 0 }}>
              {t('users.demoHint')}
            </p>
            <div>
              <label className="ylune-label" htmlFor="demo-username">
                {t('users.username')} <span className="ylune-req">*</span>
              </label>
              <input
                id="demo-username"
                className="hub-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="ylune-label" htmlFor="demo-password">
                {t('users.password')} <span className="ylune-req">*</span>
              </label>
              <input
                id="demo-password"
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
              <label className="ylune-label" htmlFor="demo-remark">
                {t('users.remark')}
              </label>
              <input
                id="demo-remark"
                className="hub-input"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder={t('users.remarkPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
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
      </div>
    </div>
  );
};

export default AddDemoForm;
