// 단지별 연도 추이(서버 전용). 필요한 구·월을 DB 에 채운 뒤(store 와 같은 신선도 규칙) 단지 거래를 연도별로 묶는다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAptTrades } from "./aptTrade";
import type { SeoulDistrict } from "./lawd";
import { fromRow, isFresh, saveMonth, type TradeRow } from "./store";
import type { AptTrade, AptTrendResult, AptTrendYear } from "./types";

/** 국토교통부에 동시에 보내는 요청 수 */
const CONCURRENCY = 6;
const PAGE = 1000;

/** fromYear 1월 ~ toYear 12월(이번 달까지)의 YYYYMM 목록 */
export function yearMonths(fromYear: number, toYear: number, now = new Date()): string[] {
  const last = now.getFullYear() * 100 + now.getMonth() + 1;
  const out: string[] = [];
  for (let y = fromYear; y <= toYear; y++) for (let m = 1; m <= 12; m++) if (y * 100 + m <= last) out.push(`${y}${String(m).padStart(2, "0")}`);
  return out;
}

/** 아직 없거나 오래된 구·월만 국토교통부에서 받아 DB 에 넣는다 */
async function ensureMonths(db: SupabaseClient, district: SeoulDistrict, yms: string[]) {
  const { data, error } = await db.from("apt_trade_loads").select("ym, loaded_at").eq("district", district).in("ym", yms);
  if (error) throw new Error(`실거래가 DB 읽기 실패: ${error.message}`);
  const loadedAt = new Map((data ?? []).map((r) => [r.ym as string, r.loaded_at as string]));
  const todo = yms.filter((ym) => !isFresh(loadedAt.get(ym) ?? null, ym));

  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const ym = todo[next++];
      try {
        await saveMonth(db, district, ym, (await fetchAptTrades(district, ym, true)).items);
      } catch {
        failed.push(ym);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  return { fetched: todo.length - failed.length, failed: failed.sort() };
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
  const { fetched, failed } = await ensureMonths(db, district, yms);

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
    fetchedMonths: fetched,
    failedMonths: failed,
  };
}
