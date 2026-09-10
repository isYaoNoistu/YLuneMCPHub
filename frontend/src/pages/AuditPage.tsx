import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminAuditLogs } from '@/services/auditService';
import { AdminAuditLog } from '@/types';

const AuditPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const [rows, setRows] = useState<AdminAuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    void getAdminAuditLogs(page, 20).then((response) => {
      if (response?.success && Array.isArray(response.data)) {
        setRows(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    });
  }, [page]);

  if (!auth.user?.isAdmin) {
    return (
      <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-err)' }}>
        {t('users.adminRequired')}
      </div>
    );
  }

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('audit.title')}</h1>
          <p className="hub-sub">{t('audit.hint')}</p>
        </div>
      </div>
      <div className="hub-card overflow-hidden">
        <div className="hub-row head hub-mono">
          <div>{t('activity.timestamp')}</div>
          <div>{t('audit.actor')}</div>
          <div>{t('audit.action')}</div>
          <div>{t('audit.resource')}</div>
        </div>
        {rows.length === 0 ? (
          <div className="hub-empty">
            <p className="hub-empty-title">{t('audit.empty')}</p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="hub-row">
              <div>{new Date(row.timestamp).toLocaleString()}</div>
              <div className="hub-mono">{row.actor}</div>
              <div>{row.action}</div>
              <div className="hub-mono">
                {row.resourceType}
                {row.resourceId ? `:${row.resourceId}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button type="button" className="hub-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          {t('common.previous')}
        </button>
        <button
          type="button"
          className="hub-btn"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
};

export default AuditPage;
