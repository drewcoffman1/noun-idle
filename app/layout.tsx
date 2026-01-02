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
    images: ['https://pbs.twimg.com/media/G9dQ6iCaYAAvQP3?format=jpg'],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: 'https://pbs.twimg.com/media/G9dQ6iCaYAAvQP3?format=jpg',
      button: {
        title: 'Play Now',
        action: {
          type: 'launch_miniapp',
          name: 'Noun Idle',
          url: appUrl,
          splashImageUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/3999f273-1831-4b00-4fc9-df110c314d00/original',
          splashBackgroundColor: '#000000',
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
