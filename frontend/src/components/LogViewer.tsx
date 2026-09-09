import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../services/logService';
import { useTranslation } from 'react-i18next';

interface LogViewerProps {
  logs: LogEntry[];
  isLoading?: boolean;
  error?: Error | null;
  onClear?: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, isLoading = false, error = null, onClear }) => {
  const { t } = useTranslation();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<Array<'info' | 'error' | 'warn' | 'debug'>>([
    'info',
    'error',
    'warn',
    'debug',
  ]);
  const [sourceFilter, setSourceFilter] = useState<Array<'main' | 'child'>>(['main', 'child']);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesText = filter ? log.message.toLowerCase().includes(filter.toLowerCase()) : true;
    const matchesType = typeFilter.includes(log.type);
    const matchesSource = sourceFilter.includes(log.source as 'main' | 'child');
    return matchesText && matchesType && matchesSource;
  });

  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

  const toggleType = (type: 'info' | 'error' | 'warn' | 'debug') => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const toggleSource = (source: 'main' | 'child') => {
    setSourceFilter((prev) =>
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source],
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="logs-toolbar">
        <div className="logs-toolbar-main">
          <label className="logs-search">
            <input
              type="text"
              placeholder={t('logs.search')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          {(['debug', 'info', 'error', 'warn'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`logs-chip is-${type}${typeFilter.includes(type) ? ' is-on' : ''}`}
              onClick={() => toggleType(type)}
            >
              {type}
            </button>
          ))}
          {(['main', 'child'] as const).map((source) => (
            <button
              key={source}
              type="button"
              className={`logs-chip is-${source}${sourceFilter.includes(source) ? ' is-on' : ''}`}
              onClick={() => toggleSource(source)}
            >
              {source === 'main' ? t('logs.mainProcess') : t('logs.childProcess')}
            </button>
          ))}
        </div>
        <div className="logs-toolbar-side">
          <label className="ylune-check">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={() => setAutoScroll(!autoScroll)}
            />
            {t('logs.autoScroll')}
          </label>
          <button
            type="button"
            className="hub-btn"
            onClick={onClear}
            disabled={isLoading || logs.length === 0}
          >
            {t('logs.clearLogs')}
          </button>
        </div>
      </div>

      <div ref={logContainerRef} className="logs-console">
        {isLoading ? (
          <div className="hub-empty">
            <p className="hub-empty-title">{t('logs.loading')}</p>
          </div>
        ) : error ? (
          <div className="ylune-error" style={{ margin: 14 }}>
            {error.message}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="hub-empty">
            <p className="hub-empty-title">
              {filter || typeFilter.length < 4 || sourceFilter.length < 2
                ? t('logs.noMatch')
                : t('logs.noLogs')}
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`logs-line${log.type === 'error' ? ' is-error' : log.type === 'warn' ? ' is-warn' : ''}`}
            >
              <span className="logs-time">[{formatTimestamp(log.timestamp)}]</span>
              <span className="logs-level">{log.type}</span>
              <span className="logs-source">
                {log.source === 'main' ? t('logs.main') : t('logs.child')}
              </span>
              <span className="logs-pid">{log.processId ? `(${log.processId})` : ''}</span>
              <span className="logs-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogViewer;
