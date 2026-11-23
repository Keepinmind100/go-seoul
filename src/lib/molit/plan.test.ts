import { describe, expect, it } from "vitest";
import { nextRunAt } from "@/jobs/loadAptTrades";
import { loadIndex, planLoads, ymBefore } from "./plan";

// 2026-11-23 10:00 (로컬 시각)
const NOW = new Date(2026, 10, 23, 10, 0, 0);
const D = ["마포구", "송파구"];
const iso = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString();

describe("ymBefore", () => {
  it("해를 넘긴다", () => {
    expect(ymBefore(NOW, 0)).toBe("202611");
    expect(ymBefore(NOW, 10)).toBe("202601");
    expect(ymBefore(NOW, 11)).toBe("202512");
    expect(ymBefore(new Date(2026, 0, 5), 1)).toBe("202512");
  });
});

describe("planLoads", () => {
  it("빈 DB: 최근 4개월 → 창을 막 벗어난 달 → 과거 달 순서로, 예산만큼", () => {
    const plan = planLoads({ now: NOW, districts: D, loads: new Map(), budget: 14 });
    expect(plan.filter((p) => p.phase === "recent").map((p) => p.ym)).toEqual(["202611", "202611", "202610", "202610", "202609", "202609", "202608", "202608"]);
    expect(plan.filter((p) => p.phase === "finalize").map((p) => p.ym)).toEqual(["202607", "202607"]);
    expect(plan.filter((p) => p.phase === "backfill").map((p) => p.ym)).toEqual(["202606", "202606", "202605", "202605"]);
    expect(plan).toHaveLength(14);
  });

  it("하루 안에 받은 최근 달은 다시 받지 않는다", () => {
    const rows = ["202611", "202610", "202609", "202608"].flatMap((ym) => D.map((district) => ({ district, ym, loaded_at: iso(2026, 11, 23, 4) })));
    const plan = planLoads({ now: NOW, districts: D, loads: loadIndex(rows), budget: 100, firstYm: "202606" });
    expect(plan.some((p) => p.phase === "recent")).toBe(false);
  });

  it("창 안에서 마지막으로 받은 달은 창을 벗어난 뒤 한 번 더 받는다", () => {
    const loads = loadIndex([
      { district: "마포구", ym: "202607", loaded_at: iso(2026, 10, 31, 4) }, // 11월 1일 전 → 다시
      { district: "송파구", ym: "202607", loaded_at: iso(2026, 11, 1, 4) }, // 창을 벗어난 뒤 → 끝
    ]);
    const plan = planLoads({ now: NOW, districts: D, loads, budget: 100, firstYm: "202607" });
    expect(plan.filter((p) => p.phase === "finalize")).toEqual([{ district: "마포구", ym: "202607", phase: "finalize" }]);
  });

  it("과거 달은 한 번 받으면 다시 받지 않고, 첫 달 전으로는 가지 않는다", () => {
    const loads = loadIndex([{ district: "마포구", ym: "202606", loaded_at: iso(2026, 7, 1) }]);
    const plan = planLoads({ now: NOW, districts: D, loads, budget: 100, firstYm: "202605" });
    expect(plan.filter((p) => p.phase === "backfill")).toEqual([
      { district: "송파구", ym: "202606", phase: "backfill" },
      { district: "마포구", ym: "202605", phase: "backfill" },
      { district: "송파구", ym: "202605", phase: "backfill" },
    ]);
  });
});

describe("nextRunAt", () => {
  it("오늘 그 시각이 지났으면 내일", () => {
    expect(nextRunAt(new Date(2026, 10, 23, 3, 59), 4)).toEqual(new Date(2026, 10, 23, 4));
    expect(nextRunAt(new Date(2026, 10, 23, 4, 0), 4)).toEqual(new Date(2026, 10, 24, 4));
    expect(nextRunAt(new Date(2026, 10, 30, 10), 4)).toEqual(new Date(2026, 11, 1, 4));
  });
});
