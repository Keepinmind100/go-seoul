-- 아파트 매매 실거래가 저장(국토교통부 상세 자료). 구·계약월 단위로 받아서 통째로 바꿔 넣는다.
-- 지난 자료는 DB 에서만 읽고, 최근 몇 달은 늦은 신고·계약 해제가 반영되므로 하루에 한 번 다시 받는다.

-- 거래
create table if not exists public.apt_trades (
  id            bigint generated always as identity primary key,
  trade_key     text not null unique,          -- 화면 행 구분용(구|단지|계약일|면적|층|금액|동)
  district      text not null,                 -- 구 (예: 마포구)
  ym            text not null check (ym ~ '^\d{6}$'),  -- 계약년월 YYYYMM
  apt_seq       text,                          -- 단지 일련번호(상세 자료)
  apt_name      text not null,
  dong          text not null,                 -- 법정동
  jibun         text,
  road_name     text,
  area_m2       numeric(8, 2) not null,        -- 전용면적
  floor         integer,
  build_year    integer,
  deal_date     date not null,
  price_manwon  integer not null,              -- 거래금액(만원)
  deal_type     text,                          -- 중개거래 · 직거래
  cancelled     boolean not null default false,
  raw           jsonb not null,                -- 원본 항목 전체
  fetched_at    timestamptz not null default now()
);

create index if not exists apt_trades_district_ym_idx on public.apt_trades (district, ym);
create index if not exists apt_trades_apt_idx on public.apt_trades (apt_seq);

-- 어느 구·월을 언제 받았는지 (거래가 0건인 달도 받은 것으로 기록한다)
create table if not exists public.apt_trade_loads (
  district    text not null,
  ym          text not null check (ym ~ '^\d{6}$'),
  row_count   integer not null,
  loaded_at   timestamptz not null default now(),
  primary key (district, ym)
);

-- 한 구·월을 지우고 새로 넣는 것을 한 트랜잭션으로 처리한다(중간에 실패해도 반쯤 지워진 상태가 남지 않게)
create or replace function public.replace_apt_trades(p_district text, p_ym text, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
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

-- RLS: 로그인한 사용자(부부)만 읽고 쓴다. 공공 자료지만 앱 밖으로 열 이유가 없다
alter table public.apt_trades enable row level security;
alter table public.apt_trade_loads enable row level security;

drop policy if exists "household all" on public.apt_trades;
create policy "household all" on public.apt_trades
  for all to authenticated using (true) with check (true);

drop policy if exists "household all" on public.apt_trade_loads;
create policy "household all" on public.apt_trade_loads
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.apt_trades, public.apt_trade_loads to authenticated;
revoke execute on function public.replace_apt_trades(text, text, jsonb) from public, anon;
grant execute on function public.replace_apt_trades(text, text, jsonb) to authenticated;
