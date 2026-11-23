-- 실거래가 적재를 요청 경로에서 배치(loader)로 옮긴다.
-- - 앱(로그인 사용자)은 읽기만 한다. 쓰기는 secret key(service_role)를 가진 loader 만 한다
-- - 같은 구·월을 두 곳에서 동시에 바꿔 넣어도 trade_key 충돌·반쯤 지워진 상태가 생기지 않게 잠근다
-- - loader 가 언제 무엇을 받았는지 남긴다(apt_trade_load_runs)

-- 한 구·월을 지우고 새로 넣는 것을 한 트랜잭션으로 처리한다. 같은 구·월 호출은 차례로 실행된다
create or replace function public.replace_apt_trades(p_district text, p_ym text, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 트랜잭션이 끝나면 풀린다. 다른 구·월은 막지 않는다
  perform pg_advisory_xact_lock(hashtextextended('apt_trades:' || p_district || ':' || p_ym, 0));

  delete from public.apt_trades where district = p_district and ym = p_ym;

  insert into public.apt_trades (trade_key, district, ym, apt_seq, apt_name, dong, jibun, road_name, area_m2, floor, build_year, deal_date, price_manwon, deal_type, cancelled, raw)
  select r.trade_key, p_district, p_ym, r.apt_seq, r.apt_name, r.dong, r.jibun, r.road_name, r.area_m2, r.floor, r.build_year, r.deal_date, r.price_manwon, r.deal_type, r.cancelled, r.raw
  from jsonb_to_recordset(p_rows) as r(
    trade_key text, apt_seq text, apt_name text, dong text, jibun text, road_name text, area_m2 numeric, floor integer,
    build_year integer, deal_date date, price_manwon integer, deal_type text, cancelled boolean, raw jsonb
  );

  insert into public.apt_trade_loads (district, ym, row_count, loaded_at)
  values (p_district, p_ym, jsonb_array_length(p_rows), now())
  on conflict (district, ym) do update set row_count = excluded.row_count, loaded_at = excluded.loaded_at;
end;
$$;

-- 앱은 읽기만: 쓰기 정책·권한을 걷어 낸다(service_role 은 RLS 를 거치지 않는다)
drop policy if exists "household all" on public.apt_trades;
drop policy if exists "household all" on public.apt_trade_loads;
drop policy if exists "household read" on public.apt_trades;
drop policy if exists "household read" on public.apt_trade_loads;
create policy "household read" on public.apt_trades for select to authenticated using (true);
create policy "household read" on public.apt_trade_loads for select to authenticated using (true);

revoke insert, update, delete on public.apt_trades, public.apt_trade_loads from authenticated;
grant select on public.apt_trades, public.apt_trade_loads to authenticated;
grant select, insert, update, delete on public.apt_trades, public.apt_trade_loads to service_role;

revoke execute on function public.replace_apt_trades(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_apt_trades(text, text, jsonb) to service_role;

-- loader 실행 기록. finished_at 이 비어 있으면 실행 중이거나 중간에 죽은 것이다
create table if not exists public.apt_trade_load_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  planned      jsonb not null default '{}'::jsonb,   -- 단계별 계획 수 {"recent": 100, "finalize": 25, "backfill": 675}
  loaded       integer not null default 0,
  failed       jsonb not null default '[]'::jsonb,   -- [{"district","ym","error"}]
  error        text                                   -- 실행 전체를 멈춘 사유(트래픽 한도 초과 등)
);

create index if not exists apt_trade_load_runs_started_idx on public.apt_trade_load_runs (started_at desc);

alter table public.apt_trade_load_runs enable row level security;
drop policy if exists "household read" on public.apt_trade_load_runs;
create policy "household read" on public.apt_trade_load_runs for select to authenticated using (true);

grant select on public.apt_trade_load_runs to authenticated;
grant select, insert, update, delete on public.apt_trade_load_runs to service_role;
