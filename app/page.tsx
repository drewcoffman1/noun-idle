'use client';

import { useEffect, useState } from 'react';
import CoffeeShop from '@/components/CoffeeShop';
import { initializeMiniApp, sdk } from '@/lib/farcaster';

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // Check if we're in a Farcaster mini app context
        const context = await initializeMiniApp();
        if (context?.user?.fid) {
          setFid(context.user.fid);
        } else {
          // Development fallback - use a test FID
          if (process.env.NODE_ENV === 'development') {
            setFid(1); // Test FID for development
          } else {
            setError('Could not get Farcaster user');
          }
        }
      } catch (err) {
        console.error('Init error:', err);
        // Development fallback
        if (process.env.NODE_ENV === 'development') {
          setFid(1);
        } else {
          setError('Failed to initialize mini app');
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-950">
        <div className="text-center">
          <div className="text-4xl mb-4">N O U N</div>
          <div className="text-amber-300 animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-950">
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">Oops!</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!fid) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-950">
        <div className="text-center text-amber-100">
          <div className="text-2xl mb-2">Welcome!</div>
          <div>Open this app in Warpcast to play</div>
        </div>
      </div>
    );
  }

  return <CoffeeShop fid={fid} />;
}
