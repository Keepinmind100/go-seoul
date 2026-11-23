// 아파트 매매 실거래가 조회(읽기 전용): GET /api/molit/apt-trades?district=마포구&ym=202609
// loader(배치)가 Supabase 에 받아 둔 자료만 돌려준다. 아직 안 받은 구·월은 빈 목록과 status: "not_loaded".
// 로그인 확인은 proxy 가 하고, 읽기는 로그인 세션으로 해서 RLS(select only)가 그대로 적용된다.
import { isSeoulDistrict } from "@/lib/molit/lawd";
import { readAptTrades } from "@/lib/molit/store";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const district = sp.get("district") ?? "";
  const ym = sp.get("ym") ?? "";

  if (!isSeoulDistrict(district)) return Response.json({ error: `서울 구 이름이 아닙니다: ${district}` }, { status: 400 });
  if (!/^\d{6}$/.test(ym)) return Response.json({ error: "ym 은 YYYYMM 형식이어야 합니다" }, { status: 400 });
  if (sp.has("refresh")) return Response.json({ error: "새로 받기는 loader 가 합니다(docker compose run --rm loader --district … --ym …)" }, { status: 400 });

  try {
    return Response.json(await readAptTrades(await serverSupabase(), district, ym), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
