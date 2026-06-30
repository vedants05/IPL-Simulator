import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPL Manager 2025",
  description: "IPL franchise management simulator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0f1117] text-[#e8eaf0]">
        {children}
      </body>
    </html>
  );
}
