// 열린 탭 상태(zustand). 탭 목록은 새로고침 후에도 유지하고, 화면 상태는 탭이 열려 있는 동안만 유지된다.
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { closeAllTabs, closeTab, openTab, type TabsState } from "./tabs";

/** 탭을 닫기 전 확인(예: 저장하지 않은 도면). false 를 돌려주면 닫지 않는다 */
type CloseGuard = () => boolean;
const guards = new Map<string, CloseGuard>();

export function registerCloseGuard(href: string, guard: CloseGuard) {
  guards.set(href, guard);
  return () => {
    if (guards.get(href) === guard) guards.delete(href);
  };
}

const canClose = (href: string) => guards.get(href)?.() ?? true;

interface TabStore extends TabsState {
  /** 실패하면 사유 문장을 돌려준다 */
  open: (href: string) => string | null;
  close: (href: string) => void;
  closeAll: () => void;
  /** 탭 수 초과 등 안내 문구 */
  notice: string | null;
  clearNotice: () => void;
}

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      active: null,
      notice: null,
      open: (href) => {
        const res = openTab(get(), href);
        if (!res.ok) {
          set({ notice: res.message });
          return res.message;
        }
        set({ ...res.state, notice: null });
        return null;
      },
      close: (href) => {
        if (!canClose(href)) return;
        set(closeTab(get(), href));
      },
      closeAll: () => {
        if (!get().tabs.every(canClose)) return;
        set(closeAllTabs());
      },
      clearNotice: () => set({ notice: null }),
    }),
    {
      name: "goseoul.tabs",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tabs: s.tabs, active: s.active }),
    },
  ),
);
