// Game state and logic

export interface DailyQuest {
  id: string;
  type: 'brew' | 'earn' | 'upgrade' | 'social';
  description: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement: number;
  unlocked: boolean;
  nftClaimed?: boolean;
}

export interface SocialAction {
  type: 'gift' | 'visit';
  fromFid: number;
  toFid: number;
  timestamp: number;
  message?: string;
  amount?: number;
}

export interface GameState {
  fid: number;
  coins: number;
  lastCollected: number;
  upgrades: {
    // Core upgrades
    tapPower: number;        // 0-50: Better beans (+1 per tap each)
    coffeeMachine: number;   // 0-10: Machines (+2/sec each)
    barista: number;         // 0-5: Baristas (+5/sec each)
    pastryCase: number;      // 0-3: Pastry cases (+10/sec each)
    cozySeating: number;     // 0-4: Seating (+15/sec each)
    bookshelf: number;       // 0-3: Bookshelves (+8/sec each)
    plants: number;          // 0-6: Plants (+3/sec each)
    lighting: number;        // 0-3: String lights (+12/sec each)

    // Premium upgrades (require $NOUN)
    espressoBar: number;     // 0-3: Espresso bar (+50/sec each)
    roastery: number;        // 0-2: Roastery (2x multiplier each)
    franchise: number;       // 0-5: Franchise locations (+100/sec each)
  };
  milestones: string[];
  totalCoffees: number;
  totalTaps: number;
  boostEndTime?: number; // Timestamp when 2x boost ends
  prestigeLevel: number;
  prestigePoints: number;

  // Daily quests
  dailyQuests: DailyQuest[];
  lastQuestReset: number;
  questStreak: number;

  // Achievements
  achievements: Achievement[];

  // Social
  friendVisits: number;
  giftsReceived: SocialAction[];
  giftsSent: number;

  // Token integration
  nounTokensEarned: number;
  nounTokensSpent: number;

  // Special events
  currentEvent?: {
    id: string;
    name: string;
    endTime: number;
    multiplier: number;
  };
}

// Upgrade costs (in coins)
export const UPGRADE_COSTS = {
  tapPower: { base: 10, mult: 1.5, max: 50 },
  coffeeMachine: { base: 100, mult: 1.8, max: 10 },
  barista: { base: 500, mult: 2.0, max: 5 },
  pastryCase: { base: 2000, mult: 2.2, max: 3 },
  cozySeating: { base: 5000, mult: 2.5, max: 4 },
  bookshelf: { base: 3000, mult: 2.0, max: 3 },
  plants: { base: 800, mult: 1.6, max: 6 },
  lighting: { base: 4000, mult: 2.3, max: 3 },
} as const;

// Premium upgrade costs (in $NOUN tokens)
export const PREMIUM_UPGRADE_COSTS = {
  espressoBar: { base: 100, mult: 2.0, max: 3, nounCost: true },
  roastery: { base: 500, mult: 3.0, max: 2, nounCost: true },
  franchise: { base: 200, mult: 2.5, max: 5, nounCost: true },
} as const;

// Milestones that reward $NOUN tokens
export const MILESTONES = {
  first_100: { requirement: 100, reward: 10, description: "Serve 100 coffees", type: 'coffees' },
  first_1k: { requirement: 1000, reward: 25, description: "Serve 1,000 coffees", type: 'coffees' },
  coffee_10k: { requirement: 10000, reward: 100, description: "Serve 10,000 coffees", type: 'coffees' },
  coffee_100k: { requirement: 100000, reward: 500, description: "Serve 100,000 coffees", type: 'coffees' },
  first_machine: { requirement: 1, reward: 10, description: "Buy first coffee machine", type: 'upgrade' },
  first_barista: { requirement: 1, reward: 25, description: "Hire your first barista", type: 'upgrade' },
  first_premium: { requirement: 1, reward: 50, description: "Purchase a premium upgrade", type: 'premium' },
  prestige_1: { requirement: 1, reward: 100, description: "Prestige for the first time", type: 'prestige' },
  social_butterfly: { requirement: 10, reward: 50, description: "Visit 10 friends' shops", type: 'social' },
  generous: { requirement: 25, reward: 75, description: "Send 25 gifts", type: 'social' },
  quest_master: { requirement: 30, reward: 100, description: "Complete 30 daily quests", type: 'quests' },
  streak_7: { requirement: 7, reward: 50, description: "7-day quest streak", type: 'streak' },
  streak_30: { requirement: 30, reward: 200, description: "30-day quest streak", type: 'streak' },
} as const;

// Achievements (unlock special bonuses)
export const ACHIEVEMENTS = {
  speed_demon: { name: 'Speed Demon', description: 'Tap 1000 times', requirement: 1000, bonus: 'tapPowerBonus' },
  idle_master: { name: 'Idle Master', description: 'Earn 50k while offline', requirement: 50000, bonus: 'idleBonus' },
  collector: { name: 'Collector', description: 'Max out all basic upgrades', requirement: 1, bonus: 'coinMultiplier' },
  tycoon: { name: 'Coffee Tycoon', description: 'Earn 1 million total coffees', requirement: 1000000, bonus: 'prestigeBonus' },
  social_star: { name: 'Social Star', description: 'Receive 50 gifts', requirement: 50, bonus: 'giftBonus' },
} as const;

export function createInitialState(fid: number): GameState {
  return {
    fid,
    coins: 0,
    lastCollected: Date.now(),
    upgrades: {
      tapPower: 0,
      coffeeMachine: 0,
      barista: 0,
      pastryCase: 0,
      cozySeating: 0,
      bookshelf: 0,
      plants: 0,
      lighting: 0,
      espressoBar: 0,
      roastery: 0,
      franchise: 0,
    },
    milestones: [],
    totalCoffees: 0,
    totalTaps: 0,
    prestigeLevel: 0,
    prestigePoints: 0,
    dailyQuests: generateDailyQuests(),
    lastQuestReset: Date.now(),
    questStreak: 0,
    achievements: Object.keys(ACHIEVEMENTS).map(id => ({
      id,
      name: ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS].name,
      description: ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS].description,
      requirement: ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS].requirement,
      unlocked: false,
    })),
    friendVisits: 0,
    giftsReceived: [],
    giftsSent: 0,
    nounTokensEarned: 0,
    nounTokensSpent: 0,
  };
}

// Generate 3 random daily quests
export function generateDailyQuests(): DailyQuest[] {
  const questTypes = [
    { id: 'brew_100', type: 'brew' as const, description: 'Brew 100 coffees', target: 100, reward: 50 },
    { id: 'brew_500', type: 'brew' as const, description: 'Brew 500 coffees', target: 500, reward: 150 },
    { id: 'brew_1000', type: 'brew' as const, description: 'Brew 1,000 coffees', target: 1000, reward: 300 },
    { id: 'earn_1k', type: 'earn' as const, description: 'Earn 1,000 coins', target: 1000, reward: 100 },
    { id: 'earn_10k', type: 'earn' as const, description: 'Earn 10,000 coins', target: 10000, reward: 500 },
    { id: 'tap_50', type: 'brew' as const, description: 'Tap 50 times', target: 50, reward: 50 },
    { id: 'tap_100', type: 'brew' as const, description: 'Tap 100 times', target: 100, reward: 100 },
    { id: 'upgrade_1', type: 'upgrade' as const, description: 'Purchase 1 upgrade', target: 1, reward: 75 },
    { id: 'upgrade_3', type: 'upgrade' as const, description: 'Purchase 3 upgrades', target: 3, reward: 200 },
    { id: 'social_visit', type: 'social' as const, description: 'Visit a friend\'s shop', target: 1, reward: 100 },
  ];

  // Shuffle and pick 3
  const shuffled = questTypes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(q => ({
    ...q,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

export function calculateProductionRate(state: GameState): number {
  // Base production from upgrades
  let perSecond = 0;

  perSecond += state.upgrades.coffeeMachine * 2;
  perSecond += state.upgrades.barista * 5;
  perSecond += state.upgrades.pastryCase * 10;
  perSecond += state.upgrades.cozySeating * 15;
  perSecond += state.upgrades.bookshelf * 8;
  perSecond += state.upgrades.plants * 3;
  perSecond += state.upgrades.lighting * 12;

  // Premium upgrades
  perSecond += state.upgrades.espressoBar * 50;
  perSecond += state.upgrades.franchise * 100;

  // Apply multipliers
  let multiplier = 1;

  // Prestige multiplier
  multiplier *= 1 + (state.prestigeLevel * 0.1);

  // Roastery multiplier (2x per level)
  multiplier *= Math.pow(2, state.upgrades.roastery);

  // Achievement bonuses
  const collectorAchievement = state.achievements.find(a => a.id === 'collector');
  if (collectorAchievement?.unlocked) {
    multiplier *= 1.25;
  }

  // Boost active?
  if (state.boostEndTime && Date.now() < state.boostEndTime) {
    multiplier *= 2;
  }

  // Event multiplier
  if (state.currentEvent && Date.now() < state.currentEvent.endTime) {
    multiplier *= state.currentEvent.multiplier;
  }

  return Math.floor(perSecond * multiplier);
}

export function calculateTapPower(state: GameState): number {
  let power = 1 + state.upgrades.tapPower;

  // Prestige bonus
  power *= 1 + (state.prestigeLevel * 0.1);

  // Speed demon achievement
  const speedDemonAchievement = state.achievements.find(a => a.id === 'speed_demon');
  if (speedDemonAchievement?.unlocked) {
    power *= 1.5;
  }

  return Math.floor(power);
}

export function calculateIdleEarnings(state: GameState): { coins: number; coffees: number } {
  const now = Date.now();
  const secondsElapsed = Math.floor((now - state.lastCollected) / 1000);

  // Cap at 8 hours of idle earnings (unless barista upgrade or idle master achievement)
  let maxSeconds = 8 * 60 * 60;  // 8 hours base

  if (state.upgrades.barista > 0) {
    maxSeconds = 24 * 60 * 60;  // 24 hours with barista
  }

  const idleMasterAchievement = state.achievements.find(a => a.id === 'idle_master');
  if (idleMasterAchievement?.unlocked) {
    maxSeconds *= 2;  // Double idle time with achievement
  }

  const effectiveSeconds = Math.min(secondsElapsed, maxSeconds);
  const rate = calculateProductionRate(state);
  const coffees = Math.floor(effectiveSeconds * rate);

  return { coins: coffees, coffees };
}

export function getUpgradeCost(upgrade: keyof typeof UPGRADE_COSTS, level: number): number | null {
  const upgradeData = UPGRADE_COSTS[upgrade];
  if (level >= upgradeData.max) return null;
  return Math.floor(upgradeData.base * Math.pow(upgradeData.mult, level));
}

export function getPremiumUpgradeCost(upgrade: keyof typeof PREMIUM_UPGRADE_COSTS, level: number): number | null {
  const upgradeData = PREMIUM_UPGRADE_COSTS[upgrade];
  if (level >= upgradeData.max) return null;
  return Math.floor(upgradeData.base * Math.pow(upgradeData.mult, level));
}

export function canAffordUpgrade(state: GameState, upgrade: keyof typeof UPGRADE_COSTS): boolean {
  const cost = getUpgradeCost(upgrade, state.upgrades[upgrade]);
  if (cost === null) return false;
  return state.coins >= cost;
}

export function getUnclaimedMilestones(state: GameState): string[] {
  const unclaimed: string[] = [];

  Object.entries(MILESTONES).forEach(([key, milestone]) => {
    if (state.milestones.includes(key)) return;

    let eligible = false;

    switch (milestone.type) {
      case 'coffees':
        eligible = state.totalCoffees >= milestone.requirement;
        break;
      case 'upgrade':
        if (key === 'first_machine') eligible = state.upgrades.coffeeMachine >= 1;
        if (key === 'first_barista') eligible = state.upgrades.barista >= 1;
        break;
      case 'premium':
        eligible = state.upgrades.espressoBar + state.upgrades.roastery + state.upgrades.franchise >= milestone.requirement;
        break;
      case 'prestige':
        eligible = state.prestigeLevel >= milestone.requirement;
        break;
      case 'social':
        if (key === 'social_butterfly') eligible = state.friendVisits >= milestone.requirement;
        if (key === 'generous') eligible = state.giftsSent >= milestone.requirement;
        break;
      case 'quests':
        const completedQuests = state.dailyQuests.filter(q => q.claimed).length;
        eligible = completedQuests >= milestone.requirement;
        break;
      case 'streak':
        eligible = state.questStreak >= milestone.requirement;
        break;
    }

    if (eligible) unclaimed.push(key);
  });

  return unclaimed;
}

export function checkAchievements(state: GameState): Achievement[] {
  const newlyUnlocked: Achievement[] = [];

  state.achievements.forEach(achievement => {
    if (achievement.unlocked) return;

    let eligible = false;

    switch (achievement.id) {
      case 'speed_demon':
        eligible = state.totalTaps >= ACHIEVEMENTS.speed_demon.requirement;
        break;
      case 'idle_master':
        // Check if they earned 50k+ in last idle session (we'd track this separately)
        break;
      case 'collector':
        // Check if all basic upgrades are maxed
        eligible = Object.entries(state.upgrades).every(([key, level]) => {
          if (key === 'espressoBar' || key === 'roastery' || key === 'franchise') return true;
          const upgradeKey = key as keyof typeof UPGRADE_COSTS;
          return level >= UPGRADE_COSTS[upgradeKey].max;
        });
        break;
      case 'tycoon':
        eligible = state.totalCoffees >= ACHIEVEMENTS.tycoon.requirement;
        break;
      case 'social_star':
        eligible = state.giftsReceived.length >= ACHIEVEMENTS.social_star.requirement;
        break;
    }

    if (eligible) {
      achievement.unlocked = true;
      newlyUnlocked.push(achievement);
    }
  });

  return newlyUnlocked;
}

export function updateQuestProgress(state: GameState, action: { type: string; amount?: number }): void {
  state.dailyQuests.forEach(quest => {
    if (quest.completed) return;

    if (quest.type === 'brew' && (action.type === 'tap' || action.type === 'idle')) {
      quest.progress += action.amount || 0;
    } else if (quest.type === 'earn' && action.type === 'earn') {
      quest.progress += action.amount || 0;
    } else if (quest.type === 'upgrade' && action.type === 'upgrade') {
      quest.progress += 1;
    } else if (quest.type === 'social' && action.type === 'social') {
      quest.progress += 1;
    }

    if (quest.progress >= quest.target) {
      quest.completed = true;
    }
  });
}

export function shouldResetQuests(state: GameState): boolean {
  const now = Date.now();
  const lastReset = new Date(state.lastQuestReset);
  const today = new Date(now);

  // Reset if it's a new day
  return lastReset.getDate() !== today.getDate() ||
    lastReset.getMonth() !== today.getMonth() ||
    lastReset.getFullYear() !== today.getFullYear();
}

export function calculatePrestigeCost(prestigeLevel: number): number {
  return Math.floor(100000 * Math.pow(2, prestigeLevel));
}

export function canPrestige(state: GameState): boolean {
  const cost = calculatePrestigeCost(state.prestigeLevel);
  return state.totalCoffees >= cost;
}
