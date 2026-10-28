// 단지 연도별 매매가 차트: 막대 = 연평균 거래금액, 꺾은선 = 연 최고 거래금액. 같은 금액 축 하나만 쓴다.
// 값은 꺾은선 점과 겹치므로 직접 달지 않고 툴팁과 아래 연도별 표로 보여 준다.
// 색은 dataviz 검증 스크립트로 라이트/다크 각각 통과한 값이다(막대 초록 · 선 황토).
"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/client/data";
import type { AptTrendYear } from "@/lib/molit/types";

const HEIGHT = 320;
const PAD = { top: 24, right: 16, bottom: 32, left: 56 };
const BAR_MAX = 24;

/** 축 눈금용 짧은 금액: 12.5억, 8,500만 */
const shortPrice = (manwon: number) => (manwon >= 10000 ? `${+(manwon / 10000).toFixed(1)}억` : `${manwon.toLocaleString()}만`);

/** 0부터 max 를 덮는 깔끔한 눈금(1·2·2.5·5 × 10ⁿ 간격, 4~6개) */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** selected · onSelect: 막대(연도)를 누르면 그 해를 고른다. 다시 누르면 풀린다 */
export function TrendChart({ years, selected, onSelect }: { years: AptTrendYear[]; selected?: number | null; onSelect?: (year: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ticks = niceTicks(Math.max(0, ...years.map((y) => y.max ?? 0)));
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = years.length ? plotW / years.length : 0;
  const barW = Math.min(BAR_MAX, band * 0.6);
  const x = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  // 거래가 없는 해는 선을 끊는다
  const segments: string[] = [];
  let cur = "";
  years.forEach((d, i) => {
    if (d.max === null) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i)},${y(d.max)}`;
  });
  if (cur) segments.push(cur);

  const h = hover !== null ? years[hover] : null;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex gap-4 text-xs text-slate-600" aria-label="범례">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1f7f52] dark:bg-[#3a9a6b]" />
          연평균 거래금액
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#b07d14] dark:bg-[#b9861a]" />
          연 최고 거래금액
        </li>
      </ul>
      <div ref={box} className="relative w-full" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="연도별 매매가 추이" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-200" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                  {t === 0 ? "0" : shortPrice(t)}
                </text>
              </g>
            ))}
            {years.map((d, i) => (
              <text
                key={d.year}
                x={x(i)}
                y={HEIGHT - PAD.bottom + 18}
                textAnchor="middle"
                className={`text-[11px] tabular-nums ${d.year === selected ? "fill-slate-900 font-semibold" : "fill-slate-500"}`}
              >
                {d.year}
              </text>
            ))}
            {years.map((d, i) =>
              d.year === selected ? <rect key={d.year} x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} className="fill-brand-100" /> : null,
            )}
            {hover !== null && years[hover].year !== selected && <rect x={PAD.left + band * hover} y={PAD.top} width={band} height={plotH} className="fill-slate-100" />}
            {years.map((d, i) =>
              d.avg === null ? null : (
                // 위쪽만 4px 둥글게, 바닥은 각지게
                <path
                  key={d.year}
                  d={roundedTopBar(x(i) - barW / 2, y(d.avg), barW, y(0) - y(d.avg), 4)}
                  className="fill-[#1f7f52] dark:fill-[#3a9a6b]"
                />
              ),
            )}
            {segments.map((d) => (
              <path key={d} d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-[#b07d14] dark:stroke-[#b9861a]" />
            ))}
            {years.map((d, i) =>
              d.max === null ? null : (
                <circle key={d.year} cx={x(i)} cy={y(d.max)} r={4} strokeWidth={2} className="fill-[#b07d14] stroke-white dark:fill-[#b9861a]" />
              ),
            )}
            {/* 해마다 세로 띠 전체를 마우스 영역으로 쓴다(막대보다 넓게) */}
            {years.map((d, i) => (
              <rect
                key={d.year}
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                className={onSelect && d.count ? "cursor-pointer" : undefined}
                onMouseEnter={() => setHover(i)}
                onClick={() => d.count && onSelect?.(d.year === selected ? null : d.year)}
              />
            ))}
          </svg>
        )}
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop"
            style={{ left: Math.min(x(hover) + 12, width - 180), top: PAD.top }}
          >
            <p className="mb-1 font-semibold text-slate-900">{h.year}년</p>
            {h.count ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums text-slate-600">
                <dt>평균</dt>
                <dd className="text-right font-medium text-slate-900">{formatPrice(h.avg)}</dd>
                <dt>최고</dt>
                <dd className="text-right text-slate-900">{formatPrice(h.max)}</dd>
                <dt>최저</dt>
                <dd className="text-right text-slate-900">{formatPrice(h.min)}</dd>
                <dt>거래</dt>
                <dd className="text-right text-slate-900">{h.count}건</dd>
              </dl>
            ) : (
              <p className="text-slate-500">거래 없음</p>
            )}
            {onSelect && h.count > 0 && <p className="mt-1.5 text-[11px] text-slate-500">{h.year === selected ? "누르면 선택 해제" : "누르면 거래 목록"}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
