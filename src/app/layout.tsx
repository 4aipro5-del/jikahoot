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

export const metadata: Metadata = {
  title: "Jikahoot",
  description: "교실을 게임쇼처럼 바꿔 주는 실시간 퀴즈 빌더",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${pretendard.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
