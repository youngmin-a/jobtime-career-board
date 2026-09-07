import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOBTIME | 채용 마감 관리",
  description: "지원 기업의 최신 채용공고와 모집 시작·마감 일시를 정리합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
