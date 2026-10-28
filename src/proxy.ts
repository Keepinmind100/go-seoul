// 모든 요청 앞단: 만료된 로그인 토큰을 갱신하고, 로그인하지 않았으면 /login 으로 보낸다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  // 접속 정보가 없으면 로그인 화면에서 설정 안내를 보여 준다
  if (!supabaseConfigured()) {
    return request.nextUrl.pathname === "/login" ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // createServerClient 와 getClaims 사이에 다른 코드를 넣지 않는다(세션이 임의로 끊길 수 있음)
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;

  if (!data?.claims && path !== "/login") {
    // API 는 로그인 화면 HTML 대신 401 을 돌려준다
    if (path.startsWith("/api/")) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (data?.claims && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
