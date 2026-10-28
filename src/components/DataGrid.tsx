// AG Grid Community 공용 래퍼: 모듈 등록, 테마, 한국어 문구, 서버 정렬 연결, 번호 열, 체크박스 선택.
// 목록 화면은 이 컴포넌트로만 그리드를 그린다. 모든 그리드 맨 앞에는 번호 열이 붙는다(필수).
"use client";

import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type ColDef,
  type GridReadyEvent,
  type PostSortRowsParams,
  type RowClickedEvent,
  type SortChangedEvent,
} from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { useCallback, useMemo } from "react";
import { useTheme } from "@/lib/client/theme";

ModuleRegistry.registerModules([AllCommunityModule]);

// 앱 디자인 기준(남산초록 포인트색·둥근 모서리)에 맞춘 라이트/다크 테마
const base = {
  fontFamily: "inherit",
  fontSize: 13,
  headerFontWeight: 600,
  spacing: 6,
  borderRadius: 6,
  wrapperBorderRadius: 12,
  accentColor: "#2f6b4f",
};
const lightTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  ...base,
  backgroundColor: "#ffffff",
  foregroundColor: "#22292d",
  borderColor: "#dde3e6",
  headerBackgroundColor: "#f6f8f8",
  headerTextColor: "#4f5b62",
  rowHoverColor: "#eef5f1",
  selectedRowBackgroundColor: "#d7e8de",
});
const darkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  ...base,
  accentColor: "#84b69a",
  backgroundColor: "#1a2024",
  foregroundColor: "#e3e8ea",
  borderColor: "#303a41",
  headerBackgroundColor: "#1f262b",
  headerTextColor: "#aab5bc",
  rowHoverColor: "#16261e",
  selectedRowBackgroundColor: "#1b3126",
});

const LOCALE_TEXT = {
  noRowsToShow: "조회된 데이터가 없습니다.",
  loadingOoo: "불러오는 중…",
  selectAll: "전체 선택",
  page: "페이지",
};

export interface ServerSort {
  field: string;
  order: "asc" | "desc";
}

/** 번호: 지금 보이는 순서(정렬·필터 반영)대로 1부터.
 * 행 순서(rowIndex)는 처음 그릴 때 아직 정해지지 않았을 수 있으므로, 행 모델이 바뀔 때마다(onModelUpdated) 다시 계산한다 */
const NO_COLUMN_ID = "__no";
const NO_COLUMN: ColDef = {
  colId: NO_COLUMN_ID,
  headerName: "번호",
  width: 70,
  pinned: "left",
  sortable: false,
  resizable: false,
  valueGetter: (p) => (p.node?.rowIndex == null ? "" : p.node.rowIndex + 1),
  cellClass: "tabular-nums text-slate-500",
};

/** 체크박스(선택 열)를 누른 것이면 행 클릭으로 치지 않는다 */
const isSelectionClick = (e: RowClickedEvent) => !!(e.event?.target as HTMLElement | null)?.closest('.ag-selection-checkbox, [col-id="ag-Grid-SelectionColumn"]');

type Props<T> = AgGridReactProps<T> & {
  /** 체크박스 선택: 맨 앞에 체크박스 열을 두고, 체크한 행이 바뀔 때마다 알려 준다 */
  onCheckedChange?: (rows: T[]) => void;
  /** 서버 정렬: 헤더 클릭을 그리드 안에서 정렬하지 않고 onChange 로 넘긴다 */
  serverSort?: { sort: ServerSort; onChange: (sort: ServerSort) => void };
  /** 고정 높이(px). 없으면 행 수만큼 늘어난다 */
  height?: number;
};

export function DataGrid<T>({ serverSort, height, defaultColDef, onGridReady, getRowId, columnDefs, onCheckedChange, onRowClicked, onModelUpdated, ...props }: Props<T>) {
  const mode = useTheme();
  const ready = useCallback(
    (e: GridReadyEvent<T>) => {
      if (serverSort) e.api.applyColumnState({ state: [{ colId: serverSort.sort.field, sort: serverSort.sort.order }], defaultState: { sort: null } });
      onGridReady?.(e);
    },
    // 처음 한 번만 정렬 표시를 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 행 ID 로 갱신하면 노드의 원래 순번이 남으므로, 최신 rowData 의 순서를 기준으로 되돌린다
  const rowData = props.rowData;
  const keepServerOrder = useMemo(() => {
    const idx = new Map((rowData ?? []).map((row, i) => [row, i]));
    return ({ nodes }: PostSortRowsParams<T>) => void nodes.sort((a, b) => (idx.get(a.data as T) ?? 0) - (idx.get(b.data as T) ?? 0));
  }, [rowData]);

  const columns = useMemo(() => (columnDefs ? [NO_COLUMN, ...columnDefs] : columnDefs), [columnDefs]);

  const sortChanged = (e: SortChangedEvent<T>) => {
    if (!serverSort) return;
    const col = e.api.getColumnState().find((c) => c.sort);
    if (col?.sort) serverSort.onChange({ field: col.colId, order: col.sort });
  };

  return (
    <div style={height ? { height } : undefined} className="w-full">
      <AgGridReact<T>
        theme={mode === "dark" ? darkTheme : lightTheme}
        localeText={LOCALE_TEXT}
        domLayout={height ? "normal" : "autoHeight"}
        defaultColDef={{
          resizable: true,
          sortable: false,
          ...defaultColDef,
        }}
        sortingOrder={serverSort ? ["asc", "desc"] : undefined}
        // 서버 정렬이면 정렬 표시만 하고 행 순서는 서버가 준 순서(rowData 순서)를 그대로 쓴다
        postSortRows={serverSort ? keepServerOrder : undefined}
        onGridReady={ready}
        onSortChanged={sortChanged}
        suppressCellFocus
        enableCellTextSelection
        // 서버 정렬 목록은 행 ID 로 갱신하면 그리드가 기존 행 순서를 유지하므로, 받은 데이터로 매번 새로 그린다
        getRowId={serverSort ? undefined : getRowId}
        columnDefs={columns}
        {...(onCheckedChange && {
          rowSelection: { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false },
          selectionColumnDef: { width: 48, pinned: "left" },
          onSelectionChanged: (e) => onCheckedChange(e.api.getSelectedRows()),
        })}
        onRowClicked={onRowClicked && ((e) => !isSelectionClick(e) && onRowClicked(e))}
        onModelUpdated={(e) => {
          e.api.refreshCells({ columns: [NO_COLUMN_ID], force: true });
          onModelUpdated?.(e);
        }}
        {...props}
      />
    </div>
  );
}
