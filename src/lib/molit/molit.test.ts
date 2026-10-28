import { describe, expect, it } from "vitest";
import { toTrade } from "./aptTrade";
import { assertOk, OpenApiError, parseItems, tagText } from "./xml";

const OK = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
<body><items>
<item><aptDong> </aptDong><aptNm>마포래미안푸르지오</aptNm><aptSeq>11440-1234</aptSeq><buildYear>2014</buildYear>
<cdealDay> </cdealDay><dealAmount>   182,000</dealAmount><dealDay>7</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear>
<dealingGbn>중개거래</dealingGbn><excluUseAr>84.89</excluUseAr><floor>12</floor><jibun>777</jibun><umdNm>아현동</umdNm><rgstDate/></item>
<item><aptNm>A&amp;B</aptNm><cdealDay>26.09.20</cdealDay><dealAmount>50,000</dealAmount><dealDay>1</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear></item>
</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

const AUTH_ERROR = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>
<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

describe("실거래가 XML", () => {
  it("item 을 태그별 값으로 읽는다", () => {
    const items = parseItems(OK);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ aptNm: "마포래미안푸르지오", dealAmount: "182,000", aptDong: "", rgstDate: "" });
    expect(items[1].aptNm).toBe("A&B");
    expect(tagText(OK, "totalCount")).toBe("2");
  });

  it("거래 항목을 화면용으로 바꾼다", () => {
    const [a, b] = parseItems(OK).map((r) => toTrade(r, "마포구"));
    expect(a).toMatchObject({ district: "마포구", dealDate: "2026-09-07", priceManwon: 182000, areaM2: 84.89, floor: 12, buildYear: 2014, cancelled: false, dong: "아현동" });
    expect(b).toMatchObject({ priceManwon: 50000, cancelled: true, floor: null });
  });

  it("정상 응답은 통과, 키 오류·결과 오류는 던진다", () => {
    expect(() => assertOk(OK)).not.toThrow();
    expect(() => assertOk(AUTH_ERROR)).toThrow(OpenApiError);
    expect(() => assertOk(AUTH_ERROR)).toThrow("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    expect(() => assertOk("<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>")).toThrow("NO DATA");
  });
});

describe("monthsBetween", () => {
  it("시작~끝 월을 YYYYMM 목록으로 펼친다(연도 넘김 포함)", async () => {
    const { monthsBetween } = await import("@/lib/client/molit");
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["202511", "202512", "202601", "202602"]);
    expect(monthsBetween("2026-09", "2026-09")).toEqual(["202609"]);
    expect(monthsBetween("2026-09", "2026-08")).toEqual([]);
    expect(monthsBetween("", "2026-08")).toEqual([]);
  });
});

describe("DB 캐시 신선도", () => {
  it("지난 자료는 받은 적 있으면 DB, 최근 3개월은 하루 지나면 다시 받는다", async () => {
    const { isFresh, monthsAgoOf } = await import("./store");
    const now = new Date("2026-10-27T12:00:00+09:00");
    expect(monthsAgoOf("202610", now)).toBe(0);
    expect(monthsAgoOf("202512", now)).toBe(10);
    expect(isFresh(null, "202401", now)).toBe(false);
    expect(isFresh("2026-01-01T00:00:00Z", "202401", now)).toBe(true);
    expect(isFresh("2026-10-27T00:00:00+09:00", "202609", now)).toBe(true);
    expect(isFresh("2026-10-25T00:00:00+09:00", "202609", now)).toBe(false);
  });
});

describe("yearMonths", () => {
  it("연도 범위를 이번 달까지의 YYYYMM 으로 펼친다", async () => {
    const { yearMonths } = await import("./trend");
    const now = new Date("2026-03-15T12:00:00+09:00");
    expect(yearMonths(2025, 2026, now)).toEqual(["202501", "202502", "202503", "202504", "202505", "202506", "202507", "202508", "202509", "202510", "202511", "202512", "202601", "202602", "202603"]);
  });
});
