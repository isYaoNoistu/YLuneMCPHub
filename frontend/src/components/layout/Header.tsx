import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { useEmbeddingSync } from '@/contexts/EmbeddingSyncContext';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const useCrumbs = (): { trail: string; here: string } => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();

  return useMemo(() => {
    const path = location.pathname;
    const root = 'YLune MCPHub';
    const here = (() => {
      if (path === '/') return t('nav.dashboard');
      if (path.startsWith('/servers')) return t('nav.servers');
      if (path.startsWith('/groups')) return t('nav.groups');
      if (path.startsWith('/prompts')) return t('nav.prompts');
      if (path.startsWith('/resources')) return t('nav.resources');
      if (path.startsWith('/users')) return t('nav.users');
      if (path.startsWith('/credentials')) return t('nav.credentials');
      if (path.startsWith('/lab')) return t('nav.lab');
      if (path.startsWith('/market')) {
        const serverName = (params as { serverName?: string }).serverName;
        return serverName ? `${t('nav.market')} / ${serverName}` : t('nav.market');
      }
      if (path.startsWith('/logs')) return t('nav.logs');
      if (path.startsWith('/activity')) return t('nav.activity');
      if (path.startsWith('/audit')) return t('nav.audit');
      if (path.startsWith('/settings')) return t('nav.settings');
      return root;
    })();
    return { trail: `${root} /`, here };
  }, [location.pathname, params, t]);
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { t, i18n } = useTranslation();
  const { activeSyncs } = useEmbeddingSync();
  const crumbs = useCrumbs();
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleLanguage = () => {
    const next = i18n.language.startsWith('zh') ? 'en' : 'zh';
    localStorage.setItem('i18nextLng', next);
    void i18n.changeLanguage(next);
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button type="button" className="icon-btn" onClick={onToggleSidebar} aria-label={t('app.toggleSidebar')}>
          ≡
        </button>
        <p className="crumb mono">
          {crumbs.trail} <b>{crumbs.here}</b>
        </p>
      </div>
      <div className="flex-1 flex justify-center px-2 min-w-0">
        {activeSyncs.length > 0 &&
          activeSyncs.map((activeSync) => (
            <span key={activeSync.serverName} className="mono" style={{ color: 'var(--color-muted)' }}>
              {activeSync.serverName} {activeSync.current}/{activeSync.total}
            </span>
          ))}
      </div>
      <div className="topbar-right">
        <button type="button" className="topbar-lang mono" onClick={toggleLanguage}>
          {i18n.language.startsWith('zh') ? 'EN' : '中文'}
        </button>
        <span className="mono topbar-clock">{clock}</span>
        <span className="dot" aria-hidden="true" />
        <span className="mono">ONLINE</span>
      </div>
    </header>
  );
};

export default Header;
