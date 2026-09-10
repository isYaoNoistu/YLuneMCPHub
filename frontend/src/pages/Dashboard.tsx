import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { useUserData } from '@/hooks/useUserData';
import { useSettingsData } from '@/hooks/useSettingsData';
import { formatTokens } from '@/utils/contextCost';
import { checkActivityAvailable, getActivityUsage } from '@/services/activityService';
import { ActivityUsage, IGroupServerConfig, IUser, Server, User } from '@/types';
import { getMcpEndpointUrl } from '@/utils/userMcpConfig';

const formatWhen = (iso?: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const isTokenExpired = (user: Pick<User, 'isAdmin' | 'tokenExpiresAt' | 'expired'>): boolean => {
  if (user.isAdmin || !user.tokenExpiresAt) return false;
  if (user.expired) return true;
  const expires = new Date(user.tokenExpiresAt).getTime();
  return !Number.isNaN(expires) && expires <= Date.now();
};

const tokenRemainingLabel = (
  user: Pick<User, 'isAdmin' | 'tokenExpiresAt' | 'expired'>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (user.isAdmin || !user.tokenExpiresAt) {
    return t('users.tokenNeverExpires');
  }
  if (isTokenExpired(user)) {
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
  const username = auth.user?.username || '';
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
  const todayUsage = usage?.days[usage.days.length - 1];
  const weekCalls = usage?.days.reduce((sum, day) => sum + day.count, 0) ?? null;
  const lastFailure = usage?.recentErrors[0];
  const mcpEndpoint = getMcpEndpointUrl(installConfig?.baseUrl);
  const sessionUser = auth.user as IUser | null;
  const myGrants = sessionUser?.grants || [];
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

  return (
    <section aria-labelledby="dashboardTitle">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1" id="dashboardTitle">
            {t('pages.dashboard.title')}
          </h1>
          <p className="hub-sub">{t('pages.dashboard.subtitle')}</p>
        </div>
        <div className="view-actions">
          <span className="hub-tag accent">LIVE</span>
          <button
            className="hub-btn"
            type="button"
            onClick={() => {
              triggerRefresh();
              refreshUsers();
              void loadUsage();
            }}
          >
            {t('common.refresh')}
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
        {(showSkeleton ? Array.from({ length: 4 }) : [0]).map((_, i) =>
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
              <div className="stat-num">{stats.tools}</div>
              <div className="stat-label">{t('server.tools')}</div>
              <p className="stat-note mono">EXPOSED TOOLS</p>
            </article>
            <article className="stat-card">
              <div className="stat-num">{formatTokens(footprint)}</div>
              <div className="stat-label">{t('cost.totalFootprint')}</div>
              <p className="stat-note mono">CONTEXT TOKENS</p>
            </article>
            <article className="stat-card">
              <div className="stat-num">{users.length}</div>
              <div className="stat-label">{t('pages.dashboard.usersStat')}</div>
              <p className="stat-note mono">
                {t('pages.dashboard.usersStatNote', {
                  admins: stats.admins,
                  regulars: stats.regulars,
                })}
              </p>
            </article>
          </>
        )}
      </div>

      <div className="dash-hero">
        {isAdmin ? (
          <article className="dash-session">
            <header className="dash-identity">
              <div>
                <p className="dash-identity-kicker">{t('pages.dashboard.snapshotTitle')}</p>
                <h2>{t('pages.dashboard.snapshotHeading')}</h2>
              </div>
            </header>
            <p className="ylune-help dash-identity-hint">{t('pages.dashboard.snapshotHint')}</p>

            <div className="dash-snapshot">
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.todayCalls')}</span>
                <b className="hub-num">{todayUsage ? todayUsage.count : '—'}</b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.todayErrors')}</span>
                <b className={`hub-num${todayUsage && todayUsage.errors > 0 ? ' is-warn' : ''}`}>
                  {todayUsage ? todayUsage.errors : '—'}
                </b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.weekCalls')}</span>
                <b className="hub-num">{weekCalls ?? '—'}</b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.offlineServers')}</span>
                <b className={`hub-num${stats.offline > 0 ? ' is-warn' : ''}`}>{stats.offline}</b>
              </div>
              <div className="dash-snapshot-item is-wide">
                <span>{t('pages.dashboard.lastFailure')}</span>
                {lastFailure ? (
                  <b className="is-err" title={`${lastFailure.tool} · ${lastFailure.errorMessage || ''}`}>
                    {lastFailure.tool}
                    {lastFailure.errorMessage ? ` · ${lastFailure.errorMessage}` : ''}
                  </b>
                ) : (
                  <b>{usageNote || t('pages.dashboard.noFailure')}</b>
                )}
              </div>
            </div>

            {usage?.days?.length ? (
              <div className="dash-session-pulse" aria-label={t('pages.dashboard.sessionPulse')}>
                {usage.days.map((day) => (
                  <div key={`session-${day.date}`} className="dash-day">
                    <div
                      className="dash-day-bar"
                      style={{ height: `${Math.max(4, (day.count / maxDay) * 36)}px` }}
                      title={`${day.date} ${day.count}`}
                    />
                    <span className="mono">{day.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="dash-endpoint">
              <span>{t('pages.dashboard.mcpEndpoint')}</span>
              <code>{mcpEndpoint}</code>
            </div>
          </article>
        ) : (
          <article className="dash-session">
            <header className="dash-identity">
              <div>
                <p className="dash-identity-kicker">{t('pages.dashboard.sessionTitle')}</p>
                <h2 className="hub-mono">{username || 'user'}</h2>
              </div>
              <span className="hub-tag muted">{t('users.user')}</span>
            </header>
            <p className="ylune-help dash-identity-hint">{t('pages.dashboard.youAreUser')}</p>

            <div className="dash-snapshot">
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.myServers')}</span>
                <b className="hub-num">{myGrants.length}</b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.grantedTools')}</span>
                <b className="hub-num">{myGrants.length === 0 ? '—' : myToolCount}</b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.tokenRemaining')}</span>
                <b className={sessionUser && isTokenExpired(sessionUser) ? 'is-err' : undefined}>
                  {sessionUser ? tokenRemainingLabel(sessionUser, t) : '—'}
                </b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.lastCalledAt')}</span>
                <b>{formatWhen(sessionUser?.lastCalledAt)}</b>
              </div>
              <div className="dash-snapshot-item">
                <span>{t('pages.dashboard.createdAt')}</span>
                <b>{formatWhen(sessionUser?.createdAt)}</b>
              </div>
            </div>

            <div className="dash-endpoint">
              <span>{t('pages.dashboard.mcpEndpoint')}</span>
              <code>{mcpEndpoint}</code>
            </div>
          </article>
        )}

        {isAdmin ? (
          <div className="dash-stack">
            <article className="dash-roster">
              <div className="dash-roster-head">
                <h3>{t('pages.dashboard.serversNow')}</h3>
                <span className="hub-num hub-mono">
                  {stats.online}/{stats.total}
                </span>
              </div>
              {allServers.length === 0 ? (
                <div className="dash-empty">
                  <strong>{t('pages.dashboard.noServersYet')}</strong>
                </div>
              ) : (
                allServers.slice(0, 8).map((server) => {
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
                        <span className="hub-num hub-mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          {server.tools?.length || 0} {t('server.tools')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </article>

            <article className="dash-roster is-users">
              <div className="dash-roster-head">
                <h3>{t('pages.dashboard.usersNow')}</h3>
                <span className="hub-num hub-mono">{users.length}</span>
              </div>
              {users.length === 0 ? (
                <div className="dash-empty">
                  <strong>{t('pages.dashboard.noOtherUsers')}</strong>
                </div>
              ) : (
                users.map((user) => {
                  const expired = isTokenExpired(user);
                  return (
                    <div key={user.username} className={`dash-roster-row is-user${expired ? ' is-expired' : ''}`}>
                      <div className="dash-user-top">
                        <span className="dash-roster-name hub-mono">
                          {user.username}
                          {user.username === username ? (
                            <span className="hub-tag accent" style={{ fontSize: 10, marginLeft: 8 }}>
                              {t('users.currentUser')}
                            </span>
                          ) : null}
                          {user.isAdmin ? (
                            <span className="hub-tag muted" style={{ fontSize: 10, marginLeft: 6 }}>
                              {t('users.admin')}
                            </span>
                          ) : null}
                          {expired ? (
                            <span className="hub-tag muted" style={{ fontSize: 10, marginLeft: 6 }}>
                              {t('users.tokenExpired')}
                            </span>
                          ) : null}
                        </span>
                        <span className="hub-num hub-mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          {user.isAdmin
                            ? t('pages.dashboard.adminAccess')
                            : t('pages.dashboard.grantCount', { count: user.grants?.length || 0 })}
                        </span>
                      </div>
                      <div className="dash-user-times">
                        <span>
                          {t('pages.dashboard.tokenRemaining')} ·{' '}
                          <b className={expired ? 'is-err' : undefined}>{tokenRemainingLabel(user, t)}</b>
                        </span>
                        <span>
                          {t('pages.dashboard.lastCalledAt')} · {formatWhen(user.lastCalledAt)}
                        </span>
                        <span>
                          {t('pages.dashboard.createdAt')} · {formatWhen(user.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </article>
          </div>
        ) : (
          <article className="dash-roster">
            <div className="dash-roster-head">
              <h3>{t('pages.dashboard.myServers')}</h3>
              <span className="hub-num hub-mono">{myGrants.length}</span>
            </div>
            {myGrants.length === 0 ? (
              <div className="dash-empty">
                <strong>{t('pages.dashboard.noGrantsYet')}</strong>
              </div>
            ) : (
              myGrants.map((grant) => {
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
                      <span className="hub-num hub-mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                        {grantToolsLabel(grant)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </article>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="dash-section-head">
            <h2 className="block-title mono">// {t('pages.dashboard.usageTitle')}</h2>
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
                    <div className="dash-empty">
                      <strong>{t('pages.dashboard.noCalls')}</strong>
                      {t('pages.dashboard.emptyUsageHint')}
                    </div>
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
                    <div className="dash-empty">
                      <strong>{t('pages.dashboard.noCalls')}</strong>
                      {t('pages.dashboard.emptyUsageHint')}
                    </div>
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
                <div className="dash-errors is-empty">
                  <p className="dash-muted" style={{ margin: 0 }}>
                    {t('pages.dashboard.noRecentErrors')}
                  </p>
                </div>
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
