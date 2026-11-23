// 단지별 연도 추이(서버 전용, 읽기만). loader 가 DB 에 받아 둔 거래를 연도별로 묶는다. 아직 안 받은 달은 missingMonths 로 알린다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeoulDistrict } from "./lawd";
import { fromRow, type TradeRow } from "./store";
import type { AptTrade, AptTrendResult, AptTrendYear } from "./types";

const PAGE = 1000;

/** fromYear 1월 ~ toYear 12월(이번 달까지)의 YYYYMM 목록 */
export function yearMonths(fromYear: number, toYear: number, now = new Date()): string[] {
  const last = now.getFullYear() * 100 + now.getMonth() + 1;
  const out: string[] = [];
  for (let y = fromYear; y <= toYear; y++) for (let m = 1; m <= 12; m++) if (y * 100 + m <= last) out.push(`${y}${String(m).padStart(2, "0")}`);
  return out;
}

/** 기간 안에서 loader 가 아직 받지 않은 구·월 */
async function missingMonths(db: SupabaseClient, district: SeoulDistrict, yms: string[]): Promise<string[]> {
  const { data, error } = await db.from("apt_trade_loads").select("ym").eq("district", district).in("ym", yms);
  if (error) throw new Error(`실거래가 DB 읽기 실패: ${error.message}`);
  const loaded = new Set((data ?? []).map((r) => r.ym as string));
  return yms.filter((ym) => !loaded.has(ym));
}

/** 단지(aptSeq)의 연도별 평균·최고·최저 거래금액. area 를 주면 그 전용면적(반올림 ㎡)만 */
export async function aptTrend(
  db: SupabaseClient,
  district: SeoulDistrict,
  aptSeq: string,
  fromYear: number,
  toYear: number,
  area: number | null,
): Promise<AptTrendResult> {
  const yms = yearMonths(fromYear, toYear);
  const missing = await missingMonths(db, district, yms);

  const rows: AptTrade[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("apt_trades")
      .select("*")
      .eq("district", district)
      .eq("apt_seq", aptSeq)
      .gte("ym", yms[0])
      .lte("ym", yms[yms.length - 1])
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`실거래가 DB 읽기 실패: ${error.message}`);
    rows.push(...(data as TradeRow[]).map(fromRow));
    if (data.length < PAGE) break;
  }

  const areaCount = new Map<number, number>();
  for (const r of rows) if (!r.cancelled) areaCount.set(Math.round(r.areaM2), (areaCount.get(Math.round(r.areaM2)) ?? 0) + 1);
  const picked = area === null ? rows : rows.filter((r) => Math.round(r.areaM2) === area);

  const years: AptTrendYear[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    // 해제된 거래는 통계에서 뺀다
    const prices = picked.filter((r) => !r.cancelled && r.dealDate.startsWith(String(y))).map((r) => r.priceManwon);
    years.push({
      year: y,
      count: prices.length,
      avg: prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null,
      max: prices.length ? Math.max(...prices) : null,
      min: prices.length ? Math.min(...prices) : null,
    });
  }

  const trades = [...picked].sort((a, b) => b.dealDate.localeCompare(a.dealDate));

  return {
    district,
    aptSeq,
    // 단지명은 해마다 조금씩 다를 수 있어 가장 최근 거래의 이름을 쓴다
    aptName: rows.reduce((a, r) => (!a || r.dealDate > a.dealDate ? r : a), null as AptTrade | null)?.aptName ?? "",
    fromYear,
    toYear,
    area,
    years,
    trades,
    areas: [...areaCount].map(([a, count]) => ({ area: a, count })).sort((a, b) => a.area - b.area),
    missingMonths: missing,
  };
}
