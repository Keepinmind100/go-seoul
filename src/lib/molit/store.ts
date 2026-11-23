// 실거래가 저장소(Supabase apt_trades). 쓰기는 loader(배치, src/jobs/loadAptTrades.ts)만, 앱 API 는 읽기만 한다.
// 구·월 단위로 받은 기록은 apt_trade_loads 에 있다(거래 0건인 달도 받은 것으로 남는다).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeoulDistrict } from "./lawd";
import type { AptTrade, AptTradeResult } from "./types";

/** 이 개월 수 안의 자료는 늦은 신고·계약 해제로 바뀔 수 있어 하루에 한 번 다시 받는다 */
export const RECENT_MONTHS = 3;
const REFRESH_MS = 24 * 60 * 60 * 1000;
/** Supabase(PostgREST) 한 번에 돌려주는 최대 행 수 */
const PAGE = 1000;

/** 지금으로부터 몇 달 전인지 (이번 달 = 0) */
export function monthsAgoOf(ym: string, now = new Date()): number {
  return now.getFullYear() * 12 + now.getMonth() + 1 - (Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4)));
}

/** 받은 기록이 있고, 지난 자료이거나 하루 안에 받았으면 다시 받을 필요가 없다(loader 가 쓴다) */
export function isFresh(loadedAt: string | null, ym: string, now = new Date()): boolean {
  if (!loadedAt) return false;
  if (monthsAgoOf(ym, now) > RECENT_MONTHS) return true;
  return now.getTime() - new Date(loadedAt).getTime() < REFRESH_MS;
}

export interface TradeRow {
  trade_key: string;
  district: string;
  apt_seq: string | null;
  apt_name: string;
  dong: string;
  jibun: string | null;
  road_name: string | null;
  area_m2: number;
  floor: number | null;
  build_year: number | null;
  deal_date: string;
  price_manwon: number;
  deal_type: string | null;
  cancelled: boolean;
  raw: Record<string, string>;
}

const toRow = (t: AptTrade): Omit<TradeRow, "district"> => ({
  trade_key: t.key,
  apt_seq: t.raw.aptSeq?.trim() || null,
  apt_name: t.aptName,
  dong: t.dong,
  jibun: t.jibun || null,
  road_name: t.roadName,
  area_m2: t.areaM2,
  floor: t.floor,
  build_year: t.buildYear,
  deal_date: t.dealDate,
  price_manwon: t.priceManwon,
  deal_type: t.dealType,
  cancelled: t.cancelled,
  raw: t.raw,
});

export const fromRow = (r: TradeRow): AptTrade => ({
  key: r.trade_key,
  district: r.district,
  aptName: r.apt_name,
  dong: r.dong,
  jibun: r.jibun ?? "",
  roadName: r.road_name,
  areaM2: Number(r.area_m2),
  floor: r.floor,
  buildYear: r.build_year,
  dealDate: r.deal_date,
  priceManwon: r.price_manwon,
  dealType: r.deal_type,
  cancelled: r.cancelled,
  raw: r.raw,
});

async function readRows(db: SupabaseClient, district: string, ym: string): Promise<AptTrade[]> {
  const rows: TradeRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("apt_trades").select("*").eq("district", district).eq("ym", ym).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`실거래가 DB 읽기 실패: ${error.message}`);
    rows.push(...(data as TradeRow[]));
    if (data.length < PAGE) return rows.map(fromRow);
  }
}

/** 한 구·월의 거래를 통째로 바꿔 넣고 받은 시각을 남긴다(한 트랜잭션) */
export async function saveMonth(db: SupabaseClient, district: string, ym: string, items: AptTrade[]) {
  const { error } = await db.rpc("replace_apt_trades", { p_district: district, p_ym: ym, p_rows: items.map(toRow) });
  if (error) throw new Error(`DB 저장 실패: ${error.message}`);
}

/** 구·월 실거래가를 DB 에서 읽는다. 아직 적재되지 않은 구·월이면 빈 목록과 status: "not_loaded" */
export async function readAptTrades(db: SupabaseClient, district: SeoulDistrict, ym: string): Promise<AptTradeResult> {
  const load = await db.from("apt_trade_loads").select("loaded_at").eq("district", district).eq("ym", ym).maybeSingle();
  if (load.error) throw new Error(`실거래가 DB 읽기 실패: ${load.error.message}`);
  const loadedAt: string | null = load.data?.loaded_at ?? null;
  if (!loadedAt) return { district, ym, detail: true, totalCount: 0, items: [], loadedAt: null, status: "not_loaded" };

  const items = await readRows(db, district, ym);
  return { district, ym, detail: true, totalCount: items.length, items, loadedAt, status: "loaded" };
}
