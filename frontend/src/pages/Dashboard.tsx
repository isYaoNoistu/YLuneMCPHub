import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { useGroupData } from '@/hooks/useGroupData';
import { useCostData } from '@/hooks/useCostData';
import { formatTokens } from '@/utils/contextCost';
import { buildGroupToolRows, groupsWithoutMembers, serversNotInGroups } from '@/utils/groupTools';
import { checkActivityAvailable, getActivityUsage } from '@/services/activityService';
import { ActivityUsage, Server } from '@/types';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const { allServers, error, setError, isLoading, triggerRefresh } = useServerData({
    refreshOnMount: true,
  });
  const { groups } = useGroupData();
  const { serverCosts } = useCostData();

  const [hasLoaded, setHasLoaded] = React.useState(false);
  const loadingStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (isLoading) {
      loadingStartedRef.current = true;
      return;
    }
    if (loadingStartedRef.current || allServers.length > 0 || error) setHasLoaded(true);
  }, [isLoading, allServers.length, error]);

  const stats = useMemo(
    () => ({
      total: allServers.length,
      online: allServers.filter((s: Server) => s.status === 'connected').length,
      disabled: allServers.filter((s: Server) => s.enabled === false).length,
      offline: allServers.filter((s: Server) => s.status === 'disconnected' && s.enabled !== false)
        .length,
      connecting: allServers.filter(
        (s: Server) =>
          (s.status === 'connecting' || s.status === 'oauth_required') && s.enabled !== false,
      ).length,
      tools: allServers.reduce((acc, s) => acc + (s.tools?.length || 0), 0),
    }),
    [allServers],
  );

  const footprint = useMemo(
    () => serverCosts.filter((c) => c.connected).reduce((acc, c) => acc + c.exposed, 0),
    [serverCosts],
  );

  const groupRows = useMemo(() => buildGroupToolRows(groups, allServers), [groups, allServers]);
  const emptyMemberGroups = useMemo(() => groupsWithoutMembers(groups), [groups]);
  const ungroupedServers = useMemo(
    () => serversNotInGroups(allServers, groups),
    [allServers, groups],
  );

  const [usage, setUsage] = useState<ActivityUsage | null>(null);
  const [usageNote, setUsageNote] = useState<string | null>(null);

  const loadUsage = React.useCallback(async () => {
    if (!isAdmin) {
      setUsage(null);
      setUsageNote(null);
      return;
    }
    const available = await checkActivityAvailable();
    if (!available) {
      setUsage(null);
      setUsageNote(t('pages.dashboard.usageNeedsDb'));
      return;
    }
    try {
      const response = await getActivityUsage(7, 10);
      if (response?.success && response.data) {
        setUsage(response.data);
        setUsageNote(null);
      } else {
        setUsage(null);
        setUsageNote(t('pages.dashboard.usageUnavailable'));
      }
    } catch {
      setUsage(null);
      setUsageNote(t('pages.dashboard.usageUnavailable'));
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const showSkeleton = !hasLoaded;
  const maxTool = Math.max(1, ...(usage?.tools.map((item) => item.count) || [0]));
  const maxUser = Math.max(1, ...(usage?.users.map((item) => item.count) || [0]));
  const maxDay = Math.max(1, ...(usage?.days.map((item) => item.count) || [0]));

  return (
    <section aria-labelledby="dashboardTitle">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1" id="dashboardTitle">
            网关概览
          </h1>
          <p className="hub-sub">MCP 服务统一入口的实时状态。</p>
        </div>
        <div className="view-actions">
          <span className="hub-tag accent">LIVE</span>
          <button
            className="hub-btn"
            type="button"
            onClick={() => {
              triggerRefresh();
              void loadUsage();
            }}
          >
            刷新
          </button>
          <button className="hub-btn primary" type="button" onClick={() => navigate('/servers')}>
            ＋ {t('server.add')}
          </button>
        </div>
      </div>

      {error && (
        <p className="form-msg" style={{ marginBottom: 16 }}>
          {error}{' '}
          <button type="button" className="cfg-link" onClick={() => setError(null)}>
            {t('app.closeButton')}
          </button>
        </p>
      )}

      <div className="stat-grid">
        {(showSkeleton ? Array.from({ length: 6 }) : [0]).map((_, i) =>
          showSkeleton ? <div key={i} className="stat-card" style={{ minHeight: 88 }} /> : null,
        )}
        {!showSkeleton && (
          <>
            <article className="stat-card">
              <div className="stat-num">
                {stats.online}
                <i>/{stats.total}</i>
              </div>
              <div className="stat-label">{t('pages.dashboard.onlineServers')}</div>
              <p className="stat-note mono">
                OFF {stats.offline} · CONN {stats.connecting} · OFFX {stats.disabled}
              </p>
            </article>
            <article className="stat-card">
              <div className="stat-num">{groups.length}</div>
              <div className="stat-label">{t('nav.groups')}</div>
              <p className="stat-note mono">GROUP ROUTES</p>
            </article>
            <article className="stat-card">
              <div className="stat-num">{stats.tools}</div>
              <div className="stat-label">{t('server.tools')}</div>
              <p className="stat-note mono">EXPOSED TOOLS</p>
            </article>
            <article className="stat-card">
              <div className="stat-num">{formatTokens(footprint)}</div>
              <div className="stat-label">{t('cost.totalFootprint')}</div>
              <p className="stat-note mono">CONTEXT TOKENS</p>
            </article>
          </>
        )}
      </div>

      <p className="dash-endpoint-note mono">{t('pages.dashboard.unifiedEndpointNote')}</p>

      <h2 className="block-title mono">// {t('pages.dashboard.groupMatrix')}</h2>
      {groups.length === 0 && !showSkeleton ? (
        <button className="group-add" type="button" onClick={() => navigate('/groups')}>
          <span className="group-add-plus" aria-hidden="true">
            ＋
          </span>
          <b>Add</b>
          <span className="mono">ADD NEW GROUP</span>
        </button>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>{t('pages.dashboard.colGroup')}</th>
                <th>{t('pages.dashboard.colMembers')}</th>
                <th>{t('pages.dashboard.colServers')}</th>
                <th>{t('pages.dashboard.colTools')}</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="cfg-link" onClick={() => navigate('/groups')}>
                      {row.name}
                    </button>
                    {row.description ? <div className="dash-muted">{row.description}</div> : null}
                  </td>
                  <td>
                    {row.members.length === 0 ? (
                      <span className="dash-warn">{t('pages.dashboard.noMembers')}</span>
                    ) : (
                      <div className="dash-chips">
                        {row.members.map((member) => (
                          <span key={member} className="dash-chip">
                            {member}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="mono">{row.servers.length}</td>
                  <td>
                    {row.tools.length === 0 ? (
                      <span className="dash-muted">—</span>
                    ) : (
                      <div className="dash-chips">
                        {row.tools.map((tool) => (
                          <span key={`${row.id}-${tool.server}-${tool.name}`} className="dash-chip">
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (emptyMemberGroups.length > 0 || ungroupedServers.length > 0) && (
        <div className="dash-attention">
          {emptyMemberGroups.length > 0 && (
            <p>
              {t('pages.dashboard.emptyMemberGroups')}: {emptyMemberGroups.join(', ')}
            </p>
          )}
          {ungroupedServers.length > 0 && (
            <p>
              {t('pages.dashboard.ungroupedServers')}: {ungroupedServers.join(', ')}
            </p>
          )}
        </div>
      )}

      {isAdmin && (
        <>
          <div className="dash-section-head">
            <h2 className="block-title mono">// {t('pages.dashboard.usageTitle')}</h2>
            <button type="button" className="cfg-link" onClick={() => navigate('/activity')}>
              {t('pages.dashboard.viewActivity')} →
            </button>
          </div>
          {usageNote && <p className="dash-muted">{usageNote}</p>}
          {usage && (
            <>
              <div className="dash-days" aria-label={t('pages.dashboard.last7Days')}>
                {usage.days.map((day) => (
                  <div key={day.date} className="dash-day">
                    <div
                      className="dash-day-bar"
                      style={{ height: `${Math.max(4, (day.count / maxDay) * 64)}px` }}
                      title={`${day.date} ${day.count}`}
                    />
                    <span className="mono">{day.date.slice(5)}</span>
                    <b className="mono">{day.count}</b>
                  </div>
                ))}
              </div>
              <div className="dash-charts">
                <article className="dash-chart">
                  <h3>{t('pages.dashboard.toolCalls')}</h3>
                  {usage.tools.length === 0 ? (
                    <p className="dash-muted">{t('pages.dashboard.noCalls')}</p>
                  ) : (
                    usage.tools.map((item) => (
                      <div key={item.name} className="dash-bar-row">
                        <span className="dash-bar-label" title={item.name}>
                          {item.name}
                        </span>
                        <div className="dash-bar-track">
                          <div
                            className="dash-bar-fill"
                            style={{ width: `${(item.count / maxTool) * 100}%` }}
                          />
                        </div>
                        <span className="dash-bar-num mono">
                          {item.count}
                          {item.errors > 0 ? <i> /{item.errors}</i> : null}
                        </span>
                      </div>
                    ))
                  )}
                </article>
                <article className="dash-chart">
                  <h3>{t('pages.dashboard.userCalls')}</h3>
                  {usage.users.length === 0 ? (
                    <p className="dash-muted">{t('pages.dashboard.noCalls')}</p>
                  ) : (
                    usage.users.map((item) => (
                      <div key={item.name} className="dash-bar-row">
                        <span className="dash-bar-label" title={item.name}>
                          {item.name}
                        </span>
                        <div className="dash-bar-track">
                          <div
                            className="dash-bar-fill is-user"
                            style={{ width: `${(item.count / maxUser) * 100}%` }}
                          />
                        </div>
                        <span className="dash-bar-num mono">
                          {item.count}
                          {item.errors > 0 ? <i> /{item.errors}</i> : null}
                        </span>
                      </div>
                    ))
                  )}
                </article>
              </div>
              <h2 className="block-title mono">// {t('pages.dashboard.recentErrors')}</h2>
              {usage.recentErrors.length === 0 ? (
                <p className="dash-muted">{t('pages.dashboard.noRecentErrors')}</p>
              ) : (
                <ul className="dash-errors">
                  {usage.recentErrors.map((item) => (
                    <li key={item.id}>
                      <span className="mono">{new Date(item.timestamp).toLocaleString()}</span>
                      <strong>{item.tool}</strong>
                      <span>{item.username || '—'}</span>
                      <span className="dash-error-msg">{item.errorMessage || t('activity.statusError')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};

export default DashboardPage;
