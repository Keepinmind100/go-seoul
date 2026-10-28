import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 라즈베리파이 Docker 배포용: 실행에 필요한 파일만 .next/standalone 에 모은다
  output: "standalone",
};

export default nextConfig;
