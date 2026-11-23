// 국토교통부 실거래가 조회 훅. 서버(/api/molit/*)를 거쳐 받는다(서비스키는 서버에만 있다).
"use client";

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
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
  /** loader 가 아직 받지 않은 구·월 수(그 구·월 거래는 빠져 있다) */
  notLoaded: number;
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
    notLoaded: results.filter((r) => r.data?.status === "not_loaded").length,
  };
}

/**
 * 여러 구 × 여러 월을 한 번씩 따로 조회해 합친다(API 가 구·월 단위라서). 서버는 loader 가 Supabase 에 받아 둔 자료만 돌려준다.
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

/** 단지별 연도 추이(DB 에 받아 둔 자료로 계산) */
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
