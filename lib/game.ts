// Game state and logic

export interface GameState {
  fid: number;
  coins: number;
  lastCollected: number;
  upgrades: {
    beans: number;      // 0-5
    espresso: number;   // 0-3
    barista: number;    // 0-3
    locations: number;  // 0-2
  };
  milestones: string[];
  totalCoffees: number;
  boostEndTime?: number; // Timestamp when 2x boost ends
}

export const UPGRADE_COSTS = {
  beans: [100, 500, 2000, 8000, 32000],
  espresso: [200, 1000, 5000],
  barista: [500, 2500, 10000],
  locations: [10000, 50000],
} as const;

export const MILESTONES = {
  first_100: { requirement: 100, reward: 10, description: "Serve 100 coffees" },
  first_espresso: { requirement: 1, reward: 25, description: "Buy espresso machine" },
  first_hire: { requirement: 1, reward: 50, description: "Hire first barista" },
  coffee_10k: { requirement: 10000, reward: 100, description: "Serve 10,000 coffees" },
  expansion: { requirement: 1, reward: 200, description: "Open second location" },
} as const;

export function createInitialState(fid: number): GameState {
  return {
    fid,
    coins: 0,
    lastCollected: Date.now(),
    upgrades: {
      beans: 0,
      espresso: 0,
      barista: 0,
      locations: 0,
    },
    milestones: [],
    totalCoffees: 0,
  };
}

export function calculateProductionRate(state: GameState): number {
  // Base: 1 coffee per second
  let rate = 1;

  // Beans: 1.5x per level
  rate *= Math.pow(1.5, state.upgrades.beans);

  // Espresso: +2 per level
  rate += state.upgrades.espresso * 2;

  // Locations: 2x per level
  rate *= Math.pow(2, state.upgrades.locations);

  // Boost active?
  if (state.boostEndTime && Date.now() < state.boostEndTime) {
    rate *= 2;
  }

  return rate;
}

export function calculateIdleEarnings(state: GameState): { coins: number; coffees: number } {
  const now = Date.now();
  const secondsElapsed = Math.floor((now - state.lastCollected) / 1000);

  // Cap at 8 hours of idle earnings (unless barista upgrade)
  const maxSeconds = state.upgrades.barista > 0
    ? 24 * 60 * 60  // 24 hours with barista
    : 8 * 60 * 60;  // 8 hours without

  const effectiveSeconds = Math.min(secondsElapsed, maxSeconds);
  const rate = calculateProductionRate(state);
  const coffees = Math.floor(effectiveSeconds * rate);

  return { coins: coffees, coffees };
}

export function getUpgradeCost(upgrade: keyof typeof UPGRADE_COSTS, level: number): number | null {
  const costs = UPGRADE_COSTS[upgrade];
  if (level >= costs.length) return null;
  return costs[level];
}

export function canAffordUpgrade(state: GameState, upgrade: keyof typeof UPGRADE_COSTS): boolean {
  const cost = getUpgradeCost(upgrade, state.upgrades[upgrade]);
  if (cost === null) return false;
  return state.coins >= cost;
}

export function getUnclaimedMilestones(state: GameState): string[] {
  const unclaimed: string[] = [];

  if (state.totalCoffees >= MILESTONES.first_100.requirement && !state.milestones.includes('first_100')) {
    unclaimed.push('first_100');
  }
  if (state.upgrades.espresso >= 1 && !state.milestones.includes('first_espresso')) {
    unclaimed.push('first_espresso');
  }
  if (state.upgrades.barista >= 1 && !state.milestones.includes('first_hire')) {
    unclaimed.push('first_hire');
  }
  if (state.totalCoffees >= MILESTONES.coffee_10k.requirement && !state.milestones.includes('coffee_10k')) {
    unclaimed.push('coffee_10k');
  }
  if (state.upgrades.locations >= 1 && !state.milestones.includes('expansion')) {
    unclaimed.push('expansion');
  }

  return unclaimed;
}
