// 관심 단지 ↔ 실거래 시세(서버 전용). 필요한 구·월을 DB 에 채운 뒤(store 와 같은 신선도 규칙) view·함수로 요약을 읽는다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSeoulDistrict, type SeoulDistrict } from "./lawd";
import { ensureMonths, recentMonths } from "./trend";
import type { AptComplex, AptComplexesResult, FavoritePrice, FavoritePricesResult } from "./types";

/** 시세 요약 기간: 최근 12개월과 그 전 12개월(view favorite_price_summary 와 맞춘다) */
export const PRICE_MONTHS = 24;
/** 단지 목록을 만들 기간. 그동안 거래가 한 건도 없는 단지는 목록에 안 나온다 */
export const COMPLEX_MONTHS = 12;

interface SummaryRow {
  favorite_id: number;
  last_deal_date: string | null;
  last_price_manwon: number | null;
  last_area_m2: number | string | null;
  last_floor: number | null;
  recent_count: number | string;
  recent_avg: number | null;
  recent_per_pyeong: number | null;
  prev_count: number | string;
  prev_per_pyeong: number | null;
  change_pct: number | string | null;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

export const fromSummaryRow = (r: SummaryRow): FavoritePrice => ({
  favoriteId: r.favorite_id,
  lastDealDate: r.last_deal_date,
  lastPriceManwon: r.last_price_manwon,
  lastAreaM2: num(r.last_area_m2),
  lastFloor: r.last_floor,
  recentCount: Number(r.recent_count),
  recentAvg: r.recent_avg,
  recentPerPyeong: r.recent_per_pyeong,
  prevCount: Number(r.prev_count),
  prevPerPyeong: r.prev_per_pyeong,
  changePct: num(r.change_pct),
});

/** 실거래 단지가 연결된 관심 단지의 구마다 최근 24개월을 채우고 시세 요약을 돌려준다 */
export async function favoritePrices(db: SupabaseClient): Promise<FavoritePricesResult> {
  const favs = await db.from("favorites").select("district").not("apt_seq", "is", null);
  if (favs.error) throw new Error(`관심 단지 읽기 실패: ${favs.error.message}`);
  const districts = [...new Set((favs.data ?? []).map((f) => f.district as string))].filter(isSeoulDistrict);

  const yms = recentMonths(PRICE_MONTHS);
  let fetchedMonths = 0;
  const failedMonths: string[] = [];
  // 구마다 차례로(한 구 안에서는 동시에 여러 달) 받아 국토교통부 호출이 한꺼번에 몰리지 않게 한다
  for (const d of districts) {
    const r = await ensureMonths(db, d, yms);
    fetchedMonths += r.fetched;
    failedMonths.push(...r.failed.map((ym) => `${d} ${ym}`));
  }

  const { data, error } = await db.from("favorite_price_summary").select("*");
  if (error) throw new Error(`시세 요약 읽기 실패: ${error.message}`);
  return { items: (data as SummaryRow[]).map(fromSummaryRow), fetchedMonths, failedMonths };
}

interface ComplexRow {
  apt_seq: string;
  apt_name: string;
  dong: string;
  build_year: number | null;
  trade_count: number | string;
  last_deal_date: string | null;
  areas: number[] | null;
}

/** 한 구의 단지 목록(최근 12개월 거래 기준). 관심 단지에 실거래 단지를 연결할 때 고른다 */
export async function aptComplexes(db: SupabaseClient, district: SeoulDistrict): Promise<AptComplexesResult> {
  const { failed } = await ensureMonths(db, district, recentMonths(COMPLEX_MONTHS));
  const { data, error } = await db.rpc("search_apt_complexes", { p_district: district });
  if (error) throw new Error(`단지 목록 읽기 실패: ${error.message}`);
  const items = (data as ComplexRow[]).map(
    (r): AptComplex => ({
      aptSeq: r.apt_seq,
      aptName: r.apt_name,
      dong: r.dong,
      buildYear: r.build_year,
      tradeCount: Number(r.trade_count),
      lastDealDate: r.last_deal_date,
      areas: r.areas ?? [],
    }),
  );
  return { district, months: COMPLEX_MONTHS, items, failedMonths: failed };
}
