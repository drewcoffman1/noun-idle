import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getGameState } from '@/lib/redis';
import { MILESTONES, getUnclaimedMilestones } from '@/lib/game';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, milestone, walletAddress } = body;

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    if (!milestone || !Object.keys(MILESTONES).includes(milestone)) {
      return NextResponse.json({ error: 'Invalid milestone' }, { status: 400 });
    }

    const currentState = await getGameState(fid);
    const unclaimed = getUnclaimedMilestones(currentState);

    if (!unclaimed.includes(milestone)) {
      return NextResponse.json({ error: 'Milestone not available to claim' }, { status: 400 });
    }

    const reward = MILESTONES[milestone as keyof typeof MILESTONES].reward;

    // Mark milestone as claimed
    const state = await updateGameState(fid, (state) => ({
      ...state,
      milestonesClaimed: [...state.milestonesClaimed, milestone],
      nounTokensEarned: state.nounTokensEarned + reward,
    }));

    // TODO: In production, this would trigger an actual token transfer
    // For now, we just record the claim and return the reward amount
    // The actual transfer would require a backend wallet with tokens to distribute

    return NextResponse.json({
      state,
      reward,
      message: `Claimed ${reward} $NOUN for: ${MILESTONES[milestone as keyof typeof MILESTONES].name}`,
      // In production: txHash would be included here
    });
  } catch (error) {
    console.error('Error claiming milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
