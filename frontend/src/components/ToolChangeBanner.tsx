import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server } from '@/types';
import { diffToolInventory, rememberToolInventory, ToolChange } from '@/utils/toolInventory';

interface ToolChangeBannerProps {
  servers: Server[];
}

const ToolChangeBanner = ({ servers }: ToolChangeBannerProps) => {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<ToolChange[]>([]);

  useEffect(() => {
    if (servers.length === 0) return;
    const next = diffToolInventory(servers);
    if (next.length === 0 && !localStorage.getItem('ylune.toolInventory.v1')) {
      rememberToolInventory(servers);
      return;
    }
    setChanges(next);
  }, [servers]);

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
        return `${change.server}: ${parts.join('；')}`;
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
          onClick={() => {
            rememberToolInventory(servers);
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
