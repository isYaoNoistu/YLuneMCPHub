import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ackToolChanges, getToolChanges } from '@/services/opsService';
import { ToolChangeRow } from '@/types';

const ToolChangeBanner = () => {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<ToolChangeRow[]>([]);

  const load = async () => {
    const response = await getToolChanges();
    if (response?.success && Array.isArray(response.data)) {
      setChanges(response.data);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(
    () =>
      changes.map((change) => {
        const parts: string[] = [];
        if (change.added.length) {
          parts.push(t('pages.servers.toolAdded', { tools: change.added.join(', ') }));
        }
        if (change.removed.length) {
          parts.push(t('pages.servers.toolRemoved', { tools: change.removed.join(', ') }));
        }
        if (change.changed.length) {
          parts.push(t('pages.servers.toolChanged', { tools: change.changed.join(', ') }));
        }
        const users = change.impactedUsers.map((user) => user.username).join(', ');
        const impact = users
          ? t('pages.servers.toolImpacted', { users })
          : t('pages.servers.toolImpactedNone');
        return `${change.server}: ${parts.join('；')} — ${impact}`;
      }),
    [changes, t],
  );

  if (summary.length === 0) return null;

  return (
    <div className="hub-card" style={{ padding: '12px 16px', marginBottom: 16 }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="hub-card-title" style={{ marginBottom: 6 }}>
            {t('pages.servers.toolChanges')}
          </h2>
          <ul className="grant-preview-list">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="hub-btn"
          onClick={async () => {
            await ackToolChanges();
            setChanges([]);
          }}
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
};

export default ToolChangeBanner;
