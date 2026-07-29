import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted via next/font (no runtime CDN request) — sourced from the
// `pretendard` npm package's single variable-font file, same font-weight
// range (45-920) the old @font-face declared.
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

// JIHOOT 워드마크 전용 서체(Sora). 본문/제목은 Pretendard 유지, 로고에만 적용.
// Pretendard와 동일하게 self-host(런타임 CDN 요청 없음).
const sora = localFont({
  src: "../../node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2",
  display: "swap",
  weight: "100 800",
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "JIHOOT",
  description: "교실을 게임쇼처럼 바꿔 주는 실시간 퀴즈 빌더",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${pretendard.variable} ${sora.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
