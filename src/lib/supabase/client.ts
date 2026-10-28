// 브라우저용 Supabase 클라이언트. 데이터는 이 클라이언트로 Supabase 에 직접 읽고 쓴다(RLS 가 권한을 지킨다).
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
