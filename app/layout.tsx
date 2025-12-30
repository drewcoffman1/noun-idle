import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://noun-idle.vercel.app'

export const metadata: Metadata = {
  title: 'Noun Idle',
  description: 'Brew coffee, earn beans, spend $NOUN',
  openGraph: {
    title: 'Noun Idle',
    description: 'An idle coffee shop game. Tap to brew, earn beans, spend $NOUN!',
    images: [`${appUrl}/og-image.png`],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      image: `${appUrl}/og-image.png`,
      button: {
        title: 'Play Now',
        action: {
          type: 'launch_frame',
          url: appUrl,
          splashBackgroundColor: '#171717',
        },
      },
    }),
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
