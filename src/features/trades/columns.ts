// 실거래가 표 열 정의
import type { ColDef } from "ag-grid-community";
import { formatPrice } from "@/lib/client/data";
import type { AptTrade } from "@/lib/molit/types";

export const PYEONG = 3.3058;

/** 실거래 한 건씩 보여 주는 표의 열([거래 목록] 탭 · [단지별 추이]의 연도별 거래가 같이 쓴다). 해제된 거래는 금액에 취소선 */
export const TRADE_COLUMNS: ColDef<AptTrade>[] = [
  { field: "dealDate", headerName: "계약일", width: 110, sort: "desc" },
  { field: "district", headerName: "구", width: 90 },
  { field: "dong", headerName: "법정동", width: 100 },
  { field: "aptName", headerName: "단지", flex: 1, minWidth: 160 },
  { field: "roadName", headerName: "도로명", width: 120 },
  {
    field: "areaM2",
    headerName: "전용(㎡)",
    width: 120,
    type: "rightAligned",
    valueFormatter: (p) => (p.value ? `${p.value.toFixed(2)} (${Math.round(p.value / PYEONG)}평)` : ""),
  },
  { field: "floor", headerName: "층", width: 70, type: "rightAligned" },
  {
    field: "priceManwon",
    headerName: "거래금액",
    width: 130,
    type: "rightAligned",
    valueFormatter: (p) => formatPrice(p.value),
    cellClass: (p) => `ag-right-aligned-cell tabular-nums ${p.data?.cancelled ? "text-slate-400 line-through" : ""}`,
  },
  { field: "buildYear", headerName: "건축", width: 80 },
  { field: "dealType", headerName: "거래유형", width: 100 },
];
