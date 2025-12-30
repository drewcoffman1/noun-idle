'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'
import { useState, useEffect, ReactNode } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      await sdk.actions.ready()
      setIsSDKLoaded(true)
    }
    load()
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
