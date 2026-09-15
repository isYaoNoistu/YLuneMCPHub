import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Server, User } from '@/types';
import { buildDashboardAttention, DashboardAttentionKind } from '@/utils/dashboardAttention';
import { takeDashboardPreview } from '@/utils/dashboardPresentation';

type DashboardAttentionPanelProps = {
  servers: Server[];
  users: User[];
};

const messageKey: Record<DashboardAttentionKind, string> = {
  disconnected: 'diag.disconnected',
  empty_grants: 'diag.emptyGrants',
  expired_users: 'diag.expiredUsers',
  expiring_users: 'diag.expiringUsers',
};

const targetFor = (kind: DashboardAttentionKind): string =>
  kind === 'disconnected' ? '/servers' : '/users';

const DashboardAttentionPanel = ({ servers, users }: DashboardAttentionPanelProps) => {
  const { t } = useTranslation();
  const items = buildDashboardAttention(servers, users);
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.names.length, 0);

  return (
    <details className="dash-attention">
      <summary>
        <span className="dash-attention-mark" aria-hidden="true" />
        <strong>{t('diag.title')}</strong>
        <span className="hub-tag warn">{total}</span>
        <span className="dash-attention-summary">{t('pages.dashboard.attentionHint')}</span>
      </summary>
      <div className="dash-attention-list">
        {items.map((item) => {
          const preview = takeDashboardPreview(item.names, 4);
          const names = `${preview.visible.join(', ')}${
            preview.hiddenCount > 0 ? ` +${preview.hiddenCount}` : ''
          }`;
          const target = targetFor(item.kind);
          return (
            <div className="dash-attention-row" key={item.kind}>
              <span>{t(messageKey[item.kind], { names })}</span>
              <Link className="cfg-link" to={target}>
                {t('common.view')} {t(item.kind === 'disconnected' ? 'nav.servers' : 'nav.users')}
              </Link>
            </div>
          );
        })}
      </div>
    </details>
  );
};

export default DashboardAttentionPanel;
