import fs from 'fs';
import path from 'path';

const readLocale = (locale: string): Record<string, unknown> => {
  const localePath = path.join(process.cwd(), 'locales', `${locale}.json`);
  return JSON.parse(fs.readFileSync(localePath, 'utf8')) as Record<string, unknown>;
};

const flattenKeys = (value: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const pathName = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, pathName)
      : [pathName];
  });

describe('server visibility locale strings', () => {
  it('provides sharing labels in every supported locale', () => {
    for (const locale of ['en', 'fr', 'tr', 'zh']) {
      const localePath = path.join(process.cwd(), 'locales', `${locale}.json`);
      const translations = JSON.parse(fs.readFileSync(localePath, 'utf8'));

      expect(translations.server.visibilityGroupShort).toBeTruthy();
      expect(translations.server.visibilityGroup).toBeTruthy();
      expect(translations.server.shareWithUsers).toBeTruthy();
      expect(translations.server.shareWithUsersDescription).toBeTruthy();
      expect(translations.server.shareCandidatesLoading).toBeTruthy();
      expect(translations.server.shareCandidatesError).toBeTruthy();
      expect(translations.server.shareAfterCreate).toBeTruthy();
      expect(translations.server.noShareCandidates).toBeTruthy();
      expect(translations.server.shareUserSearchLabel).toBeTruthy();
      expect(translations.server.shareUserSearchPlaceholder).toBeTruthy();
      expect(translations.server.selectAllShareUsers).toBeTruthy();
      expect(translations.server.deselectAllShareUsers).toBeTruthy();
      expect(translations.server.noMatchingShareUsers).toBeTruthy();
    }
  });

  it('provides Chinese translations for sharing labels and help text', () => {
    const localePath = path.join(process.cwd(), 'locales', 'zh.json');
    const zh = JSON.parse(fs.readFileSync(localePath, 'utf8'));

    expect(zh.server.visibility).toBe('可见性');
    expect(zh.server.visibilityPrivateShort).toBe('私有');
    expect(zh.server.visibilityPrivate).toBe('私有 — 仅所有者和管理员可见');
    expect(zh.server.visibilityGroupShort).toBe('共享');
    expect(zh.server.visibilityGroup).toBe('共享 — 仅选中的用户可见');
    expect(zh.server.visibilityPublicShort).toBe('公开');
    expect(zh.server.visibilityPublic).toBe('公开 — 所有已登录用户可见');
    expect(zh.server.visibilityDescription).toBe(
      '控制哪些非管理员用户可以发现并调用此服务器。管理员始终拥有访问权限。',
    );
  });

  it('keeps Chinese and English translation keys in sync', () => {
    expect(flattenKeys(readLocale('zh')).sort()).toEqual(flattenKeys(readLocale('en')).sort());
  });
});
