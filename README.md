# 고서울

부부가 함께 쓰는 집 찾기 앱. 관심 단지와 임장 기록을 Supabase 에 저장한다.

- Next.js 16 (App Router) · React 19 · Tailwind 4 · TanStack Query · AG Grid
- Supabase: Auth(이메일·비밀번호), Postgres + RLS. 브라우저가 Supabase 를 직접 호출한다(publishable key)
- 화면: 대시보드 · 관심 단지 · 임장 기록 · 자산현황 · 연결 확인

## 처음 설정

1. **Supabase 프로젝트 생성** (Free 플랜)
2. DB 구조 반영: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push` (아래 "DB 변경" 참고)
3. **Authentication → Sign In / Providers**: Email 사용, **Allow new users to sign up 끄기**
4. **Authentication → Users → Add user**: 두 사람 계정 생성 (Auto Confirm 체크)
5. `.env.local` 작성

   ```bash
   cp .env.example .env.local
   # Project Settings → API 의 Project URL, Publishable key 를 넣는다
   ```

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

로그인 후 **설정 → 연결 확인** 화면에서 접속 정보 · 로그인 세션 · 테이블 읽기 · 쓰기(RLS)를 한 번에 점검한다.

## DB 변경 (마이그레이션)

DB 구조는 `supabase/migrations/*.sql` 로만 바꾼다. 클라우드 콘솔에서 직접 고치지 않는다.

```bash
npx supabase migration new <이름>      # 새 SQL 파일 생성 → 내용 작성 (새 테이블은 RLS·정책·grant 필수)
npx supabase start                     # 로컬 Supabase (Docker)
npx supabase db reset                  # 로컬에 마이그레이션 전부 다시 적용
npx supabase db push --dry-run         # 클라우드에 적용될 내용 확인
npx supabase db push                   # 클라우드 반영
```

로컬 Supabase 로 개발할 때는 `.env.development.local` 에 `npx supabase status` 의 URL·publishable key 를 넣는다(개발 모드에서 `.env.local` 보다 우선).

## 확인

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Docker 배포

`output: "standalone"` 결과만 담은 이미지를 만든다(node:24-alpine, arm64 · x86 공통). `.env.local` 은 이미지에 들어가지 않는다(`.dockerignore`).

```bash
docker compose --env-file .env.local up -d --build   # 빌드 + 실행 → http://<호스트>:3000
docker compose logs -f                               # 로그
docker compose down                                  # 중지
```

| 값 | 넘기는 때 | 방법 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 빌드할 때(브라우저 JS 에 박힘) | build arg. 바꾸면 다시 빌드해야 한다 |
| `MOLIT_SERVICE_KEY`, `SUPABASE_SECRET_KEY` | 실행할 때(loader 만 읽음) | 환경변수. 이미지에 남지 않고, 웹(goseoul) 컨테이너에는 넘기지 않는다 |

라즈베리파이(64비트 OS)에서는 저장소를 받아 같은 명령으로 빌드한다. 맥(Apple Silicon)에서 만든 이미지도 arm64 라 그대로 옮겨 쓸 수 있다.

## 실거래가 적재 (loader)

앱의 `/api/molit/apt-trades`, `/api/molit/apt-trend` 는 Supabase 에 받아 둔 자료를 **읽기만** 한다. 국토교통부 API 를 부르고 `apt_trades` 에 넣는 일은 `loader` 컨테이너(`src/jobs/loadAptTrades.ts`)가 한다.

- 매일 04:00(Asia/Seoul): 최근 3개월 + 이번 달 × 25개 구를 다시 받는다(늦은 신고 · 계약 해제 반영). 하루 안에 받은 것은 건너뛴다
- 최근 창을 막 벗어난 달은 한 번 더 받아 굳힌다
- 남은 예산(`MOLIT_DAILY_BUDGET`, 기본 800)으로 2006년 1월까지 아직 안 받은 달을 최신 달부터 채운다(전체 약 6,250회 → 예산 800이면 8일쯤)
- 구·월 하나는 `replace_apt_trades` RPC 한 번(한 트랜잭션, 같은 구·월은 advisory lock 으로 차례로)이라 중간에 죽어도 반쯤 바뀐 상태가 남지 않는다
- 실행 기록은 `apt_trade_load_runs`, 로그는 `docker compose logs -f loader`(JSON 한 줄씩)
- 키 오류 · 트래픽 한도 초과가 나면 그 실행은 멈추고 다음 날 이어서 받는다

```bash
docker compose --env-file .env.local run --rm loader --once                          # 지금 한 번
docker compose --env-file .env.local run --rm loader --district 마포구 --ym 202609   # 그 구·월만 다시
npm run build:loader && node --env-file=.env.local dist/loader.mjs --once            # Docker 없이
```

권한: 로그인 사용자(`authenticated`)는 `apt_trades` · `apt_trade_loads` · `apt_trade_load_runs` 를 읽기만 한다. 쓰기와 `replace_apt_trades` 실행은 `service_role`(secret key)만 할 수 있다.

## 참고

- `NEXT_PUBLIC_*` 값은 **빌드할 때** JS 에 들어간다. Docker 이미지로 만들 때는 build arg 로 넘겨야 한다.
- secret(service_role) key 는 앱(웹)에 쓰지 않고 loader 에만 넘긴다. 절대 `NEXT_PUBLIC_` 으로 노출하지 않는다.
- 다음 단계(미구현): 임장 사진 업로드.
