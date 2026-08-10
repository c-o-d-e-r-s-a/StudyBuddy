import type { Metadata } from "next";
import { ReactNode } from "react";
import "./global.css";

export const metadata: Metadata = {
  title: "StudyBuddy",
  description: "AI Study Companion",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}