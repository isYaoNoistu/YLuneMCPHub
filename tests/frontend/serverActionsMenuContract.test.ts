import fs from 'fs';
import path from 'path';

describe('server actions menu presentation contract', () => {
  const menu = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'components', 'server-card', 'ActionsMenu.tsx'),
    'utf8',
  );
  const styles = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'styles', 'ylune-shell.css'),
    'utf8',
  );
  const serverCard = fs.readFileSync(
    path.join(process.cwd(), 'frontend', 'src', 'components', 'ServerCard.tsx'),
    'utf8',
  );

  it('groups configuration, connection, and dangerous actions explicitly', () => {
    expect(menu).toContain('className="hub-actions-menu"');
    expect(menu).toContain('aria-label={labels.configuration}');
    expect(menu).toContain('aria-label={labels.connection}');
    expect(menu).toContain('aria-label={labels.danger}');
    expect(menu.match(/className="hub-actions-menu-label"/g)).toHaveLength(3);
    expect(menu).toContain('className="hub-actions-menu-section is-danger"');
  });

  it('uses native button navigation without promising unsupported ARIA menu behavior', () => {
    expect(menu).toContain('aria-expanded={showMenu}');
    expect(menu).toContain('aria-controls={panelId}');
    expect(menu).not.toContain('role="menu"');
    expect(menu).not.toContain('role="menuitem"');
    expect(serverCard).toContain("e.key !== 'Escape'");
    expect(serverCard).toContain(
      "querySelector<HTMLButtonElement>('.hub-actions-trigger')?.focus()",
    );
    expect(serverCard).toContain('onBlur={handleMenuBlur}');
  });

  it('preserves conditional maintenance actions and their disabled states', () => {
    expect(menu).toContain('{hasReload && (');
    expect(menu).toContain('{hasReinstall && (');
    expect(menu).toContain('{hasOAuthDisconnect && (');
    expect(menu).toContain('disabled={isReloading || isToggling || !enabled}');
    expect(menu).toContain('disabled={isReinstalling || isToggling || !enabled}');
    expect(menu).toContain('disabled={isDisconnectingOAuth}');
  });

  it('defines visible hierarchy plus distinct hover and keyboard focus states', () => {
    expect(styles).toMatch(/\.hub-actions-menu\s*\{[^}]*box-shadow:/s);
    expect(styles).toMatch(/\.hub-actions-menu-section\s*\+\s*\.hub-actions-menu-section/s);
    expect(styles).toMatch(/\.hub-actions-menu-label\s*\{[^}]*text-transform:\s*uppercase/s);
    expect(styles).toMatch(/\.hub-actions-menu-item:hover\s*\{/s);
    expect(styles).toMatch(/\.hub-actions-menu-item:focus-visible\s*\{/s);
    expect(styles).toMatch(/\.hub-actions-menu-section\.is-danger/s);
  });

  it('provides section labels in every supported locale', () => {
    for (const locale of ['en', 'fr', 'tr', 'zh']) {
      const translations = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'locales', `${locale}.json`), 'utf8'),
      );

      expect(translations.server.actionsConfiguration).toBeTruthy();
      expect(translations.server.actionsConnection).toBeTruthy();
      expect(translations.server.actionsDanger).toBeTruthy();
    }
  });
});
