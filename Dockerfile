# 고서울 운영 이미지(라즈베리파이 arm64 · x86 공통). next.config.ts 의 output: "standalone" 결과만 담는다.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     -t goseoul .
#   docker run -p 3000:3000 -e MOLIT_SERVICE_KEY=... goseoul
#
# NEXT_PUBLIC_* 는 빌드할 때 브라우저 JS 에 박히므로 build arg 로, MOLIT_SERVICE_KEY 는 서버에서만 읽으므로 실행할 때 넘긴다.

ARG NODE_VERSION=24

# 1) 의존성: package*.json 이 바뀔 때만 다시 받는다
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) 빌드
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
# 값 없이 빌드하면 로그인 화면이 "접속 정보 없음"만 띄우므로 여기서 막는다
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    || (echo "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY build arg 가 필요합니다" >&2 && exit 1)
RUN npm run build

# 3) 실행: standalone 서버와 정적 파일만 복사하고 root 가 아닌 사용자로 돌린다
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node

EXPOSE 3000
# 로그인 화면은 세션 없이도 200 을 돌려준다
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
