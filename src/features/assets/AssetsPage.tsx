// 자산현황: 순자산 요약 · 구분별 비율 · 항목 목록(등록 · 수정 · 삭제). 행을 누르면 수정 창이 열린다.
"use client";

import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { DataGrid } from "@/components/DataGrid";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, Input, Modal, PageShell, Select, Textarea } from "@/components/ui";
import {
  ASSET_CATEGORIES,
  DEBT_CATEGORIES,
  formatPrice,
  isDebt,
  useAssets,
  useDeleteAsset,
  useSaveAsset,
  type Asset,
  type AssetCategory,
  type AssetInput,
} from "@/lib/client/data";

const EMPTY: AssetInput = { category: "예금·적금", name: "", owner: "공동", amount_manwon: 0, memo: null };

/** 자산 구분별 막대 색(ASSET_CATEGORIES 순서) */
const SEGMENT = ["bg-brand-700", "bg-brand-500", "bg-ginkgo-400", "bg-brand-300", "bg-slate-400", "bg-brand-200"];

const COLUMNS: ColDef<Asset>[] = [
  {
    field: "category",
    headerName: "구분",
    width: 120,
    cellClass: (p) => (p.value && isDebt(p.value) ? "text-red-700" : ""),
  },
  { field: "name", headerName: "항목", flex: 1, minWidth: 160 },
  { field: "owner", headerName: "명의", width: 100 },
  {
    field: "amount_manwon",
    headerName: "금액",
    width: 140,
    type: "rightAligned",
    valueFormatter: (p) => (p.data && isDebt(p.data.category) ? `-${formatPrice(p.value)}` : formatPrice(p.value)),
    // cellClass 를 지정하면 rightAligned 의 정렬 클래스가 덮이므로 함께 넣는다
    cellClass: (p) => `ag-right-aligned-cell tabular-nums ${p.data && isDebt(p.data.category) ? "text-red-700" : ""}`,
  },
  { field: "memo", headerName: "메모", flex: 1, minWidth: 140 },
  { field: "updated_at", headerName: "수정일", width: 120, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString("ko-KR") : "") },
];

export function AssetsPage() {
  const list = useAssets();
  const [editing, setEditing] = useState<{ id?: number; values: AssetInput } | null>(null);
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const owners = useMemo(() => [...new Set(["공동", ...rows.map((r) => r.owner)])], [rows]);

  return (
    <PageShell
      title="자산현황"
      actions={
        <Button variant="primary" onClick={() => setEditing({ values: EMPTY })}>
          <Icon name="plus" />
          항목 추가
        </Button>
      }
    >
      <ErrorText error={list.error} />
      <Summary rows={rows} />
      <Card className="p-0">
        <DataGrid<Asset>
          rowData={rows}
          loading={list.isLoading}
          columnDefs={COLUMNS}
          getRowId={(p) => String(p.data.id)}
          onRowClicked={(e) =>
            e.data &&
            setEditing({
              id: e.data.id,
              values: { category: e.data.category, name: e.data.name, owner: e.data.owner, amount_manwon: e.data.amount_manwon, memo: e.data.memo },
            })
          }
          rowStyle={{ cursor: "pointer" }}
        />
      </Card>
      {editing && <AssetForm key={editing.id ?? "new"} id={editing.id} initial={editing.values} owners={owners} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}

function Summary({ rows }: { rows: Asset[] }) {
  const sum = (cats: readonly string[]) => rows.filter((r) => cats.includes(r.category)).reduce((s, r) => s + r.amount_manwon, 0);
  const assets = sum(ASSET_CATEGORIES);
  const debts = sum(DEBT_CATEGORIES);
  const segments = ASSET_CATEGORIES.map((c, i) => ({ category: c, amount: sum([c]), color: SEGMENT[i] })).filter((s) => s.amount > 0);

  return (
    <Card className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)]">
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-sm text-slate-500">순자산</dt>
          <dd className={`text-3xl font-semibold tabular-nums tracking-tight ${assets - debts < 0 ? "text-red-700" : "text-slate-900"}`}>
            {formatPrice(assets - debts)}
          </dd>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <dt className="text-slate-500">자산</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{formatPrice(assets)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">부채</dt>
            <dd className={`font-semibold tabular-nums ${debts ? "text-red-700" : "text-slate-800"}`}>{debts ? `-${formatPrice(debts)}` : "0"}</dd>
          </div>
        </div>
      </dl>
      <div className="flex flex-col justify-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">자산 구성</h2>
        {segments.length ? (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="자산 구분별 비율">
              {segments.map((s) => (
                <span key={s.category} className={s.color} style={{ width: `${(s.amount / assets) * 100}%` }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
              {segments.map((s) => (
                <li key={s.category} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                  {s.category}
                  <span className="tabular-nums text-slate-500">
                    {formatPrice(s.amount)} ({Math.round((s.amount / assets) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-500">자산 항목을 추가하면 구분별 비율이 보입니다.</p>
        )}
      </div>
    </Card>
  );
}

function AssetForm({ id, initial, owners, onClose }: { id?: number; initial: AssetInput; owners: string[]; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const save = useSaveAsset();
  const del = useDeleteAsset();
  const set = (patch: Partial<AssetInput>) => setV((prev) => ({ ...prev, ...patch }));

  const valid = v.name.trim() && v.owner.trim() && v.amount_manwon >= 0;
  const submit = () =>
    save.mutate(
      { id, values: { ...v, name: v.name.trim(), owner: v.owner.trim(), memo: v.memo?.trim() || null, updated_at: new Date().toISOString() } },
      { onSuccess: onClose },
    );
  const remove = () => id && window.confirm(`'${initial.name}' 항목을 삭제할까요?`) && del.mutate(id, { onSuccess: onClose });

  return (
    <Modal
      open
      title={id ? "자산 항목 수정" : "자산 항목 추가"}
      onClose={onClose}
      footer={
        <>
          {id && (
            <Button variant="danger" onClick={remove} disabled={del.isPending} className="mr-auto">
              삭제
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || save.isPending}>
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="구분">
            <Select value={v.category} onChange={(e) => set({ category: e.target.value as AssetCategory })}>
              <optgroup label="자산">
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </optgroup>
              <optgroup label="부채">
                {DEBT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field label="명의">
            <Input list="asset-owners" value={v.owner} onChange={(e) => set({ owner: e.target.value })} />
            <datalist id="asset-owners">
              {owners.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="항목">
          <Input autoFocus value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 국민은행 정기예금" />
        </Field>
        <Field label="금액 (만원)" hint={v.amount_manwon ? formatPrice(v.amount_manwon) : "부채도 양수로 적습니다"}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={v.amount_manwon || ""}
            onChange={(e) => set({ amount_manwon: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="예: 5000"
          />
        </Field>
        <Field label="메모">
          <Textarea value={v.memo ?? ""} onChange={(e) => set({ memo: e.target.value })} />
        </Field>
        <ErrorText error={save.error ?? del.error} />
      </div>
    </Modal>
  );
}
