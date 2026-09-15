import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Server, User } from '@/types';
import {
  buildDashboardAttention,
  buildDashboardLifecycleNotices,
  DashboardAttentionKind,
  DashboardLifecycleKind,
} from '@/utils/dashboardAttention';
import { takeDashboardPreview } from '@/utils/dashboardPresentation';

type DashboardAttentionPanelProps = {
  servers: Server[];
  users: User[];
};

const attentionMessageKey: Record<DashboardAttentionKind, string> = {
  disconnected: 'diag.disconnected',
  empty_grants: 'diag.emptyGrants',
};

const lifecycleMessageKey: Record<DashboardLifecycleKind, string> = {
  expired_users: 'diag.expiredUsers',
  expiring_users: 'diag.expiringUsers',
};

const targetFor = (kind: DashboardAttentionKind): string =>
  kind === 'disconnected' ? '/servers' : '/users';

const DashboardAttentionPanel = ({ servers, users }: DashboardAttentionPanelProps) => {
  const { t } = useTranslation();
  const attentionItems = buildDashboardAttention(servers, users);
  const lifecycleItems = buildDashboardLifecycleNotices(users);
  if (attentionItems.length === 0 && lifecycleItems.length === 0) return null;

  const attentionTotal = attentionItems.reduce((sum, item) => sum + item.names.length, 0);
  const lifecycleTotal = lifecycleItems.reduce((sum, item) => sum + item.names.length, 0);

  return (
    <div className="dash-notice-stack">
      {attentionItems.length > 0 && (
        <details className="dash-attention">
          <summary>
            <span className="dash-attention-mark" aria-hidden="true" />
            <strong>{t('diag.title')}</strong>
            <span className="hub-tag err">{attentionTotal}</span>
            <span className="dash-attention-summary">{t('pages.dashboard.attentionHint')}</span>
          </summary>
          <div className="dash-attention-list">
            {attentionItems.map((item) => {
              const preview = takeDashboardPreview(item.names, 4);
              const names = `${preview.visible.join(', ')}${
                preview.hiddenCount > 0 ? ` +${preview.hiddenCount}` : ''
              }`;
              const target = targetFor(item.kind);
              return (
                <div className="dash-attention-row" key={item.kind}>
                  <span>{t(attentionMessageKey[item.kind], { names })}</span>
                  <Link className="cfg-link" to={target}>
                    {t('common.view')}{' '}
                    {t(item.kind === 'disconnected' ? 'nav.servers' : 'nav.users')}
                  </Link>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {lifecycleItems.length > 0 && (
        <details className="dash-lifecycle">
          <summary>
            <span className="dash-lifecycle-mark" aria-hidden="true" />
            <strong>{t('pages.dashboard.keyReminder')}</strong>
            <span className="hub-tag warn">{lifecycleTotal}</span>
            <span className="dash-attention-summary">{t('pages.dashboard.keyReminderHint')}</span>
          </summary>
          <div className="dash-attention-list">
            {lifecycleItems.map((item) => {
              const preview = takeDashboardPreview(item.names, 4);
              const names = `${preview.visible.join(', ')}${
                preview.hiddenCount > 0 ? ` +${preview.hiddenCount}` : ''
              }`;
              return (
                <div className="dash-attention-row" key={item.kind}>
                  <span>{t(lifecycleMessageKey[item.kind], { names })}</span>
                  <Link className="cfg-link" to="/users">
                    {t('common.view')} {t('nav.users')}
                  </Link>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
};

export default DashboardAttentionPanel;
