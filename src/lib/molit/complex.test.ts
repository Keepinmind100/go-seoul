import { describe, expect, it } from "vitest";
import { matchScore, normName, rankComplexes, suggestComplex } from "./complex";
import { recentMonths } from "./trend";
import type { AptComplex } from "./types";

const c = (aptSeq: string, aptName: string, tradeCount = 1, dong = "아현동"): AptComplex => ({ aptSeq, aptName, dong, buildYear: 2014, tradeCount, lastDealDate: null, areas: [] });

describe("단지 이름 맞추기", () => {
  it("띄어쓰기·괄호 표기를 무시한다", () => {
    expect(normName("마포래미안 푸르지오(1단지)")).toBe("마포래미안푸르지오");
    expect(matchScore("마포 래미안푸르지오", "마포래미안푸르지오")).toBe(3);
    expect(matchScore("래미안푸르지오", "마포래미안푸르지오")).toBe(2);
    expect(matchScore("공덕자이", "마포래미안푸르지오")).toBe(0);
    expect(matchScore("", "마포래미안푸르지오")).toBe(0);
  });

  it("관심 단지 이름과 맞는 단지를 앞에, 그다음 거래가 많은 순", () => {
    const list = [c("1", "공덕자이", 50), c("2", "마포래미안푸르지오", 10), c("3", "래미안공덕", 30, "공덕동")];
    expect(rankComplexes(list, "", "마포래미안푸르지오").map((x) => x.aptSeq)).toEqual(["2", "1", "3"]);
    expect(rankComplexes(list, "래미안").map((x) => x.aptSeq)).toEqual(["3", "2"]);
    expect(rankComplexes(list, "공덕동").map((x) => x.aptSeq)).toEqual(["3"]);
  });

  it("후보가 하나로 정해질 때만 추천한다", () => {
    const list = [c("1", "마포래미안푸르지오"), c("2", "래미안공덕4차"), c("3", "래미안공덕5차")];
    expect(suggestComplex(list, "마포 래미안 푸르지오")?.aptSeq).toBe("1");
    expect(suggestComplex(list, "래미안공덕")).toBeNull();
    expect(suggestComplex(list, "래미안공덕4차")?.aptSeq).toBe("2");
    expect(suggestComplex([c("1", "A"), c("2", "A")], "A")).toBeNull();
  });
});

describe("최근 개월", () => {
  it("이번 달 포함 n개월, 해를 넘긴다", () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(["202511", "202512", "202601"]);
    expect(recentMonths(24, new Date(2026, 10, 23))).toHaveLength(24);
    expect(recentMonths(24, new Date(2026, 10, 23))[0]).toBe("202412");
  });
});
