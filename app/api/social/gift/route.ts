import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getGameState } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromFid, toFid, amount, message } = body;

    if (!fromFid || !toFid || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Get sender's state to verify they have enough coins
    const senderState = await getGameState(fromFid);

    if (senderState.coins < amount) {
      return NextResponse.json({ error: 'Insufficient coins' }, { status: 400 });
    }

    // Deduct from sender
    await updateGameState(fromFid, (state) => ({
      ...state,
      coins: state.coins - amount,
      giftsSent: state.giftsSent + 1,
    }));

    // Add to receiver
    await updateGameState(toFid, (state) => ({
      ...state,
      coins: state.coins + amount,
      giftsReceived: [
        ...state.giftsReceived,
        {
          type: 'gift' as const,
          fromFid,
          toFid,
          timestamp: Date.now(),
          amount,
          message,
        },
      ],
    }));

    return NextResponse.json({
      message: 'Gift sent!',
      amount,
    });
  } catch (error) {
    console.error('Error sending gift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
