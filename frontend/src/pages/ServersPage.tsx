import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search, Upload, FileCode, AlertCircle, X } from 'lucide-react';
import { Server } from '@/types';
import ServerCard from '@/components/ServerCard';
import AddServerForm from '@/components/AddServerForm';
import EditServerForm from '@/components/EditServerForm';
import McpbUploadForm from '@/components/McpbUploadForm';
import JSONImportForm from '@/components/JSONImportForm';
import Pagination from '@/components/ui/Pagination';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoUser } from '@/utils/navigationPermissions';
import { selectServerPage, getServerFilterCounts, type ServerFilter } from '@/utils/serverFilters';
import ToolChangeBanner from '@/components/ToolChangeBanner';
import { extractSearchTags } from '@/utils/toolInventory';

const ServersPage: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isDemo = isDemoUser(auth.user);
  const {
    servers,
    allServers,
    error,
    setError,
    isLoading,
    currentPage,
    serversPerPage,
    setCurrentPage,
    setServersPerPage,
    handleServerAdd,
    handleServerEdit,
    handleServerRemove,
    handleServerToggle,
    handleServerVisibilityChange,
    handleServerReload,
    handleServerReinstall,
    handleServerOAuthDisconnect,
    triggerRefresh,
  } = useServerData({ refreshOnMount: true });

  const { serverCosts, refetch: refetchCost } = useCostData();

  // Re-fetch context footprint whenever server data changes (toggle, reload, edit).
  useEffect(() => {
    refetchCost();
  }, [servers, refetchCost]);

  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMcpbUpload, setShowMcpbUpload] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [filter, setFilter] = useState<ServerFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => getServerFilterCounts(allServers), [allServers]);
  const searchTags = useMemo(() => extractSearchTags(allServers).slice(0, 16), [allServers]);

  // Filter against the full list and paginate the filtered result client-side,
  // so status filters reach servers that live on other pagination pages.
  const { servers: visibleServers, pagination: clientPagination } = useMemo(
    () => selectServerPage(allServers, filter, search, currentPage, serversPerPage),
    [allServers, filter, search, currentPage, serversPerPage],
  );

  // Sync currentPage when client-side pagination clamps it (filter/search narrows results).
  useEffect(() => {
    if (clientPagination.page !== currentPage) {
      setCurrentPage(clientPagination.page);
    }
  }, [clientPagination.page, currentPage, setCurrentPage]);

  const handleEditClick = async (server: Server) => {
    const fullServerData = await handleServerEdit(server);
    if (fullServerData) setEditingServer(fullServerData);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      triggerRefresh();
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="hub-page-stack servers-page">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('pages.servers.title')}</h1>
          <p className="hub-sub">
            <span className="hub-num">{counts.all}</span> {t('nav.servers')} ·{' '}
            <span className="hub-num">{counts.online}</span> {t('status.online')} ·{' '}
            <span className="hub-num">{counts.issues}</span>{' '}
            {t('common.inactive') || 'issues'}
          </p>
        </div>
        <div className="view-actions">
          {!isDemo && (
            <>
              <button className="hub-btn" onClick={() => setShowJsonImport(true)}>
                <FileCode size={13} /> {t('jsonImport.button')}
              </button>
              <button className="hub-btn" onClick={() => setShowMcpbUpload(true)}>
                <Upload size={13} /> {t('mcpb.upload')}
              </button>
            </>
          )}
          <button
            className="hub-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={t('common.refresh')}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
          {!isDemo && <AddServerForm onAdd={handleServerAdd} />}
        </div>
      </div>

      {error && (
        <div
          className="hub-card flex items-center justify-between gap-3"
          style={{
            padding: '10px 14px',
            borderColor: 'oklch(0.85 0.1 25)',
            background: 'oklch(0.97 0.03 25)',
            color: 'oklch(0.4 0.18 25)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span className="truncate text-[13px]">{error}</span>
          </div>
          <button
            className="hub-icon-btn sm"
            onClick={() => setError(null)}
            aria-label={t('app.closeButton')}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {!isDemo && <ToolChangeBanner />}

      <div className="servers-toolbar">
        <div className="servers-filters">
          {(
            [
              ['all', t('common.all') || 'All', counts.all],
              ['online', t('status.online'), counts.online],
              ['issues', t('common.inactive') || 'Issues', counts.issues],
              ['disabled', t('pages.dashboard.disabledServers') || 'Disabled', counts.disabled],
            ] as [ServerFilter, string, number][]
          ).map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`servers-filter${filter === k ? ' is-on' : ''}`}
            >
              {l}
              <span>{n}</span>
            </button>
          ))}
        </div>

        <label className="servers-search">
          <Search size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.servers.searchPlaceholder') || t('market.searchPlaceholder') || 'Search…'}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="hub-icon-btn sm" aria-label="clear">
              <X size={11} />
            </button>
          )}
        </label>

        <span className="servers-count">
          {clientPagination.total}/{allServers.length}
        </span>
      </div>

      {searchTags.length > 0 && (
        <div className="servers-filters" style={{ flexWrap: 'wrap' }}>
          {searchTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`servers-filter${search === tag.replace(/^#/, '') || search === tag ? ' is-on' : ''}`}
              onClick={() => setSearch(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading && servers.length === 0 ? (
        <div className="hub-card p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--hub-ink-3)' }} />
            <p style={{ color: 'var(--hub-ink-3)' }}>{t('app.loading')}</p>
          </div>
        </div>
      ) : visibleServers.length === 0 ? (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          <p>{servers.length === 0 ? t('app.noServers') : t('market.noServers')}</p>
        </div>
      ) : (
        <div className="hub-card overflow-visible servers-table">
          {visibleServers.map((server) => (
            <ServerCard
              key={server.name}
              server={server}
              cost={serverCosts.find((c) => c.name === server.name)}
              onRemove={handleServerRemove}
              onEdit={handleEditClick}
              onToggle={handleServerToggle}
              onVisibilityChange={handleServerVisibilityChange}
              onRefresh={triggerRefresh}
              onReload={handleServerReload}
              onReinstall={handleServerReinstall}
              onOAuthDisconnect={handleServerOAuthDisconnect}
            />
          ))}
          <div className="hub-card-foot is-split">
            <span className="hub-pager-meta">
              {t('common.showing', {
                start: (clientPagination.page - 1) * clientPagination.limit + 1,
                end: Math.min(clientPagination.page * clientPagination.limit, clientPagination.total),
                total: clientPagination.total,
              })}
            </span>
            <Pagination
              currentPage={clientPagination.page}
              totalPages={clientPagination.totalPages}
              onPageChange={setCurrentPage}
              disabled={isLoading}
            />
            <div className="hub-pager">
              <label className="hub-pager-meta" htmlFor="perPage">
                {t('common.itemsPerPage')}
              </label>
              <select
                id="perPage"
                value={serversPerPage}
                onChange={(e) => setServersPerPage(Number(e.target.value))}
                disabled={isLoading}
                className="hub-input"
                style={{ height: 30, width: 72, padding: '0 8px', fontSize: 12 }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {!isDemo && editingServer && (
        <EditServerForm
          server={editingServer}
          onEdit={() => {
            setEditingServer(null);
            triggerRefresh();
          }}
          onCancel={() => setEditingServer(null)}
        />
      )}
      {!isDemo && showMcpbUpload && (
        <McpbUploadForm
          onSuccess={() => {
            setShowMcpbUpload(false);
            triggerRefresh();
          }}
          onCancel={() => setShowMcpbUpload(false)}
        />
      )}
      {!isDemo && showJsonImport && (
        <JSONImportForm
          onSuccess={() => {
            setShowJsonImport(false);
            triggerRefresh();
          }}
          onCancel={() => setShowJsonImport(false)}
        />
      )}
    </div>
  );
};

export default ServersPage;
