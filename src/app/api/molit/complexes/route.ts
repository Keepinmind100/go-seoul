// 구의 단지 목록: GET /api/molit/complexes?district=마포구
// 최근 12개월 거래로 단지(aptSeq)를 모은다. 관심 단지에 실거래 단지를 연결할 때 쓴다.
import { aptComplexes } from "@/lib/molit/favorites";
import { isSeoulDistrict } from "@/lib/molit/lawd";
import { OpenApiError } from "@/lib/molit/xml";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const district = new URL(request.url).searchParams.get("district") ?? "";
  if (!isSeoulDistrict(district)) return Response.json({ error: `서울 구 이름이 아닙니다: ${district}` }, { status: 400 });

  try {
    return Response.json(await aptComplexes(await serverSupabase(), district));
  } catch (e) {
    if (e instanceof OpenApiError) return Response.json({ error: `${e.message} (${e.code})` }, { status: 502 });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
