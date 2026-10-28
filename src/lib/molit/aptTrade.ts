// 국토교통부 아파트 매매 실거래가 조회(서버 전용). 서비스키는 MOLIT_SERVICE_KEY 로만 읽고 브라우저로 내보내지 않는다.
import { SEOUL_LAWD_CD, type SeoulDistrict } from "./lawd";
import type { AptTrade, AptTradeResult } from "./types";
import { assertOk, OpenApiError, parseItems, tagText } from "./xml";

const BASE = "https://apis.data.go.kr/1613000";

/** detail=true 는 상세 자료(도로명·등기일 등 추가), false 는 기본 자료 */
const ENDPOINT = {
  basic: `${BASE}/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade`,
  detail: `${BASE}/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`,
};

const PAGE_SIZE = 1000;
/** 한 구·한 달에 이보다 많이 나올 일은 없지만, 무한 반복을 막는다 */
const MAX_PAGES = 10;

export const molitConfigured = () => !!process.env.MOLIT_SERVICE_KEY;

export async function fetchAptTrades(district: SeoulDistrict, ym: string, detail: boolean): Promise<AptTradeResult> {
  const key = process.env.MOLIT_SERVICE_KEY;
  if (!key) throw new OpenApiError("MOLIT_SERVICE_KEY 가 설정되지 않았습니다", "CONFIG");

  const items: AptTrade[] = [];
  let totalCount = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    // URLSearchParams 가 인코딩하므로 키는 '디코딩' 키를 넣는다
    const params = new URLSearchParams({ serviceKey: key, LAWD_CD: SEOUL_LAWD_CD[district], DEAL_YMD: ym, pageNo: String(page), numOfRows: String(PAGE_SIZE) });
    const res = await fetch(`${detail ? ENDPOINT.detail : ENDPOINT.basic}?${params}`, { cache: "no-store" });
    const xml = await res.text();
    if (!res.ok && !xml.includes("<")) throw new OpenApiError(`HTTP ${res.status}`, String(res.status));
    assertOk(xml);

    totalCount = Number(tagText(xml, "totalCount") ?? 0);
    items.push(...parseItems(xml).map((r) => toTrade(r, district)));
    if (items.length >= totalCount) break;
  }
  return { district, ym, detail, totalCount, items: withUniqueKeys(items) };
}

/** 같은 날 같은 조건의 거래가 여러 건이면 키 뒤에 #2, #3 을 붙인다 */
function withUniqueKeys(items: AptTrade[]): AptTrade[] {
  const seen = new Map<string, number>();
  return items.map((t) => {
    const n = (seen.get(t.key) ?? 0) + 1;
    seen.set(t.key, n);
    return n === 1 ? t : { ...t, key: `${t.key}#${n}` };
  });
}

const num = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/,/g, ""));
  return s?.trim() && Number.isFinite(n) ? n : null;
};
const blankToNull = (s: string | undefined) => (s?.trim() ? s.trim() : null);
const pad2 = (s: string | undefined) => (s ?? "").padStart(2, "0");

/** 응답 항목(영문 태그) → 화면용 형태 */
export function toTrade(r: Record<string, string>, district: string): AptTrade {
  const dealDate = `${r.dealYear}-${pad2(r.dealMonth)}-${pad2(r.dealDay)}`;
  return {
    // 여러 구를 합쳐 보여 주므로 구를 키 앞에 붙인다(기본 자료에는 aptSeq 가 없다)
    key: [district, r.aptSeq || r.aptNm, dealDate, r.excluUseAr, r.floor, r.dealAmount, r.aptDong].join("|"),
    district,
    aptName: r.aptNm ?? "",
    dong: r.umdNm ?? "",
    jibun: r.jibun ?? "",
    roadName: blankToNull(r.roadNm),
    areaM2: num(r.excluUseAr) ?? 0,
    floor: num(r.floor),
    buildYear: num(r.buildYear),
    dealDate,
    priceManwon: num(r.dealAmount) ?? 0,
    dealType: blankToNull(r.dealingGbn),
    cancelled: !!blankToNull(r.cdealDay),
    raw: r,
  };
}
