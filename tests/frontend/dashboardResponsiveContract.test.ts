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
});
