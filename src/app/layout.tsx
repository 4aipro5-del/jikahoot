import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Like Kahoot",
  description: "교실을 게임쇼처럼 바꿔 주는 실시간 퀴즈 빌더",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
