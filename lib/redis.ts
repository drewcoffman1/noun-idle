import { Redis } from '@upstash/redis';
import { GameState, createInitialState } from './game';

// Initialize Redis client with Upstash credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

const GAME_STATE_PREFIX = 'game:';

export async function getGameState(fid: number): Promise<GameState> {
  const key = `${GAME_STATE_PREFIX}${fid}`;

  try {
    const state = await redis.get<GameState>(key);
    if (!state) {
      return createInitialState(fid);
    }
    return state;
  } catch (error) {
    console.error('Redis get error:', error);
    return createInitialState(fid);
  }
}

export async function saveGameState(state: GameState): Promise<void> {
  const key = `${GAME_STATE_PREFIX}${state.fid}`;

  try {
    await redis.set(key, state);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function updateGameState(
  fid: number,
  updater: (state: GameState) => GameState
): Promise<GameState> {
  const state = await getGameState(fid);
  const newState = updater(state);
  await saveGameState(newState);
  return newState;
}
