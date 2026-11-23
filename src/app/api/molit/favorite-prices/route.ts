// 관심 단지 시세 요약: GET /api/molit/favorite-prices
// 실거래 단지가 연결된 관심 단지의 구마다 최근 24개월이 DB 에 없으면 국토교통부에서 받아 채운 뒤 요약한다(처음 한 번은 오래 걸릴 수 있다).
import { favoritePrices } from "@/lib/molit/favorites";
import { OpenApiError } from "@/lib/molit/xml";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    return Response.json(await favoritePrices(await serverSupabase()));
  } catch (e) {
    if (e instanceof OpenApiError) return Response.json({ error: `${e.message} (${e.code})` }, { status: 502 });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
