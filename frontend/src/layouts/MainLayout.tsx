import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Content from '@/components/layout/Content';
import { EmbeddingSyncProvider } from '@/contexts/EmbeddingSyncContext';

const PageFallback: React.FC = () => (
  <div className="flex h-full min-h-[240px] items-center justify-center text-sm" style={{ color: 'var(--color-muted)' }}>
    Loading...
  </div>
);

const MainLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <EmbeddingSyncProvider>
      <a className="skip-link" href="#mainView">
        跳到主内容
      </a>
      <div className="fx-scanlines" aria-hidden="true" />
      <div className="fx-noise" aria-hidden="true" />
      <div className={`app${sidebarCollapsed ? ' is-collapsed' : ''}`}>
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="main">
          <Header onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />
          <Content>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </Content>
        </div>
      </div>
    </EmbeddingSyncProvider>
  );
};

export default MainLayout;
