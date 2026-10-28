// 국토교통부 실거래가 조회 훅. 서버(/api/molit/*)를 거쳐 받는다(서비스키는 서버에만 있다).
"use client";

import { useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { AptTrade, AptTradeResult, AptTrendResult } from "@/lib/molit/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `요청 실패 (HTTP ${res.status})`);
  return body as T;
}

export interface AptTradesState {
  items: AptTrade[];
  /** 응답이 온 호출 수 / 전체 호출 수 (구 × 월) */
  done: number;
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  /** 실패한 구·월과 사유 */
  errors: { label: string; message: string }[];
  /** DB 에 저장된 자료로 응답한 호출 수 */
  fromDb: number;
  /** DB 저장 실패 등 알림 */
  warnings: string[];
}

/** "2026-04" ~ "2026-09" → ["202604", …, "202609"] (from > to 이면 빈 목록) */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!y || !m || !ty || !tm) return out;
  while (y * 12 + m <= ty * 12 + tm) {
    out.push(`${y}${String(m).padStart(2, "0")}`);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

/** 지금 조건(구 × 월)을 국토교통부에서 새로 받아 DB 를 바꾸고, 화면 캐시도 그 결과로 바꾼다 */
export function useRefreshAptTrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pairs: { district: string; ym: string }[]) =>
      Promise.all(
        pairs.map(async ({ district, ym }) => {
          const data = await getJson<AptTradeResult>(`/api/molit/apt-trades?${new URLSearchParams({ district, ym, refresh: "1" })}`);
          qc.setQueryData(["molit", "apt-trades", district, ym], data);
        }),
      ),
  });
}

/**
 * useQueries 결과 합치기. 모듈 함수(항상 같은 참조)라야 TanStack Query 가 결과가 그대로일 때 이전 값을 돌려준다
 * → 수천 행 배열을 매 렌더 새로 만들지 않아 그리드가 다시 비교하지 않는다. errors.label 은 일단 순번이다
 */
function combineTrades(results: UseQueryResult<AptTradeResult>[]): AptTradesState {
  return {
    items: results.flatMap((r) => r.data?.items ?? []),
    done: results.filter((r) => r.isSuccess || r.isError).length,
    total: results.length,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    errors: results.flatMap((r, i) => (r.error ? [{ label: String(i), message: r.error.message }] : [])),
    fromDb: results.filter((r) => r.data?.source === "db").length,
    warnings: [...new Set(results.flatMap((r) => (r.data?.warning ? [r.data.warning] : [])))],
  };
}

/**
 * 여러 구 × 여러 월을 한 번씩 따로 조회해 합친다(API 가 구·월 단위라서). 서버는 Supabase 에 저장된 자료를 먼저 쓴다.
 * 구·월 단위로 캐시하므로 다시 고른 구는 다시 부르지 않는다.
 */
export function useAptTrades(districts: string[], months: string[]): AptTradesState {
  const pairs = districts.flatMap((district) => months.map((ym) => ({ district, ym })));
  const state = useQueries({
    queries: pairs.map(({ district, ym }) => ({
      queryKey: ["molit", "apt-trades", district, ym],
      queryFn: () => getJson<AptTradeResult>(`/api/molit/apt-trades?${new URLSearchParams({ district, ym })}`),
      staleTime: 30 * 60_000,
      retry: 1,
    })),
    combine: combineTrades,
  });
  // 실패 표시에만 구·월 이름을 붙인다(items 는 combineTrades 가 결과가 바뀔 때만 새로 만든다)
  return { ...state, errors: state.errors.map((e) => ({ ...e, label: pairs[Number(e.label)] ? `${pairs[Number(e.label)].district} ${pairs[Number(e.label)].ym}` : e.label })) };
}

/** 단지별 연도 추이. 과거 자료를 처음 채울 때는 오래 걸리므로 결과를 오래 캐시한다 */
export function useAptTrend(params: { district: string; aptSeq: string; from: number; to: number; area: number | null } | null) {
  return useQuery({
    queryKey: ["molit", "apt-trend", params],
    queryFn: () =>
      getJson<AptTrendResult>(
        `/api/molit/apt-trend?${new URLSearchParams({
          district: params!.district,
          aptSeq: params!.aptSeq,
          from: String(params!.from),
          to: String(params!.to),
          ...(params!.area !== null && { area: String(params!.area) }),
        })}`,
      ),
    enabled: !!params,
    staleTime: 30 * 60_000,
    retry: false,
  });
}
