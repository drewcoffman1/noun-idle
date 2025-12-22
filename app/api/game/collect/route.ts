import { NextRequest, NextResponse } from 'next/server';
import { updateGameState } from '@/lib/redis';
import { calculateIdleEarnings } from '@/lib/game';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    const state = await updateGameState(fid, (currentState) => {
      const earnings = calculateIdleEarnings(currentState);
      return {
        ...currentState,
        coins: currentState.coins + earnings.coins,
        totalCoffees: currentState.totalCoffees + earnings.coffees,
        lastCollected: Date.now(),
      };
    });

    return NextResponse.json({ state });
  } catch (error) {
    console.error('Error collecting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
