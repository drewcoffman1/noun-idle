import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getGameState } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromFid, toFid } = body;

    if (!fromFid || !toFid) {
      return NextResponse.json({ error: 'Missing fid parameters' }, { status: 400 });
    }

    // Get the friend's state to show
    const friendState = await getGameState(toFid);

    // Update visitor's stats
    await updateGameState(fromFid, (state) => ({
      ...state,
      friendVisits: state.friendVisits + 1,
    }));

    // Award bonus coins to the visited friend (when they next log in)
    await updateGameState(toFid, (state) => ({
      ...state,
      giftsReceived: [
        ...state.giftsReceived,
        {
          type: 'visit' as const,
          fromFid,
          toFid,
          timestamp: Date.now(),
        },
      ],
    }));

    return NextResponse.json({
      message: 'Visit recorded!',
      friendState: {
        coins: friendState.coins,
        totalCoffees: friendState.totalCoffees,
        prestigeLevel: friendState.prestigeLevel,
        upgrades: friendState.upgrades,
      },
    });
  } catch (error) {
    console.error('Error visiting friend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
