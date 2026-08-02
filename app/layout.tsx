import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ansemworld.com"),
  alternates: {
    canonical: "/",
  },
  twitter: {
    card: "summary",
    title: "ANSEM WORLD — The Global $ANSEM Herd",
    description: "Map the global $ANSEM herd by country. Add one community bull without connecting a wallet; Phantom holder verification is optional.",
    images: ["/ansem-bull.png"],
  },
  title: "ANSEM WORLD — Live global herd",
  description: "Map the global $ANSEM herd by country. Add one community bull without connecting a wallet; Phantom holder verification is optional.",
  icons: { icon: "/ansem-bull.png", apple: "/ansem-bull.png" },
  openGraph: {
    title: "ANSEM WORLD",
    description: "Map the global $ANSEM herd by country. Add one community bull without connecting a wallet; Phantom holder verification is optional.",
    images: ["/ansem-bull.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
