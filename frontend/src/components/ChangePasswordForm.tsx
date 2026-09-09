import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePasswordCredentials } from '../types';
import { changePassword } from '../services/authService';
import { validatePasswordStrength } from '../utils/passwordValidation';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ChangePasswordForm = ({ onSuccess, onCancel }: ChangePasswordFormProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ChangePasswordCredentials>({
    currentPassword: '',
    newPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === 'newPassword') {
        setPasswordErrors(validatePasswordStrength(value).errors);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validatePasswordStrength(formData.newPassword);
    if (!validation.isValid) {
      setError(t('auth.passwordStrengthError'));
      setPasswordErrors(validation.errors);
      return;
    }

    setPasswordErrors([]);

    if (formData.newPassword !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await changePassword(formData);
      if (response.success) {
        setSuccess(true);
        onSuccess?.();
      } else {
        setError(response.message || t('auth.changePasswordError'));
      }
    } catch {
      setError(t('auth.changePasswordError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return <div className="ylune-error" style={{ color: 'var(--color-accent)', borderColor: 'rgba(94, 234, 212, 0.35)', background: 'rgba(94, 234, 212, 0.08)' }}>{t('auth.changePasswordSuccess')}</div>;
  }

  return (
    <form className="settings-section-body" onSubmit={handleSubmit}>
      {error && (
        <div className="ylune-error">
          <p>{error}</p>
          {passwordErrors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {passwordErrors.map((errorKey) => (
                <li key={errorKey}>{t(`auth.${errorKey}`)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="settings-block">
        <label className="ylune-label" htmlFor="currentPassword">
          {t('auth.currentPassword')}
        </label>
        <input
          type="password"
          id="currentPassword"
          name="currentPassword"
          className="hub-input"
          value={formData.currentPassword}
          onChange={handleChange}
          required
        />
      </div>

      <div className="settings-block">
        <label className="ylune-label" htmlFor="newPassword">
          {t('auth.newPassword')}
        </label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          className="hub-input"
          value={formData.newPassword}
          onChange={handleChange}
          required
          minLength={8}
        />
        {formData.newPassword && passwordErrors.length > 0 && (
          <p className="ylune-help">
            {t('auth.passwordStrengthHint')}: {passwordErrors.map((key) => t(`auth.${key}`)).join(' · ')}
          </p>
        )}
        {formData.newPassword && passwordErrors.length === 0 && (
          <p className="ylune-help">{t('auth.passwordStrengthHint')}</p>
        )}
      </div>

      <div className="settings-block">
        <label className="ylune-label" htmlFor="confirmPassword">
          {t('auth.confirmPassword')}
        </label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          className="hub-input"
          value={confirmPassword}
          onChange={handleChange}
          required
          minLength={8}
        />
      </div>

      <div className="settings-actions">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={isLoading} className="hub-btn">
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" disabled={isLoading} className="hub-btn primary">
          {isLoading ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
