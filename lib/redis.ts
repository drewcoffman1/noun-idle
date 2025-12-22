import { kv } from '@vercel/kv';
import { GameState, createInitialState } from './game';

const GAME_STATE_PREFIX = 'game:';

export async function getGameState(fid: number): Promise<GameState> {
  const key = `${GAME_STATE_PREFIX}${fid}`;
  const state = await kv.get<GameState>(key);

  if (!state) {
    return createInitialState(fid);
  }

  return state;
}

export async function saveGameState(state: GameState): Promise<void> {
  const key = `${GAME_STATE_PREFIX}${state.fid}`;
  await kv.set(key, state);
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
