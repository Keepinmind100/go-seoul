"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { setTheme, useTheme } from "@/lib/client/theme";
import { useIsClient } from "@/lib/client/useIsClient";
import { supabase } from "@/lib/supabase/client";
import { useMenuStore } from "@/features/shell/menuStore";
import { useTabStore } from "@/features/shell/tabStore";
import { Icon } from "./icons";

export function AppHeader() {
  const router = useRouter();
  const qc = useQueryClient();
  const toggleSidebar = useMenuStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useMenuStore((s) => s.collapsed);
  const isClient = useIsClient();
  const theme = useTheme();
  const { data: email } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase().auth.getUser()).data.user?.email ?? null,
  });

  const logout = async () => {
    await supabase().auth.signOut();
    qc.clear();
    useTabStore.getState().closeAll();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-giwa px-4 text-on-color">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={isClient && sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
        title={isClient && sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
        className="rounded-lg p-2 text-on-color/70 hover:bg-on-color/10 hover:text-on-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-color/40"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2.5 pr-3">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-on-color">
          <Icon name="building" className="h-[18px] w-[18px]" />
        </span>
        <span className="font-display text-lg font-bold tracking-tight">고서울</span>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        className="rounded-lg p-2 text-on-color/70 hover:bg-on-color/10 hover:text-on-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-color/40"
      >
        <Icon name={isClient && theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
      </button>
      <span className="hidden items-center gap-2 whitespace-nowrap rounded-lg py-1 pl-1 pr-3 text-sm text-on-color/85 sm:flex">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-on-color/10 text-on-color/70">
          <Icon name="user" className="h-4 w-4" />
        </span>
        {email ?? "…"}
      </span>
      <button type="button" onClick={logout} aria-label="로그아웃" title="로그아웃" className="rounded-lg p-2 text-on-color/70 hover:bg-on-color/10 hover:text-on-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-color/40">
        <Icon name="logout" className="h-5 w-5" />
      </button>
    </header>
  );
}
