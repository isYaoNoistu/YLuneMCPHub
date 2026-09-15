export type DashboardUsageStatus = 'loading' | 'ready' | 'needs_db' | 'unavailable';
export type UsageSurfaceState = 'loading' | 'ready' | 'unavailable';

export const resolveUsageSurfaceState = (
  status: DashboardUsageStatus,
  hasUsage: boolean,
): UsageSurfaceState => {
  if (status === 'loading') return 'loading';
  return status === 'ready' && hasUsage ? 'ready' : 'unavailable';
};

export const takeDashboardPreview = <T>(
  items: readonly T[],
  limit: number,
): { visible: T[]; hiddenCount: number } => {
  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    visible: items.slice(0, safeLimit),
    hiddenCount: Math.max(0, items.length - safeLimit),
  };
};
