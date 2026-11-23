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
  /** loader 가 이 구·월을 DB 에 받아 둔 시각. 아직 안 받았으면 null */
  loadedAt?: string | null;
  /** loaded: DB 에 있음 · not_loaded: loader 가 아직 받지 않음(items 는 빈 목록). 국토교통부에서 직접 받은 결과에는 없다 */
  status?: "loaded" | "not_loaded";
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
  /** 기간 안에서 loader 가 아직 받지 않은 월 (YYYYMM) — 그 달 거래는 통계에 빠져 있다 */
  missingMonths: string[];
}

