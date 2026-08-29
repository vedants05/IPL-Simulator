import type { Metadata } from "next";
import localFont from "next/font/local";
import ViewportScaler from "@/components/shared/ViewportScaler";
import "./globals.css";

const anton = localFont({
  src: "./fonts/anton-latin.woff2",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});
const barlow = localFont({
  src: [
    { path: "./fonts/barlow-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});
const barlowCondensed = localFont({
  src: [
    { path: "./fonts/barlow-condensed-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-condensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
});
const spaceMono = localFont({
  src: [
    { path: "./fonts/space-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-mono-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-space-mono",
  display: "swap",
});
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IPL Manager 2027",
  description: "IPL franchise management simulator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable} ${spaceMono.variable} ${bricolage.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem('theme');
                var theme = savedTheme === 'dark' || savedTheme === 'retro' || savedTheme === 'team' ? savedTheme : 'light';
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.classList.toggle('retro', theme === 'retro');
                document.documentElement.classList.toggle('team', theme === 'team');
                document.documentElement.setAttribute('data-theme', theme);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="readable-ui antialiased bg-bg text-text-primary font-barlow">
        <ViewportScaler>{children}</ViewportScaler>
      </body>
    </html>
  );
}
