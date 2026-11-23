-- 관심 단지 ↔ 실거래가 연결. 단지명은 해마다 표기가 조금씩 바뀌므로 국토교통부 단지 일련번호(apt_seq)로 잇는다.
-- apt_seq 는 시군구코드가 붙어 있어(예: 11440-1234) 서울 전체에서 하나뿐이다.

alter table public.favorites add column if not exists apt_seq text;          -- 실거래 단지 일련번호. 없으면 연결 안 됨
alter table public.favorites add column if not exists area_m2 smallint       -- 관심 전용면적(반올림 ㎡). 없으면 전체 면적
  check (area_m2 is null or area_m2 between 10 and 400);

-- 단지별 최근 거래를 바로 찾는다(해제 거래는 시세에서 뺀다)
create index if not exists apt_trades_apt_deal_idx on public.apt_trades (apt_seq, deal_date desc) where not cancelled;

-- 관심 단지별 시세 요약. 기준일(오늘)부터 최근 12개월과 그 전 12개월을 비교한다.
-- 면적이 섞이면 평균 금액이 흔들리므로 전년 대비는 평당가(전용 3.3058㎡당) 기준이다.
-- security_invoker: 조회한 사용자의 권한(RLS)으로 favorites·apt_trades 를 읽는다
create or replace view public.favorite_price_summary
with (security_invoker = true)
as
select
  f.id as favorite_id,
  l.deal_date as last_deal_date,
  l.price_manwon as last_price_manwon,
  l.area_m2 as last_area_m2,
  l.floor as last_floor,
  coalesce(s.recent_count, 0) as recent_count,
  s.recent_avg,
  s.recent_per_pyeong,
  coalesce(s.prev_count, 0) as prev_count,
  s.prev_per_pyeong,
  case when s.prev_per_pyeong > 0 and s.recent_per_pyeong is not null
    then round((s.recent_per_pyeong - s.prev_per_pyeong) * 100.0 / s.prev_per_pyeong, 1)
  end as change_pct
from public.favorites f
left join lateral (
  select a.deal_date, a.price_manwon, a.area_m2, a.floor
  from public.apt_trades a
  where a.apt_seq = f.apt_seq and not a.cancelled and (f.area_m2 is null or round(a.area_m2) = f.area_m2)
  order by a.deal_date desc, a.id desc
  limit 1
) l on true
left join lateral (
  select
    count(*) filter (where a.deal_date > current_date - interval '12 months') as recent_count,
    round(avg(a.price_manwon) filter (where a.deal_date > current_date - interval '12 months'))::integer as recent_avg,
    round(avg(a.price_manwon / (a.area_m2 / 3.3058)) filter (where a.deal_date > current_date - interval '12 months'))::integer as recent_per_pyeong,
    count(*) filter (where a.deal_date <= current_date - interval '12 months') as prev_count,
    round(avg(a.price_manwon / (a.area_m2 / 3.3058)) filter (where a.deal_date <= current_date - interval '12 months'))::integer as prev_per_pyeong
  from public.apt_trades a
  where a.apt_seq = f.apt_seq and not a.cancelled and (f.area_m2 is null or round(a.area_m2) = f.area_m2)
    and a.deal_date > current_date - interval '24 months'
    and a.area_m2 > 0
) s on true
where f.apt_seq is not null;

grant select on public.favorite_price_summary to authenticated;
revoke all on public.favorite_price_summary from anon;

-- 한 구에서 DB 에 받아 둔 거래로 단지 목록을 만든다(관심 단지에 연결할 단지 고르기). PostgREST 에 DISTINCT 가 없어 함수로 둔다
create or replace function public.search_apt_complexes(p_district text)
returns table (
  apt_seq text,
  apt_name text,
  dong text,
  build_year integer,
  trade_count bigint,
  last_deal_date date,
  areas integer[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.apt_seq,
    (array_agg(a.apt_name order by a.deal_date desc))[1],   -- 이름은 가장 최근 거래의 것
    (array_agg(a.dong order by a.deal_date desc))[1],
    max(a.build_year),
    count(*) filter (where not a.cancelled),
    max(a.deal_date),
    array_agg(distinct round(a.area_m2)::integer order by round(a.area_m2)::integer)
  from public.apt_trades a
  where a.district = p_district and a.apt_seq is not null
  group by a.apt_seq
  order by 2;
$$;

revoke execute on function public.search_apt_complexes(text) from public, anon;
grant execute on function public.search_apt_complexes(text) to authenticated;
