// 열린 탭 목록: 탭 선택, ✕ 닫기, 모두 닫기, 최대 개수 안내.
"use client";

import { useEffect } from "react";
import { useIsClient } from "@/lib/client/useIsClient";
import { MAX_TABS, menuLabel } from "./tabs";
import { useTabStore } from "./tabStore";

export function TabBar() {
  const isClient = useIsClient();
  const { tabs, active, notice, open, close, closeAll, clearNotice } = useTabStore();

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, 4000);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);

  if (!isClient) return <div className="h-11 shrink-0 border-b bg-white" />;
  return (
    <div className="relative flex h-11 shrink-0 items-center gap-2 border-b bg-white px-3">
      <div role="tablist" aria-label="열린 화면" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((href) => {
          const selected = href === active;
          return (
            <div
              key={href}
              className={`group flex shrink-0 items-center gap-1 rounded-lg py-1 pl-3 pr-1 text-sm transition-colors ${
                selected ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <button type="button" role="tab" aria-selected={selected} onClick={() => open(href)} className="whitespace-nowrap">
                {menuLabel(href)}
              </button>
              <button type="button" aria-label={`${menuLabel(href)} 닫기`} onClick={() => close(href)} className="ml-0.5 rounded-md px-1.5 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-800">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
        {tabs.length}/{MAX_TABS}
      </span>
      <button type="button" disabled={!tabs.length} onClick={closeAll} className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:text-slate-300">
        모두 닫기
      </button>
      {notice && (
        <div role="alert" className="absolute right-3 top-12 z-40 rounded-lg bg-amber-500 px-3 py-2 text-sm text-on-color shadow-pop">
          {notice}
        </div>
      )}
    </div>
  );
}
