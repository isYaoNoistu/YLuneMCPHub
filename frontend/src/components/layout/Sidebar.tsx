import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useServerContext } from '@/contexts/ServerContext';
import { canViewSystemLogs } from '@/utils/navigationPermissions';
import { usePermissionCheck } from '../PermissionChecker';
import { checkActivityAvailable } from '@/services/activityService';
import logoUrl from '@/assets/ylune/logo-mark.png';

interface SidebarProps {
  collapsed: boolean;
}

interface MenuItem {
  path: string;
  label: string;
  ico: string;
  badge?: string | number;
  end?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const { allServers } = useServerContext();
  const [activityAvailable, setActivityAvailable] = useState(false);

  useEffect(() => {
    checkActivityAvailable()
      .then(setActivityAvailable)
      .catch(() => setActivityAvailable(false));
  }, []);

  const canManageUsers = usePermissionCheck('x');
  const userCanManageUsers = Boolean(auth.user?.isAdmin && canManageUsers);

  const workspaceItems: MenuItem[] = [
    { path: '/', label: t('nav.dashboard'), ico: '◈', end: true },
    { path: '/servers', label: t('nav.servers'), ico: '▤', badge: allServers.length || undefined },
    { path: '/prompts', label: t('nav.prompts'), ico: '⌘' },
    { path: '/resources', label: t('nav.resources'), ico: '▦' },
  ];

  const systemItems: MenuItem[] = [
    ...(userCanManageUsers ? [{ path: '/users', label: t('nav.users'), ico: '◉' }] : []),
    ...(activityAvailable && auth.user?.isAdmin
      ? [{ path: '/activity', label: t('nav.activity'), ico: '◎' }]
      : []),
    ...(canViewSystemLogs(auth.user) ? [{ path: '/logs', label: t('nav.logs'), ico: '≣' }] : []),
    { path: '/settings', label: t('nav.settings'), ico: '⚙' },
  ];

  const renderItem = (item: MenuItem) => (
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
        <img src={logoUrl} alt="" width={28} height={28} />
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
        <span className="side-user-name">{auth.user?.username || 'guest'}</span>
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
