// 실거래가: 국토교통부 아파트 매매 실거래가를 구(여러 개 · 서울 전체)·계약월 기간으로 조회하고, 선택한 구의 단지로 거른다.
// 아래 탭: 거래 목록 · 단지별 추이(고른 단지의 연도별 매매가 그래프)
"use client";

import { useMemo, useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, Input, PageShell, Select } from "@/components/ui";
import { SEOUL_DISTRICTS } from "@/lib/client/data";
import { monthsBetween, useAptTrades, useRefreshAptTrades } from "@/lib/client/molit";
import type { AptTrade } from "@/lib/molit/types";
import { TRADE_COLUMNS } from "./columns";
import { TrendPanel } from "./TrendPanel";

/** n달 전(YYYY-MM). 기본 기간은 지난 3개월: 이번 달 자료는 신고 기한(30일) 때문에 아직 비어 있는 경우가 많다 */
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toLocaleDateString("sv-SE").slice(0, 7);
};
/** 한 번에 조회할 수 있는 최대 개월 수(서울 전체 × 12개월 = 300회 호출) */
const MAX_MONTHS = 12;
/** 띄어쓰기·대소문자를 무시하고 비교한다 (예: "래미안 푸르지오" = "래미안푸르지오") */
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const ymLabel = (ym: string) => `${ym.slice(0, 4)}.${ym.slice(4)}`;
export function TradesPage() {
  const [districts, setDistricts] = useState<string[]>(["마포구"]);
  const [range, setRange] = useState({ from: monthsAgo(3), to: monthsAgo(1) });
  /** 조회에 쓰는 기간. 기간은 [조회]를 눌러야 반영한다(입력 중에 호출하지 않도록) */
  const [applied, setApplied] = useState(range);
  /** 고른 단지("구|단지명"). 빈 값이면 전체 */
  const [apt, setApt] = useState("");
  /** 단지명 부분 검색어(LIKE). 단지 select 목록과 표를 함께 좁힌다 */
  const [aptText, setAptText] = useState("");
  const [view, setView] = useState<"list" | "trend">("list");
  // 구는 켜고 끄면 바로 반영한다(구·월 단위로 캐시하므로 다시 켠 구는 바로 나온다)
  const selected = SEOUL_DISTRICTS.filter((d) => districts.includes(d));
  const months = monthsBetween(applied.from, applied.to);
  const result = useAptTrades(selected, months);
  const refresh = useRefreshAptTrades();
  const busy = result.isFetching || refresh.isPending;

  const draftMonths = monthsBetween(range.from, range.to).length;
  const rangeError = !range.from || !range.to ? "기간을 입력하세요" : !draftMonths ? "시작 월이 끝 월보다 늦습니다" : draftMonths > MAX_MONTHS ? `최대 ${MAX_MONTHS}개월까지 조회할 수 있습니다` : null;
  // 조회: 저장된 자료(DB)를 먼저 쓴다. 새로 받기: 지금 조건을 국토교통부에서 다시 받아 DB 를 바꾼다
  const search = () => setApplied(range);
  const refetchFromApi = () => {
    setApplied(range);
    refresh.mutate(selected.flatMap((district) => monthsBetween(range.from, range.to).map((ym) => ({ district, ym }))));
  };

  // 단지명 검색어로 먼저 거른다 → 단지 select 에는 검색어에 맞는 단지만 남는다
  const matched = useMemo(() => {
    const q = norm(aptText);
    return q ? result.items.filter((t) => norm(t.aptName).includes(q)) : result.items;
  }, [result.items, aptText]);

  // 단지 목록: 선택된 구의 거래에서만 만든다 → 구를 켜면 추가되고 끄면 빠진다
  const aptGroups = useMemo(() => {
    const byDistrict = new Map<string, Set<string>>();
    for (const t of matched) {
      if (!byDistrict.has(t.district)) byDistrict.set(t.district, new Set());
      byDistrict.get(t.district)!.add(t.aptName);
    }
    return SEOUL_DISTRICTS.filter((d) => byDistrict.has(d)).map((d) => ({ district: d, names: [...byDistrict.get(d)!].sort((x, y) => x.localeCompare(y, "ko")) }));
  }, [matched]);
  // 고른 단지의 구를 끄거나 검색어에 안 맞으면(또는 그 기간에 거래가 없으면) 선택을 푼다
  const aptValue = aptGroups.some((g) => g.names.some((n) => `${g.district}|${n}` === apt)) ? apt : "";

  const rows = useMemo(() => (aptValue ? matched.filter((t) => `${t.district}|${t.aptName}` === aptValue) : matched), [matched, aptValue]);
  const cancelled = rows.filter((r) => r.cancelled).length;
  // 추이 탭은 단지 고유번호(aptSeq)로 찾는다(해마다 단지명이 조금씩 달라도 같은 단지)
  const trendApt = useMemo(() => {
    const t = aptValue ? rows.find((r) => r.raw.aptSeq?.trim()) : undefined;
    return t ? { district: t.district, aptSeq: t.raw.aptSeq.trim(), aptName: t.aptName } : null;
  }, [aptValue, rows]);

  const allSelected = districts.length === SEOUL_DISTRICTS.length;
  const toggle = (d: string) => setDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <PageShell title="실거래가">
      <Card className="flex flex-col gap-4 p-4">
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-[13px] font-medium text-slate-600">구 ({districts.length}개 선택)</legend>
            <Button variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setDistricts(allSelected ? [] : [...SEOUL_DISTRICTS])}>
              {allSelected ? "모두 해제" : "서울 전체"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEOUL_DISTRICTS.map((d) => {
              const on = districts.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    on ? "border-brand-600 bg-brand-600 text-on-color" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="계약월">
            <div className="flex items-center gap-1.5">
              <Input type="month" aria-label="시작 월" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <span className="text-slate-400">~</span>
              <Input type="month" aria-label="끝 월" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          </Field>
          <Field label="단지명 검색">
            <Input type="search" value={aptText} onChange={(e) => setAptText(e.target.value)} placeholder="예: 래미안" className="w-48" />
          </Field>
          <Field label={`단지 (${aptGroups.reduce((n, g) => n + g.names.length, 0)}곳)`}>
            <Select value={aptValue} onChange={(e) => setApt(e.target.value)} disabled={!aptGroups.length} className="w-72">
              <option value="">전체 단지</option>
              {aptGroups.map((g) => (
                <optgroup key={g.district} label={g.district}>
                  {g.names.map((n) => (
                    <option key={n} value={`${g.district}|${n}`}>
                      {n}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-right text-sm text-slate-500">
              {rangeError ? (
                <span className="text-red-700">{rangeError}</span>
              ) : (
                <>
                  {refresh.isPending ? "국토교통부에서 받는 중 · " : result.isFetching && `불러오는 중 ${result.done}/${result.total} · `}
                  {months.length ? `${ymLabel(months[0])}~${ymLabel(months[months.length - 1])}` : ""} · {rows.length - cancelled}건
                  {cancelled > 0 && ` (해제 ${cancelled}건 별도)`}
                  {result.total > 0 && !busy && ` · 저장된 자료 ${result.fromDb}/${result.total}`}
                </>
              )}
            </p>
            <Button disabled={!!rangeError || !districts.length || busy} onClick={refetchFromApi} title="저장된 자료를 무시하고 국토교통부에서 다시 받아 저장합니다">
              <Icon name="refresh" className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
              새로 받기
            </Button>
            <Button variant="primary" disabled={!!rangeError || !districts.length || busy} onClick={search}>
              조회
            </Button>
          </div>
        </div>
      </Card>
      {result.warnings.length > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{result.warnings.join(" / ")}</p>}
      <ErrorText error={refresh.error} />
      {result.errors.length > 0 && <ErrorText error={new Error(result.errors.map((e) => `${e.label}: ${e.message}`).join(" / "))} />}
      <div role="tablist" aria-label="보기" className="flex gap-1 border-b border-slate-200">
        {(
          [
            ["list", "거래 목록"],
            ["trend", "단지별 추이"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              view === key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "trend" ? (
        <TrendPanel key={trendApt?.aptSeq ?? "none"} apt={trendApt} />
      ) : (
        <Card className="p-0">
          {/* 서울 전체면 수천 건이므로 높이를 고정해 보이는 행만 그린다 */}
          <DataGrid<AptTrade> height={640} rowData={rows} loading={result.isLoading && !result.items.length} columnDefs={TRADE_COLUMNS} getRowId={(p) => p.data.key} defaultColDef={{ sortable: true }} />
        </Card>
      )}
    </PageShell>
  );
}
