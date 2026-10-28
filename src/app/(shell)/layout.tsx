// 로그인 후 화면 틀: 헤더 · 사이드바 · 탭. 로그인하지 않은 요청은 proxy 가 /login 으로 보낸다.
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/features/shell/Sidebar";
import { TabBar } from "@/features/shell/TabBar";
import { TabHost } from "@/features/shell/TabHost";

export default function ShellLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <main className="min-h-0 flex-1 overflow-hidden">
            {children}
            <TabHost />
          </main>
        </div>
      </div>
    </>
  );
}
