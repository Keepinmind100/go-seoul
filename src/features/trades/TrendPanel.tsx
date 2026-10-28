// 단지별 추이: 위에서 고른 단지의 연도별 매매가(막대 평균 · 꺾은선 최고)와 연도별 표.
// 그래프의 연도(또는 연도별 표의 행)를 누르면 그해 거래 목록을 그래프 바로 아래에 보여 준다.
"use client";

import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Card, ErrorText, Field, Select } from "@/components/ui";
import { formatPrice } from "@/lib/client/data";
import { useAptTrend } from "@/lib/client/molit";
import type { AptTrade, AptTrendYear } from "@/lib/molit/types";
import { PYEONG, TRADE_COLUMNS } from "./columns";
import { TrendChart } from "./TrendChart";

const FIRST_YEAR = 2006;
const MAX_YEARS = 20;

/** 연도별 요약 표의 한 줄: 연도 통계 + 전년 대비 · 평당가 · 최고/최저가 거래 상세 */
interface YearRow extends AptTrendYear {
  /** 평균 거래금액의 직전 거래 연도 대비 변동률(%) */
  change: number | null;
  /** 비교한 직전 연도(바로 앞 해에 거래가 없으면 그 전 해) */
  prevYear: number | null;
  /** 평균 평당가(만원/3.3㎡) */
  perPyeong: number | null;
  maxTrade: AptTrade | null;
  minTrade: AptTrade | null;
}

/** "03.12 · 84㎡(25평) 15층" */
const tradeNote = (t: AptTrade | null) => (t ? `${t.dealDate.slice(5).replace("-", ".")} · ${Math.round(t.areaM2)}㎡(${Math.round(t.areaM2 / PYEONG)}평)${t.floor !== null ? ` ${t.floor}층` : ""}` : "");

function toYearRows(years: AptTrendYear[], trades: AptTrade[]): YearRow[] {
  let prev: { year: number; avg: number } | null = null;
  const rows = years.map((y): YearRow => {
    const list = trades.filter((t) => !t.cancelled && t.dealDate.startsWith(String(y.year)));
    const pick = (better: (a: AptTrade, b: AptTrade) => boolean) => list.reduce<AptTrade | null>((acc, t) => (!acc || better(t, acc) ? t : acc), null);
    const row: YearRow = {
      ...y,
      change: y.avg !== null && prev ? ((y.avg - prev.avg) / prev.avg) * 100 : null,
      prevYear: y.avg !== null && prev ? prev.year : null,
      perPyeong: list.length ? Math.round(list.reduce((s, t) => s + t.priceManwon / (t.areaM2 / PYEONG), 0) / list.length) : null,
      maxTrade: pick((a, b) => a.priceManwon > b.priceManwon),
      minTrade: pick((a, b) => a.priceManwon < b.priceManwon),
    };
    if (y.avg !== null) prev = { year: y.year, avg: y.avg };
    return row;
  });
  return rows.reverse();
}

const COLUMNS: ColDef<YearRow>[] = [
  { field: "year", headerName: "연도", width: 80 },
  { field: "count", headerName: "거래", width: 80, type: "rightAligned", valueFormatter: (p) => `${p.value}건`, headerTooltip: "해제된 거래는 뺀 건수" },
  { field: "avg", headerName: "평균", width: 120, type: "rightAligned", valueFormatter: (p) => formatPrice(p.value), cellClass: "ag-right-aligned-cell tabular-nums font-semibold" },
  {
    field: "change",
    headerName: "전년 대비",
    width: 170,
    type: "rightAligned",
    headerTooltip: "평균 거래금액이 직전 거래 연도보다 얼마나 올랐나(▲)·내렸나(▼)",
    valueFormatter: (p) =>
      p.value === null || p.value === undefined
        ? "—"
        : `${p.value > 0 ? "▲" : p.value < 0 ? "▼" : ""}${Math.abs(p.value).toFixed(1)}%${p.data?.prevYear && p.data.prevYear !== p.data.year - 1 ? ` (${p.data.prevYear}년 대비)` : ""}`,
    cellClass: (p) => `ag-right-aligned-cell tabular-nums ${p.value > 0 ? "text-red-700" : p.value < 0 ? "text-blue-700" : ""}`,
  },
  {
    field: "perPyeong",
    headerName: "평당가",
    width: 110,
    type: "rightAligned",
    headerTooltip: "거래마다 금액 ÷ 전용 평수를 구해 평균 낸 값(전용 3.3㎡당)",
    valueFormatter: (p) => formatPrice(p.value),
  },
  {
    field: "max",
    headerName: "최고가 거래",
    flex: 1,
    minWidth: 220,
    valueFormatter: (p) => (p.value === null ? "—" : `${formatPrice(p.value)}  ·  ${tradeNote(p.data?.maxTrade ?? null)}`),
    headerTooltip: "그해 가장 비싼 거래의 금액 · 계약일 · 전용면적 · 층",
  },
  {
    field: "min",
    headerName: "최저가 거래",
    flex: 1,
    minWidth: 220,
    valueFormatter: (p) => (p.value === null ? "—" : `${formatPrice(p.value)}  ·  ${tradeNote(p.data?.minTrade ?? null)}`),
    headerTooltip: "그해 가장 싼 거래의 금액 · 계약일 · 전용면적 · 층",
  },
];

export function TrendPanel({ apt }: { apt: { district: string; aptSeq: string; aptName: string } | null }) {
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(thisYear - 9);
  const [to, setTo] = useState(thisYear);
  const [area, setArea] = useState<number | null>(null);
  /** 그래프에서 누른 연도 */
  const [picked, setPicked] = useState<number | null>(null);
  const yearError = from > to ? "시작 연도가 끝 연도보다 늦습니다" : to - from + 1 > MAX_YEARS ? `최대 ${MAX_YEARS}년까지 볼 수 있습니다` : null;
  const trend = useAptTrend(apt && !yearError ? { district: apt.district, aptSeq: apt.aptSeq, from, to, area } : null);
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);

  const data = trend.data;
  const yearRows = useMemo(() => (data ? toYearRows(data.years, data.trades) : []), [data]);

  if (!apt)
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        위에서 <b className="text-slate-700">단지</b>를 하나 고르면 연도별 매매가 추이를 보여 줍니다. (단지명 검색으로 좁힌 뒤 고르면 편합니다)
      </Card>
    );

  return (
    <>
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <p className="text-xs text-slate-500">{apt.district}</p>
            <h2 className="text-lg font-semibold text-slate-900">{data?.aptName || apt.aptName}</h2>
          </div>
          <Field label="연도">
            <div className="flex items-center gap-1.5">
              <Select aria-label="시작 연도" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
              <span className="text-slate-400">~</span>
              <Select aria-label="끝 연도" value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
            </div>
          </Field>
          <Field label="전용면적">
            <Select value={area ?? ""} onChange={(e) => setArea(e.target.value ? Number(e.target.value) : null)} className="w-44">
              <option value="">전체 면적</option>
              {data?.areas.map((a) => (
                <option key={a.area} value={a.area}>
                  {a.area}㎡ ({Math.round(a.area / PYEONG)}평) · {a.count}건
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {yearError && <p className="text-sm text-red-700">{yearError}</p>}
        <ErrorText error={trend.error} />
        {trend.isFetching ? (
          <p className="py-24 text-center text-sm text-slate-500">
            불러오는 중… 처음 보는 기간은 국토교통부에서 구 전체 자료를 받아 저장하느라 1분 가까이 걸릴 수 있습니다. 한 번 받은 기간은 바로 나옵니다.
          </p>
        ) : data && data.years.some((y) => y.count) ? (
          <TrendChart years={data.years} selected={picked} onSelect={setPicked} />
        ) : (
          data && <p className="py-24 text-center text-sm text-slate-500">이 기간에 거래가 없습니다.</p>
        )}
        {data && !trend.isFetching && data.years.some((y) => y.count) && !picked && (
          <p className="text-center text-xs text-slate-500">그래프에서 연도를 누르면 그해 거래 목록이 아래에 나옵니다.</p>
        )}
        {data && data.failedMonths.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {data.failedMonths.length}개월은 국토교통부에서 받지 못해 빠졌습니다({data.failedMonths.slice(0, 6).join(", ")}
            {data.failedMonths.length > 6 && " …"}). 잠시 뒤 다시 열면 채웁니다.
          </p>
        )}
      </Card>
      {data && picked !== null && <YearTrades year={picked} trades={data.trades.filter((t) => t.dealDate.startsWith(String(picked)))} onClose={() => setPicked(null)} />}
      {data && (
        <Card className="flex flex-col p-0">
          <div className="flex flex-col gap-1 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              연도별 요약{" "}
              <span className="font-normal text-slate-500">
                {data.fromYear}~{data.toYear} · {area === null ? "전체 면적" : `전용 ${area}㎡(${Math.round(area / PYEONG)}평)`} · 해제 거래 제외
              </span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-500">
              <b className="font-medium text-slate-600">평균</b>은 그해 거래금액의 단순 평균이라 큰 평형 거래가 많은 해는 높게 나옵니다. 평형을 맞춰 비교하려면 위에서
              전용면적을 고르세요. <b className="font-medium text-slate-600">전년 대비</b>는 평균의 변동률(▲ 상승 · ▼ 하락)이고, 앞 해에 거래가 없으면 그 전
              거래 연도와 비교합니다. <b className="font-medium text-slate-600">평당가</b>는 전용 3.3㎡당 금액입니다. 행을 누르면 그해 거래 목록이 위에 나옵니다.
            </p>
          </div>
          <DataGrid<YearRow>
            rowData={yearRows}
            columnDefs={COLUMNS}
            getRowId={(p) => String(p.data.year)}
            onRowClicked={(e) => e.data?.count && setPicked(e.data.year)}
            rowStyle={{ cursor: "pointer" }}
          />
        </Card>
      )}
    </>
  );
}

function YearTrades({ year, trades, onClose }: { year: number; trades: AptTrade[]; onClose: () => void }) {
  return (
    <Card className="flex flex-col gap-0 p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          {year}년 거래{" "}
          <span className="font-normal text-slate-500">
            {trades.filter((t) => !t.cancelled).length}건 · 최신순{trades.some((t) => t.cancelled) && ` · 해제 ${trades.filter((t) => t.cancelled).length}건 별도(취소선)`}
          </span>
        </h3>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          닫기 ✕
        </button>
      </div>
      <DataGrid<AptTrade> rowData={trades} columnDefs={TRADE_COLUMNS} getRowId={(p) => p.data.key} defaultColDef={{ sortable: true }} />
    </Card>
  );
}
