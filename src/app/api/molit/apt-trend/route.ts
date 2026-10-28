// 단지별 연도 추이: GET /api/molit/apt-trend?district=송파구&aptSeq=11710-123&from=2017&to=2026[&area=84]
// 기간 안의 구·월 자료가 DB 에 없으면 국토교통부에서 받아 채운 뒤 계산한다(처음 한 번은 오래 걸릴 수 있다).
import { isSeoulDistrict } from "@/lib/molit/lawd";
import { aptTrend } from "@/lib/molit/trend";
import { OpenApiError } from "@/lib/molit/xml";
import { serverSupabase } from "@/lib/supabase/server";

/** 국토교통부 실거래가 자료가 있는 첫 해 */
const FIRST_YEAR = 2006;
const MAX_YEARS = 20;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const district = sp.get("district") ?? "";
  const aptSeq = sp.get("aptSeq") ?? "";
  const from = Number(sp.get("from"));
  const to = Number(sp.get("to"));
  const area = sp.get("area") ? Number(sp.get("area")) : null;
  const thisYear = new Date().getFullYear();

  if (!isSeoulDistrict(district)) return Response.json({ error: `서울 구 이름이 아닙니다: ${district}` }, { status: 400 });
  if (!aptSeq) return Response.json({ error: "단지(aptSeq)를 고르세요" }, { status: 400 });
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < FIRST_YEAR || to > thisYear || from > to)
    return Response.json({ error: `연도는 ${FIRST_YEAR}~${thisYear} 사이로 고르세요` }, { status: 400 });
  if (to - from + 1 > MAX_YEARS) return Response.json({ error: `최대 ${MAX_YEARS}년까지 볼 수 있습니다` }, { status: 400 });
  if (area !== null && !Number.isFinite(area)) return Response.json({ error: "면적이 올바르지 않습니다" }, { status: 400 });

  try {
    return Response.json(await aptTrend(await serverSupabase(), district, aptSeq, from, to, area));
  } catch (e) {
    if (e instanceof OpenApiError) return Response.json({ error: `${e.message} (${e.code})` }, { status: 502 });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
