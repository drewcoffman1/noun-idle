'use client';

import { useEffect, useState } from 'react';
import NounCoffeeTycoon from '@/components/NounCoffeeTycoon';
import { initializeMiniApp } from '@/lib/farcaster';

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // For now, always use demo mode
    // TODO: Re-enable Farcaster SDK once we debug the client-side error
    setFid(99999);
    setIsLoading(false);
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

  return <NounCoffeeTycoon fid={fid} />;
}
