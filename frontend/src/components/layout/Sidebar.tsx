import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useServerContext } from '@/contexts/ServerContext';
import { canViewSystemLogs, isDemoUser } from '@/utils/navigationPermissions';
import { usePermissionCheck } from '../PermissionChecker';
import { checkActivityAvailable } from '@/services/activityService';
import { useTheme } from '@/contexts/ThemeContext';
import logoUrl from '@/assets/ylune/logo-mark.png';
import logoDarkMarkUrl from '@/assets/ylune/logo-mark-dark.png';

interface SidebarProps {
  collapsed: boolean;
}

interface MenuItem {
  path: string;
  label: string;
  ico: string;
  badge?: string | number;
  end?: boolean;
  locked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { auth, logout } = useAuth();
  const { allServers } = useServerContext();
  const [activityAvailable, setActivityAvailable] = useState(false);
  const demo = isDemoUser(auth.user);

  useEffect(() => {
    if (demo) {
      setActivityAvailable(true);
      return;
    }
    checkActivityAvailable()
      .then(setActivityAvailable)
      .catch(() => setActivityAvailable(false));
  }, [demo]);

  const canManageUsers = usePermissionCheck('x');
  const userCanManageUsers = Boolean(auth.user?.isAdmin && canManageUsers && !demo);

  const workspaceItems: MenuItem[] = [
    { path: '/', label: t('nav.dashboard'), ico: '◈', end: true },
    { path: '/servers', label: t('nav.servers'), ico: '▤', badge: allServers.length || undefined },
    { path: '/prompts', label: t('nav.prompts'), ico: '⌘' },
    { path: '/resources', label: t('nav.resources'), ico: '▦' },
    ...(auth.user?.isAdmin || demo ? [{ path: '/lab', label: t('nav.lab'), ico: '✎' }] : []),
  ];

  const systemItems: MenuItem[] = demo
    ? [
        { path: '/users', label: t('nav.users'), ico: '◉', locked: true },
        { path: '/credentials', label: t('nav.credentials'), ico: '▣', locked: true },
        { path: '/activity', label: t('nav.activity'), ico: '◎', locked: true },
        { path: '/audit', label: t('nav.audit'), ico: '▣', locked: true },
        { path: '/logs', label: t('nav.logs'), ico: '≣', locked: true },
        { path: '/settings', label: t('nav.settings'), ico: '⚙', locked: true },
      ]
    : [
        ...(userCanManageUsers ? [{ path: '/users', label: t('nav.users'), ico: '◉' }] : []),
        ...(auth.user?.isAdmin ? [{ path: '/credentials', label: t('nav.credentials'), ico: '▣' }] : []),
        ...(activityAvailable && auth.user?.isAdmin
          ? [{ path: '/activity', label: t('nav.activity'), ico: '◎' }]
          : []),
        ...(auth.user?.isAdmin ? [{ path: '/audit', label: t('nav.audit'), ico: '▣' }] : []),
        ...(canViewSystemLogs(auth.user) ? [{ path: '/logs', label: t('nav.logs'), ico: '≣' }] : []),
        { path: '/settings', label: t('nav.settings'), ico: '⚙' },
      ];

  const renderItem = (item: MenuItem) =>
    item.locked ? (
      <span
        key={item.path}
        className="side-link is-soon"
        aria-disabled="true"
        title={t('nav.demoLocked')}
      >
        <span className="side-ico" aria-hidden="true">
          {item.ico}
        </span>
        {item.label}
      </span>
    ) : (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.end}
        className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}
        title={item.label}
      >
        <span className="side-ico" aria-hidden="true">
          {item.ico}
        </span>
        {item.label}
        {item.badge != null && <span className="side-count mono">{item.badge}</span>}
      </NavLink>
    );

  return (
    <aside className={`side${collapsed ? ' is-collapsed' : ''}`} aria-label="主导航">
      <NavLink className="side-brand" to="/" end>
        <img src={resolvedTheme === 'light' ? logoDarkMarkUrl : logoUrl} alt="" width={28} height={28} />
        <span className="side-name">
          Y<b>LUNE</b>
        </span>
        <span className="side-badge mono">HUB</span>
      </NavLink>

      <nav className="side-nav">
        <p className="side-group mono">WORKSPACE</p>
        {workspaceItems.map(renderItem)}
        <p className="side-group mono">SYSTEM</p>
        {systemItems.map(renderItem)}
      </nav>

      <div className="side-user">
        <span className="dot" aria-hidden="true" />
        <span className="side-user-name">
          {auth.user?.username || 'guest'}
          {demo ? (
            <span className="hub-tag muted" style={{ fontSize: 10, marginLeft: 6 }}>
              DEMO
            </span>
          ) : null}
        </span>
        <button
          className="side-logout mono"
          type="button"
          title={t('app.logout')}
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          LOGOUT
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
