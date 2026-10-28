// 열린 탭의 화면을 모두 마운트해 두고 활성 탭만 보여 준다(탭 전환 시 상태 유지).
"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, type ComponentType } from "react";
import { useIsClient } from "@/lib/client/useIsClient";
import { TabActiveContext } from "./TabContext";
import { useTabStore } from "./tabStore";
import type { TabHref } from "./tabs";

const DashboardPage = dynamic(() => import("@/features/dashboard/DashboardPage").then((m) => m.DashboardPage), { ssr: false });

const SCREENS: Record<TabHref, ComponentType> = {
  "/dashboard": DashboardPage,
  "/favorites": dynamic(() => import("@/features/favorites/FavoritesPage").then((m) => m.FavoritesPage), { ssr: false }),
  "/visits": dynamic(() => import("@/features/visits/VisitsPage").then((m) => m.VisitsPage), { ssr: false }),
  "/trades": dynamic(() => import("@/features/trades/TradesPage").then((m) => m.TradesPage), { ssr: false }),
  "/assets": dynamic(() => import("@/features/assets/AssetsPage").then((m) => m.AssetsPage), { ssr: false }),
  "/status": dynamic(() => import("@/features/status/StatusPage").then((m) => m.StatusPage), { ssr: false }),
};

export function TabHost() {
  const isClient = useIsClient();
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);
  const active = useTabStore((s) => s.active);

  // 처음 들어온 주소의 탭을 연다(이후 이동은 탭으로만 한다). 첫 주소(/)는 탭을 열지 않아 대시보드가 첫 화면이 된다
  useEffect(() => {
    if (pathname !== "/") useTabStore.getState().open(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주소창을 활성 탭과 맞춘다(화면을 다시 그리지 않도록 history 만 바꾼다)
  useEffect(() => {
    if (isClient && window.location.pathname !== (active ?? "/")) window.history.replaceState(null, "", active ?? "/");
  }, [isClient, active]);

  if (!isClient) return null;
  if (!tabs.length) {
    // 탭이 없으면 대시보드가 첫 화면이다
    return (
      <TabActiveContext.Provider value>
        <DashboardPage />
      </TabActiveContext.Provider>
    );
  }
  return (
    <>
      {tabs.map((href) => {
        const Screen = SCREENS[href as TabHref];
        if (!Screen) return null;
        const isActive = href === active;
        return (
          <section key={href} aria-hidden={!isActive} className={isActive ? "h-full" : "hidden"}>
            <TabActiveContext.Provider value={isActive}>
              <Screen />
            </TabActiveContext.Provider>
          </section>
        );
      })}
    </>
  );
}
