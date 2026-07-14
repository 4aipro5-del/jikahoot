import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const bodyFont = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

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
    <html
      lang="ko"
      className={`${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
