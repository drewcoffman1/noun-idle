import { NextRequest, NextResponse } from 'next/server';
import { getGameState, saveGameState } from '@/lib/redis';
import { calculateIdleEarnings, createInitialState } from '@/lib/game';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
  }

  const fid = parseInt(fidParam, 10);
  if (isNaN(fid)) {
    return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
  }

  try {
    let state = await getGameState(fid);

    // Calculate idle earnings since last visit
    const earnings = calculateIdleEarnings(state);
    state = {
      ...state,
      coins: state.coins + earnings.coins,
      totalCoffees: state.totalCoffees + earnings.coffees,
      lastCollected: Date.now(),
    };

    await saveGameState(state);

    return NextResponse.json({
      state,
      idleEarnings: earnings,
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, state: providedState } = body;

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    // If state is provided, save it (for auto-save from frontend)
    // Otherwise, create a new initial state
    const state = providedState || createInitialState(fid);
    await saveGameState(state);

    return NextResponse.json({ state });
  } catch (error) {
    console.error('Error saving game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
