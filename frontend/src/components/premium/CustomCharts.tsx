'use client';

import React, { useState, useRef } from 'react';

// Common utility to format currency
const formatKES = (val: number) => {
  if (val >= 1_000_000) {
    return `KES ${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `KES ${(val / 1_000).toFixed(1)}K`;
  }
  return `KES ${val.toLocaleString()}`;
};

// ----------------------------------------------------------------------
// 1. AREA CHART (Payroll Trend & Employee Growth)
// ----------------------------------------------------------------------
interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string; // primary numeric value (e.g., cost)
  y2Key?: string; // secondary numeric value (e.g., employees)
  title?: string;
  yLabelFormatter?: (v: number) => string;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  xKey,
  yKey,
  y2Key,
  title,
  yLabelFormatter = formatKES,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400 italic text-sm">
        No trend data available
      </div>
    );
  }

  const viewBoxWidth = 600;
  const viewBoxHeight = 250;
  const padding = { top: 25, right: 40, bottom: 45, left: 65 };

  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  // Max calculations
  const yValues = data.map((d) => Number(d[yKey]) || 0);
  const maxY = Math.max(...yValues, 1000) * 1.15; // 15% padding at top
  const minY = 0;

  const y2Values = y2Key ? data.map((d) => Number(d[y2Key]) || 0) : [];
  const maxY2 = y2Key ? Math.max(...y2Values, 5) * 1.2 : 0;

  // Generate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const yVal = Number(d[yKey]) || 0;
    const y = padding.top + chartHeight - ((yVal - minY) / (maxY - minY)) * chartHeight;
    
    // Optional y2 calculations
    let y2 = 0;
    if (y2Key) {
      const y2Val = Number(d[y2Key]) || 0;
      y2 = padding.top + chartHeight - (y2Val / maxY2) * chartHeight;
    }

    return { x, y, y2, raw: d };
  });

  // Construct SVG paths
  let linePath = '';
  let areaPath = '';
  let line2Path = '';

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
    areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    if (y2Key) {
      line2Path = `M ${points[0].x} ${points[0].y2} ` + points.slice(1).map((p) => `L ${p.x} ${p.y2}`).join(' ');
    }
  }

  // Handle move on interactive hover rects
  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    setHoveredIdx(index);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltipPos({ x, y });
    }
  };

  // Y-axis gridlines & labels (4 divisions)
  const yDivisions = 4;
  const gridLines = Array.from({ length: yDivisions + 1 }).map((_, i) => {
    const val = minY + (i / yDivisions) * (maxY - minY);
    const y = padding.top + chartHeight - (i / yDivisions) * chartHeight;
    return { val, y };
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      {title && (
        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-4 font-outfit uppercase tracking-widest">
          {title}
        </h4>
      )}
      
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible select-none"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={viewBoxWidth - padding.right}
              y2={line.y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="4 4"
            />
            {/* Left Y Axis Labels */}
            <text
              x={padding.left - 10}
              y={line.y + 4}
              textAnchor="end"
              className="text-[9px] fill-slate-400 dark:fill-slate-500 font-bold font-mono"
            >
              {yLabelFormatter(line.val)}
            </text>
          </g>
        ))}

        {/* X Axis Line */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={viewBoxWidth - padding.right}
          y2={padding.top + chartHeight}
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-700"
          strokeWidth="1"
        />

        {/* X Axis Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padding.top + chartHeight + 18}
            textAnchor="middle"
            className="text-[9px] fill-slate-400 dark:fill-slate-500 font-bold"
          >
            {p.raw[xKey]}
          </text>
        ))}

        {/* Area fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            className="text-slate-500 dark:text-slate-400 transition-all duration-300"
          />
        )}

        {/* Primary Line stroke */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            className="stroke-slate-900 dark:stroke-slate-100 transition-all duration-300"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Secondary Line stroke (Employees count, dashed) */}
        {y2Key && line2Path && (
          <path
            d={line2Path}
            fill="none"
            stroke="currentColor"
            className="stroke-slate-400 dark:stroke-slate-600 transition-all duration-300"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Tooltip vertical line & dots indicator */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={padding.top}
              x2={points[hoveredIdx].x}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              className="text-slate-400 dark:text-slate-600"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* Primary value dot */}
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].y}
              r="5"
              fill="currentColor"
              className="text-slate-950 dark:text-white stroke-slate-200 dark:stroke-slate-800"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            {/* Secondary value dot */}
            {y2Key && (
              <circle
                cx={points[hoveredIdx].x}
                cy={points[hoveredIdx].y2}
                r="4"
                fill="currentColor"
                className="text-slate-400 dark:text-slate-500 stroke-slate-200 dark:stroke-slate-800"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            )}
          </g>
        )}

        {/* Transparent overlay blocks for mouse interactions */}
        {points.map((p, i) => {
          const blockWidth = chartWidth / Math.max(data.length - 1, 1);
          const blockX = p.x - blockWidth / 2;
          return (
            <rect
              key={i}
              x={blockX}
              y={padding.top}
              width={blockWidth}
              height={chartHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseMove={(e) => handleMouseMove(e, i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip Div */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute z-50 pointer-events-none p-3 rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-44 flex flex-col gap-1.5 transition-all duration-100 ease-out"
          style={{
            left: `${Math.min(tooltipPos.x + 15, (containerRef.current?.clientWidth || 0) - 190)}px`,
            top: `${tooltipPos.y - 85}px`,
          }}
        >
          <div className="font-extrabold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {points[hoveredIdx].raw[xKey]}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Net Payroll:</span>
            <span className="font-bold font-mono">
              {Number(points[hoveredIdx].raw[yKey]).toLocaleString('en-KE', {
                style: 'currency',
                currency: 'KES',
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          {y2Key && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-1.5">
              <span className="text-slate-500 dark:text-slate-400">Headcount:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                {points[hoveredIdx].raw[y2Key]} Staff
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// 2. BAR CHART (Departmental Allocation)
// ----------------------------------------------------------------------
interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  title?: string;
  valueFormatter?: (v: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  xKey,
  yKey,
  title,
  valueFormatter = formatKES,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400 italic text-sm">
        No departmental data available
      </div>
    );
  }

  const viewBoxWidth = 600;
  const viewBoxHeight = 250;
  const padding = { top: 20, right: 30, bottom: 45, left: 65 };

  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  // Max calculations
  const yValues = data.map((d) => Number(d[yKey]) || 0);
  const maxY = Math.max(...yValues, 1000) * 1.15;
  const minY = 0;

  // Division width
  const totalBars = data.length;
  const barWidth = Math.min(32, (chartWidth / totalBars) * 0.5);
  const interval = chartWidth / totalBars;

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    setHoveredIdx(index);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Grid lines
  const yDivisions = 4;
  const gridLines = Array.from({ length: yDivisions + 1 }).map((_, i) => {
    const val = minY + (i / yDivisions) * (maxY - minY);
    const y = padding.top + chartHeight - (i / yDivisions) * chartHeight;
    return { val, y };
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      {title && (
        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-4 font-outfit uppercase tracking-widest">
          {title}
        </h4>
      )}

      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Horizontal gridlines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={viewBoxWidth - padding.right}
              y2={line.y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={line.y + 3}
              textAnchor="end"
              className="text-[9px] fill-slate-400 dark:fill-slate-500 font-bold font-mono"
            >
              {valueFormatter(line.val)}
            </text>
          </g>
        ))}

        {/* X Axis Line */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={viewBoxWidth - padding.right}
          y2={padding.top + chartHeight}
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-700"
          strokeWidth="1"
        />

        {/* Bars and labels */}
        {data.map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const h = ((val - minY) / (maxY - minY)) * chartHeight;
          const x = padding.left + (i * interval) + (interval / 2) - (barWidth / 2);
          const y = padding.top + chartHeight - h;

          const isHovered = hoveredIdx === i;

          return (
            <g key={i}>
              {/* Rounded Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(h, 2)}
                fill="currentColor"
                className="text-slate-900 dark:text-slate-100 transition-all duration-300 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                rx="2"
                ry="2"
                onMouseMove={(e) => handleMouseMove(e, i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ opacity: hoveredIdx === null || isHovered ? 1 : 0.6 }}
              />

              {/* X Axis Label */}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 18}
                textAnchor="middle"
                className="text-[9px] fill-slate-400 dark:fill-slate-500 font-bold max-w-[50px] truncate"
              >
                {d[xKey]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip Div */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          className="absolute z-50 pointer-events-none p-3 rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 shadow-xl border border-slate-200 dark:border-slate-800 text-xs min-w-44 flex flex-col gap-1 transition-all duration-100 ease-out"
          style={{
            left: `${Math.min(tooltipPos.x + 15, (containerRef.current?.clientWidth || 0) - 190)}px`,
            top: `${tooltipPos.y - 75}px`,
          }}
        >
          <div className="font-extrabold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {data[hoveredIdx][xKey]}
          </div>
          <div className="flex items-center justify-between gap-4 mt-0.5">
            <span className="text-slate-500 dark:text-slate-400">Total Cost:</span>
            <span className="font-bold font-mono">
              {Number(data[hoveredIdx][yKey]).toLocaleString('en-KE', {
                style: 'currency',
                currency: 'KES',
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          {data[hoveredIdx].employees !== undefined && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1">
              <span className="text-slate-500 dark:text-slate-400">Headcount:</span>
              <span className="font-bold text-slate-950 dark:text-slate-50 font-mono">
                {data[hoveredIdx].employees} Staff
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// 3. DONUT CHART (Leave Distribution)
// ----------------------------------------------------------------------
interface DonutChartProps {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  title?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  nameKey,
  valueKey,
  title,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400 italic text-sm">
        No active records this period
      </div>
    );
  }

  const radius = 50;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // 314.159
  const center = 100;

  // Premium monochrome slate shades
  const colorsList = [
    '#0f172a', // Slate-900 (deep black-blue)
    '#475569', // Slate-600 (dark gray)
    '#94a3b8', // Slate-400 (medium gray)
    '#cbd5e1', // Slate-300 (light gray)
    '#334155', // Slate-700 (dark medium gray)
    '#64748b', // Slate-500 (gray)
  ];

  const segments = data.reduce<Array<{raw: Record<string, unknown>, pct: number, strokeLength: number, offset: number, color: string}>>((acc, d, i) => {
    const val = Number(d[valueKey]) || 0;
    const pct = val / total;
    const strokeLength = pct * circumference;
    const offset = acc.reduce((sum, seg) => sum + seg.strokeLength, 0);
    return [...acc, { raw: d, pct, strokeLength, offset, color: colorsList[i % colorsList.length] }];
  }, []);

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 justify-around w-full">
      {/* Visual Circle */}
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90 overflow-visible select-none">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-900"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={`${seg.strokeLength} ${circumference - seg.strokeLength}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ opacity: hoveredIdx === null || isHovered ? 1 : 0.5 }}
              />
            );
          })}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {hoveredIdx !== null && segments[hoveredIdx] ? (
            <>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                {segments[hoveredIdx].raw[valueKey]}d
              </span>
              <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold max-w-[75px] truncate">
                {segments[hoveredIdx].raw[nameKey]}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {total}d
              </span>
              <span className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">
                Total Leaves
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legends */}
      <div className="flex flex-col gap-2.5 justify-center flex-1 w-full">
        {title && (
          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
            {title}
          </h4>
        )}
        {segments.map((seg, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className={`flex items-center justify-between gap-4 p-2 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-sm scale-[1.01]'
                  : 'border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
              }`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">
                  {seg.raw[nameKey]?.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                {seg.raw[valueKey]}d ({Math.round(seg.pct * 100)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
