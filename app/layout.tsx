import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOBTIME | 나의 취업 캘린더",
  description: "내가 선택한 공고와 서류·시험·면접 일정을 함께 관리하는 개인 취업 캘린더",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
