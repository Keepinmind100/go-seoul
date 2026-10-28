// Supabase 접속 정보(브라우저·서버 공통). 빌드 시점에 값이 박히므로 Docker 에서는 build arg 로 넘긴다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;
