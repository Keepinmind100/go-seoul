// 아파트 매매 실거래가 조회: GET /api/molit/apt-trades?district=마포구&ym=202609[&refresh=1]
// Supabase 에 받아 둔 자료가 있으면 그것을, 없거나 오래됐으면 국토교통부 API(상세 자료)로 받아 저장한 뒤 돌려준다.
// 서비스키는 서버에만 있다(CORS 도 막혀 있음). 로그인 확인은 proxy 가 한다.
import { isSeoulDistrict } from "@/lib/molit/lawd";
import { getAptTrades } from "@/lib/molit/store";
import { OpenApiError } from "@/lib/molit/xml";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const district = sp.get("district") ?? "";
  const ym = sp.get("ym") ?? "";
  const refresh = sp.get("refresh") === "1";

  if (!isSeoulDistrict(district)) return Response.json({ error: `서울 구 이름이 아닙니다: ${district}` }, { status: 400 });
  if (!/^\d{6}$/.test(ym)) return Response.json({ error: "ym 은 YYYYMM 형식이어야 합니다" }, { status: 400 });

  try {
    return Response.json(await getAptTrades(await serverSupabase(), district, ym, refresh));
  } catch (e) {
    if (e instanceof OpenApiError) return Response.json({ error: `${e.message} (${e.code})` }, { status: e.code === "CONFIG" ? 500 : 502 });
    throw e;
  }
}
