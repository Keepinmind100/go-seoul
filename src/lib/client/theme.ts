// 라이트/다크 모드. <html class="dark"> 로 켜고 localStorage 에 기억한다(처음에는 시스템 설정을 따른다).
"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme-init";

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 저장 불가 환경: 이번 화면에만 적용 */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    current,
    () => "light",
  );
}
