"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatGHS, formatShort } from "@/lib/money";
import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx, ProgressBar, Segmented, Tag, type BarTone, type TagTone } from "./ui";

/* ------------------------------------------------------------------ *
 * Small, dependency-free SVG charts.
 * Thin marks (<=24px columns, 4px rounded data-end), hairline grid,
 * one axis, hover + keyboard tooltips, and a table view for every chart.
 * ------------------------------------------------------------------ */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round axis maximum and 3-4 clean ticks (in pesewas, stepped in whole cedis). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const cedis = max / 100;
  const raw = cedis / 3;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= cedis + step * 0.001; v += step) ticks.push(Math.round(v * 100));
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] / 100 + step) * 100));
  return ticks;
}

/** Column path: square at the baseline, 4px rounded data-end. Grows up (h>0) or down (h<0). */
function columnPath(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, Math.abs(h), w / 2);
  if (h >= 0) {
    const top = base - h;
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
  }
  const bot = base - h;
  return `M${x},${base}V${bot - r}Q${x},${bot} ${x + r},${bot}H${x + w - r}Q${x + w},${bot} ${x + w},${bot - r}V${base}Z`;
}

interface TipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string; line?: boolean }[];
}

function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), Math.max(width - 70, 70));
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control border-2 border-brand-ink bg-surface px-3 py-2 text-xs shadow-hard"
      style={{ left, top: Math.max(tip.y - 8, 0) }}
      role="status"
    >
      <div className="mb-1 text-muted">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 whitespace-nowrap">
          {r.color && <span className={cx("shrink-0", r.line ? "h-0.5 w-3" : "h-2 w-2 rounded-full")} style={{ background: r.color }} />}
          <span className="tabular font-semibold text-ink">{r.value}</span>
          <span className="text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Card with title and a Chart/Table switch (the table is the accessible twin of the chart). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[19px] leading-tight font-bold">{title}</h2>
          {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
        </div>
        <Segmented
          size="sm"
          className="shrink-0"
          label={`${title} view`}
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      {legend && view === "chart" && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{legend}</div>}
      <div className="mt-4">
        {view === "chart" ? (
          children
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-surface text-xs text-muted">
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={h} className={cx("py-2 font-medium", i > 0 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className={cx("py-2", j > 0 && "tabular text-right")}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function LegendKey({ color, label, kind = "rect" }: { color: string; label: string; kind?: "rect" | "line" | "dot" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cx(
          kind === "rect" && "h-2.5 w-2.5 rounded-[3px]",
          kind === "line" && "h-0.5 w-4 rounded",
          kind === "dot" && "h-2.5 w-2.5 rounded-full",
        )}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/* ---------------- Column chart (single series) ---------------- */

export interface ColumnDatum {
  key: string;
  label: string; // x tick
  title: string; // tooltip heading
  value: number; // pesewas
}

export function ColumnChart({
  data,
  color = "var(--expense)",
  emphasis,
  reference,
  height = 170,
  labelEvery = 1,
  valueLabel = "spent",
}: {
  data: ColumnDatum[];
  color?: string;
  /** Keys drawn in `color`; everything else de-emphasised. Omit to colour all. */
  emphasis?: string[];
  reference?: { value: number; label: string };
  height?: number;
  labelEvery?: number;
  valueLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const axisW = 40;
  const xAxisH = 22;
  const plotH = height - xAxisH;
  const max = Math.max(...data.map((d) => d.value), Math.round((reference?.value ?? 0) * 1.15), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(width - axisW, 0);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(Math.min(24, band - 2), 2);
  const y = (v: number) => plotH - (v / top) * (plotH - 6);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Column chart">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={width} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[10px]">
                {formatShort(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = axisW + i * band + (band - barW) / 2;
            const h = plotH - y(d.value);
            const active = !emphasis || emphasis.includes(d.key);
            const show = () =>
              setTip({ x: x + barW / 2, y: y(d.value), title: d.title, rows: [{ label: valueLabel, value: formatGHS(d.value) }] });
            return (
              <g key={d.key}>
                {d.value > 0 && <path d={columnPath(x, plotH, barW, h)} fill={active ? color : "var(--deemph)"} />}
                <rect
                  x={axisW + i * band}
                  y={0}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.title}: ${formatGHS(d.value)}`}
                  onPointerEnter={show}
                  onFocus={show}
                  onBlur={() => setTip(null)}
                  className="outline-none"
                />
                {i % labelEvery === 0 && (
                  <text x={axisW + i * band + band / 2} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          {reference && reference.value > 0 && (
            <g>
              <line
                x1={axisW}
                x2={width}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke="var(--text)"
                strokeWidth={1}
                opacity={0.5}
              />
              <text
                x={width - 2}
                y={y(reference.value) < 14 ? y(reference.value) + 12 : y(reference.value) - 5}
                textAnchor="end"
                className="fill-[var(--text)] text-[10px] font-medium"
              >
                {reference.label}
              </text>
            </g>
          )}
          <line x1={axisW} x2={width} y1={plotH} y2={plotH} stroke="var(--border)" strokeWidth={1} />
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ---------------- Cash-flow chart: income up, spending down, net dot ---------------- */

export interface FlowDatum {
  key: string;
  label: string;
  title: string;
  income: number;
  expense: number;
  net: number;
}

export function FlowChart({ data, height = 220 }: { data: FlowDatum[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const axisW = 44;
  const xAxisH = 22;
  const plotH = height - xAxisH;
  const maxUp = Math.max(...data.map((d) => Math.max(d.income, d.net)), 1);
  const maxDown = Math.max(...data.map((d) => Math.max(d.expense, -d.net)), 1);
  const upTicks = niceTicks(maxUp);
  const downTicks = niceTicks(maxDown);
  const upTop = upTicks[upTicks.length - 1];
  const downTop = downTicks[downTicks.length - 1];
  const scale = (plotH - 12) / (upTop + downTop);
  const base = 6 + upTop * scale;
  const y = (v: number) => base - v * scale;
  const plotW = Math.max(width - axisW, 0);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(Math.min(24, band - 8), 3);
  const ticks = [
    ...downTicks
      .slice(1)
      .map((t) => -t)
      .reverse(),
    ...upTicks,
  ];
  // Thin the tick labels if they would collide.
  const tickStep = ticks.length > 6 ? 2 : 1;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Money in and out by month">
          {ticks.map((t, i) => (
            <g key={t}>
              <line x1={axisW} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--border)" : "var(--grid)"} strokeWidth={1} />
              {(i % tickStep === 0 || t === 0) && (
                <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[10px]">
                  {formatShort(t)}
                </text>
              )}
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = axisW + i * band + band / 2;
            const x = cx0 - barW / 2;
            const show = () =>
              setTip({
                x: cx0,
                y: y(d.income),
                title: d.title,
                rows: [
                  { label: "in", value: formatGHS(d.income), color: "var(--income)" },
                  { label: "out", value: formatGHS(d.expense), color: "var(--expense)" },
                  { label: "net", value: formatGHS(d.net, { sign: true }), color: "var(--text)" },
                ],
              });
            return (
              <g key={d.key}>
                {d.income > 0 && <path d={columnPath(x, base - 1, barW, d.income * scale - 1)} fill="var(--income)" />}
                {d.expense > 0 && <path d={columnPath(x, base + 1, barW, -(d.expense * scale - 1))} fill="var(--expense)" />}
                {(d.income > 0 || d.expense > 0) && (
                  <circle cx={cx0} cy={y(d.net)} r={4} fill="var(--text)" stroke="var(--surface)" strokeWidth={2} />
                )}
                <rect
                  x={axisW + i * band}
                  y={0}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.title}: in ${formatGHS(d.income)}, out ${formatGHS(d.expense)}, net ${formatGHS(d.net, { sign: true })}`}
                  onPointerEnter={show}
                  onFocus={show}
                  onBlur={() => setTip(null)}
                  className="outline-none"
                />
                <text x={cx0} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ---------------- Line chart (cumulative, with target) ---------------- */

export interface LinePoint {
  key: string;
  label: string; // tooltip heading
  value: number;
}

export function LineChart({
  points,
  target,
  color = "var(--income)",
  height = 180,
  startLabel,
  endLabel,
}: {
  points: LinePoint[];
  target?: number;
  color?: string;
  height?: number;
  startLabel?: string;
  endLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const axisW = 44;
  const xAxisH = 22;
  const plotH = height - xAxisH;
  const max = Math.max(...points.map((p) => p.value), Math.round((target ?? 0) * 1.1), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(width - axisW - 8, 0);
  const x = (i: number) => axisW + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => plotH - (Math.max(v, 0) / top) * (plotH - 6);
  const path = useMemo(() => points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(""), [points, width, top]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = points.length ? `${path}L${x(points.length - 1)},${plotH}L${x(0)},${plotH}Z` : "";

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = points.length > 1 ? Math.round((px / plotW) * (points.length - 1)) : 0;
    setHover(Math.min(Math.max(i, 0), points.length - 1));
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && points.length > 0 && (
        <svg width={width} height={height} role="img" aria-label="Progress over time">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={width} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[10px]">
                {formatShort(t)}
              </text>
            </g>
          ))}
          {target !== undefined && target > 0 && (
            <g>
              <line x1={axisW} x2={width} y1={y(target)} y2={y(target)} stroke="var(--text)" strokeWidth={1} opacity={0.5} />
              <text x={width - 2} y={y(target) < 14 ? y(target) + 12 : y(target) - 5} textAnchor="end" className="fill-[var(--text)] text-[10px] font-medium">
                Target {formatShort(target)}
              </text>
            </g>
          )}
          <path d={area} fill={color} opacity={0.1} />
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle
            cx={x(points.length - 1)}
            cy={y(points[points.length - 1].value)}
            r={4}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={2}
          />
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={plotH} stroke="var(--border)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(h.value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
          <line x1={axisW} x2={width} y1={plotH} y2={plotH} stroke="var(--border)" strokeWidth={1} />
          {startLabel && (
            <text x={axisW} y={height - 6} className="fill-[var(--muted)] text-[10px]">
              {startLabel}
            </text>
          )}
          {endLabel && (
            <text x={width - 2} y={height - 6} textAnchor="end" className="fill-[var(--muted)] text-[10px]">
              {endLabel}
            </text>
          )}
          <rect x={axisW} y={0} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
        </svg>
      )}
      <Tooltip
        tip={
          h && hover !== null
            ? { x: x(hover), y: y(h.value), title: h.label, rows: [{ label: "saved", value: formatGHS(h.value), color, line: true }] }
            : null
        }
        width={width}
      />
    </div>
  );
}

/* ---------------- Meter ---------------- */

export type MeterTone = "good" | "warn" | "over";

export function meterTone(spent: number, amount: number, expected?: number): MeterTone {
  if (spent > amount) return "over";
  if (spent >= amount * 0.9 || (expected !== undefined && expected > 0 && spent > expected * 1.1)) return "warn";
  return "good";
}

const TONE: Record<MeterTone, { bar: BarTone; tag: TagTone; label: string; icon: LucideIcon }> = {
  good: { bar: "good", tag: "good", label: "On track", icon: CircleCheck },
  warn: { bar: "warn", tag: "warn", label: "Spending fast", icon: TriangleAlert },
  over: { bar: "bad", tag: "bad", label: "Over budget", icon: CircleAlert },
};

export function toneLabel(t: MeterTone) {
  return TONE[t].label;
}

/** Budget status as a labelled tag (icon + words, never colour alone). */
export function ToneTag({ tone }: { tone: MeterTone }) {
  return (
    <Tag tone={TONE[tone].tag} icon={TONE[tone].icon}>
      {TONE[tone].label}
    </Tag>
  );
}

/** Budget meter: a ProgressBar whose fill carries the budget state, with an optional pace tick. */
export function Meter({
  value,
  max,
  tone,
  pace,
  height = 10,
}: {
  value: number;
  max: number;
  tone: MeterTone;
  pace?: number;
  height?: number;
}) {
  return <ProgressBar value={value} max={max} tone={TONE[tone].bar} pace={pace} size={height <= 6 ? "sm" : height >= 12 ? "lg" : "md"} label={TONE[tone].label} />;
}
