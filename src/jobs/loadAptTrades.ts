// 실거래가 적재 배치(loader). 국토교통부에서 구·월 단위로 받아 Supabase 에 통째로 바꿔 넣는다(replace_apt_trades, 한 트랜잭션).
// Next 와 상관없이 node 로 돌린다: npm run build:loader → node dist/loader.mjs [옵션]
//
//   --daemon                      매일 LOAD_HOUR 시(기본 4, TZ 기준)에 실행. 시작할 때 마지막 실행이 20시간보다 오래됐으면 바로 한 번
//   --once                        한 번 실행하고 끝(기본)
//   --district 마포구 --ym 202609  그 구·월만 지금 다시 받는다(앱의 '새로 받기' 대신)
//
// 환경변수: MOLIT_SERVICE_KEY, SUPABASE_URL(없으면 NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY(service_role),
//          MOLIT_DAILY_BUDGET(기본 800, 한 번 실행에서 부를 최대 구·월 수), MOLIT_CONCURRENCY(기본 4), LOAD_HOUR(기본 4)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAptTrades } from "@/lib/molit/aptTrade";
import { isSeoulDistrict, SEOUL_LAWD_CD, type SeoulDistrict } from "@/lib/molit/lawd";
import { loadIndex, planLoads, type LoadPhase, type PlannedLoad } from "@/lib/molit/plan";
import { saveMonth } from "@/lib/molit/store";
import { OpenApiError } from "@/lib/molit/xml";

const DISTRICTS = Object.keys(SEOUL_LAWD_CD) as SeoulDistrict[];
const PAGE = 1000;
/** data.go.kr 코드 중 이 실행에서 더 불러 봐야 소용없는 것: 키 오류(30·31·32·33) · 트래픽 초과(22) · 설정 없음 */
const FATAL_CODES = new Set(["CONFIG", "22", "30", "31", "32", "33"]);
const RERUN_AFTER_MS = 20 * 60 * 60 * 1000;

const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} 환경변수가 필요합니다`);
  return v;
};
const intEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} 는 1 이상의 정수여야 합니다`);
  return n;
};
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function db(): SupabaseClient {
  return createClient(env("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readLoads(client: SupabaseClient) {
  const rows: { district: string; ym: string; loaded_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("apt_trade_loads").select("district, ym, loaded_at").order("district").order("ym").range(from, from + PAGE - 1);
    if (error) throw new Error(`apt_trade_loads 읽기 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

interface RunResult {
  loaded: number;
  failed: { district: string; ym: string; error: string }[];
  error: string | null;
}

/** 계획한 구·월을 동시에 concurrency 개씩 받아 넣는다. 키·트래픽 오류가 나면 남은 것은 다음 실행으로 미룬다 */
async function execute(client: SupabaseClient, plan: PlannedLoad[], concurrency: number): Promise<RunResult> {
  const result: RunResult = { loaded: 0, failed: [], error: null };
  let next = 0;
  const worker = async () => {
    while (next < plan.length && !result.error) {
      const { district, ym, phase } = plan[next++];
      try {
        const { items } = await fetchAptTrades(district as SeoulDistrict, ym, true);
        await saveMonth(client, district, ym, items);
        result.loaded++;
        if (phase !== "backfill" || result.loaded % 50 === 0) log("loaded", { district, ym, phase, rows: items.length, done: result.loaded, of: plan.length });
      } catch (e) {
        const message = e instanceof OpenApiError ? `${e.message} (${e.code})` : (e as Error).message;
        result.failed.push({ district, ym, error: message });
        log("failed", { district, ym, phase, error: message });
        if (e instanceof OpenApiError && FATAL_CODES.has(e.code)) result.error = message;
      }
      // data.go.kr 에 몰아서 보내지 않는다
      await sleep(100 + Math.random() * 200);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, worker));
  return result;
}

async function runOnce(client: SupabaseClient, plan?: PlannedLoad[]) {
  const budget = intEnv("MOLIT_DAILY_BUDGET", 800);
  const concurrency = intEnv("MOLIT_CONCURRENCY", 4);
  plan ??= planLoads({ now: new Date(), districts: DISTRICTS, loads: loadIndex(await readLoads(client)), budget });

  const planned: Partial<Record<LoadPhase, number>> = {};
  for (const p of plan) planned[p.phase] = (planned[p.phase] ?? 0) + 1;

  const run = await client.from("apt_trade_load_runs").insert({ planned }).select("id").single();
  if (run.error) throw new Error(`apt_trade_load_runs 기록 실패: ${run.error.message}`);
  log("run start", { run: run.data.id, planned });

  const result = await execute(client, plan, concurrency);
  const { error } = await client
    .from("apt_trade_load_runs")
    .update({ finished_at: new Date().toISOString(), loaded: result.loaded, failed: result.failed, error: result.error })
    .eq("id", run.data.id);
  if (error) log("run record update failed", { error: error.message });
  log("run end", { run: run.data.id, loaded: result.loaded, failed: result.failed.length, error: result.error });
  return result;
}

/** 다음 hour 시 정각(로컬 시각 = 컨테이너 TZ) */
export function nextRunAt(now: Date, hour: number): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

async function lastFinishedAt(client: SupabaseClient): Promise<number | null> {
  const { data, error } = await client.from("apt_trade_load_runs").select("finished_at").not("finished_at", "is", null).is("error", null).order("finished_at", { ascending: false }).limit(1);
  if (error) throw new Error(`apt_trade_load_runs 읽기 실패: ${error.message}`);
  return data[0] ? new Date(data[0].finished_at).getTime() : null;
}

async function daemon(client: SupabaseClient) {
  const hour = intEnv("LOAD_HOUR", 4);
  for (const sig of ["SIGTERM", "SIGINT"] as const)
    process.on(sig, () => {
      // 진행 중인 구·월은 RPC 한 번(한 트랜잭션)이라 끊겨도 반쯤 들어간 상태가 남지 않는다
      log("stop", { sig });
      process.exit(0);
    });

  const last = await lastFinishedAt(client);
  if (last === null || Date.now() - last > RERUN_AFTER_MS) await runOnce(client).catch((e) => log("run error", { error: (e as Error).message }));

  for (;;) {
    const at = nextRunAt(new Date(), hour);
    log("next run", { at: at.toISOString() });
    // setTimeout 은 약 24.8일까지만 정확하다. 하루 안쪽이라 괜찮다
    await sleep(at.getTime() - Date.now());
    await runOnce(client).catch((e) => log("run error", { error: (e as Error).message }));
  }
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv: string[]) {
  env("MOLIT_SERVICE_KEY");
  const client = db();

  const district = arg(argv, "--district");
  const ym = arg(argv, "--ym");
  if (district || ym) {
    if (!district || !isSeoulDistrict(district)) throw new Error(`--district 는 서울 구 이름이어야 합니다: ${district}`);
    if (!ym || !/^\d{6}$/.test(ym)) throw new Error("--ym 은 YYYYMM 형식이어야 합니다");
    const r = await runOnce(client, [{ district, ym, phase: "recent" }]);
    process.exitCode = r.failed.length ? 1 : 0;
    return;
  }

  if (argv.includes("--daemon")) return daemon(client);

  const r = await runOnce(client);
  process.exitCode = r.error ? 1 : 0;
}

// 테스트에서 import 할 때는 실행하지 않는다
if (!process.env.VITEST) {
  main(process.argv.slice(2)).catch((e) => {
    log("fatal", { error: (e as Error).message });
    process.exit(1);
  });
}
