import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});
export const metadata: Metadata = {
  title: "Kargo | Hiring workspace",
  description: "Evidence-led hiring, grounded in Kargo’s historical hires.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
