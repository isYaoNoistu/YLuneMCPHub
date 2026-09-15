import fs from 'fs';
import path from 'path';

describe('usage chart interaction contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'components', 'UsageLineChart.tsx'),
    'utf8',
  );
  const styles = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'styles', 'ylune-shell.css'),
    'utf8',
  );

  it('exposes one named interactive group and hides the decorative SVG tree', () => {
    expect(source).toContain('role="group"');
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('aria-describedby=');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('focusable="false"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('interactionHint');
  });

  it('tracks rendered width, handles arrows and preserves vertical page scrolling on touch', () => {
    expect(source).toContain('ResizeObserver');
    expect(source).toContain("event.key === 'ArrowLeft'");
    expect(source).toContain("event.key === 'ArrowRight'");
    expect(styles).toMatch(/\.dash-line-chart\s*\{[^}]*touch-action:\s*pan-y/s);
  });
});
