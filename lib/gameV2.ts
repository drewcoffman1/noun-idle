// ============================================
// NOUN COFFEE EMPIRE - DEEP IDLE GAME ENGINE
// ============================================

// ===================
// TYPES & INTERFACES
// ===================

export interface Currency {
  beans: number;           // Primary currency (coffee → beans)
  roastPoints: number;     // Prestige 1 currency
  franchiseTokens: number; // Prestige 2 currency
  nounTokens: number;      // On-chain $NOUN balance (synced)
}

export interface PrestigeStats {
  totalPrestiges: number;
  highestBeans: number;
  highestRoast: number;
  totalBeansEarned: number;
}

export interface Staff {
  id: string;
  name: string;
  role: 'barista' | 'roaster' | 'manager' | 'influencer';
  level: number;
  xp: number;
  glassesStyle: number;  // Which Nouns glasses (0-9)
  skinTone: number;      // Character customization
  bonus: number;         // Multiplier this staff provides
  special?: string;      // Special ability ID
}

export interface ShopTier {
  level: number;
  name: string;
  baseProduction: number;
  unlockCost: number;
  unlockCurrency: 'beans' | 'roastPoints' | 'franchiseTokens';
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'production' | 'automation' | 'passive' | 'special';
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  currency: 'beans' | 'roastPoints' | 'franchiseTokens' | 'nounTokens';
  effect: UpgradeEffect;
  requires?: { upgradeId: string; level: number }[];
  icon: string;
}

export interface UpgradeEffect {
  type: 'multiply_production' | 'add_production' | 'multiply_tap' | 'add_tap' |
        'offline_multiplier' | 'combo_bonus' | 'auto_tap' | 'critical_chance' |
        'prestige_bonus' | 'special';
  value: number;
  scaling?: 'linear' | 'exponential';
}

export interface ActiveEvent {
  type: 'rush_hour' | 'golden_bean' | 'special_order' | 'noun_rain';
  multiplier: number;
  endsAt: number;
  data?: Record<string, unknown>;
}

export interface ComboState {
  count: number;
  lastTap: number;
  multiplier: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: AchievementRequirement;
  reward: { type: 'beans' | 'roastPoints' | 'nounTokens'; amount: number };
  secret?: boolean;
}

export interface AchievementRequirement {
  type: 'beans_earned' | 'taps' | 'prestige' | 'staff_count' | 'upgrade_level' |
        'combo_reached' | 'events_completed' | 'playtime';
  value: number;
}

export interface GameStateV2 {
  version: 2;
  fid: number;

  // Currencies
  currency: Currency;

  // Progression
  shopTier: number;
  upgrades: Record<string, number>;  // upgradeId → level
  staff: Staff[];
  achievements: string[];  // Claimed achievement IDs

  // Stats & Prestige
  stats: {
    totalTaps: number;
    totalBeansEarned: number;
    totalRoastEarned: number;
    totalFranchiseEarned: number;
    highestCombo: number;
    eventsCompleted: number;
    playTimeSeconds: number;
    prestigeCount: [number, number, number];  // [bean, roast, franchise]
  };
  prestigeStats: PrestigeStats;

  // Active gameplay
  combo: ComboState;
  activeEvents: ActiveEvent[];

  // Timing
  lastTick: number;
  lastCollected: number;
  sessionStart: number;

  // $NOUN specific
  stakedNoun: number;
  lastDailySpin: number;
  dailyStreak: number;
}

// ===================
// GAME CONSTANTS
// ===================

export const SHOP_TIERS: ShopTier[] = [
  { level: 0, name: 'Coffee Cart', baseProduction: 1, unlockCost: 0, unlockCurrency: 'beans' },
  { level: 1, name: 'Kiosk', baseProduction: 5, unlockCost: 1000, unlockCurrency: 'beans' },
  { level: 2, name: 'Café', baseProduction: 25, unlockCost: 10000, unlockCurrency: 'beans' },
  { level: 3, name: 'Roastery', baseProduction: 100, unlockCost: 100, unlockCurrency: 'roastPoints' },
  { level: 4, name: 'Chain', baseProduction: 500, unlockCost: 1000, unlockCurrency: 'roastPoints' },
  { level: 5, name: 'Empire HQ', baseProduction: 2500, unlockCost: 100, unlockCurrency: 'franchiseTokens' },
];

export const UPGRADES: Upgrade[] = [
  // === PRODUCTION UPGRADES (Beans) ===
  {
    id: 'better_beans',
    name: 'Premium Beans',
    description: '+50% production per level',
    category: 'production',
    maxLevel: 25,
    baseCost: 50,
    costMultiplier: 1.4,
    currency: 'beans',
    effect: { type: 'multiply_production', value: 1.5, scaling: 'exponential' },
    icon: '🫘'
  },
  {
    id: 'grinder',
    name: 'Burr Grinder',
    description: '+10 beans/sec per level',
    category: 'production',
    maxLevel: 20,
    baseCost: 100,
    costMultiplier: 1.5,
    currency: 'beans',
    effect: { type: 'add_production', value: 10 },
    icon: '⚙️'
  },
  {
    id: 'espresso_machine',
    name: 'Espresso Machine',
    description: '+100 beans/sec per level',
    category: 'production',
    maxLevel: 10,
    baseCost: 1000,
    costMultiplier: 2.0,
    currency: 'beans',
    effect: { type: 'add_production', value: 100 },
    requires: [{ upgradeId: 'grinder', level: 5 }],
    icon: '☕'
  },

  // === TAP UPGRADES (Beans) ===
  {
    id: 'finger_strength',
    name: 'Finger Strength',
    description: '+1 beans per tap',
    category: 'production',
    maxLevel: 50,
    baseCost: 25,
    costMultiplier: 1.3,
    currency: 'beans',
    effect: { type: 'add_tap', value: 1 },
    icon: '👆'
  },
  {
    id: 'double_shot',
    name: 'Double Shot',
    description: '2x tap power',
    category: 'production',
    maxLevel: 10,
    baseCost: 500,
    costMultiplier: 2.5,
    currency: 'beans',
    effect: { type: 'multiply_tap', value: 2, scaling: 'exponential' },
    requires: [{ upgradeId: 'finger_strength', level: 10 }],
    icon: '✌️'
  },

  // === AUTOMATION UPGRADES (Beans) ===
  {
    id: 'auto_drip',
    name: 'Auto Drip',
    description: 'Auto-tap 1/sec per level',
    category: 'automation',
    maxLevel: 10,
    baseCost: 2000,
    costMultiplier: 2.0,
    currency: 'beans',
    effect: { type: 'auto_tap', value: 1 },
    icon: '🤖'
  },

  // === COMBO UPGRADES (Beans) ===
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: '+10% combo multiplier cap',
    category: 'special',
    maxLevel: 20,
    baseCost: 500,
    costMultiplier: 1.8,
    currency: 'beans',
    effect: { type: 'combo_bonus', value: 0.1 },
    icon: '🔥'
  },
  {
    id: 'critical_beans',
    name: 'Critical Beans',
    description: '+2% critical tap chance (10x)',
    category: 'special',
    maxLevel: 25,
    baseCost: 750,
    costMultiplier: 1.6,
    currency: 'beans',
    effect: { type: 'critical_chance', value: 0.02 },
    icon: '💥'
  },

  // === ROAST POINT UPGRADES ===
  {
    id: 'roast_multiplier',
    name: 'Master Roaster',
    description: '+25% all production',
    category: 'production',
    maxLevel: 50,
    baseCost: 10,
    costMultiplier: 1.5,
    currency: 'roastPoints',
    effect: { type: 'multiply_production', value: 1.25, scaling: 'exponential' },
    icon: '🔥'
  },
  {
    id: 'offline_roast',
    name: 'Night Roast',
    description: '+20% offline earnings',
    category: 'passive',
    maxLevel: 25,
    baseCost: 25,
    costMultiplier: 1.4,
    currency: 'roastPoints',
    effect: { type: 'offline_multiplier', value: 0.2 },
    icon: '🌙'
  },
  {
    id: 'prestige_boost',
    name: 'Legacy Beans',
    description: '+10% prestige bonus',
    category: 'special',
    maxLevel: 50,
    baseCost: 50,
    costMultiplier: 1.3,
    currency: 'roastPoints',
    effect: { type: 'prestige_bonus', value: 0.1 },
    icon: '⭐'
  },

  // === FRANCHISE TOKEN UPGRADES ===
  {
    id: 'global_brand',
    name: 'Global Brand',
    description: '2x all production',
    category: 'production',
    maxLevel: 20,
    baseCost: 5,
    costMultiplier: 2.0,
    currency: 'franchiseTokens',
    effect: { type: 'multiply_production', value: 2, scaling: 'exponential' },
    icon: '🌍'
  },
  {
    id: 'franchise_automation',
    name: 'Corporate AI',
    description: 'Auto-tap 10/sec per level',
    category: 'automation',
    maxLevel: 10,
    baseCost: 10,
    costMultiplier: 2.5,
    currency: 'franchiseTokens',
    effect: { type: 'auto_tap', value: 10 },
    icon: '🤖'
  },

  // === $NOUN UPGRADES (Premium) ===
  {
    id: 'noun_blessing',
    name: 'Noun Blessing',
    description: 'Permanent 2x multiplier',
    category: 'special',
    maxLevel: 5,
    baseCost: 10,
    costMultiplier: 5.0,
    currency: 'nounTokens',
    effect: { type: 'multiply_production', value: 2, scaling: 'exponential' },
    icon: '⌐◨-◨'
  },
  {
    id: 'noun_luck',
    name: 'Noun Luck',
    description: '+5% event spawn rate',
    category: 'special',
    maxLevel: 10,
    baseCost: 5,
    costMultiplier: 2.0,
    currency: 'nounTokens',
    effect: { type: 'special', value: 0.05 },
    icon: '🍀'
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  // Early game
  { id: 'first_bean', name: 'First Bean', description: 'Tap for the first time', icon: '🫘', requirement: { type: 'taps', value: 1 }, reward: { type: 'beans', amount: 10 } },
  { id: 'hundred_taps', name: 'Caffeine Fingers', description: 'Tap 100 times', icon: '👆', requirement: { type: 'taps', value: 100 }, reward: { type: 'beans', amount: 100 } },
  { id: 'thousand_taps', name: 'Tap Master', description: 'Tap 1,000 times', icon: '🔥', requirement: { type: 'taps', value: 1000 }, reward: { type: 'beans', amount: 1000 } },

  // Bean milestones
  { id: 'beans_1k', name: 'Bean Counter', description: 'Earn 1,000 beans', icon: '🫘', requirement: { type: 'beans_earned', value: 1000 }, reward: { type: 'beans', amount: 500 } },
  { id: 'beans_100k', name: 'Bean Baron', description: 'Earn 100,000 beans', icon: '👑', requirement: { type: 'beans_earned', value: 100000 }, reward: { type: 'beans', amount: 10000 } },
  { id: 'beans_1m', name: 'Bean Billionaire', description: 'Earn 1,000,000 beans', icon: '💎', requirement: { type: 'beans_earned', value: 1000000 }, reward: { type: 'roastPoints', amount: 10 } },

  // Prestige
  { id: 'first_roast', name: 'First Roast', description: 'Prestige for the first time', icon: '🔥', requirement: { type: 'prestige', value: 1 }, reward: { type: 'roastPoints', amount: 5 } },
  { id: 'roast_master', name: 'Roast Master', description: 'Prestige 10 times', icon: '⭐', requirement: { type: 'prestige', value: 10 }, reward: { type: 'roastPoints', amount: 50 } },

  // Combos
  { id: 'combo_10', name: 'Combo Starter', description: 'Reach a 10x combo', icon: '🔥', requirement: { type: 'combo_reached', value: 10 }, reward: { type: 'beans', amount: 500 } },
  { id: 'combo_50', name: 'Combo King', description: 'Reach a 50x combo', icon: '👑', requirement: { type: 'combo_reached', value: 50 }, reward: { type: 'beans', amount: 5000 } },
  { id: 'combo_100', name: 'Combo Legend', description: 'Reach a 100x combo', icon: '🏆', requirement: { type: 'combo_reached', value: 100 }, reward: { type: 'roastPoints', amount: 25 }, secret: true },

  // Staff
  { id: 'first_hire', name: 'First Hire', description: 'Hire your first staff', icon: '👤', requirement: { type: 'staff_count', value: 1 }, reward: { type: 'beans', amount: 250 } },
  { id: 'full_team', name: 'Full Team', description: 'Hire 5 staff members', icon: '👥', requirement: { type: 'staff_count', value: 5 }, reward: { type: 'roastPoints', amount: 15 } },
];

// Staff templates
export const STAFF_TEMPLATES = [
  { role: 'barista', names: ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery'] },
  { role: 'roaster', names: ['Blaze', 'Ember', 'Ash', 'Phoenix', 'Cinder', 'Flint'] },
  { role: 'manager', names: ['Taylor', 'Cameron', 'Jamie', 'Parker', 'Drew', 'Blake'] },
  { role: 'influencer', names: ['Pixel', 'Noun', 'Vibe', 'Bean', 'Buzz', 'Hype'] },
];

// ===================
// GAME CALCULATIONS
// ===================

export function createInitialStateV2(fid: number): GameStateV2 {
  return {
    version: 2,
    fid,
    currency: {
      beans: 0,
      roastPoints: 0,
      franchiseTokens: 0,
      nounTokens: 0,
    },
    shopTier: 0,
    upgrades: {},
    staff: [],
    achievements: [],
    stats: {
      totalTaps: 0,
      totalBeansEarned: 0,
      totalRoastEarned: 0,
      totalFranchiseEarned: 0,
      highestCombo: 0,
      eventsCompleted: 0,
      playTimeSeconds: 0,
      prestigeCount: [0, 0, 0],
    },
    prestigeStats: {
      totalPrestiges: 0,
      highestBeans: 0,
      highestRoast: 0,
      totalBeansEarned: 0,
    },
    combo: {
      count: 0,
      lastTap: 0,
      multiplier: 1,
    },
    activeEvents: [],
    lastTick: Date.now(),
    lastCollected: Date.now(),
    sessionStart: Date.now(),
    stakedNoun: 0,
    lastDailySpin: 0,
    dailyStreak: 0,
  };
}

export function getUpgradeLevel(state: GameStateV2, upgradeId: string): number {
  return state.upgrades[upgradeId] || 0;
}

export function getUpgradeCost(upgrade: Upgrade, currentLevel: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
}

export function canAffordUpgrade(state: GameStateV2, upgrade: Upgrade): boolean {
  const level = getUpgradeLevel(state, upgrade.id);
  if (level >= upgrade.maxLevel) return false;

  const cost = getUpgradeCost(upgrade, level);

  switch (upgrade.currency) {
    case 'beans': return state.currency.beans >= cost;
    case 'roastPoints': return state.currency.roastPoints >= cost;
    case 'franchiseTokens': return state.currency.franchiseTokens >= cost;
    case 'nounTokens': return state.currency.nounTokens >= cost;
    default: return false;
  }
}

export function meetsUpgradeRequirements(state: GameStateV2, upgrade: Upgrade): boolean {
  if (!upgrade.requires) return true;
  return upgrade.requires.every(req => getUpgradeLevel(state, req.upgradeId) >= req.level);
}

// Calculate base production per second
export function calculateBaseProduction(state: GameStateV2): number {
  const tier = SHOP_TIERS[state.shopTier] || SHOP_TIERS[0];
  let base = tier.baseProduction;

  // Add flat bonuses
  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'add_production') {
      base += upgrade.effect.value * level;
    }
  });

  return base;
}

// Calculate all multipliers
export function calculateMultipliers(state: GameStateV2): number {
  let mult = 1;

  // Upgrade multipliers
  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'multiply_production') {
      if (upgrade.effect.scaling === 'exponential') {
        mult *= Math.pow(upgrade.effect.value, level);
      } else {
        mult *= 1 + (upgrade.effect.value - 1) * level;
      }
    }
  });

  // Staff bonuses
  state.staff.forEach(s => {
    mult *= 1 + s.bonus;
  });

  // Staked $NOUN bonus (1% per staked token)
  mult *= 1 + state.stakedNoun * 0.01;

  // Active event multipliers
  state.activeEvents.forEach(event => {
    mult *= event.multiplier;
  });

  // Prestige bonuses
  mult *= 1 + state.stats.prestigeCount[0] * 0.1; // +10% per bean prestige
  mult *= 1 + state.stats.prestigeCount[1] * 0.25; // +25% per roast prestige
  mult *= 1 + state.stats.prestigeCount[2] * 0.5; // +50% per franchise prestige

  return mult;
}

// Calculate total production per second
export function calculateProduction(state: GameStateV2): number {
  return Math.floor(calculateBaseProduction(state) * calculateMultipliers(state));
}

// Calculate tap value
export function calculateTapValue(state: GameStateV2): number {
  let base = 1;
  let mult = 1;

  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0) {
      if (upgrade.effect.type === 'add_tap') {
        base += upgrade.effect.value * level;
      } else if (upgrade.effect.type === 'multiply_tap') {
        if (upgrade.effect.scaling === 'exponential') {
          mult *= Math.pow(upgrade.effect.value, level);
        } else {
          mult *= 1 + (upgrade.effect.value - 1) * level;
        }
      }
    }
  });

  // Apply combo multiplier
  mult *= state.combo.multiplier;

  // Apply general multipliers
  mult *= calculateMultipliers(state);

  return Math.floor(base * mult);
}

// Calculate auto-tap per second
export function calculateAutoTap(state: GameStateV2): number {
  let autoTaps = 0;

  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'auto_tap') {
      autoTaps += upgrade.effect.value * level;
    }
  });

  return autoTaps;
}

// Calculate critical chance
export function calculateCritChance(state: GameStateV2): number {
  let chance = 0;

  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'critical_chance') {
      chance += upgrade.effect.value * level;
    }
  });

  return Math.min(chance, 0.5); // Cap at 50%
}

// Calculate max combo multiplier
export function calculateMaxCombo(state: GameStateV2): number {
  let max = 10; // Base max combo

  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'combo_bonus') {
      max += upgrade.effect.value * level * 100; // +10% per level
    }
  });

  return max;
}

// Calculate offline multiplier
export function calculateOfflineMultiplier(state: GameStateV2): number {
  let mult = 0.25; // Base 25% offline

  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'offline_multiplier') {
      mult += upgrade.effect.value * level;
    }
  });

  return Math.min(mult, 1.0); // Cap at 100%
}

// Calculate prestige currency earned
export function calculatePrestigeGain(state: GameStateV2, prestigeLevel: 0 | 1 | 2): number {
  let baseAmount = 0;

  if (prestigeLevel === 0) {
    // Beans → Roast Points
    // Gain 1 roast point per 10,000 beans earned this run
    baseAmount = Math.floor(state.stats.totalBeansEarned / 10000);
  } else if (prestigeLevel === 1) {
    // Roast → Franchise
    // Gain 1 franchise token per 1,000 roast points
    baseAmount = Math.floor(state.currency.roastPoints / 1000);
  } else {
    // Franchise → Empire (not implemented yet)
    baseAmount = 0;
  }

  // Apply prestige bonus upgrades
  let mult = 1;
  UPGRADES.forEach(upgrade => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level > 0 && upgrade.effect.type === 'prestige_bonus') {
      mult += upgrade.effect.value * level;
    }
  });

  return Math.floor(baseAmount * mult);
}

// Update combo state
export function updateCombo(state: GameStateV2): ComboState {
  const now = Date.now();
  const timeSinceLast = now - state.combo.lastTap;

  // Combo breaks after 1 second
  if (timeSinceLast > 1000) {
    return { count: 1, lastTap: now, multiplier: 1 };
  }

  const newCount = state.combo.count + 1;
  const maxMult = calculateMaxCombo(state);

  // Multiplier scales: 1 + (count / 10), capped at max
  const newMult = Math.min(1 + newCount * 0.1, maxMult);

  return { count: newCount, lastTap: now, multiplier: newMult };
}

// Calculate idle earnings
export function calculateIdleEarnings(state: GameStateV2): number {
  const now = Date.now();
  const secondsElapsed = Math.floor((now - state.lastCollected) / 1000);

  // Cap at 8 hours (28800 seconds)
  const maxSeconds = 28800;
  const effectiveSeconds = Math.min(secondsElapsed, maxSeconds);

  const production = calculateProduction(state);
  const offlineMult = calculateOfflineMultiplier(state);

  return Math.floor(effectiveSeconds * production * offlineMult);
}

// Generate random staff
export function generateStaff(role: Staff['role'], glassesStyle?: number): Staff {
  const templates = STAFF_TEMPLATES.find(t => t.role === role);
  const names = templates?.names || ['Buddy'];
  const name = names[Math.floor(Math.random() * names.length)];

  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    role,
    level: 1,
    xp: 0,
    glassesStyle: glassesStyle ?? Math.floor(Math.random() * 10),
    skinTone: Math.floor(Math.random() * 5),
    bonus: role === 'barista' ? 0.05 : role === 'roaster' ? 0.1 : role === 'manager' ? 0.15 : 0.2,
  };
}

// Get staff hire cost
export function getStaffCost(state: GameStateV2, role: Staff['role']): { currency: keyof Currency; amount: number } {
  const staffOfType = state.staff.filter(s => s.role === role).length;

  switch (role) {
    case 'barista':
      return { currency: 'beans', amount: Math.floor(1000 * Math.pow(2, staffOfType)) };
    case 'roaster':
      return { currency: 'roastPoints', amount: Math.floor(50 * Math.pow(2, staffOfType)) };
    case 'manager':
      return { currency: 'franchiseTokens', amount: Math.floor(10 * Math.pow(2, staffOfType)) };
    case 'influencer':
      return { currency: 'nounTokens', amount: Math.floor(5 * Math.pow(2, staffOfType)) };
  }
}

// Check if achievement is unlocked
export function checkAchievement(state: GameStateV2, achievement: Achievement): boolean {
  if (state.achievements.includes(achievement.id)) return false;

  const req = achievement.requirement;
  switch (req.type) {
    case 'taps': return state.stats.totalTaps >= req.value;
    case 'beans_earned': return state.stats.totalBeansEarned >= req.value;
    case 'prestige': return state.stats.prestigeCount[0] >= req.value;
    case 'staff_count': return state.staff.length >= req.value;
    case 'combo_reached': return state.stats.highestCombo >= req.value;
    case 'events_completed': return state.stats.eventsCompleted >= req.value;
    default: return false;
  }
}

// Format large numbers
export function formatNumber(n: number): string {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

// Short format for UI
export function formatShort(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return Math.floor(n).toString();
}
