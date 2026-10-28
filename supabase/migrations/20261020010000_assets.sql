-- 자산현황: 집 살 돈을 가늠하기 위한 자산·부채 항목. 순자산 = 자산 합계 - 부채 합계

create table if not exists public.assets (
  id            bigint generated always as identity primary key,
  category      text not null check (category in ('예금·적금', '주식·펀드', '청약통장', '현금', '전세보증금', '기타 자산', '대출', '기타 부채')),
  name          text not null,                 -- 항목명 (예: 국민은행 정기예금)
  owner         text not null default '공동',  -- 명의
  amount_manwon integer not null check (amount_manwon >= 0),  -- 금액(만원). 부채도 양수로 적는다
  memo          text,
  created_by    uuid not null default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.assets enable row level security;

drop policy if exists "household all" on public.assets;
create policy "household all" on public.assets
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.assets to authenticated;
