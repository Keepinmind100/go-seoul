// 관심 단지·임장 기록·자산 조회와 변경(React Query + Supabase). 화면은 이 훅만 쓴다.
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SEOUL_LAWD_CD, type SeoulDistrict } from "@/lib/molit/lawd";
import { supabase } from "@/lib/supabase/client";

export interface Favorite {
  id: number;
  name: string;
  district: string;
  address: string | null;
  memo: string | null;
  created_at: string;
}

export interface Visit {
  id: number;
  favorite_id: number | null;
  title: string;
  visited_on: string;
  rating: number | null;
  price_manwon: number | null;
  pros: string | null;
  cons: string | null;
  memo: string | null;
  created_at: string;
}

export const ASSET_CATEGORIES = ["예금·적금", "주식·펀드", "청약통장", "현금", "전세보증금", "기타 자산"] as const;
export const DEBT_CATEGORIES = ["대출", "기타 부채"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number] | (typeof DEBT_CATEGORIES)[number];
export const isDebt = (c: AssetCategory) => (DEBT_CATEGORIES as readonly string[]).includes(c);

export interface Asset {
  id: number;
  category: AssetCategory;
  name: string;
  owner: string;
  amount_manwon: number;
  memo: string | null;
  updated_at: string;
}

export type FavoriteInput = Pick<Favorite, "name" | "district" | "address" | "memo">;
export type VisitInput = Omit<Visit, "id" | "created_at">;
export type AssetInput = Pick<Asset, "category" | "name" | "owner" | "amount_manwon" | "memo">;

type Table = "favorites" | "visits" | "assets";

/** Supabase 오류를 그대로 던진다(PostgrestError 는 Error 가 아니라 메시지를 감싼다) */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (error) throw new Error(error.code ? `${error.message} (${error.code})` : error.message);
  return data as T;
}

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => unwrap(await supabase().from("favorites").select("*").order("created_at", { ascending: false })) as Favorite[],
  });
}

export function useVisits() {
  return useQuery({
    queryKey: ["visits"],
    queryFn: async () =>
      unwrap(await supabase().from("visits").select("*").order("visited_on", { ascending: false }).order("id", { ascending: false })) as Visit[],
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => unwrap(await supabase().from("assets").select("*").order("category").order("amount_manwon", { ascending: false })) as Asset[],
  });
}

/** 저장(id 가 있으면 수정, 없으면 등록)·삭제 후 목록을 다시 불러온다 */
function useSave<T extends object>(table: Table) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: T }) => {
      // 테이블 타입을 생성하지 않았으므로 행 값은 일반 객체로 넘긴다
      const row = values as Record<string, unknown>;
      const q = id ? supabase().from(table).update(row).eq("id", id) : supabase().from(table).insert(row);
      unwrap(await q.select("id").single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

function useDelete(table: Table) {
  const qc = useQueryClient();
  return useMutation({
    // 하나(id) 또는 여러 개(id 목록)를 지운다
    mutationFn: async (id: number | number[]) => {
      const q = supabase().from(table).delete();
      unwrap(await (Array.isArray(id) ? q.in("id", id) : q.eq("id", id)));
    },
    // 관심 단지를 지우면 임장 기록의 연결(favorite_id)도 비워지므로 둘 다 다시 불러온다
    onSuccess: () => qc.invalidateQueries(),
  });
}

export const useSaveFavorite = () => useSave<FavoriteInput>("favorites");
export const useDeleteFavorite = () => useDelete("favorites");
export const useSaveVisit = () => useSave<VisitInput>("visits");
export const useDeleteVisit = () => useDelete("visits");
export const useSaveAsset = () => useSave<AssetInput & { updated_at: string }>("assets");
export const useDeleteAsset = () => useDelete("assets");

/** 12억 3,500 */
export function formatPrice(manwon: number | null): string {
  if (manwon === null) return "—";
  if (manwon < 0) return `-${formatPrice(-manwon)}`;
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (!eok) return `${rest.toLocaleString()}만`;
  return rest ? `${eok}억 ${rest.toLocaleString()}` : `${eok}억`;
}

/** 서울 25개 구(가나다순). 구 목록의 기준은 SEOUL_LAWD_CD 하나다 */
export const SEOUL_DISTRICTS = (Object.keys(SEOUL_LAWD_CD) as SeoulDistrict[]).sort((a, b) => a.localeCompare(b, "ko"));
