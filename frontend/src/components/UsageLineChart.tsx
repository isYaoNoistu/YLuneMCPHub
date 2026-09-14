import { useId, useMemo, useState } from 'react';
import { ActivityUsageDay } from '@/types';

type UsageLineChartProps = {
  days: ActivityUsageDay[];
  callsLabel: string;
  errorsLabel: string;
  ariaLabel: string;
  compact?: boolean;
};

type Point = { x: number; y: number };

const formatTick = (date: string): string => {
  const parts = date.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return date.slice(5);
};

const niceMax = (value: number): number => {
  if (value <= 0) return 4;
  const padded = value * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = magnitude < 1 ? 1 : magnitude;
  return Math.max(4, Math.ceil(padded / step) * step);
};

const smoothPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
};

const UsageLineChart = ({
  days,
  callsLabel,
  errorsLabel,
  ariaLabel,
  compact = false,
}: UsageLineChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const fillId = `dash-call-fill-${useId().replace(/:/g, '')}`;

  const chart = useMemo(() => {
    const width = 720;
    const height = compact ? 96 : 220;
    const left = compact ? 8 : 36;
    const right = compact ? 8 : 12;
    const top = compact ? 10 : 16;
    const bottom = compact ? 20 : 32;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const peak = niceMax(Math.max(0, ...days.map((day) => Math.max(day.count, day.errors))));
    const lastIndex = Math.max(days.length - 1, 1);
    const xFor = (index: number) => left + (plotWidth * index) / lastIndex;
    const yFor = (value: number) => top + plotHeight - (value / peak) * plotHeight;
    const callPoints = days.map((day, index) => ({ x: xFor(index), y: yFor(day.count) }));
    const errorPoints = days.map((day, index) => ({ x: xFor(index), y: yFor(day.errors) }));
    const baseline = top + plotHeight;
    const callLine = smoothPath(callPoints);
    const errorLine = smoothPath(errorPoints);
    const area =
      callPoints.length === 0
        ? ''
        : `${callLine} L ${callPoints[callPoints.length - 1].x} ${baseline} L ${callPoints[0].x} ${baseline} Z`;
    const yTicks = compact ? [peak] : [0, Math.round(peak / 2), peak];

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
      callLine,
      errorLine,
      area,
      yTicks,
      xFor,
    };
  }, [compact, days]);

  if (days.length === 0) {
    return null;
  }

  const hoverIndex =
    activeIndex === null ? null : Math.min(Math.max(activeIndex, 0), days.length - 1);
  const hoverDay = hoverIndex === null ? null : days[hoverIndex];
  const hoverPoint = hoverIndex === null ? null : chart.callPoints[hoverIndex];

  return (
    <div
      className={`dash-line-chart${compact ? ' is-compact' : ''}`}
      aria-label={ariaLabel}
    >
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        onMouseLeave={() => setActiveIndex(null)}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - bounds.left) / bounds.width;
          const x = ratio * chart.width;
          let nearest = 0;
          let best = Number.POSITIVE_INFINITY;
          chart.callPoints.forEach((point, index) => {
            const distance = Math.abs(point.x - x);
            if (distance < best) {
              best = distance;
              nearest = index;
            }
          });
          setActiveIndex(nearest);
        }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {chart.yTicks.map((tick) => {
          const y = chart.top + chart.plotHeight - (tick / chart.peak) * chart.plotHeight;
          return (
            <g key={`y-${tick}`}>
              <line
                className="dash-line-grid"
                x1={chart.left}
                x2={chart.left + chart.plotWidth}
                y1={y}
                y2={y}
              />
              {!compact && (
                <text className="dash-line-axis" x={chart.left - 8} y={y + 3} textAnchor="end">
                  {tick}
                </text>
              )}
            </g>
          );
        })}

        {days.map((day, index) => {
          const show =
            days.length <= 8 ||
            index === 0 ||
            index === days.length - 1 ||
            index % Math.ceil(days.length / 7) === 0;
          if (!show) return null;
          return (
            <text
              key={`x-${day.date}`}
              className="dash-line-axis"
              x={chart.xFor(index)}
              y={chart.height - 8}
              textAnchor="middle"
            >
              {formatTick(day.date)}
            </text>
          );
        })}

        <path className="dash-line-area" d={chart.area} fill={`url(#${fillId})`} />
        <path className="dash-line-calls" d={chart.callLine} fill="none" />
        <path className="dash-line-errors" d={chart.errorLine} fill="none" />

        {hoverPoint && hoverDay && (
          <g>
            <line
              className="dash-line-guide"
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={chart.top}
              y2={chart.baseline}
            />
            <circle className="dash-line-dot is-call" cx={hoverPoint.x} cy={hoverPoint.y} r="4" />
            <circle
              className="dash-line-dot is-err"
              cx={chart.errorPoints[hoverIndex!].x}
              cy={chart.errorPoints[hoverIndex!].y}
              r="3.5"
            />
          </g>
        )}
      </svg>

      {hoverDay && !compact && (
        <div className="dash-line-tip" role="status">
          <strong>{hoverDay.date}</strong>
          <span>
            {callsLabel} {hoverDay.count}
          </span>
          <span className="is-err">
            {errorsLabel} {hoverDay.errors}
          </span>
        </div>
      )}

      {!compact && (
        <div className="dash-line-legend">
          <span>
            <i className="is-call" />
            {callsLabel}
          </span>
          <span>
            <i className="is-err" />
            {errorsLabel}
          </span>
        </div>
      )}
    </div>
  );
};

export default UsageLineChart;
