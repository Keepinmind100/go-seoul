// 대시보드: 서울 구 지도 · 요약 · 최근 임장 · 관심 단지. 탭이 없을 때의 첫 화면이며, 항목을 누르면 관련 탭을 연다.
"use client";

import { useMemo, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, PageShell } from "@/components/ui";
import { useTabStore } from "@/features/shell/tabStore";
import type { TabHref } from "@/features/shell/tabs";
import { formatPrice, useFavorites, useVisits } from "@/lib/client/data";
import { SeoulTileMap } from "./SeoulTileMap";

const open = (href: TabHref) => useTabStore.getState().open(href);

export function DashboardPage() {
  const favorites = useFavorites();
  const visits = useVisits();
  const v = useMemo(() => visits.data ?? [], [visits.data]);
  const f = useMemo(() => favorites.data ?? [], [favorites.data]);
  const loading = favorites.isLoading || visits.isLoading;
  const fetching = favorites.isFetching || visits.isFetching;

  const byDistrict = useMemo(() => {
    const m = new Map<string, number>();
    f.forEach((x) => m.set(x.district, (m.get(x.district) ?? 0) + 1));
    return m;
  }, [f]);
  // 임장 기록은 관심 단지와 연결된 것만 구를 알 수 있다
  const visitedDistricts = useMemo(() => {
    const districtOf = new Map(f.map((x) => [x.id, x.district]));
    return new Set(v.flatMap((x) => (x.favorite_id && districtOf.has(x.favorite_id) ? [districtOf.get(x.favorite_id)!] : [])));
  }, [f, v]);

  const rated = v.filter((x) => x.rating);
  const avg = rated.length ? (rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length).toFixed(1) : null;
  const thisMonth = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const monthCount = v.filter((x) => x.visited_on.startsWith(thisMonth)).length;

  return (
    <PageShell
      title="대시보드"
      actions={
        <Button onClick={() => void Promise.all([favorites.refetch(), visits.refetch()])} disabled={fetching}>
          <Icon name="refresh" className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      }
    >
      <ErrorText error={favorites.error ?? visits.error} />

      <Card className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">어디를 보고 있나요</h2>
          <SeoulTileMap favorites={byDistrict} visits={visitedDistricts} onPick={() => open("/favorites")} />
        </div>
        <dl className="flex flex-col justify-center divide-y border-t md:border-l md:border-t-0 md:pl-6">
          <Summary label="관심 단지" value={f.length} unit="곳" onClick={() => open("/favorites")} />
          <Summary label="임장 기록" value={v.length} unit="건" onClick={() => open("/visits")} />
          <Summary label="이번 달 임장" value={monthCount} unit="건" onClick={() => open("/visits")} />
          <Summary label="평균 점수" value={avg ?? "—"} unit={avg ? "/ 5" : ""} onClick={() => open("/visits")} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="최근 임장" action="기록하기" onClick={() => open("/visits")} />
          <ul className="divide-y">
            {v.slice(0, 5).map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-slate-500">{x.visited_on}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{x.title}</span>
                {x.price_manwon !== null && <span className="hidden text-sm tabular-nums text-slate-600 sm:inline">{formatPrice(x.price_manwon)}</span>}
                <span className="w-16 text-right text-sm tracking-tight text-ginkgo-600" aria-label={x.rating ? `${x.rating}점` : undefined}>
                  {x.rating ? "★".repeat(x.rating) : ""}
                </span>
              </li>
            ))}
            {!loading && !v.length && <Empty>다녀온 집을 기록하면 여기에 최근 5건이 보입니다.</Empty>}
          </ul>
        </Card>
        <Card>
          <CardHead title="관심 단지" action="추가하기" onClick={() => open("/favorites")} />
          <ul className="divide-y">
            {f.slice(0, 5).map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-16 shrink-0 text-xs font-medium text-brand-700">{x.district}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{x.name}</span>
                <span className="hidden truncate text-xs text-slate-500 sm:inline">{x.address}</span>
              </li>
            ))}
            {!loading && !f.length && <Empty>눈여겨본 단지를 추가하면 지도에 구별로 표시됩니다.</Empty>}
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}

function Summary({ label, value, unit, onClick }: { label: string; value: number | string; unit: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-baseline justify-between gap-3 py-3 text-left">
      {/* 숫자까지 함께 초록으로 바뀌어야 누를 수 있는 줄이라는 걸 알 수 있다 */}
      <dt className="text-sm text-slate-500 transition-colors group-hover:text-brand-700">{label}</dt>
      <dd className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 transition-colors group-hover:text-brand-700">{value}</span>
        <span className="text-sm text-slate-500">{unit}</span>
      </dd>
    </button>
  );
}

function CardHead({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-3">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <button type="button" onClick={onClick} className="group flex items-center gap-0.5 text-sm text-brand-700 hover:underline">
        {action}
        <Icon name="chevron" className="h-3.5 w-3.5 transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="px-5 py-8 text-center text-sm text-slate-500">{children}</li>;
}
