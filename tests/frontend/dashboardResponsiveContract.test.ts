import fs from 'fs';
import path from 'path';

describe('dashboard responsive presentation contract', () => {
  const sidebar = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'components', 'layout', 'Sidebar.tsx'),
    'utf8',
  );
  const styles = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'styles', 'ylune-shell.css'),
    'utf8',
  );
  const dashboard = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'pages', 'Dashboard.tsx'),
    'utf8',
  );
  const attentionPanel = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'components', 'DashboardAttentionPanel.tsx'),
    'utf8',
  );

  it('wraps navigation labels so the compact rail can hide them without vertical text', () => {
    expect(sidebar).toContain('className="side-link-label"');
    expect(styles).toMatch(/\.side-link-label[^}]*display:\s*none/s);
  });

  it('keeps recent-error field labels visible without relying on an absent table header', () => {
    expect(styles).toMatch(/\.dash-error-cell small\s*\{[^}]*display:\s*block/s);
    expect(styles).not.toMatch(/\.dash-error-cell small\s*\{[^}]*display:\s*none/s);
  });

  it('has only one dashboard attention container rule', () => {
    expect(styles.match(/\.dash-attention\s*\{/g)).toHaveLength(1);
  });

  it('renders key expiry as a lifecycle reminder instead of a fault', () => {
    expect(attentionPanel).toContain('buildDashboardLifecycleNotices');
    expect(attentionPanel).toContain('className="dash-lifecycle"');
    expect(attentionPanel).toContain("t('pages.dashboard.keyReminder')");
  });

  it('uses independent desktop columns and renders a logical narrow-screen DOM order', () => {
    expect(dashboard).toContain('className="dash-flow-grid"');
    expect(dashboard).toContain('className="dash-flow-column"');
    expect(dashboard).toContain('dash-operations-card');
    expect(dashboard).toContain('dash-trend-card');
    expect(dashboard).toContain('dash-tools-card');
    expect(dashboard).toContain('dash-users-card');
    expect(styles).toMatch(/\.dash-flow-column\s*\{[^}]*display:\s*flex/s);
    expect(styles).toMatch(
      /@media \(max-width:\s*1120px\)[\s\S]*\.dash-flow-column\s*\{[^}]*display:\s*contents/s,
    );
    expect(dashboard).toContain("const DASHBOARD_STACK_QUERY = '(max-width: 1120px)'");
    expect(dashboard.indexOf('isStackedLayout && trendCard')).toBeLessThan(
      dashboard.indexOf('dash-tools-card'),
    );
    expect(dashboard.indexOf('!isStackedLayout && trendCard')).toBeLessThan(
      dashboard.indexOf('dash-users-card'),
    );
  });

  it('uses a high-contrast light-theme foreground for the expiry count', () => {
    expect(styles).toContain('--dash-warning-text: #e7c27a');
    expect(styles).toMatch(/html\.light\s*\{[^}]*--dash-warning-text:\s*#6f4b00/s);
    expect(styles).toMatch(
      /\.dash-lifecycle \.hub-tag\s*\{[^}]*color:\s*var\(--dash-warning-text\)/s,
    );
  });
});
