// 브라우저에서만 정해지는 값(localStorage 의 선택 창고, 오늘 날짜)을 쓰는 화면은
// 서버 렌더와 어긋나지 않도록 클라이언트에서만 그린다.
"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
