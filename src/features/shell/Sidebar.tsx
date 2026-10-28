// 왼쪽 메뉴: 그룹(1단계) 펼치기·접기와 메뉴(2단계). 메뉴를 누르면 탭으로 연다.
// 폰 폭(md 미만)에서는 내용 위에 겹쳐 띄우고, 메뉴를 고르거나 바깥을 누르면 닫는다.
"use client";

import { Icon } from "@/components/icons";
import { useIsClient } from "@/lib/client/useIsClient";
import { MENU_GROUPS, MENU_ICON, MENU_TOP, menuLabel, type TabHref } from "./tabs";
import { useMenuStore } from "./menuStore";
import { useTabStore } from "./tabStore";

const GROUP_KEYS = MENU_GROUPS.map((g) => g.key);
const isPhone = () => window.matchMedia("(max-width: 767px)").matches;

export function Sidebar() {
  const isClient = useIsClient();
  const { collapsed, closedGroups, toggleGroup, setAllGroups, toggleSidebar } = useMenuStore();
  const active = useTabStore((s) => s.active);
  const openTab = useTabStore((s) => s.open);
  const open = (href: string) => {
    openTab(href);
    if (isPhone()) toggleSidebar();
  };

  // 서버 렌더와 어긋나지 않게 브라우저에서만 저장된 펼침 상태를 쓴다
  if (!isClient) return <nav aria-label="메뉴" className="hidden w-60 shrink-0 border-r bg-white md:block" />;
  if (collapsed) return null;

  const allOpen = closedGroups.length === 0;
  return (
    <>
      <div aria-hidden className="fixed inset-0 top-14 z-20 bg-giwa/40 md:hidden" onClick={toggleSidebar} />
      <nav
        aria-label="메뉴"
        className="fixed bottom-0 left-0 top-14 z-30 flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-white px-3 py-3 text-sm shadow-pop md:static md:z-auto md:shadow-none"
      >
        <div className="flex items-center justify-between px-2 pb-1">
          <span />
          <button type="button" onClick={() => setAllGroups(!allOpen, GROUP_KEYS)} className="rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            {allOpen ? "모두 접기" : "모두 펼치기"}
          </button>
        </div>
        <ul className="mb-1 flex flex-col gap-0.5">
          {MENU_TOP.map((href) => (
            <li key={href}>
              <MenuItem href={href} selected={active === href} onOpen={open} />
            </li>
          ))}
        </ul>
        {MENU_GROUPS.map((g) => {
          const isOpen = !closedGroups.includes(g.key);
          return (
            <div key={g.key} className="flex flex-col">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(g.key)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                {g.label}
                <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <ul className="mb-1 flex flex-col gap-0.5">
                  {g.items.map((href) => (
                    <li key={href}>
                      <MenuItem href={href} selected={active === href} onOpen={open} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}

function MenuItem({ href, selected, onOpen }: { href: TabHref; selected: boolean; onOpen: (href: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(href)}
      aria-current={selected ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        selected ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon name={MENU_ICON[href]} className={`h-[18px] w-[18px] ${selected ? "text-brand-600" : "text-slate-400"}`} />
      {menuLabel(href)}
    </button>
  );
}
