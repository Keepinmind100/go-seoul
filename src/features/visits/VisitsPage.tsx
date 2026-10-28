// 임장 기록: 목록(표) · 등록 · 수정 · 삭제. 관심 단지와 연결할 수 있다.
"use client";

import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, Input, Modal, PageShell, Select, Textarea } from "@/components/ui";
import { formatPrice, useDeleteVisit, useFavorites, useSaveVisit, useVisits, type Visit, type VisitInput } from "@/lib/client/data";

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (로컬 날짜)
const stars = (n: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "—");

const emptyVisit = (): VisitInput => ({
  favorite_id: null,
  title: "",
  visited_on: today(),
  rating: null,
  price_manwon: null,
  pros: null,
  cons: null,
  memo: null,
});

const toInput = ({ favorite_id, title, visited_on, rating, price_manwon, pros, cons, memo }: Visit): VisitInput => ({
  favorite_id,
  title,
  visited_on,
  rating,
  price_manwon,
  pros,
  cons,
  memo,
});

export function VisitsPage() {
  const list = useVisits();
  const favorites = useFavorites();
  const del = useDeleteVisit();
  const [editing, setEditing] = useState<{ id?: number; values: VisitInput } | null>(null);
  const [checked, setChecked] = useState<Visit[]>([]);
  const removeChecked = () =>
    checked.length &&
    window.confirm(`선택한 임장 기록 ${checked.length}건을 삭제할까요?`) &&
    del.mutate(
      checked.map((v) => v.id),
      { onSuccess: () => setChecked([]) },
    );
  const favName = useMemo(() => new Map((favorites.data ?? []).map((f) => [f.id, f.name])), [favorites.data]);

  const columns = useMemo<ColDef<Visit>[]>(
    () => [
      { field: "visited_on", headerName: "방문일", width: 120 },
      { field: "title", headerName: "다녀온 곳", flex: 1, minWidth: 160 },
      { field: "favorite_id", headerName: "관심 단지", width: 160, valueFormatter: (p) => (p.value ? (favName.get(p.value) ?? "") : "") },
      { field: "rating", headerName: "점수", width: 120, valueFormatter: (p) => stars(p.value), cellClass: "text-ginkgo-600" },
      { field: "price_manwon", headerName: "호가", width: 130, valueFormatter: (p) => formatPrice(p.value) },
      { field: "pros", headerName: "장점", flex: 1, minWidth: 140 },
      { field: "cons", headerName: "단점", flex: 1, minWidth: 140 },
    ],
    [favName],
  );

  return (
    <PageShell
      title="임장 기록"
      actions={
        <>
          <Button variant="danger" disabled={!checked.length || del.isPending} onClick={removeChecked}>
            {del.isPending ? "삭제 중…" : `선택 삭제${checked.length ? ` (${checked.length})` : ""}`}
          </Button>
          <Button variant="primary" onClick={() => setEditing({ values: emptyVisit() })}>
            <Icon name="plus" />
            기록 추가
          </Button>
        </>
      }
    >
      <ErrorText error={list.error ?? del.error} />
      <Card className="p-0">
        <DataGrid<Visit>
          rowData={list.data ?? []}
          loading={list.isLoading}
          columnDefs={columns}
          getRowId={(p) => String(p.data.id)}
          onCheckedChange={setChecked}
          onRowClicked={(e) => e.data && setEditing({ id: e.data.id, values: toInput(e.data) })}
          rowStyle={{ cursor: "pointer" }}
        />
      </Card>
      {editing && <VisitForm key={editing.id ?? "new"} id={editing.id} initial={editing.values} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}

function VisitForm({ id, initial, onClose }: { id?: number; initial: VisitInput; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const favorites = useFavorites();
  const save = useSaveVisit();
  const del = useDeleteVisit();
  const set = (patch: Partial<VisitInput>) => setV((prev) => ({ ...prev, ...patch }));
  const blank = (s: string) => (s.trim() ? s : null);

  const pickFavorite = (value: string) => {
    const fav = favorites.data?.find((f) => f.id === Number(value));
    // 다녀온 곳이 비어 있으면 단지명으로 채운다
    set({ favorite_id: fav?.id ?? null, ...(fav && !v.title.trim() ? { title: fav.name } : {}) });
  };
  const submit = () => save.mutate({ id, values: { ...v, title: v.title.trim() } }, { onSuccess: onClose });
  const remove = () => id && window.confirm("이 임장 기록을 삭제할까요?") && del.mutate(id, { onSuccess: onClose });

  return (
    <Modal
      open
      width="max-w-xl"
      title={id ? "임장 기록 수정" : "임장 기록 추가"}
      onClose={onClose}
      footer={
        <>
          {id && (
            <Button variant="danger" onClick={remove} disabled={del.isPending} className="mr-auto">
              삭제
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={!v.title.trim() || !v.visited_on || save.isPending}>
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="관심 단지 (선택)">
            <Select value={v.favorite_id ?? ""} onChange={(e) => pickFavorite(e.target.value)}>
              <option value="">연결 안 함</option>
              {favorites.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.district})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="방문일">
            <Input type="date" value={v.visited_on} onChange={(e) => set({ visited_on: e.target.value })} />
          </Field>
        </div>
        <Field label="다녀온 곳">
          <Input autoFocus value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="예: 래미안 102동 15층 매물" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="점수">
            <Select value={v.rating ?? ""} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : null })}>
              <option value="">선택 안 함</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {stars(n)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="호가 (만원)" hint={v.price_manwon ? formatPrice(v.price_manwon) : undefined}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={v.price_manwon ?? ""}
              onChange={(e) => set({ price_manwon: e.target.value ? Number(e.target.value) : null })}
              placeholder="예: 123500"
            />
          </Field>
        </div>
        <Field label="장점">
          <Textarea rows={2} value={v.pros ?? ""} onChange={(e) => set({ pros: blank(e.target.value) })} />
        </Field>
        <Field label="단점">
          <Textarea rows={2} value={v.cons ?? ""} onChange={(e) => set({ cons: blank(e.target.value) })} />
        </Field>
        <Field label="메모">
          <Textarea value={v.memo ?? ""} onChange={(e) => set({ memo: blank(e.target.value) })} />
        </Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </Modal>
  );
}
