// 관심 단지: 목록(표, 실거래 시세 요약 포함) · 등록 · 수정 · 삭제.
// 행을 누르면 아래에 그 단지의 연도별 실거래가 추이가 나온다(실거래 단지가 연결된 경우). 수정은 [수정] 버튼으로 연다.
"use client";

import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, Input, Modal, PageShell, Select, Textarea } from "@/components/ui";
import { PYEONG } from "@/features/trades/columns";
import { TrendPanel } from "@/features/trades/TrendPanel";
import { formatPrice, SEOUL_DISTRICTS, useDeleteFavorite, useFavorites, useSaveFavorite, type Favorite, type FavoriteInput } from "@/lib/client/data";
import { useAptComplexes, useFavoritePrices } from "@/lib/client/molit";
import { rankComplexes, suggestComplex } from "@/lib/molit/complex";
import type { AptComplex, FavoritePrice } from "@/lib/molit/types";

const EMPTY: FavoriteInput = { name: "", district: "마포구", address: null, memo: null, apt_seq: null, area_m2: null };
/** 단지 select 에 한 번에 보여 줄 최대 수(구 전체는 수백 곳이라 검색으로 좁힌다) */
const MAX_OPTIONS = 200;

type Row = Favorite & { price: FavoritePrice | null };

const toInput = ({ name, district, address, memo, apt_seq, area_m2 }: Favorite): FavoriteInput => ({ name, district, address, memo, apt_seq, area_m2 });
/** "84㎡(25평)" */
const areaLabel = (m2: number) => `${Math.round(m2)}㎡(${Math.round(m2 / PYEONG)}평)`;
const shortDate = (d: string) => d.slice(2).replaceAll("-", ".");

const COLUMNS: ColDef<Row>[] = [
  { field: "district", headerName: "구", width: 100 },
  {
    field: "name",
    headerName: "단지명",
    flex: 1,
    minWidth: 160,
    valueFormatter: (p) => `${p.value}${p.data?.area_m2 ? ` · ${areaLabel(p.data.area_m2)}` : ""}`,
    headerTooltip: "관심 전용면적을 정해 두면 시세도 그 면적 거래만 봅니다",
  },
  {
    colId: "last",
    headerName: "최근 실거래",
    width: 230,
    headerTooltip: "해제된 거래를 뺀 가장 최근 거래의 금액 · 계약일 · 전용면적 · 층",
    valueGetter: (p) => p.data?.price?.lastPriceManwon ?? null,
    valueFormatter: (p) => {
      const d = p.data;
      if (!d?.apt_seq) return "실거래 단지 미연결";
      const x = d.price;
      if (!x?.lastDealDate) return "최근 2년 거래 없음";
      return `${formatPrice(x.lastPriceManwon)}  ·  ${shortDate(x.lastDealDate)} · ${x.lastAreaM2 ? areaLabel(x.lastAreaM2) : ""}${x.lastFloor !== null ? ` ${x.lastFloor}층` : ""}`;
    },
    cellClass: (p) => (p.data?.price?.lastDealDate ? "tabular-nums font-semibold" : "text-slate-400"),
  },
  {
    colId: "perPyeong",
    headerName: "12개월 평당가",
    width: 140,
    type: "rightAligned",
    headerTooltip: "최근 12개월 거래의 평균 평당가(전용 3.3㎡당)와 거래 건수",
    valueGetter: (p) => p.data?.price?.recentPerPyeong ?? null,
    valueFormatter: (p) => (p.value === null ? "—" : `${formatPrice(p.value)} (${p.data?.price?.recentCount}건)`),
  },
  {
    colId: "change",
    headerName: "전년 대비",
    width: 110,
    type: "rightAligned",
    headerTooltip: "최근 12개월 평당가가 그 전 12개월보다 얼마나 올랐나(▲)·내렸나(▼). 면적이 섞여도 흔들리지 않게 평당가로 비교합니다",
    valueGetter: (p) => p.data?.price?.changePct ?? null,
    valueFormatter: (p) => (p.value === null ? "—" : `${p.value > 0 ? "▲" : p.value < 0 ? "▼" : ""}${Math.abs(p.value).toFixed(1)}%`),
    cellClass: (p) => `ag-right-aligned-cell tabular-nums ${p.value > 0 ? "text-red-700" : p.value < 0 ? "text-blue-700" : ""}`,
  },
  { field: "memo", headerName: "메모", flex: 1, minWidth: 140 },
  { field: "created_at", headerName: "등록일", width: 110, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("ko-KR") : "") },
];

export function FavoritesPage() {
  const list = useFavorites();
  const linked = (list.data ?? []).some((f) => f.apt_seq);
  const prices = useFavoritePrices(linked);
  const del = useDeleteFavorite();
  const [editing, setEditing] = useState<{ id?: number; values: FavoriteInput } | null>(null);
  const [checked, setChecked] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const removeChecked = () =>
    checked.length &&
    window.confirm(`선택한 관심 단지 ${checked.length}곳을 삭제할까요? 연결된 임장 기록은 남습니다.`) &&
    del.mutate(
      checked.map((f) => f.id),
      { onSuccess: () => setChecked([]) },
    );

  const rows = useMemo<Row[]>(() => {
    const byId = new Map((prices.data?.items ?? []).map((p) => [p.favoriteId, p]));
    return (list.data ?? []).map((f) => ({ ...f, price: byId.get(f.id) ?? null }));
  }, [list.data, prices.data]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const failed = prices.data?.failedMonths ?? [];

  return (
    <PageShell
      title="관심 단지"
      actions={
        <>
          <Button variant="danger" disabled={!checked.length || del.isPending} onClick={removeChecked}>
            {del.isPending ? "삭제 중…" : `선택 삭제${checked.length ? ` (${checked.length})` : ""}`}
          </Button>
          <Button variant="primary" onClick={() => setEditing({ values: EMPTY })}>
            <Icon name="plus" />
            단지 추가
          </Button>
        </>
      }
    >
      <ErrorText error={list.error ?? del.error ?? prices.error} />
      {prices.isFetching && (
        <p className="text-sm text-slate-500">
          실거래 시세 불러오는 중… 처음에는 연결된 단지가 있는 구의 최근 2년 자료를 국토교통부에서 받아 저장하느라 1분 가까이 걸릴 수 있습니다.
        </p>
      )}
      {failed.length > 0 && !prices.isFetching && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {failed.length}개 구·월은 국토교통부에서 받지 못해 시세에서 빠졌습니다({failed.slice(0, 4).join(", ")}
          {failed.length > 4 && " …"}). 잠시 뒤 다시 열면 채웁니다.
        </p>
      )}
      <Card className="p-0">
        <DataGrid<Row>
          rowData={rows}
          loading={list.isLoading}
          columnDefs={COLUMNS}
          getRowId={(p) => String(p.data.id)}
          onCheckedChange={setChecked}
          onRowClicked={(e) => e.data && setSelectedId(e.data.id)}
          rowStyle={{ cursor: "pointer" }}
        />
      </Card>
      {!selected && rows.length > 0 && <p className="text-center text-xs text-slate-500">단지를 누르면 아래에 실거래가 추이가 나옵니다.</p>}
      {selected && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold text-slate-900">
              <span className="mr-2 text-sm font-medium text-brand-700">{selected.district}</span>
              {selected.name}
              {selected.address && <span className="ml-2 text-sm font-normal text-slate-500">{selected.address}</span>}
            </h2>
            <Button onClick={() => setEditing({ id: selected.id, values: toInput(selected) })}>수정</Button>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              닫기
            </Button>
          </div>
          {selected.memo && <p className="whitespace-pre-wrap text-sm text-slate-600">{selected.memo}</p>}
          {selected.apt_seq ? (
            <TrendPanel
              key={`${selected.apt_seq}|${selected.area_m2 ?? ""}`}
              apt={{ district: selected.district, aptSeq: selected.apt_seq, aptName: selected.name }}
              initialArea={selected.area_m2}
            />
          ) : (
            <Card className="flex flex-col items-center gap-3 p-8 text-center text-sm text-slate-500">
              <p>
                이 관심 단지는 아직 <b className="text-slate-700">실거래 단지</b>와 연결되지 않았습니다. 연결하면 최근 실거래가와 연도별 추이를 볼 수 있습니다.
              </p>
              <Button variant="primary" onClick={() => setEditing({ id: selected.id, values: toInput(selected) })}>
                실거래 단지 연결
              </Button>
            </Card>
          )}
        </>
      )}
      {editing && <FavoriteForm key={editing.id ?? "new"} id={editing.id} initial={editing.values} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}

function FavoriteForm({ id, initial, onClose }: { id?: number; initial: FavoriteInput; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const save = useSaveFavorite();
  const del = useDeleteFavorite();
  const set = (patch: Partial<FavoriteInput>) => setV((prev) => ({ ...prev, ...patch }));
  const blank = (s: string) => (s.trim() ? s : null);

  const submit = () => save.mutate({ id, values: { ...v, name: v.name.trim() } }, { onSuccess: onClose });
  const remove = () => id && window.confirm(`'${initial.name}'을(를) 삭제할까요? 연결된 임장 기록은 남습니다.`) && del.mutate(id, { onSuccess: onClose });

  return (
    <Modal
      open
      width="max-w-xl"
      title={id ? "관심 단지 수정" : "관심 단지 추가"}
      onClose={onClose}
      footer={
        <>
          {id && (
            <Button variant="danger" onClick={remove} disabled={del.isPending} className="mr-auto">
              삭제
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={!v.name.trim() || save.isPending}>
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="구">
            {/* 구가 바뀌면 다른 구의 단지 연결은 풀린다 */}
            <Select value={v.district} onChange={(e) => set({ district: e.target.value, apt_seq: null, area_m2: null })}>
              {SEOUL_DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="단지명">
            <Input autoFocus value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 마포래미안푸르지오" />
          </Field>
        </div>
        <Field label="주소">
          <Input value={v.address ?? ""} onChange={(e) => set({ address: blank(e.target.value) })} placeholder="예: 아현동 777" />
        </Field>
        <ComplexPicker district={v.district} name={v.name} aptSeq={v.apt_seq} area={v.area_m2} onChange={(patch) => set(patch)} />
        <Field label="메모">
          <Textarea value={v.memo ?? ""} onChange={(e) => set({ memo: blank(e.target.value) })} />
        </Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </Modal>
  );
}

/** 실거래 단지 연결: 같은 구의 단지(최근 12개월 거래 기준) 중에서 고른다. 이름이 맞는 단지가 하나면 추천한다 */
function ComplexPicker({
  district,
  name,
  aptSeq,
  area,
  onChange,
}: {
  district: string;
  name: string;
  aptSeq: string | null;
  area: number | null;
  onChange: (patch: Pick<FavoriteInput, "apt_seq" | "area_m2">) => void;
}) {
  const complexes = useAptComplexes(district);
  const [q, setQ] = useState("");
  const items = useMemo(() => complexes.data?.items ?? [], [complexes.data]);
  const ranked = useMemo(() => rankComplexes(items, q, name), [items, q, name]);
  const current = items.find((c) => c.aptSeq === aptSeq) ?? null;
  const suggestion = !aptSeq && name.trim() ? suggestComplex(items, name) : null;
  const pick = (c: AptComplex | null) => onChange({ apt_seq: c?.aptSeq ?? null, area_m2: null });
  // 지금 연결된 단지는 검색어에 안 맞아도 목록에 남긴다
  const options = current && !ranked.slice(0, MAX_OPTIONS).includes(current) ? [current, ...ranked.slice(0, MAX_OPTIONS - 1)] : ranked.slice(0, MAX_OPTIONS);

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-[13px] font-medium text-slate-600">실거래 단지 연결</legend>
      {complexes.isLoading ? (
        <p className="text-sm text-slate-500">{district} 단지 목록 불러오는 중… 처음 보는 구는 국토교통부에서 12개월 자료를 받느라 30초쯤 걸릴 수 있습니다.</p>
      ) : (
        <>
          <ErrorText error={complexes.error} />
          {suggestion && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              <span className="mr-auto">
                추천: <b>{suggestion.aptName}</b> · {suggestion.dong}
                {suggestion.buildYear && ` · ${suggestion.buildYear}년`}
              </span>
              <Button className="h-7 px-2.5 text-xs" onClick={() => pick(suggestion)}>
                이 단지로 연결
              </Button>
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-2">
            <Input type="search" aria-label="단지 검색" value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지명·동 검색" />
            <Select aria-label="실거래 단지" value={aptSeq ?? ""} onChange={(e) => pick(items.find((c) => c.aptSeq === e.target.value) ?? null)}>
              <option value="">연결 안 함</option>
              {aptSeq && !current && <option value={aptSeq}>연결됨 ({aptSeq}, 최근 12개월 거래 없음)</option>}
              {options.map((c) => (
                <option key={c.aptSeq} value={c.aptSeq}>
                  {c.aptName} · {c.dong}
                  {c.buildYear ? ` · ${c.buildYear}년` : ""} · {c.tradeCount}건
                </option>
              ))}
            </Select>
          </div>
          {aptSeq && (
            <Field label="관심 전용면적" hint="정해 두면 관심 단지 표의 시세와 추이를 그 면적 거래로만 봅니다">
              <Select value={area ?? ""} onChange={(e) => onChange({ apt_seq: aptSeq, area_m2: e.target.value ? Number(e.target.value) : null })}>
                <option value="">전체 면적</option>
                {area !== null && !current?.areas.includes(area) && <option value={area}>{areaLabel(area)}</option>}
                {current?.areas.map((a) => (
                  <option key={a} value={a}>
                    {areaLabel(a)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <p className="text-xs text-slate-500">
            {items.length ? `${district}에서 최근 ${complexes.data?.months}개월 동안 거래된 ${items.length}개 단지 중에서 고릅니다.` : `${district}에 받아 둔 거래가 없습니다.`}
            {(complexes.data?.failedMonths.length ?? 0) > 0 && ` (${complexes.data?.failedMonths.length}개월은 받지 못함)`}
          </p>
        </>
      )}
    </fieldset>
  );
}
