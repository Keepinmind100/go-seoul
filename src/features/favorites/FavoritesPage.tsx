// 관심 단지: 목록(표) · 등록 · 수정 · 삭제. 행을 누르면 수정 창이 열린다.
"use client";

import type { ColDef } from "ag-grid-community";
import { useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, Input, Modal, PageShell, Select, Textarea } from "@/components/ui";
import { SEOUL_DISTRICTS, useDeleteFavorite, useFavorites, useSaveFavorite, type Favorite, type FavoriteInput } from "@/lib/client/data";

const EMPTY: FavoriteInput = { name: "", district: "마포구", address: null, memo: null };

const COLUMNS: ColDef<Favorite>[] = [
  { field: "district", headerName: "구", width: 100 },
  { field: "name", headerName: "단지명", flex: 1, minWidth: 160 },
  { field: "address", headerName: "주소", flex: 1, minWidth: 140 },
  { field: "memo", headerName: "메모", flex: 2, minWidth: 160 },
  { field: "created_at", headerName: "등록일", width: 120, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("ko-KR") : "") },
];

export function FavoritesPage() {
  const list = useFavorites();
  const del = useDeleteFavorite();
  const [editing, setEditing] = useState<{ id?: number; values: FavoriteInput } | null>(null);
  const [checked, setChecked] = useState<Favorite[]>([]);
  const removeChecked = () =>
    checked.length &&
    window.confirm(`선택한 관심 단지 ${checked.length}곳을 삭제할까요? 연결된 임장 기록은 남습니다.`) &&
    del.mutate(
      checked.map((f) => f.id),
      { onSuccess: () => setChecked([]) },
    );

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
      <ErrorText error={list.error ?? del.error} />
      <Card className="p-0">
        <DataGrid<Favorite>
          rowData={list.data ?? []}
          loading={list.isLoading}
          columnDefs={COLUMNS}
          getRowId={(p) => String(p.data.id)}
          onCheckedChange={setChecked}
          onRowClicked={(e) => e.data && setEditing({ id: e.data.id, values: { name: e.data.name, district: e.data.district, address: e.data.address, memo: e.data.memo } })}
          rowStyle={{ cursor: "pointer" }}
        />
      </Card>
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
            <Select value={v.district} onChange={(e) => set({ district: e.target.value })}>
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
        <Field label="메모">
          <Textarea value={v.memo ?? ""} onChange={(e) => set({ memo: blank(e.target.value) })} />
        </Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </Modal>
  );
}
