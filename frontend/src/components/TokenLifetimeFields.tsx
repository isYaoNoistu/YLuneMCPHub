import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PastExpiryAlert from './ui/PastExpiryAlert';

export type TokenLifetimeValue = 'permanent' | '1d' | '7d' | '30d' | '90d' | 'custom';

interface TokenLifetimeFieldsProps {
  lifetime: TokenLifetimeValue;
  customAt: string;
  onLifetimeChange: (value: TokenLifetimeValue) => void;
  onCustomAtChange: (value: string) => void;
  disabled?: boolean;
}

const OPTIONS: TokenLifetimeValue[] = ['permanent', '1d', '7d', '30d', '90d', 'custom'];

const TokenLifetimeFields = ({
  lifetime,
  customAt,
  onLifetimeChange,
  onCustomAtChange,
  disabled,
}: TokenLifetimeFieldsProps) => {
  const { t } = useTranslation();
  const radioName = useId();
  const [pastAlertOpen, setPastAlertOpen] = useState(false);

  return (
    <div>
      <label className="ylune-label">{t('users.tokenLifetime')}</label>
      <p className="ylune-help">{t('users.tokenLifetimeHint')}</p>
      <div className="token-lifetime-options">
        {OPTIONS.map((option) => (
          <label key={option} className="token-lifetime-option">
            <input
              type="radio"
              name={radioName}
              value={option}
              checked={lifetime === option}
              disabled={disabled}
              onChange={() => onLifetimeChange(option)}
            />
            <span>{t(`users.tokenLifetime_${option}`)}</span>
          </label>
        ))}
      </div>
      {lifetime === 'custom' ? (
        <input
          type="datetime-local"
          className="hub-input"
          value={customAt}
          min={toLocalDateTimeValue(new Date().toISOString())}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (isCustomExpiryInPast('custom', next)) {
              setPastAlertOpen(true);
              return;
            }
            onCustomAtChange(next);
          }}
        />
      ) : null}
      <PastExpiryAlert isOpen={pastAlertOpen} onClose={() => setPastAlertOpen(false)} />
    </div>
  );
};

export const toLocalDateTimeValue = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const lifetimeFromExpiresAt = (iso?: string | null): TokenLifetimeValue =>
  iso ? 'custom' : 'permanent';

export const isCustomExpiryMissing = (lifetime: TokenLifetimeValue, customAt: string): boolean =>
  lifetime === 'custom' && !customAt;

export const isCustomExpiryInPast = (lifetime: TokenLifetimeValue, customAt: string): boolean => {
  if (lifetime !== 'custom' || !customAt) return false;
  const date = new Date(customAt);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
};

export const toExpiryPayload = (
  lifetime: TokenLifetimeValue,
  customAt: string,
): { tokenLifetime: string; tokenExpiresAt?: string | null } => {
  if (lifetime === 'permanent') {
    return { tokenLifetime: 'permanent', tokenExpiresAt: null };
  }
  if (lifetime === 'custom') {
    return {
      tokenLifetime: 'custom',
      tokenExpiresAt: customAt ? new Date(customAt).toISOString() : null,
    };
  }
  return { tokenLifetime: lifetime };
};

export default TokenLifetimeFields;
