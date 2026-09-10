import { useTranslation } from 'react-i18next';
import { Server, User } from '@/types';
import { isExpiredUser } from '@/utils/expiryCenter';

interface DiagnosticsBannerProps {
  servers: Server[];
  users?: User[];
}

const DiagnosticsBanner = ({ servers, users = [] }: DiagnosticsBannerProps) => {
  const { t } = useTranslation();
  const hints: string[] = [];

  if (servers.length === 0) {
    hints.push(t('diag.noServers'));
  }

  const disconnected = servers.filter(
    (server) => server.enabled !== false && server.status !== 'connected',
  );
  if (disconnected.length > 0) {
    hints.push(
      t('diag.disconnected', {
        names: disconnected.map((server) => server.name).join(', '),
      }),
    );
  }

  const emptyGrants = users.filter(
    (user) => !user.isAdmin && (!user.grants || user.grants.length === 0),
  );
  if (emptyGrants.length > 0) {
    hints.push(t('diag.emptyGrants', { names: emptyGrants.map((user) => user.username).join(', ') }));
  }

  const expired = users.filter(isExpiredUser);
  if (expired.length > 0) {
    hints.push(t('diag.expiredUsers', { names: expired.map((user) => user.username).join(', ') }));
  }

  if (hints.length === 0) return null;

  return (
    <div className="hub-card" style={{ padding: '12px 16px', marginBottom: 16 }}>
      <h2 className="hub-card-title" style={{ marginBottom: 8 }}>
        {t('diag.title')}
      </h2>
      <ul className="grant-preview-list">
        {hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
    </div>
  );
};

export default DiagnosticsBanner;
