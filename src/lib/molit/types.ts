// 아파트 매매 실거래가: 서버(Route Handler)와 화면이 함께 쓰는 형태.

export interface AptTrade {
  /** 행 구분용(응답에 고유 ID 가 없어 조합해 만든다) */
  key: string;
  /** 구 (예: 마포구) */
  district: string;
  aptName: string;
  /** 법정동 (예: 아현동) */
  dong: string;
  jibun: string;
  /** 도로명 (상세 자료에만 있다) */
  roadName: string | null;
  /** 전용면적 ㎡ */
  areaM2: number;
  floor: number | null;
  buildYear: number | null;
  /** YYYY-MM-DD */
  dealDate: string;
  /** 거래금액(만원) */
  priceManwon: number;
  /** 중개거래 · 직거래 */
  dealType: string | null;
  /** 해제 사유 발생일이 있으면 계약이 취소된 거래 */
  cancelled: boolean;
  /** 원본 항목 전체(필드 확인·확장용) */
  raw: Record<string, string>;
}

export interface AptTradeResult {
  district: string;
  /** YYYYMM */
  ym: string;
  detail: boolean;
  totalCount: number;
  items: AptTrade[];
  /** db: 저장된 자료 · api: 방금 국토교통부에서 받음 */
  source?: "db" | "api";
  /** DB 에 받아 둔 시각 */
  loadedAt?: string | null;
  /** DB 저장 실패 등 조회는 됐지만 알릴 것 */
  warning?: string;
}

/** 단지 한 해의 매매가 요약(해제 거래 제외) */
export interface AptTrendYear {
  year: number;
  count: number;
  /** 거래금액(만원). 거래가 없는 해는 null */
  avg: number | null;
  max: number | null;
  min: number | null;
}

export interface AptTrendResult {
  district: string;
  aptSeq: string;
  aptName: string;
  fromYear: number;
  toYear: number;
  /** 고른 전용면적(㎡, 반올림). 없으면 전체 */
  area: number | null;
  years: AptTrendYear[];
  /** 기간 안의 개별 거래(고른 면적만, 최신순, 해제 거래 포함 — 통계에서는 뺀다) — 그래프에서 연도를 누르면 보여 준다 */
  trades: AptTrade[];
  /** 이 단지의 전용면적(반올림)별 거래 건수 */
  areas: { area: number; count: number }[];
  /** 이번에 국토교통부에서 새로 받은 구·월 수 */
  fetchedMonths: number;
  /** 받지 못한 월 (YYYYMM) */
  failedMonths: string[];
}

