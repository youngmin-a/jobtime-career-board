import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나의 바이브코딩 작업실",
  description: "아이디어를 작은 앱으로 만드는 첫 번째 프로젝트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
