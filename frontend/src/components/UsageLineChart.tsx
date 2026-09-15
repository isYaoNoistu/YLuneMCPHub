import { KeyboardEvent, PointerEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActivityUsageDay } from '@/types';
import { buildUsageChart, moveUsageIndex, resolveUsageChartDimensions } from '@/utils/usageChart';

type UsageLineChartProps = {
  days: ActivityUsageDay[];
  callsLabel: string;
  errorsLabel: string;
  ariaLabel: string;
  interactionHint: string;
};

const formatTick = (date: string): string => {
  const parts = date.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return date.slice(5);
};

const UsageLineChart = ({
  days,
  callsLabel,
  errorsLabel,
  ariaLabel,
  interactionHint,
}: UsageLineChartProps) => {
  const summaryId = useId();
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(Math.max(days.length - 1, 0));
  const [dimensions, setDimensions] = useState(() => resolveUsageChartDimensions(0));
  const chart = useMemo(() => buildUsageChart(days, dimensions), [days, dimensions]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateDimensions = (width: number) => {
      const next = resolveUsageChartDimensions(width);
      setDimensions((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };
    updateDimensions(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => updateDimensions(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (days.length === 0) {
    return null;
  }

  const selectedIndex = moveUsageIndex(activeIndex, 0, days.length);
  const selectedDay = days[selectedIndex];
  const selectedCall = chart.callPoints[selectedIndex];
  const selectedError = chart.errorPoints[selectedIndex];

  const selectFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chart.width;
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
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveIndex((current) => moveUsageIndex(current, -1, days.length));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveIndex((current) => moveUsageIndex(current, 1, days.length));
    }
  };

  return (
    <div
      ref={containerRef}
      className="dash-line-chart"
      role="group"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-describedby={`${summaryId} ${hintId}`}
    >
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        aria-hidden="true"
        focusable="false"
        onPointerMove={selectFromPointer}
        onPointerDown={selectFromPointer}
      >
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
              <text className="dash-line-axis" x={chart.left - 6} y={y + 3} textAnchor="end">
                {tick}
              </text>
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
          const terminal = index === 0 || index === days.length - 1;
          return (
            <text
              key={`x-${day.date}`}
              className={`dash-line-axis${terminal ? '' : ' is-mid'}`}
              x={chart.xFor(index)}
              y={chart.height - 6}
              textAnchor="middle"
            >
              {formatTick(day.date)}
            </text>
          );
        })}

        <path className="dash-line-calls" d={chart.callPath} fill="none" />
        <path className="dash-line-errors" d={chart.errorPath} fill="none" />

        {selectedCall && selectedDay && (
          <g>
            <line
              className="dash-line-guide"
              x1={selectedCall.x}
              x2={selectedCall.x}
              y1={chart.top}
              y2={chart.baseline}
            />
            <circle
              className="dash-line-dot is-call"
              cx={selectedCall.x}
              cy={selectedCall.y}
              r="3"
            />
            <circle
              className="dash-line-dot is-err"
              cx={selectedError.x}
              cy={selectedError.y}
              r="2.5"
            />
          </g>
        )}
      </svg>

      {selectedDay && (
        <div className="dash-line-chip" id={summaryId} aria-live="polite">
          <strong>{selectedDay.date}</strong>
          <span>
            {callsLabel} {selectedDay.count}
          </span>
          <span className="is-err">
            {errorsLabel} {selectedDay.errors}
          </span>
        </div>
      )}

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
      <p className="dash-line-hint" id={hintId}>
        {interactionHint}
      </p>
    </div>
  );
};

export default UsageLineChart;
