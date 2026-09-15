import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { useUserData } from '@/hooks/useUserData';
import { useSettingsData } from '@/hooks/useSettingsData';
import { formatTokens } from '@/utils/contextCost';
import { getActivityAvailability, getActivityUsage } from '@/services/activityService';
import { ActivityUsage, IGroupServerConfig, IUser, Server, User } from '@/types';
import { getMcpEndpointUrl } from '@/utils/userMcpConfig';
import { isDemoUser } from '@/utils/navigationPermissions';
import { isExpiredUser } from '@/utils/expiryCenter';
import {
  DashboardUsageStatus,
  resolveUsageSurfaceState,
  takeDashboardPreview,
} from '@/utils/dashboardPresentation';
import ConfigBackupButton from '@/components/ConfigBackupButton';
import DashboardAttentionPanel from '@/components/DashboardAttentionPanel';
import UsageLineChart from '@/components/UsageLineChart';

const formatWhen = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const tokenRemainingLabel = (
  user: IUser,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (user.mcpEnabled === false) {
    return t('users.adminNoMcp');
  }
  if (!user.tokenExpiresAt) {
    return t('users.tokenNeverExpires');
  }
  if (isExpiredUser(user)) {
    return t('users.tokenExpired');
  }
  const ms = new Date(user.tokenExpiresAt).getTime() - Date.now();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) {
    return t('pages.dashboard.tokenRemainingDays', { days });
  }
  if (hours >= 1) {
    return t('pages.dashboard.tokenRemainingHours', { hours });
  }
  return t('pages.dashboard.tokenRemainingSoon');
};

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const isDemo = isDemoUser(auth.user);
  const { allServers, error, setError, isLoading, triggerRefresh } = useServerData();
  const { serverCosts } = useCostData();
  const { users, triggerRefresh: refreshUsers } = useUserData();
  const { installConfig } = useSettingsData();

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
      admins: users.filter((user) => user.isAdmin).length,
      regulars: users.filter((user) => !user.isAdmin).length,
    }),
    [allServers, users],
  );

  const footprint = useMemo(
    () => serverCosts.filter((c) => c.connected).reduce((acc, c) => acc + c.exposed, 0),
    [serverCosts],
  );

  const [usage, setUsage] = useState<ActivityUsage | null>(null);
  const [usageStatus, setUsageStatus] = useState<DashboardUsageStatus>(
    isAdmin ? 'loading' : 'unavailable',
  );

  const loadUsage = React.useCallback(async () => {
    if (!isAdmin) {
      setUsage(null);
      setUsageStatus('unavailable');
      return;
    }
    setUsageStatus('loading');
    const availability = await getActivityAvailability();
    if (availability !== 'available') {
      setUsage(null);
      setUsageStatus(availability);
      return;
    }
    try {
      const response = await getActivityUsage(7, 10);
      if (response?.success && response.data) {
        setUsage(response.data);
        setUsageStatus('ready');
      } else {
        setUsage(null);
        setUsageStatus('unavailable');
      }
    } catch {
      setUsage(null);
      setUsageStatus('unavailable');
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const showSkeleton = !hasLoaded;
  const usageSurface = resolveUsageSurfaceState(usageStatus, usage !== null);
  const usageNote =
    usageStatus === 'needs_db'
      ? t('pages.dashboard.usageNeedsDb')
      : usageStatus === 'unavailable'
        ? t('pages.dashboard.usageUnavailable')
        : null;
  const maxTool = Math.max(1, ...(usage?.tools.map((item) => item.count) || [0]));
  const maxUser = Math.max(1, ...(usage?.users.map((item) => item.count) || [0]));
  const todayUsage = usage?.days[usage.days.length - 1];
  const weekCalls = usage?.days.reduce((sum, day) => sum + day.count, 0) ?? null;
  const lastFailure = usageSurface === 'ready' ? usage?.recentErrors[0] : undefined;
  const mcpEndpoint = getMcpEndpointUrl(installConfig?.baseUrl);
  const sessionUser = auth.user as IUser | null;
  const myGrants = sessionUser?.grants || [];
  const serverPreview = takeDashboardPreview(allServers, 6);
  const grantPreview = takeDashboardPreview(myGrants, 6);
  const myToolCount = myGrants.reduce((sum, grant) => {
    if (!grant.tools || grant.tools === 'all') {
      const server = allServers.find((item) => item.name === grant.name);
      return sum + (server?.tools?.length || 0);
    }
    return sum + grant.tools.length;
  }, 0);

  const grantToolsLabel = (grant: IGroupServerConfig) => {
    if (!grant.tools || grant.tools === 'all') {
      return t('pages.dashboard.allToolsOnServer');
    }
    return t('pages.dashboard.toolCount', { count: grant.tools.length });
  };

  const serverStatus = (server: Server) => {
    if (server.enabled === false) {
      return { text: t('pages.dashboard.disabledServers'), tone: 'muted' as const };
    }
    if (server.status === 'connected') {
      return { text: t('status.online'), tone: 'ok' as const };
    }
    if (server.status === 'connecting') {
      return { text: t('status.connecting'), tone: 'warn' as const };
    }
    if (server.status === 'oauth_required') {
      return { text: t('status.oauthRequired'), tone: 'warn' as const };
    }
    return { text: t('status.offline'), tone: 'err' as const };
  };

  const summaryCards = isAdmin
    ? [
        {
          label: t('pages.dashboard.healthSummary'),
          value: `${stats.online}/${stats.total}`,
          note: t('pages.dashboard.offlineNow', { count: stats.offline }),
        },
        {
          label: t('server.tools'),
          value: String(stats.tools),
          note: t('pages.dashboard.totalToolsNote'),
        },
        {
          label: t('pages.dashboard.todayCalls'),
          value: usageSurface === 'ready' && todayUsage ? String(todayUsage.count) : '—',
          note:
            usageSurface === 'loading'
              ? t('common.loading')
              : usageSurface === 'unavailable'
                ? usageNote || t('pages.dashboard.usageUnavailable')
                : todayUsage
                  ? `${t('pages.dashboard.todayErrors')} ${todayUsage.errors}`
                  : t('pages.dashboard.noCalls'),
        },
        {
          label: t('pages.dashboard.weekCalls'),
          value: usageSurface === 'ready' && weekCalls != null ? String(weekCalls) : '—',
          note:
            usageSurface === 'loading'
              ? t('common.loading')
              : usageSurface === 'unavailable'
                ? t('pages.dashboard.dataUnavailableShort')
                : t('pages.dashboard.last7Days'),
        },
      ]
    : isDemo
      ? [
          {
            label: t('pages.dashboard.onlineServers'),
            value: `${stats.online}/${stats.total}`,
            note: t('pages.dashboard.offlineServers'),
          },
          {
            label: t('server.tools'),
            value: String(stats.tools),
            note: t('pages.dashboard.disabledServers'),
          },
          {
            label: t('pages.dashboard.offlineServers'),
            value: String(stats.offline),
            note: t('status.offline'),
          },
          {
            label: t('pages.dashboard.disabledServers'),
            value: String(stats.disabled),
            note: t('pages.dashboard.totalServers'),
          },
        ]
      : [
          {
            label: t('pages.dashboard.myServers'),
            value: String(myGrants.length),
            note: t('pages.dashboard.grantedTools'),
          },
          {
            label: t('pages.dashboard.grantedTools'),
            value: myGrants.length === 0 ? '—' : String(myToolCount),
            note: t('pages.dashboard.allToolsOnServer'),
          },
          {
            label: t('pages.dashboard.tokenRemaining'),
            value: sessionUser ? tokenRemainingLabel(sessionUser, t) : '—',
            note: t('pages.dashboard.lastCalledAt'),
          },
          {
            label: t('pages.dashboard.lastCalledAt'),
            value: formatWhen(sessionUser?.lastCalledAt),
            note: t('pages.dashboard.createdAt'),
          },
        ];

  return (
    <section className="hub-page-stack" aria-labelledby="dashboardTitle">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1" id="dashboardTitle">
            {t('pages.dashboard.title')}
          </h1>
          <p className="hub-sub">{t('pages.dashboard.subtitle')}</p>
        </div>
        <div className="view-actions">
          <span className="hub-tag accent">LIVE</span>
          {isAdmin && <ConfigBackupButton />}
          <button
            className="hub-btn"
            type="button"
            onClick={() => {
              triggerRefresh();
              if (!isDemo) {
                refreshUsers();
              }
              void loadUsage();
            }}
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="dash-summary-grid">
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, index) => (
              <article key={index} className="dash-summary-card is-skeleton" />
            ))
          : summaryCards.map((card) => (
              <article key={card.label} className="dash-summary-card">
                <span className="dash-summary-label">{card.label}</span>
                <b className="dash-summary-value hub-mono">{card.value}</b>
                <span className="dash-summary-note">{card.note}</span>
              </article>
            ))}
      </div>

      {isAdmin && <DashboardAttentionPanel servers={allServers} users={users} />}

      {error && (
        <p className="form-msg">
          {error}{' '}
          <button type="button" className="cfg-link" onClick={() => setError(null)}>
            {t('app.closeButton')}
          </button>
        </p>
      )}

      <div className="dash-overview-grid">
        <article className="dash-card">
          <header className="dash-card-head">
            <h2>
              {isAdmin ? t('pages.dashboard.operationsTitle') : t('pages.dashboard.sessionTitle')}
            </h2>
            {isAdmin ? (
              <span className="hub-num hub-mono">
                {stats.online}/{stats.total}
              </span>
            ) : (
              <span className="hub-tag muted">
                {isDemo ? t('users.roleDemo') : t('users.user')}
              </span>
            )}
          </header>
          <p className="ylune-help dash-card-hint">
            {isAdmin
              ? t('pages.dashboard.snapshotHint')
              : isDemo
                ? t('pages.dashboard.youAreDemo')
                : t('pages.dashboard.youAreUser')}
          </p>

          <div className="dash-snapshot">
            {isAdmin && (
              <>
                <div className="dash-snapshot-item">
                  <span>{t('pages.dashboard.offlineServers')}</span>
                  <b className={`hub-num${stats.offline > 0 ? ' is-warn' : ''}`}>{stats.offline}</b>
                </div>
                <div className="dash-snapshot-item">
                  <span>{t('cost.totalFootprint')}</span>
                  <b className="hub-num">{formatTokens(footprint)}</b>
                </div>
                <div className="dash-snapshot-item is-wide">
                  <span>{t('pages.dashboard.lastFailure')}</span>
                  {lastFailure ? (
                    <a className="dash-latest-failure" href="#dashboard-failures">
                      <b className="is-err">{lastFailure.tool}</b>
                      <small>{new Date(lastFailure.timestamp).toLocaleString()}</small>
                    </a>
                  ) : (
                    <b>
                      {usageSurface === 'loading'
                        ? t('common.loading')
                        : usageSurface === 'unavailable'
                          ? usageNote
                          : t('pages.dashboard.noFailure')}
                    </b>
                  )}
                </div>
              </>
            )}
            {!isAdmin && !isDemo && (
              <>
                <div className="dash-snapshot-item">
                  <span>{t('pages.dashboard.tokenRemaining')}</span>
                  <b className={sessionUser && isExpiredUser(sessionUser) ? 'is-err' : undefined}>
                    {sessionUser ? tokenRemainingLabel(sessionUser, t) : '—'}
                  </b>
                </div>
                <div className="dash-snapshot-item">
                  <span>{t('pages.dashboard.createdAt')}</span>
                  <b>{formatWhen(sessionUser?.createdAt)}</b>
                </div>
              </>
            )}
          </div>

          {!isDemo && (
            <div className="dash-endpoint">
              <span>{t('pages.dashboard.mcpEndpoint')}</span>
              <code>{mcpEndpoint}</code>
            </div>
          )}

          <div className="dash-roster">
            <div className="dash-roster-head">
              <h3>
                {isAdmin || isDemo
                  ? t('pages.dashboard.serversNow')
                  : t('pages.dashboard.myServers')}
              </h3>
              <span className="hub-num hub-mono">
                {isAdmin || isDemo ? `${stats.online}/${stats.total}` : myGrants.length}
              </span>
            </div>
            {isAdmin || isDemo ? (
              allServers.length === 0 ? (
                <div className="dash-empty">
                  <strong>{t('pages.dashboard.noServersYet')}</strong>
                  {isAdmin && (
                    <Link className="cfg-link" to="/servers">
                      {t('pages.dashboard.addServer')}
                    </Link>
                  )}
                </div>
              ) : (
                serverPreview.visible.map((server) => {
                  const status = serverStatus(server);
                  return (
                    <div key={server.name} className="dash-roster-row">
                      <span className="dash-roster-name hub-mono" title={server.name}>
                        {server.name}
                      </span>
                      <div className="dash-roster-meta">
                        <span className={`hub-status ${status.tone}`}>
                          <i className="hub-dot" />
                          {status.text}
                        </span>
                        <span className="dash-roster-count hub-mono">
                          {server.tools?.length || 0} {t('server.tools')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : myGrants.length === 0 ? (
              <div className="dash-empty">
                <strong>{t('pages.dashboard.noGrantsYet')}</strong>
              </div>
            ) : (
              grantPreview.visible.map((grant) => {
                const server = allServers.find((item) => item.name === grant.name);
                const status = server
                  ? serverStatus(server)
                  : { text: t('status.offline'), tone: 'muted' as const };
                return (
                  <div key={grant.name} className="dash-roster-row">
                    <span className="dash-roster-name hub-mono" title={grant.name}>
                      {grant.name}
                    </span>
                    <div className="dash-roster-meta">
                      <span className={`hub-status ${status.tone}`}>
                        <i className="hub-dot" />
                        {status.text}
                      </span>
                      <span className="dash-roster-count hub-mono">{grantToolsLabel(grant)}</span>
                    </div>
                  </div>
                );
              })
            )}
            {(isAdmin || isDemo ? serverPreview.hiddenCount : grantPreview.hiddenCount) > 0 && (
              <div className="dash-roster-foot">
                <span>
                  {t('pages.dashboard.moreServers', {
                    count: isAdmin || isDemo ? serverPreview.hiddenCount : grantPreview.hiddenCount,
                  })}
                </span>
                <Link className="cfg-link" to="/servers">
                  {t('common.view')} {t('nav.servers')}
                </Link>
              </div>
            )}
          </div>
        </article>

        {isAdmin && (
          <article className="dash-card">
            <header className="dash-card-head">
              <h2>{t('pages.dashboard.trendTitle')}</h2>
              <span className="hub-num hub-mono">
                {usageSurface === 'ready' ? (weekCalls ?? '—') : '—'}
              </span>
            </header>
            {usageSurface === 'loading' ? (
              <div className="dash-empty" aria-busy="true">
                <strong>{t('common.loading')}</strong>
              </div>
            ) : usageSurface === 'ready' && usage ? (
              <UsageLineChart
                days={usage.days}
                ariaLabel={t('pages.dashboard.last7Days')}
                callsLabel={t('pages.dashboard.usageCalls')}
                errorsLabel={t('pages.dashboard.usageErrors')}
                interactionHint={t('pages.dashboard.trendInteractionHint')}
              />
            ) : (
              <div className="dash-empty is-unavailable" role="status">
                <strong>{t('pages.dashboard.dataUnavailableShort')}</strong>
                <span>{usageNote}</span>
              </div>
            )}
          </article>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="dash-detail-grid">
            <article className="dash-card">
              <header className="dash-card-head">
                <h2>{t('pages.dashboard.toolCalls')}</h2>
              </header>
              {usageSurface === 'loading' ? (
                <div className="dash-empty" aria-busy="true">
                  <strong>{t('common.loading')}</strong>
                </div>
              ) : usageSurface === 'unavailable' ? (
                <div className="dash-empty is-unavailable" role="status">
                  <strong>{t('pages.dashboard.dataUnavailableShort')}</strong>
                  <span>{usageNote}</span>
                </div>
              ) : !usage || usage.tools.length === 0 ? (
                <div className="dash-empty">
                  <strong>{t('pages.dashboard.noCalls')}</strong>
                  {t('pages.dashboard.emptyUsageHint')}
                </div>
              ) : (
                <div
                  className="dash-bar-list"
                  role="list"
                  aria-label={t('pages.dashboard.toolCalls')}
                >
                  {usage.tools.map((item) => (
                    <div
                      key={item.name}
                      className="dash-bar-row"
                      role="listitem"
                      aria-label={t('pages.dashboard.rankingAria', {
                        name: item.name,
                        calls: item.count,
                        errors: item.errors,
                      })}
                    >
                      <span className="dash-bar-label" title={item.name}>
                        {item.name}
                      </span>
                      <div className="dash-bar-track" aria-hidden="true">
                        <div
                          className="dash-bar-fill"
                          style={{ width: `${(item.count / maxTool) * 100}%` }}
                        />
                      </div>
                      <span className="dash-bar-num hub-mono">
                        {item.count}
                        {item.errors > 0 ? (
                          <i>{t('pages.dashboard.errorShort', { count: item.errors })}</i>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="dash-card">
              <header className="dash-card-head">
                <h2>{t('pages.dashboard.userCalls')}</h2>
              </header>
              {usageSurface === 'loading' ? (
                <div className="dash-empty" aria-busy="true">
                  <strong>{t('common.loading')}</strong>
                </div>
              ) : usageSurface === 'unavailable' ? (
                <div className="dash-empty is-unavailable" role="status">
                  <strong>{t('pages.dashboard.dataUnavailableShort')}</strong>
                  <span>{usageNote}</span>
                </div>
              ) : !usage || usage.users.length === 0 ? (
                <div className="dash-empty">
                  <strong>{t('pages.dashboard.noCalls')}</strong>
                  {t('pages.dashboard.emptyUsageHint')}
                </div>
              ) : (
                <div
                  className="dash-bar-list"
                  role="list"
                  aria-label={t('pages.dashboard.userCalls')}
                >
                  {usage.users.map((item) => (
                    <div
                      key={item.name}
                      className="dash-bar-row"
                      role="listitem"
                      aria-label={t('pages.dashboard.rankingAria', {
                        name: item.name,
                        calls: item.count,
                        errors: item.errors,
                      })}
                    >
                      <span className="dash-bar-label" title={item.name}>
                        {item.name}
                      </span>
                      <div className="dash-bar-track" aria-hidden="true">
                        <div
                          className="dash-bar-fill is-user"
                          style={{ width: `${(item.count / maxUser) * 100}%` }}
                        />
                      </div>
                      <span className="dash-bar-num hub-mono">
                        {item.count}
                        {item.errors > 0 ? (
                          <i>{t('pages.dashboard.errorShort', { count: item.errors })}</i>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <article className="dash-card dash-failures-card" id="dashboard-failures">
            <header className="dash-card-head">
              <h2>{t('pages.dashboard.recentErrors')}</h2>
              <Link className="cfg-link" to="/activity">
                {t('common.view')} {t('nav.activity')}
              </Link>
            </header>
            {usageSurface === 'loading' ? (
              <div className="dash-empty" aria-busy="true">
                <strong>{t('common.loading')}</strong>
              </div>
            ) : usageSurface === 'unavailable' ? (
              <div className="dash-empty is-unavailable" role="status">
                <strong>{t('pages.dashboard.dataUnavailableShort')}</strong>
                <span>{usageNote}</span>
              </div>
            ) : !usage || usage.recentErrors.length === 0 ? (
              <div className="dash-empty">
                <strong>{t('pages.dashboard.noRecentErrors')}</strong>
              </div>
            ) : (
              <ul className="dash-errors" aria-label={t('pages.dashboard.recentErrors')}>
                {usage.recentErrors.map((item) => (
                  <li key={item.id}>
                    <span className="dash-error-cell hub-mono">
                      <small>{t('activity.timestamp')}</small>
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <strong className="dash-error-cell">
                      <small>{t('activity.tool')}</small>
                      {item.tool}
                    </strong>
                    <span className="dash-error-cell">
                      <small>{t('activity.user')}</small>
                      {item.username || '—'}
                    </span>
                    <span className="dash-error-cell dash-error-msg">
                      <small>{t('activity.errorMessage')}</small>
                      {item.errorMessage || t('activity.statusError')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  );
};

export default DashboardPage;
