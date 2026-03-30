import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { THEME_INITIALIZER_SCRIPT } from "@/lib/theme";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Ghoomo",
  description: "On-demand local guide platform MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-initializer" strategy="beforeInteractive">
          {THEME_INITIALIZER_SCRIPT}
        </Script>
        <ThemeProvider>
          <div className="page-shell relative z-[90] pt-4">
            <div className="flex justify-end">
              <ThemeSwitcher />
            </div>
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
