import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getGameState } from '@/lib/redis';

const BOOST_COSTS = {
  speed: 10,      // 10 $NOUN for 2x speed for 1 hour
  instant: 50,    // 50 $NOUN for instant upgrade
} as const;

const BOOST_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, boostType, walletAddress } = body;

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    if (!boostType || !Object.keys(BOOST_COSTS).includes(boostType)) {
      return NextResponse.json({ error: 'Invalid boost type' }, { status: 400 });
    }

    const cost = BOOST_COSTS[boostType as keyof typeof BOOST_COSTS];

    // TODO: In production, verify that the user has burned/transferred the required $NOUN
    // This would involve:
    // 1. Checking a burn transaction was made
    // 2. Or transferring tokens to a treasury address
    // 3. Verifying the transaction on Base

    if (boostType === 'speed') {
      const state = await updateGameState(fid, (state) => ({
        ...state,
        boostEndTime: Date.now() + BOOST_DURATION,
      }));

      return NextResponse.json({
        state,
        message: '2x speed boost activated for 1 hour!',
        cost,
      });
    }

    if (boostType === 'instant') {
      // For instant upgrade, we just confirm the boost was purchased
      // The actual upgrade selection would be a separate call
      return NextResponse.json({
        message: 'Instant upgrade token consumed. Choose an upgrade to apply instantly.',
        cost,
      });
    }

    return NextResponse.json({ error: 'Unknown boost type' }, { status: 400 });
  } catch (error) {
    console.error('Error applying boost:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
