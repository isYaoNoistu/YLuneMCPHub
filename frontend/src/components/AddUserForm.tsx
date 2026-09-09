import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import { useSettingsData } from '@/hooks/useSettingsData';
import { User, UserFormData } from '@/types';
import { Check, Copy } from 'lucide-react';
import SecretReveal from './ui/SecretReveal';
import { formatUserMcpJson } from '@/utils/userMcpConfig';

interface AddUserFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddUserForm = ({ onAdd, onCancel }: AddUserFormProps) => {
  const { t } = useTranslation();
  const { createUser } = useUserData();
  const { installConfig } = useSettingsData();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    remark: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.username.trim()) {
      setError(t('users.usernameRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createUser({
        username: formData.username.trim(),
        remark: formData.remark?.trim() || undefined,
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

  const mcpJson = createdUser?.token
    ? formatUserMcpJson(createdUser.token, createdUser.username, installConfig?.baseUrl)
    : '';

  const copyMcpJson = async () => {
    if (!mcpJson) return;
    try {
      await navigator.clipboard.writeText(mcpJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
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

            <div>
              <label className="ylune-label">{t('users.token')}</label>
              <SecretReveal value={createdUser.token} emptyLabel={t('users.tokenMissing')} />
            </div>

            <div>
              <label className="ylune-label">{t('users.mcpJsonTitle')}</label>
              <p className="ylune-help">{t('users.mcpJsonHint')}</p>
              <pre className="ylune-code">{mcpJson}</pre>
            </div>
          </div>
          <div className="ylune-dialog-foot">
            <button type="button" className="hub-btn" onClick={copyMcpJson}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('common.copied') : t('users.copyMcpJson')}
            </button>
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
