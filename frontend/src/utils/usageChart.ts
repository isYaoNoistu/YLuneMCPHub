import type { ActivityUsageDay } from '../types';

export type ChartPoint = { x: number; y: number };

export type UsageChartOptions = {
  width?: number;
  height?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

export type UsageChartModel = {
  width: number;
  height: number;
  left: number;
  top: number;
  plotWidth: number;
  plotHeight: number;
  baseline: number;
  peak: number;
  callPoints: ChartPoint[];
  errorPoints: ChartPoint[];
  callPath: string;
  errorPath: string;
  yTicks: number[];
  xFor: (index: number) => number;
};

const DEFAULTS = {
  width: 720,
  height: 132,
  left: 24,
  right: 10,
  top: 12,
  bottom: 24,
};

export const linePath = (points: ChartPoint[]): string => {
  if (points.length === 0) {
    return '';
  }
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
};

const niceMax = (value: number): number => {
  if (value <= 0) {
    return 4;
  }
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = magnitude < 1 ? 1 : magnitude;
  return Math.max(4, Math.ceil(padded / step) * step);
};

const clampZero = (value: number): number => (value < 0 ? 0 : value);

export const buildUsageChart = (
  days: ActivityUsageDay[],
  options: UsageChartOptions = {},
): UsageChartModel => {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const left = options.left ?? DEFAULTS.left;
  const right = options.right ?? DEFAULTS.right;
  const top = options.top ?? DEFAULTS.top;
  const bottom = options.bottom ?? DEFAULTS.bottom;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const peak = niceMax(
    Math.max(0, ...days.map((day) => Math.max(clampZero(day.count), clampZero(day.errors)))),
  );
  const lastIndex = Math.max(days.length - 1, 1);
  const xFor = (index: number) => left + (plotWidth * index) / lastIndex;
  const yFor = (value: number) => top + plotHeight - (clampZero(value) / peak) * plotHeight;
  const callPoints = days.map((day, index) => ({ x: xFor(index), y: yFor(day.count) }));
  const errorPoints = days.map((day, index) => ({ x: xFor(index), y: yFor(day.errors) }));
  const baseline = top + plotHeight;
  const mid = Math.round(peak / 2);
  const yTicks = [...new Set([0, mid, peak])];

  return {
    width,
    height,
    left,
    top,
    plotWidth,
    plotHeight,
    baseline,
    peak,
    callPoints,
    errorPoints,
    callPath: linePath(callPoints),
    errorPath: linePath(errorPoints),
    yTicks,
    xFor,
  };
};
