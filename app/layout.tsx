import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANSEM WORLD — Live global herd",
  description: "A live community map for holders of $ANSEM on Solana.",
  icons: { icon: "/ansem-bull.png", apple: "/ansem-bull.png" },
  openGraph: {
    title: "ANSEM WORLD",
    description: "Track the herd. Claim your place.",
    images: ["/ansem-bull.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
