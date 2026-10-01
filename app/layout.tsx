import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kargo | Hiring workspace",
  description: "Evidence-led hiring, grounded in Kargo’s historical hires.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
