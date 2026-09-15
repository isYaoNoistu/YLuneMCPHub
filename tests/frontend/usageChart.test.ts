import { buildUsageChart, linePath } from '../../frontend/src/utils/usageChart';
import type { ActivityUsageDay } from '../../frontend/src/types';

const day = (date: string, count: number, errors = 0): ActivityUsageDay => ({
  date,
  count,
  errors,
});

describe('usage chart geometry', () => {
  it('draws only straight M/L segments', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 20, y: 5 }])).toBe('M 0 10 L 20 5');
  });

  it('keeps a readable non-zero scale for seven empty days', () => {
    const days = Array.from({ length: 7 }, (_, index) =>
      day(`2026-09-0${index + 1}`, 0, 0),
    );
    const model = buildUsageChart(days);

    expect(model.peak).toBeGreaterThanOrEqual(4);
    expect(model.callPath).toMatch(/^M /);
    expect(model.callPath).not.toContain('C');
    expect(model.errorPath).not.toContain('C');
    expect(model.callPoints.every((point) => point.y === model.baseline)).toBe(true);
  });

  it('gives a single peak at least 15% headroom', () => {
    const model = buildUsageChart([
      day('2026-09-01', 0),
      day('2026-09-02', 100),
      day('2026-09-03', 0),
    ]);

    expect(model.peak).toBeGreaterThan(100);
    expect(model.peak).toBeGreaterThanOrEqual(115);
  });

  it('aligns call and error points on the same X positions and clamps negatives', () => {
    const model = buildUsageChart([
      day('2026-09-01', -4, 2),
      day('2026-09-02', 8, -1),
    ]);

    expect(model.callPoints.map((point) => point.x)).toEqual(model.errorPoints.map((point) => point.x));
    expect(model.callPoints[0].y).toBe(model.baseline);
    expect(model.errorPoints[1].y).toBe(model.baseline);
    expect(model.width).toBe(720);
    expect(model.height).toBe(132);
  });
});
