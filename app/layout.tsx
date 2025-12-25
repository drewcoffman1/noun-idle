import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noun Coffee Tycoon",
  description: "Build your coffee empire, complete quests, earn $NOUN tokens",
  openGraph: {
    title: "Noun Coffee Tycoon",
    description: "Build your coffee empire, complete quests, earn $NOUN tokens",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#451a03",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
