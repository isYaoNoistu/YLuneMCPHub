import React from 'react';
import { useTranslation } from 'react-i18next';
import LogViewer from '../components/LogViewer';
import { useLogs } from '../services/logService';

const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { logs, loading, error, clearLogs } = useLogs();

  return (
    <div className="hub-page-stack">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('pages.logs.title')}</h1>
          <p className="hub-sub">{t('logs.entries', { count: logs.length })}</p>
        </div>
      </div>
      <div className="hub-card overflow-hidden">
        <LogViewer logs={logs} isLoading={loading} error={error} onClear={clearLogs} />
      </div>
    </div>
  );
};

export default LogsPage;
