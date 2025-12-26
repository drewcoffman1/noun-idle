'use client';

import { useEffect, useState } from 'react';
import NounCoffeeGame from '@/components/NounCoffeeGame';
import { initializeMiniApp } from '@/lib/farcaster';
import { NounGlasses, PALETTE } from '@/components/NounSprites';

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
          // Demo mode - use a test FID so people can try it
          setFid(99999);
        }
      } catch (err) {
        console.error('Init error:', err);
        // Demo mode fallback
        setFid(99999);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: PALETTE.bgDark }}
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <NounGlasses style={0} size={8} />
          </div>
          <div className="text-2xl font-bold mb-2" style={{ color: PALETTE.white }}>
            NOUN COFFEE
          </div>
          <div className="flex items-center justify-center gap-2" style={{ color: PALETTE.nounYellow }}>
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: PALETTE.nounYellow, animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: PALETTE.nounYellow, animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: PALETTE.nounYellow, animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: PALETTE.bgDark }}
      >
        <div className="text-center p-6 rounded-lg" style={{ background: PALETTE.bgMid }}>
          <div className="text-2xl mb-2" style={{ color: PALETTE.danger }}>Oops!</div>
          <div style={{ color: PALETTE.white }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!fid) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: PALETTE.bgDark }}
      >
        <div className="text-center p-6 rounded-lg" style={{ background: PALETTE.bgMid }}>
          <div className="flex justify-center mb-4">
            <NounGlasses style={0} size={6} />
          </div>
          <div className="text-xl font-bold mb-2" style={{ color: PALETTE.white }}>
            Welcome to Noun Coffee!
          </div>
          <div style={{ color: PALETTE.coffeeCream }}>
            Open this app in Warpcast to play
          </div>
        </div>
      </div>
    );
  }

  return <NounCoffeeGame fid={fid} />;
}
