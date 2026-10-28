-- 고서울 초기 스키마: 관심 단지 · 임장 기록 (클라우드에는 SQL Editor 로 이미 적용됨)
-- 사용자는 두 명(부부)뿐이고 데이터를 함께 보므로, 로그인한 사용자는 모든 행을 읽고 쓸 수 있다.
-- 대신 Authentication 설정에서 회원가입을 꺼서 다른 사람이 계정을 만들지 못하게 한다.

-- 관심 단지
create table if not exists public.favorites (
  id          bigint generated always as identity primary key,
  name        text not null,                 -- 단지명
  district    text not null,                 -- 구 (예: 마포구)
  address     text,                          -- 동·지번 또는 도로명
  memo        text,
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (district, name)
);

-- 임장 기록
create table if not exists public.visits (
  id            bigint generated always as identity primary key,
  favorite_id   bigint references public.favorites (id) on delete set null,
  title         text not null,               -- 다녀온 곳 (단지명·매물)
  visited_on    date not null default current_date,
  rating        smallint check (rating between 1 and 5),
  price_manwon  integer check (price_manwon >= 0),  -- 호가(만원)
  pros          text,
  cons          text,
  memo          text,
  created_by    uuid not null default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now()
);

create index if not exists visits_visited_on_idx on public.visits (visited_on desc);

-- RLS: 로그인한 사용자만 접근 (anon 은 아무것도 못 함)
alter table public.favorites enable row level security;
alter table public.visits enable row level security;

drop policy if exists "household all" on public.favorites;
create policy "household all" on public.favorites
  for all to authenticated using (true) with check (true);

drop policy if exists "household all" on public.visits;
create policy "household all" on public.visits
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.favorites, public.visits to authenticated;
