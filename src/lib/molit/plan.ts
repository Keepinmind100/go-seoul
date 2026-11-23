// 실거래가 적재 계획(순수 함수). loader 가 이번 실행에서 어떤 구·월을 국토교통부에서 받을지 정한다.
// 1) recent   : 최근 RECENT_MONTHS 개월 + 이번 달. 늦은 신고·계약 해제가 반영되므로 하루에 한 번 다시 받는다
// 2) finalize : 막 최근 창을 벗어난 달. 창 안에서 마지막으로 받은 뒤 반영된 것을 한 번 더 받아 굳힌다
// 3) backfill : 아직 한 번도 안 받은 과거 달. 최신 달부터 남은 예산만큼
import { isFresh, RECENT_MONTHS } from "./store";

/** 국토교통부 실거래가 자료가 있는 첫 달 */
export const FIRST_YM = "200601";

export type LoadPhase = "recent" | "finalize" | "backfill";

export interface PlannedLoad {
  district: string;
  ym: string;
  phase: LoadPhase;
}

/** 이번 달에서 n달 전의 YYYYMM (로컬 시각 기준) */
export function ymBefore(now: Date, n: number): string {
  const total = now.getFullYear() * 12 + now.getMonth() - n;
  return `${Math.floor(total / 12)}${String((total % 12) + 1).padStart(2, "0")}`;
}

const loadKey = (district: string, ym: string) => `${district}|${ym}`;

/** apt_trade_loads 행 → 계획에 쓰는 조회표 */
export function loadIndex(rows: { district: string; ym: string; loaded_at: string }[]): Map<string, string> {
  return new Map(rows.map((r) => [loadKey(r.district, r.ym), r.loaded_at]));
}

export function planLoads({
  now,
  districts,
  loads,
  budget,
  firstYm = FIRST_YM,
}: {
  now: Date;
  districts: readonly string[];
  /** loadIndex() 결과: "구|YYYYMM" → loaded_at */
  loads: Map<string, string>;
  /** 이번 실행에서 부를 최대 구·월 수(국토교통부 일일 트래픽 한도에 맞춘다) */
  budget: number;
  firstYm?: string;
}): PlannedLoad[] {
  const out: PlannedLoad[] = [];
  const loadedAt = (d: string, ym: string) => loads.get(loadKey(d, ym)) ?? null;

  for (let n = 0; n <= RECENT_MONTHS; n++) {
    const ym = ymBefore(now, n);
    for (const district of districts) if (!isFresh(loadedAt(district, ym), ym, now)) out.push({ district, ym, phase: "recent" });
  }

  // 이 달은 이번 달 1일 0시에 최근 창을 벗어났다 → 그 전에 받은 자료는 마지막 며칠의 정정이 빠져 있을 수 있다
  const finalYm = ymBefore(now, RECENT_MONTHS + 1);
  const windowClosed = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  for (const district of districts) {
    const at = loadedAt(district, finalYm);
    if (!at || new Date(at).getTime() < windowClosed) out.push({ district, ym: finalYm, phase: "finalize" });
  }

  for (let n = RECENT_MONTHS + 2; out.length < budget; n++) {
    const ym = ymBefore(now, n);
    if (ym < firstYm) break;
    for (const district of districts) if (!loadedAt(district, ym)) out.push({ district, ym, phase: "backfill" });
  }

  return out.slice(0, budget);
}
