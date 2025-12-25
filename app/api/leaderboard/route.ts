import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { GameState } from '@/lib/game';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'beans'; // beans, prestige, taps

  try {
    // Get all game states and rank them
    // In production, you'd want to use Redis sorted sets for better performance
    const keys = await redis.keys('game:*');
    const states = await Promise.all(
      keys.map(async (key) => {
        const state = await redis.get<GameState>(key);
        return state;
      })
    );

    // Filter out null states
    const validStates = states.filter((state): state is GameState => state !== null);

    // Create leaderboard based on type
    let leaderboard: Array<{ fid: number; value: number; name: string }> = [];

    switch (type) {
      case 'beans':
        leaderboard = validStates
          .map((state) => ({
            fid: state.fid,
            value: state.totalBeans || 0,
            name: `User ${state.fid}`, // In production, fetch from Farcaster
          }))
          .sort((a, b) => b.value - a.value);
        break;

      case 'prestige':
        leaderboard = validStates
          .map((state) => ({
            fid: state.fid,
            value: state.prestigeLevel || 0,
            name: `User ${state.fid}`,
          }))
          .sort((a, b) => b.value - a.value);
        break;

      case 'taps':
        leaderboard = validStates
          .map((state) => ({
            fid: state.fid,
            value: state.totalTaps || 0,
            name: `User ${state.fid}`,
          }))
          .sort((a, b) => b.value - a.value);
        break;
    }

    // Return top 100
    return NextResponse.json({
      leaderboard: leaderboard.slice(0, 100),
      type,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
