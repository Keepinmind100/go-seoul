// 사이드바 메뉴 펼침 상태(사이드바 접기, 접힌 그룹). 새로고침 후에도 기억한다.
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface MenuState {
  /** 사이드바 전체를 접었는지 */
  collapsed: boolean;
  /** 접힌 그룹 key */
  closedGroups: string[];
  toggleSidebar: () => void;
  toggleGroup: (key: string) => void;
  setAllGroups: (open: boolean, keys: string[]) => void;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      collapsed: false,
      closedGroups: [],
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
      toggleGroup: (key) => set((s) => ({ closedGroups: s.closedGroups.includes(key) ? s.closedGroups.filter((k) => k !== key) : [...s.closedGroups, key] })),
      setAllGroups: (open, keys) => set({ closedGroups: open ? [] : keys }),
    }),
    { name: "goseoul.menu", storage: createJSONStorage(() => localStorage) },
  ),
);
