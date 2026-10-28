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
| `MOLIT_SERVICE_KEY` | 실행할 때(서버만 읽음) | 환경변수. 이미지에 남지 않는다 |

라즈베리파이(64비트 OS)에서는 저장소를 받아 같은 명령으로 빌드한다. 맥(Apple Silicon)에서 만든 이미지도 arm64 라 그대로 옮겨 쓸 수 있다.

## 참고

- `NEXT_PUBLIC_*` 값은 **빌드할 때** JS 에 들어간다. Docker 이미지로 만들 때는 build arg 로 넘겨야 한다.
- secret(service_role) key 는 이 앱에 쓰지 않는다. 절대 `NEXT_PUBLIC_` 으로 노출하지 않는다.
- 다음 단계(미구현): 임장 사진 업로드.
