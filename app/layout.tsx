import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noun Coffee Empire",
  description: "Build your coffee empire, earn $NOUN tokens. A deep idle game for Farcaster.",
  openGraph: {
    title: "Noun Coffee Empire",
    description: "Build your coffee empire, earn $NOUN tokens. A deep idle game for Farcaster.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
