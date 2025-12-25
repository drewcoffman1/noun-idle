// ============================================
// ADDICTIVE IDLE GAME MECHANICS
// ============================================

export interface GameState {
  fid: number;

  // Currencies
  beans: number;              // Main currency
  goldenBeans: number;        // Rare currency (10x value)
  prestigeStars: number;      // From prestiging

  // Core stats
  totalBeans: number;         // All-time production
  totalTaps: number;          // Total clicks
  lastCollected: number;      // For offline calc

  // Upgrades - SIMPLIFIED for addictive loop
  upgrades: {
    clickPower: number;       // Beans per click (0-∞)
    autoClickers: number;     // Baristas that auto-click (0-∞)
    clickMultiplier: number;  // Multiplies click power (0-∞)
    productionMultiplier: number; // Multiplies auto production (0-∞)
    critChance: number;       // % chance for 5x tap (0-20)
    goldenChance: number;     // % chance golden bean spawns (0-10)
    offlineBonus: number;     // Hours of offline production (0-10)
  };

  // Prestige system
  prestigeLevel: number;
  lifetimeBonus: number;      // Keeps 10% of all-time beans as permanent bonus

  // Active effects
  criticalHitActive: boolean;
  goldenBeanSpawned: boolean;
  goldenBeanExpires: number;
  returnBonusActive: boolean; // 2x for 2 minutes after return
  returnBonusExpires: number;

  // Simple achievements (just for celebrations)
  achievementsUnlocked: string[];

  // Token rewards
  nounTokensEarned: number;
  milestonesClaimed: string[];
}

// EXPONENTIAL GROWTH - Key to addiction!
// Costs grow at 1.15^level (manageable exponential)
// Benefits MULTIPLY instead of ADD

export const UPGRADES = {
  clickPower: {
    name: 'Better Beans',
    desc: '+1 bean per click',
    baseCost: 10,
    costMult: 1.15,
    effect: (level: number) => level, // Flat bonus
  },
  autoClickers: {
    name: 'Hire Barista',
    desc: 'Auto-clicks 1/sec',
    baseCost: 100,
    costMult: 1.15,
    effect: (level: number) => level, // Each barista clicks once per second
  },
  clickMultiplier: {
    name: 'Premium Beans',
    desc: '×2 click power',
    baseCost: 500,
    costMult: 1.2,
    effect: (level: number) => Math.pow(2, level), // EXPONENTIAL
  },
  productionMultiplier: {
    name: 'Efficiency Training',
    desc: '×2 auto production',
    baseCost: 2000,
    costMult: 1.2,
    effect: (level: number) => Math.pow(2, level), // EXPONENTIAL
  },
  critChance: {
    name: 'Lucky Beans',
    desc: '+5% crit chance',
    baseCost: 1000,
    costMult: 1.3,
    effect: (level: number) => level * 5,
    max: 20, // Cap at 100% crit
  },
  goldenChance: {
    name: 'Golden Harvest',
    desc: '+2% golden spawn',
    baseCost: 5000,
    costMult: 1.4,
    effect: (level: number) => level * 2,
    max: 10, // Cap at 20% spawn rate
  },
  offlineBonus: {
    name: 'Manager',
    desc: '+2h offline time',
    baseCost: 10000,
    costMult: 1.5,
    effect: (level: number) => level * 2,
    max: 10, // Cap at 20 hours
  },
} as const;

export type UpgradeKey = keyof typeof UPGRADES;

// Milestones give $NOUN tokens
export const MILESTONES = {
  beans_100: { beans: 100, reward: 5, name: 'First 100 Beans!' },
  beans_1k: { beans: 1000, reward: 10, name: 'Coffee Addict' },
  beans_10k: { beans: 10000, reward: 25, name: 'Bean Counter' },
  beans_100k: { beans: 100000, reward: 50, name: 'Bean Tycoon' },
  beans_1m: { beans: 1000000, reward: 100, name: 'Bean Billionaire' },
  prestige_1: { prestige: 1, reward: 50, name: 'First Prestige!' },
  prestige_5: { prestige: 5, reward: 100, name: 'Prestige Master' },
  taps_1k: { taps: 1000, reward: 20, name: 'Clicker' },
  taps_10k: { taps: 10000, reward: 50, name: 'Pro Clicker' },
} as const;

// CORE CALCULATIONS

export function createInitialState(fid: number): GameState {
  return {
    fid,
    beans: 0,
    goldenBeans: 0,
    prestigeStars: 0,
    totalBeans: 0,
    totalTaps: 0,
    lastCollected: Date.now(),
    upgrades: {
      clickPower: 0,
      autoClickers: 0,
      clickMultiplier: 0,
      productionMultiplier: 0,
      critChance: 0,
      goldenChance: 0,
      offlineBonus: 0,
    },
    prestigeLevel: 0,
    lifetimeBonus: 0,
    criticalHitActive: false,
    goldenBeanSpawned: false,
    goldenBeanExpires: 0,
    returnBonusActive: false,
    returnBonusExpires: 0,
    achievementsUnlocked: [],
    nounTokensEarned: 0,
    milestonesClaimed: [],
  };
}

// Calculate beans per click
export function calculateClickPower(state: GameState): number {
  let power = 1; // Base

  // Add click power upgrades
  power += UPGRADES.clickPower.effect(state.upgrades.clickPower);

  // Multiply by click multiplier (EXPONENTIAL)
  power *= UPGRADES.clickMultiplier.effect(state.upgrades.clickMultiplier);

  // Apply prestige bonus (10% per level)
  power *= 1 + (state.prestigeLevel * 0.1);

  // Apply lifetime bonus
  power *= 1 + (state.lifetimeBonus / 1000000); // 1% per million lifetime beans

  // Return bonus (2x for 2 minutes after return)
  if (state.returnBonusActive && Date.now() < state.returnBonusExpires) {
    power *= 2;
  }

  return Math.floor(power);
}

// Calculate auto-production per second
export function calculateProductionRate(state: GameState): number {
  // Auto-clickers produce clicks per second
  let clicksPerSec = state.upgrades.autoClickers;

  if (clicksPerSec === 0) return 0;

  // Each auto-click has same power as manual click
  let beansPerClick = calculateClickPower(state);

  // Apply production multiplier (EXPONENTIAL)
  beansPerClick *= UPGRADES.productionMultiplier.effect(state.upgrades.productionMultiplier);

  return Math.floor(clicksPerSec * beansPerClick);
}

// Calculate offline earnings
export function calculateOfflineEarnings(state: GameState): number {
  const now = Date.now();
  const secondsElapsed = Math.floor((now - state.lastCollected) / 1000);

  // Base offline time: 2 hours
  let maxSeconds = 2 * 60 * 60;

  // Add offline bonus upgrades
  const bonusHours = UPGRADES.offlineBonus.effect(state.upgrades.offlineBonus);
  maxSeconds += bonusHours * 60 * 60;

  const effectiveSeconds = Math.min(secondsElapsed, maxSeconds);
  const rate = calculateProductionRate(state);

  return Math.floor(effectiveSeconds * rate);
}

// Calculate upgrade cost
export function getUpgradeCost(upgrade: UpgradeKey, currentLevel: number): number {
  const config = UPGRADES[upgrade];

  // Check max (using optional chaining since not all upgrades have max)
  if ('max' in config && currentLevel >= config.max) return Infinity;

  // Exponential cost: baseCost * (costMult ^ level)
  return Math.floor(config.baseCost * Math.pow(config.costMult, currentLevel));
}

// Check if can afford upgrade
export function canAfford(state: GameState, upgrade: UpgradeKey): boolean {
  const cost = getUpgradeCost(upgrade, state.upgrades[upgrade]);
  return state.beans >= cost && cost !== Infinity;
}

// Roll for critical hit
export function rollCritical(state: GameState): boolean {
  const chance = UPGRADES.critChance.effect(state.upgrades.critChance);
  return Math.random() * 100 < chance;
}

// Check if should spawn golden bean
export function shouldSpawnGolden(state: GameState): boolean {
  if (state.goldenBeanSpawned) return false;

  const chance = UPGRADES.goldenChance.effect(state.upgrades.goldenChance);
  return Math.random() * 100 < chance;
}

// Calculate prestige cost
export function getPrestigeCost(level: number): number {
  // Prestige available every 100k beans, scaling up
  return Math.floor(100000 * Math.pow(2, level));
}

export function canPrestige(state: GameState): boolean {
  return state.totalBeans >= getPrestigeCost(state.prestigeLevel);
}

// Get unclaimed milestones
export function getUnclaimedMilestones(state: GameState): string[] {
  const unclaimed: string[] = [];

  Object.entries(MILESTONES).forEach(([key, milestone]) => {
    if (state.milestonesClaimed.includes(key)) return;

    let eligible = false;

    if ('beans' in milestone) {
      eligible = state.totalBeans >= milestone.beans;
    } else if ('prestige' in milestone) {
      eligible = state.prestigeLevel >= milestone.prestige;
    } else if ('taps' in milestone) {
      eligible = state.totalTaps >= milestone.taps;
    }

    if (eligible) unclaimed.push(key);
  });

  return unclaimed;
}

// Check for new achievements (for celebrations)
export function checkNewAchievements(state: GameState): string[] {
  const newAchievements: string[] = [];

  // Total beans milestones
  const beansMilestones = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  for (const milestone of beansMilestones) {
    const id = `beans_${milestone}`;
    if (state.totalBeans >= milestone && !state.achievementsUnlocked.includes(id)) {
      newAchievements.push(`${milestone.toLocaleString()} Total Beans!`);
      state.achievementsUnlocked.push(id);
    }
  }

  // Tap milestones
  const tapMilestones = [100, 500, 1000, 5000, 10000];
  for (const milestone of tapMilestones) {
    const id = `taps_${milestone}`;
    if (state.totalTaps >= milestone && !state.achievementsUnlocked.includes(id)) {
      newAchievements.push(`${milestone.toLocaleString()} Total Clicks!`);
      state.achievementsUnlocked.push(id);
    }
  }

  // Upgrade milestones
  const totalUpgrades = Object.values(state.upgrades).reduce((a, b) => a + b, 0);
  const upgradeMilestones = [5, 10, 25, 50, 100];
  for (const milestone of upgradeMilestones) {
    const id = `upgrades_${milestone}`;
    if (totalUpgrades >= milestone && !state.achievementsUnlocked.includes(id)) {
      newAchievements.push(`${milestone} Total Upgrades!`);
      state.achievementsUnlocked.push(id);
    }
  }

  return newAchievements;
}

// Format large numbers
export function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}
