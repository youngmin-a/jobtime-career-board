import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {default: "취준캘린더", template: "%s | 취준캘린더"},
  description: "공고와 전형 일정을 한눈에.",
  openGraph: {
    title: "취준캘린더",
    siteName: "취준캘린더",
    description: "공고와 전형 일정을 한눈에.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
