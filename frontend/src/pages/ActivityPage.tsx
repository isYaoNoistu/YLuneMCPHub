import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ActivityStats,
  ActivityFilter,
  ActivityFilterOptions,
  ActivityStatus,
} from '@/types';
import {
  getActivities,
  getActivityById,
  getActivityStats,
  getActivityFilterOptions,
  deleteOldActivities,
} from '@/services/activityService';
import Pagination from '@/components/ui/Pagination';
import CopyableCode from '@/components/ui/CopyableCode';
import FilterSelect from '@/components/ui/FilterSelect';
import { X } from 'lucide-react';

// Pagination info type
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const STATUS_OPTIONS: ActivityStatus[] = ['success', 'error'];

const isValidStatus = (value: string): value is ActivityStatus =>
  STATUS_OPTIONS.includes(value as ActivityStatus);

const ActivityPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [filterOptions, setFilterOptions] = useState<ActivityFilterOptions | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filter state
  const [appliedFilters, setAppliedFilters] = useState<ActivityFilter>({});
  const [searchServer, setSearchServer] = useState('');
  const [searchTool, setSearchTool] = useState('');
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [searchUsername, setSearchUsername] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use appliedFilters directly for fetching
      const currentFilter = { ...appliedFilters };

      // Fetch activities, stats, and filter options in parallel
      const [activitiesRes, statsRes, optionsRes] = await Promise.all([
        getActivities(currentPage, itemsPerPage, currentFilter),
        getActivityStats(currentFilter),
        getActivityFilterOptions(),
      ]);

      if (activitiesRes?.success && Array.isArray(activitiesRes.data)) {
        setActivities(activitiesRes.data);
        if (activitiesRes.pagination) {
          setPagination(activitiesRes.pagination);
        }
      }

      if (statsRes?.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (optionsRes?.success && optionsRes.data) {
        setFilterOptions(optionsRes.data);
      }
    } catch (err) {
      console.error('Error fetching activity data:', err);
      setError(t('activity.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, appliedFilters, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!pagination) {
      return;
    }

    const totalPages = Math.max(1, pagination.totalPages || 1);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [pagination, currentPage]);

  // Handle view activity details
  const handleViewDetails = async (activity: Activity) => {
    try {
      const response = await getActivityById(activity.id);
      if (response?.success && response.data) {
        setSelectedActivity(response.data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Error fetching activity details:', err);
    }
  };

  // Handle cleanup old activities
  const handleCleanup = async () => {
    if (!window.confirm(t('activity.confirmCleanup'))) {
      return;
    }

    try {
      const response = await deleteOldActivities(30);
      if (response?.success) {
        alert(t('activity.cleanupSuccess', { count: response.data?.deletedCount || 0 }));
        fetchData();
      }
    } catch (err) {
      console.error('Error cleaning up activities:', err);
      alert(t('activity.cleanupError'));
    }
  };

  // Handle search
  const handleSearch = () => {
    const filters: ActivityFilter = {};
    if (searchServer) filters.server = searchServer;
    if (searchTool) filters.tool = searchTool;
    if (searchStatus && isValidStatus(searchStatus)) {
      filters.status = searchStatus;
    }
    if (searchUsername) filters.username = searchUsername;

    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchServer('');
    setSearchTool('');
    setSearchStatus('');
    setSearchUsername('');
    setAppliedFilters({});
    setCurrentPage(1);
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Parse JSON safely
  const safeParseJSON = (str: string | undefined): unknown => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const formatPayload = (value: unknown): string => {
    if (value == null || value === '') {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  // Render stats cards
  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: t('activity.totalCalls'), value: stats.totalCalls, tone: 'default' as const },
          { label: t('activity.successCount'), value: stats.successCount, tone: 'ok' as const },
          { label: t('activity.errorCount'), value: stats.errorCount, tone: 'err' as const },
          {
            label: t('activity.avgDuration'),
            value: formatDuration(stats.avgDuration),
            tone: 'default' as const,
          },
        ].map((s) => (
          <div key={s.label} className="hub-card" style={{ padding: '12px 14px' }}>
            <div className="text-[12px]" style={{ color: 'var(--hub-ink-3)' }}>
              {s.label}
            </div>
            <div
              className="hub-num"
              style={{
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.1,
                marginTop: 6,
                letterSpacing: '-0.02em',
                color:
                  s.tone === 'ok'
                    ? 'oklch(0.4 0.13 145)'
                    : s.tone === 'err'
                      ? 'oklch(0.45 0.18 25)'
                      : 'var(--hub-ink)',
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render filters
  const renderFilters = () => {
    const toOptions = (values?: string[]) =>
      (values || []).map((value) => ({ value, label: value }));

    return (
      <div className="hub-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="activity-filters">
          <FilterSelect
            id="activity-server"
            label={t('activity.server')}
            value={searchServer}
            onChange={setSearchServer}
            options={toOptions(filterOptions?.servers)}
            placeholder={t('activity.searchServer')}
          />
          <FilterSelect
            id="activity-tool"
            label={t('activity.tool')}
            value={searchTool}
            onChange={setSearchTool}
            options={toOptions(filterOptions?.tools)}
            placeholder={t('activity.searchTool')}
          />
          <FilterSelect
            id="activity-status"
            label={t('activity.status')}
            value={searchStatus}
            onChange={setSearchStatus}
            options={STATUS_OPTIONS.map((status) => ({
              value: status,
              label:
                status === 'success' ? t('activity.statusSuccess') : t('activity.statusError'),
            }))}
            placeholder={t('activity.searchStatus')}
          />
          <FilterSelect
            id="activity-username"
            label={t('activity.user')}
            value={searchUsername}
            onChange={setSearchUsername}
            options={toOptions([
              ...new Set([...(filterOptions?.usernames || []), ...(filterOptions?.keyNames || [])]),
            ])}
            placeholder={t('activity.searchUsername')}
          />
          <div className="activity-filter-actions">
            <button type="button" onClick={handleSearch} className="hub-btn primary">
              {t('common.search')}
            </button>
            <button type="button" onClick={handleClearFilters} className="hub-btn">
              {t('common.clear')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render activity table
  const renderActivityTable = () => {
    if (activities.length === 0) {
      return (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('activity.noData')}
        </div>
      );
    }

    return (
      <div className="hub-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead style={{ background: 'var(--hub-bg-2)' }}>
              <tr>
                {[
                  t('activity.timestamp'),
                  t('activity.server'),
                  t('activity.tool'),
                  t('activity.duration'),
                  t('activity.status'),
                  t('activity.user'),
                  t('activity.sourceIp'),
                  t('common.actions'),
                ].map((label) => (
                  <th
                    key={label}
                    className="hub-mono"
                    style={{
                      padding: '9px 14px',
                      textAlign: 'left',
                      fontSize: 11,
                      color: 'var(--hub-ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr
                  key={activity.id}
                  className="transition-colors hover:bg-[var(--hub-surface-hover)]"
                  style={{ borderTop: '1px solid var(--hub-line-2)' }}
                >
                  <td
                    className="hub-mono whitespace-nowrap"
                    style={{ padding: '10px 14px', fontSize: 12, color: 'var(--hub-ink-2)' }}
                  >
                    {formatTimestamp(activity.timestamp)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className="hub-tag">{activity.server}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className="hub-tag accent">{activity.tool}</span>
                  </td>
                  <td
                    className="hub-mono hub-num whitespace-nowrap"
                    style={{ padding: '10px 14px', fontSize: 12, color: 'var(--hub-ink-2)' }}
                  >
                    {formatDuration(activity.duration)}
                  </td>
                  <td style={{ padding: '10px 14px' }} className="whitespace-nowrap">
                    <span
                      className={`hub-status ${activity.status === 'success' ? 'ok' : 'err'}`}
                    >
                      <span className="hub-dot" />
                      {activity.status === 'success'
                        ? t('activity.statusSuccess')
                        : t('activity.statusError')}
                    </span>
                  </td>
                  <td
                    style={{ padding: '10px 14px', fontSize: 12, color: 'var(--hub-ink-3)' }}
                  >
                    {activity.username || activity.keyName || '—'}
                  </td>
                  <td
                    className="hub-mono whitespace-nowrap"
                    style={{ padding: '10px 14px', fontSize: 12, color: 'var(--hub-ink-3)' }}
                  >
                    {activity.sourceIp || '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleViewDetails(activity)}
                      className="hub-btn ghost sm"
                      style={{ color: 'var(--hub-accent)' }}
                    >
                      {t('common.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render detail modal
  const renderDetailModal = () => {
    if (!showDetailModal || !selectedActivity) return null;

    const inputText = formatPayload(safeParseJSON(selectedActivity.input) ?? selectedActivity.input);
    const outputText = formatPayload(
      safeParseJSON(selectedActivity.output) ?? selectedActivity.output,
    );
    const ok = selectedActivity.status === 'success';

    const meta = [
      { label: t('activity.timestamp'), value: formatTimestamp(selectedActivity.timestamp) },
      { label: t('activity.duration'), value: formatDuration(selectedActivity.duration), mono: true },
      { label: t('activity.server'), value: selectedActivity.server, mono: true },
      { label: t('activity.tool'), value: selectedActivity.tool, mono: true },
      { label: t('activity.user'), value: selectedActivity.username || selectedActivity.keyName || '—' },
      { label: t('activity.sourceIp'), value: selectedActivity.sourceIp || '—', mono: true },
      { label: t('activity.requestId'), value: selectedActivity.requestId || '—', mono: true },
      { label: t('activity.target'), value: selectedActivity.targetName || '—', mono: true },
      { label: t('activity.credential'), value: selectedActivity.credentialName || '—', mono: true },
      { label: t('activity.resourceGroup'), value: selectedActivity.resourceGroupName || '—' },
    ];

    return (
      <div className="ylune-dialog-backdrop">
        <div className="ylune-dialog is-xl">
          <div className="ylune-dialog-head">
            <div>
              <h3 className="ylune-dialog-title">{t('activity.details')}</h3>
              <p className="ylune-help" style={{ margin: '4px 0 0' }}>
                {t('activity.detailsHint')}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`hub-status ${ok ? 'ok' : 'err'}`}>
                <span className="hub-dot" />
                {ok ? t('activity.statusSuccess') : t('activity.statusError')}
              </span>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="hub-icon-btn sm"
                aria-label={t('common.close')}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="ylune-dialog-body">
            <dl className="activity-meta">
              {meta.map((item) => (
                <div key={item.label} className="activity-meta-item">
                  <dt>{item.label}</dt>
                  <dd className={item.mono ? 'hub-mono' : undefined}>{item.value}</dd>
                </div>
              ))}
            </dl>

            {selectedActivity.errorMessage && (
              <div className="activity-error">
                <div className="ylune-label" style={{ marginBottom: 6, color: 'inherit' }}>
                  {t('activity.errorMessage')}
                </div>
                {selectedActivity.errorMessage}
              </div>
            )}

            <CopyableCode
              title={t('activity.input')}
              value={inputText}
              emptyLabel={t('activity.emptyPayload')}
            />
            <CopyableCode
              title={t('activity.output')}
              value={outputText}
              emptyLabel={t('activity.emptyPayload')}
            />
          </div>
          <div className="ylune-dialog-foot">
            <button type="button" className="hub-btn" onClick={() => setShowDetailModal(false)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('activity.title')}</h1>
          <p className="hub-sub">{t('logs.entries', { count: pagination?.total ?? activities.length })}</p>
        </div>
        <div className="view-actions">
          <button onClick={handleCleanup} className="hub-btn danger">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {t('activity.cleanup')}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="hub-card flex items-center justify-between gap-3 mb-4"
          style={{
            padding: '10px 14px',
            borderColor: 'oklch(0.85 0.1 25)',
            background: 'oklch(0.97 0.03 25)',
            color: 'oklch(0.4 0.18 25)',
          }}
        >
          <span className="truncate text-[13px]">{error}</span>
          <button className="hub-icon-btn sm" onClick={() => setError(null)} aria-label="close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {isLoading && activities.length === 0 ? (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('app.loading')}
        </div>
      ) : (
        <>
          {renderStats()}
          {renderFilters()}
          {renderActivityTable()}

          {/* Pagination */}
          <div className="flex items-center mt-6">
            <div className="flex-[2] text-sm text-gray-500 dark:text-gray-400">
              {pagination &&
                t('common.showing', {
                  start: (pagination.page - 1) * pagination.limit + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                })}
            </div>
            <div className="flex-[4] flex justify-center">
              {pagination && pagination.totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={setCurrentPage}
                  disabled={isLoading}
                />
              )}
            </div>
            <div className="flex-[2] flex items-center justify-end" style={{ minWidth: 160 }}>
              <FilterSelect
                id="perPage"
                label={t('common.itemsPerPage')}
                value={String(itemsPerPage)}
                onChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
                options={[
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
                searchable={false}
                allowEmpty={false}
              />
            </div>
          </div>
        </>
      )}

      {renderDetailModal()}
    </div>
  );
};

export default ActivityPage;
