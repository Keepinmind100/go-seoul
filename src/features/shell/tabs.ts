// 탭(MDI) 규칙: 메뉴 목록, 최대 10개, 열기·닫기·모두 닫기. 화면 상태는 탭이 열려 있는 동안 유지된다.
import type { IconName } from "@/components/icons";

export const MAX_TABS = 10;

export const MENU = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/favorites", label: "관심 단지" },
  { href: "/visits", label: "임장 기록" },
  { href: "/trades", label: "실거래가" },
  { href: "/assets", label: "자산현황" },
  { href: "/status", label: "연결 확인" },
] as const;

export type TabHref = (typeof MENU)[number]["href"];

/** 메뉴 아이콘(src/components/icons.tsx 이름) */
export const MENU_ICON: Record<TabHref, IconName> = {
  "/dashboard": "home",
  "/favorites": "star",
  "/visits": "note",
  "/trades": "chart",
  "/assets": "wallet",
  "/status": "plug",
};

/** 왼쪽 사이드바 맨 위, 그룹 밖 단독 메뉴 */
export const MENU_TOP: TabHref[] = ["/dashboard"];

/** 왼쪽 사이드바 메뉴 묶음(1단계 그룹 → 2단계 메뉴) */
export const MENU_GROUPS: { key: string; label: string; items: TabHref[] }[] = [
  { key: "house", label: "집 찾기", items: ["/favorites", "/visits", "/trades"] },
  { key: "money", label: "자금", items: ["/assets"] },
  { key: "system", label: "설정", items: ["/status"] },
];

export interface TabsState {
  tabs: string[];
  active: string | null;
}

export const isMenuHref = (href: string): href is TabHref => MENU.some((m) => m.href === href);
export const menuLabel = (href: string) => MENU.find((m) => m.href === href)?.label ?? href;

export type OpenResult = { ok: true; state: TabsState } | { ok: false; message: string };

export function openTab(state: TabsState, href: string): OpenResult {
  if (!isMenuHref(href)) return { ok: false, message: `알 수 없는 메뉴입니다: ${href}` };
  if (state.tabs.includes(href)) return { ok: true, state: { ...state, active: href } };
  if (state.tabs.length >= MAX_TABS) return { ok: false, message: `탭은 최대 ${MAX_TABS}개까지 열 수 있습니다. 다른 탭을 닫고 다시 시도하세요.` };
  return { ok: true, state: { tabs: [...state.tabs, href], active: href } };
}

export function closeTab(state: TabsState, href: string): TabsState {
  const i = state.tabs.indexOf(href);
  if (i < 0) return state;
  const tabs = state.tabs.filter((t) => t !== href);
  if (state.active !== href) return { tabs, active: state.active };
  return { tabs, active: tabs[i] ?? tabs[i - 1] ?? null };
}

export const closeAllTabs = (): TabsState => ({ tabs: [], active: null });
