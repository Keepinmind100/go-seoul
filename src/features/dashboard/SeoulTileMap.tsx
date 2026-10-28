// 서울 25개 구를 실제 위치에 가깝게 배치한 타일 지도. 관심 단지가 많을수록 초록이 짙고, 임장한 구에는 은행색 점을 찍는다.
"use client";

/** 6열 격자 배치(빈 칸은 null). 위가 북쪽, 3·4행 사이가 대략 한강 */
const LAYOUT: (string | null)[][] = [
  [null, "은평구", "종로구", "성북구", "강북구", "도봉구"],
  [null, "서대문구", "중구", "동대문구", "중랑구", "노원구"],
  ["강서구", "마포구", "용산구", "성동구", "광진구", "강동구"],
  ["양천구", "영등포구", "동작구", "서초구", "강남구", "송파구"],
  ["구로구", "금천구", "관악구", null, null, null],
];

/** 관심 단지 수에 따른 타일 색(0 · 1 · 2 · 3+) */
const FILL = [
  "bg-white text-slate-500 border-slate-200",
  "bg-brand-100 text-brand-800 border-brand-200",
  "bg-brand-300 text-brand-900 border-brand-300",
  "bg-brand-600 text-on-color border-brand-600",
];

export function SeoulTileMap({ favorites, visits, onPick }: { favorites: Map<string, number>; visits: Set<string>; onPick: (district: string) => void }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="grid grid-cols-6 gap-1.5" role="list" aria-label="서울 구별 관심 단지">
        {LAYOUT.flat().map((d, i) => {
          if (!d) return <span key={i} aria-hidden />;
          const n = favorites.get(d) ?? 0;
          const visited = visits.has(d);
          return (
            <button
              key={d}
              type="button"
              role="listitem"
              onClick={() => onPick(d)}
              title={`${d}: 관심 단지 ${n}곳${visited ? ", 임장함" : ""}`}
              className={`relative flex aspect-[4/3] flex-col items-center justify-center rounded-md border text-[13px] font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out-strong hover:border-brand-500 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${FILL[Math.min(n, 3)]}`}
            >
              {d.replace(/구$/, "")}
              {n > 0 && <span className="text-[11px] tabular-nums opacity-80">{n}곳</span>}
              {visited && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full sm:right-1.5 sm:top-1.5 sm:h-2 sm:w-2 bg-ginkgo-400 ring-2 ring-white" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {FILL.map((c, i) => (
              <span key={i} className={`h-3 w-3 rounded-sm border ${c}`} />
            ))}
          </span>
          관심 단지 0 → 3곳 이상
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ginkgo-400" />
          임장 다녀온 구
        </span>
      </div>
    </div>
  );
}
