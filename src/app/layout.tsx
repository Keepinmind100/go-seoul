import type { Metadata, Viewport } from "next";
import { Hahmlet, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "고서울",
  description: "우리 집 찾기 — 관심 단지와 임장 기록",
};

// 제목·로고는 Hahmlet, 본문·숫자는 IBM Plex Sans KR (한글 글리프는 unicode-range 로 필요한 만큼만 내려받는다)
const hahmlet = Hahmlet({ subsets: ["latin"], variable: "--font-hahmlet", preload: false });
const plex = IBM_Plex_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", preload: false });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2e3438" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${hahmlet.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
