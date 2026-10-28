// 연결 확인: Supabase 접속 정보 · 로그인 세션 · 테이블 읽기 · 쓰기(RLS)를 한꺼번에 점검한다.
"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/icons";
import { Button, Card, PageShell } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabase/env";

type Result = { ok: boolean; detail: string; hint?: string };
type Check = { key: string; label: string; run: () => Promise<Result> };

const TEST_NAME = "__연결테스트__";

/** 테이블이 없을 때(42P01·PGRST205) 안내 */
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

async function readCheck(table: "favorites" | "visits" | "assets"): Promise<Result> {
  const { count, error } = await supabase().from(table).select("*", { count: "exact", head: true });
  if (error)
    return {
      ok: false,
      detail: `${error.message}${error.code ? ` (${error.code})` : ""}`,
      hint: missingTable(error.code) ? "테이블이 없습니다. npx supabase db push 로 마이그레이션을 반영하세요." : undefined,
    };
  return { ok: true, detail: `${count ?? 0}건 읽기 성공` };
}

const CHECKS: Check[] = [
  {
    key: "env",
    label: "접속 정보",
    run: async () => ({ ok: !!SUPABASE_URL, detail: SUPABASE_URL ? new URL(SUPABASE_URL).host : "NEXT_PUBLIC_SUPABASE_URL 없음" }),
  },
  {
    key: "auth",
    label: "로그인 세션 (Auth)",
    run: async () => {
      // getUser 는 Auth 서버에 직접 물어보므로 실제 연결까지 확인된다
      const { data, error } = await supabase().auth.getUser();
      if (error || !data.user) return { ok: false, detail: error?.message ?? "로그인되어 있지 않음" };
      return { ok: true, detail: `${data.user.email} · 마지막 로그인 ${new Date(data.user.last_sign_in_at ?? "").toLocaleString("ko-KR")}` };
    },
  },
  { key: "read-favorites", label: "읽기: favorites", run: () => readCheck("favorites") },
  { key: "read-visits", label: "읽기: visits", run: () => readCheck("visits") },
  { key: "read-assets", label: "읽기: assets", run: () => readCheck("assets") },
  {
    key: "write",
    label: "쓰기·삭제 (RLS)",
    run: async () => {
      // 테스트 행을 넣었다가 바로 지운다
      const ins = await supabase().from("favorites").insert({ name: TEST_NAME, district: "중구" }).select("id").single();
      if (ins.error)
        return {
          ok: false,
          detail: `${ins.error.message} (${ins.error.code})`,
          hint: ins.error.code === "42501" ? "RLS 정책 또는 grant 가 없습니다. 마이그레이션을 확인하세요." : undefined,
        };
      const del = await supabase().from("favorites").delete().eq("id", ins.data.id);
      if (del.error) return { ok: false, detail: `삭제 실패: ${del.error.message} — '${TEST_NAME}' 행을 직접 지워 주세요.` };
      return { ok: true, detail: "테스트 행 등록 → 삭제 성공" };
    },
  },
];

/** 점검 하나를 실행하고 걸린 시간을 붙인다 */
async function timed(c: Check): Promise<Result> {
  const started = performance.now();
  let res: Result;
  try {
    res = await c.run();
  } catch (e) {
    res = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  return { ...res, detail: `${res.detail} · ${Math.round(performance.now() - started)}ms` };
}

export function StatusPage() {
  const qc = useQueryClient();
  // 화면을 열 때마다 새로 점검한다(캐시하지 않음)
  const queries = useQueries({ queries: CHECKS.map((c) => ({ queryKey: ["status", c.key], queryFn: () => timed(c), retry: false, staleTime: 0, gcTime: 0 })) });
  const results: Record<string, Result | "running" | undefined> = Object.fromEntries(
    CHECKS.map((c, i) => [c.key, queries[i].isFetching ? "running" : queries[i].data]),
  );
  const running = queries.some((q) => q.isFetching);
  const runAll = () => qc.refetchQueries({ queryKey: ["status"] });

  const done = CHECKS.map((c) => results[c.key]).filter((r): r is Result => !!r && r !== "running");
  const allOk = done.length === CHECKS.length && done.every((r) => r.ok);

  return (
    <PageShell
      title="연결 확인"
      actions={
        <Button onClick={() => void runAll()} disabled={running}>
          <Icon name="refresh" className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          다시 점검
        </Button>
      }
    >
      <section className={`flex items-center gap-3 rounded-card border px-5 py-4 shadow-card ${allOk ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${allOk ? "bg-green-500 text-on-color" : "bg-slate-100 text-slate-500"}`}>
          <Icon name="plug" className="h-5 w-5" />
        </span>
        <div>
          <p className={`font-semibold ${allOk ? "text-green-800" : "text-slate-900"}`}>
            {running ? "점검 중…" : allOk ? "Supabase 연동 정상" : `${done.filter((r) => !r.ok).length}개 항목 실패`}
          </p>
          <p className="text-xs text-slate-500">브라우저 → Supabase 직접 호출 (publishable key + RLS)</p>
        </div>
      </section>
      <Card>
        <ul className="divide-y">
          {CHECKS.map((c) => {
            const r = results[c.key];
            return (
              <li key={c.key} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    !r ? "bg-slate-100 text-slate-400" : r === "running" ? "animate-pulse bg-brand-100 text-brand-700" : r.ok ? "bg-green-500 text-on-color" : "bg-red-500 text-on-color"
                  }`}
                >
                  {!r || r === "running" ? "·" : r.ok ? "✓" : "!"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{c.label}</p>
                  {r && r !== "running" && <p className={`mt-0.5 break-all text-xs ${r.ok ? "text-slate-500" : "text-red-700"}`}>{r.detail}</p>}
                  {r && r !== "running" && r.hint && <p className="mt-1 text-xs text-amber-700">{r.hint}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </PageShell>
  );
}
