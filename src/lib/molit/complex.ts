// 관심 단지 이름으로 실거래 단지 후보를 찾는다(화면·서버 공용, 순수 함수).
import type { AptComplex } from "./types";

/** 띄어쓰기·대소문자·괄호 안 보충 표기를 무시한다 (예: "래미안 푸르지오(1단지)" ≈ "래미안푸르지오") */
export const normName = (s: string) =>
  s
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s·.\-_]/g, "")
    .toLowerCase();

/** 이름이 얼마나 맞는지: 3 같음 · 2 한쪽이 다른 쪽을 포함 · 0 무관 */
export function matchScore(favoriteName: string, aptName: string): number {
  const a = normName(favoriteName);
  const b = normName(aptName);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  return 0;
}

/**
 * 검색어로 거른 단지 목록. 검색어가 비면 전체를 이름순으로.
 * 관심 단지 이름과 맞는 단지를 앞에 두고, 같으면 거래가 많은 단지(대단지일 가능성)를 앞에 둔다
 */
export function rankComplexes(items: AptComplex[], query: string, favoriteName = ""): AptComplex[] {
  const q = normName(query);
  const list = q ? items.filter((c) => normName(c.aptName).includes(q) || normName(c.dong).includes(q)) : [...items];
  return list.sort(
    (x, y) => matchScore(favoriteName, y.aptName) - matchScore(favoriteName, x.aptName) || y.tradeCount - x.tradeCount || x.aptName.localeCompare(y.aptName, "ko"),
  );
}

/** 자동 연결 후보: 이름이 같거나(3) 포함 관계(2)인 단지가 딱 하나면 그것, 같은 이름이 있으면 그것 */
export function suggestComplex(items: AptComplex[], favoriteName: string): AptComplex | null {
  const exact = items.filter((c) => matchScore(favoriteName, c.aptName) === 3);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = items.filter((c) => matchScore(favoriteName, c.aptName) === 2);
  return partial.length === 1 ? partial[0] : null;
}
