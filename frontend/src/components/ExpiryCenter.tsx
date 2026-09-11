import { useTranslation } from 'react-i18next';
import { User } from '@/types';
import { isExpiredUser, listExpiryAttention } from '@/utils/expiryCenter';

interface ExpiryCenterProps {
  users: User[];
  onRenew?: (user: User) => void;
}

const ExpiryCenter = ({ users, onRenew }: ExpiryCenterProps) => {
  const { t } = useTranslation();
  const attention = listExpiryAttention(users);

  return (
    <div className="hub-card expiry-center">
      <h2 className="hub-card-title" style={{ marginBottom: 6 }}>
        {t('users.expiryCenter')}
      </h2>
      <p className="ylune-help" style={{ marginTop: 0 }}>
        {t('users.expiryCenterHint')}
      </p>
      {attention.length === 0 ? (
        <p className="ylune-help">{t('users.expiryNone')}</p>
      ) : (
        <ul className="grant-preview-list">
          {attention.map((user) => (
            <li key={user.username}>
              <strong>{user.username}</strong>
              <span>
                {isExpiredUser(user)
                  ? t('users.tokenExpired')
                  : t('users.tokenValidUntil', {
                      time: user.tokenExpiresAt
                        ? new Date(user.tokenExpiresAt).toLocaleString()
                        : '—',
                    })}
              </span>
              {onRenew ? (
                <button type="button" className="hub-btn" onClick={() => onRenew(user)}>
                  {t('users.renew')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ExpiryCenter;
