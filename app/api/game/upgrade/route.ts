import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getGameState } from '@/lib/redis';
import { UPGRADE_COSTS, getUpgradeCost, canAffordUpgrade } from '@/lib/game';

type UpgradeType = keyof typeof UPGRADE_COSTS;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, upgrade } = body;

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    if (!upgrade || !Object.keys(UPGRADE_COSTS).includes(upgrade)) {
      return NextResponse.json({ error: 'Invalid upgrade type' }, { status: 400 });
    }

    const currentState = await getGameState(fid);
    const upgradeType = upgrade as UpgradeType;

    if (!canAffordUpgrade(currentState, upgradeType)) {
      return NextResponse.json({ error: 'Cannot afford upgrade' }, { status: 400 });
    }

    const cost = getUpgradeCost(upgradeType, currentState.upgrades[upgradeType]);
    if (cost === null) {
      return NextResponse.json({ error: 'Upgrade maxed out' }, { status: 400 });
    }

    const state = await updateGameState(fid, (state) => ({
      ...state,
      coins: state.coins - cost,
      upgrades: {
        ...state.upgrades,
        [upgradeType]: state.upgrades[upgradeType] + 1,
      },
    }));

    return NextResponse.json({ state, cost });
  } catch (error) {
    console.error('Error upgrading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
