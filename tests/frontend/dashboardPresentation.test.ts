import {
  resolveUsageSurfaceState,
  takeDashboardPreview,
} from '../../frontend/src/utils/dashboardPresentation';

describe('dashboard presentation', () => {
  it('does not present unavailable activity data as an empty result', () => {
    expect(resolveUsageSurfaceState('loading', false)).toBe('loading');
    expect(resolveUsageSurfaceState('needs_db', false)).toBe('unavailable');
    expect(resolveUsageSurfaceState('unavailable', false)).toBe('unavailable');
    expect(resolveUsageSurfaceState('ready', false)).toBe('unavailable');
    expect(resolveUsageSurfaceState('ready', true)).toBe('ready');
  });

  it('returns a bounded preview and reports hidden items', () => {
    const source = ['one', 'two', 'three', 'four'];

    expect(takeDashboardPreview(source, 3)).toEqual({
      visible: ['one', 'two', 'three'],
      hiddenCount: 1,
    });
    expect(source).toHaveLength(4);
  });

  it('handles empty and invalid preview limits safely', () => {
    expect(takeDashboardPreview([], 3)).toEqual({ visible: [], hiddenCount: 0 });
    expect(takeDashboardPreview(['one'], 0)).toEqual({ visible: [], hiddenCount: 1 });
  });
});
