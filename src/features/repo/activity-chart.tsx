"use client";

import { useMemo, useState } from "react";
import { cn, formatMonth } from "@/lib/utils";

interface Props {
  series: { month: string; commits: number }[];
  releases: { tag: string; publishedAt: string; prerelease: boolean }[];
  issues: { month: string; count: number }[];
  pullRequests: { month: string; count: number }[];
  peak: { start: string; end: string } | null;
  declineStart: string | null;
  lastActiveMonth: string | null;
}

const W = 860;
const H = 240;
const PAD = { left: 40, right: 12, top: 16, bottom: 28 };

type Layer = "releases" | "issues" | "pullRequests";

export function ActivityChart({ series, releases, issues, pullRequests, peak, declineStart, lastActiveMonth }: Props) {
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ releases: true, issues: false, pullRequests: false });
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = series.length;
    const step = innerW / n;
    const max = Math.max(1, ...series.map((s) => s.commits));
    const index = new Map(series.map((s, i) => [s.month, i]));
    const x = (i: number) => PAD.left + i * step;
    const y = (v: number, m: number) => PAD.top + innerH - (v / m) * innerH;
    const line = (data: { month: string; count: number }[]) => {
      const m = Math.max(1, ...data.map((d) => d.count));
      const pts = data.filter((d) => index.has(d.month)).map((d) => `${x(index.get(d.month)! + 0.5).toFixed(1)},${y(d.count, m).toFixed(1)}`);
      return pts.length > 1 ? `M${pts.join("L")}` : "";
    };
    const years: { label: string; x: number }[] = [];
    series.forEach((s, i) => {
      if (s.month.endsWith("-01")) years.push({ label: s.month.slice(0, 4), x: x(i) });
    });
    const every = Math.ceil(years.length / 9);
    return {
      innerH,
      step,
      max,
      x,
      y,
      years: years.filter((_, i) => i % every === 0),
      issuesPath: line(issues),
      prsPath: line(pullRequests),
      releaseMarks: releases
        .map((r) => ({ ...r, i: index.get(r.publishedAt.slice(0, 7)) }))
        .filter((r): r is typeof r & { i: number } => r.i !== undefined),
    };
  }, [series, releases, issues, pullRequests]);

  const idx = (month: string | null) => (month ? series.findIndex((s) => s.month === month) : -1);
  const peakStart = idx(peak?.start ?? null);
  const peakEnd = idx(peak?.end ?? null);
  const declineIdx = idx(declineStart);
  const lastIdx = idx(lastActiveMonth);
  const active = hover === null ? null : series[hover];

  const toggle = (k: Layer) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const chips: { key: Layer; label: string; color: string }[] = [
    { key: "releases", label: "Releases", color: "#e9c46a" },
    { key: "issues", label: "Issues (sampled)", color: "#7aa7ff" },
    { key: "pullRequests", label: "Pull requests (sampled)", color: "#a995ff" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          <span className="size-2 rounded-sm bg-grave-green" /> Commits per month
        </span>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={layers[c.key]}
            onClick={() => toggle(c.key)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", layers[c.key] ? "border-white/25 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <span className="size-2 rounded-full" style={{ background: c.color, opacity: layers[c.key] ? 1 : 0.35 }} />
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`Commits per month from ${formatMonth(series[0].month)} to ${formatMonth(series[series.length - 1].month)}${declineStart ? `. Activity fades from ${formatMonth(declineStart)}.` : "."}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.floor((px - PAD.left) / model.step);
            setHover(i >= 0 && i < series.length ? i : null);
          }}
        >
          <defs>
            <pattern id="fade-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(169 149 255 / 0.18)" strokeWidth="1.5" />
            </pattern>
          </defs>

          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={model.y(model.max * t, model.max)} y2={model.y(model.max * t, model.max)} stroke="rgb(255 255 255 / 0.06)" />
              <text x={PAD.left - 8} y={model.y(model.max * t, model.max) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {Math.round(model.max * t)}
              </text>
            </g>
          ))}

          {peakStart >= 0 && peakEnd >= 0 && <rect x={model.x(peakStart)} y={PAD.top} width={model.x(peakEnd + 1) - model.x(peakStart)} height={model.innerH} fill="rgb(110 231 168 / 0.07)" />}
          {declineIdx >= 0 && <rect x={model.x(declineIdx)} y={PAD.top} width={W - PAD.right - model.x(declineIdx)} height={model.innerH} fill="url(#fade-hatch)" />}

          {series.map((s, i) => {
            const h = (s.commits / model.max) * model.innerH;
            const dead = lastIdx >= 0 && i > lastIdx;
            return s.commits > 0 ? <rect key={s.month} x={model.x(i) + 0.4} y={model.y(s.commits, model.max)} width={Math.max(1, model.step - 0.8)} height={h} rx={0.8} fill={declineIdx >= 0 && i >= declineIdx ? "#a995ff" : "#6ee7a8"} opacity={dead ? 0.3 : hover === i ? 1 : 0.85} /> : null;
          })}

          {layers.issues && model.issuesPath && <path d={model.issuesPath} fill="none" stroke="#7aa7ff" strokeWidth="1.5" strokeLinejoin="round" />}
          {layers.pullRequests && model.prsPath && <path d={model.prsPath} fill="none" stroke="#a995ff" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />}
          {layers.releases &&
            model.releaseMarks.map((r) => (
              <line key={r.tag} x1={model.x(r.i + 0.5)} x2={model.x(r.i + 0.5)} y1={PAD.top} y2={PAD.top + model.innerH} stroke="#e9c46a" strokeOpacity={r.prerelease ? 0.25 : 0.55} strokeWidth="1" />
            ))}

          {peakStart >= 0 && (
            <text x={model.x(peakStart) + 4} y={PAD.top + 10} className="fill-grave-green text-[10px]">
              Peak
            </text>
          )}
          {declineIdx >= 0 && (
            <text x={Math.min(model.x(declineIdx) + 4, W - 110)} y={PAD.top + 10} className="fill-grave-purple text-[10px]">
              Activity fades
            </text>
          )}

          {model.years.map((yr) => (
            <text key={yr.label} x={yr.x} y={H - 8} className="fill-muted-foreground text-[10px]">
              {yr.label}
            </text>
          ))}

          {hover !== null && <line x1={model.x(hover + 0.5)} x2={model.x(hover + 0.5)} y1={PAD.top} y2={PAD.top + model.innerH} stroke="rgb(255 255 255 / 0.25)" />}
        </svg>

        {active && (
          <div className="pointer-events-none absolute top-2 right-3 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
            <p className="font-medium">{formatMonth(active.month)}</p>
            <p className="text-muted-foreground">{active.commits} commits</p>
          </div>
        )}
      </div>
    </div>
  );
}
