// ============================================
// NOUN IDLE - DEEP PROGRESSION SYSTEM
// ============================================
// Prestige Layers: Franchises → Empires → Dynasties
// Unlockable: Drinks, Customers, Upgrades, Achievements
// ============================================

// A customer waiting in line (no drink assigned yet)
export interface WaitingCustomer {
  id: string
  customerName: string
  customerEmoji: string
  customerType: string  // 'Regular', 'Student', etc.
  valueMultiplier: number
  patience: number      // Current patience (decreases over time)
  maxPatience: number   // Starting patience
  arrivedAt: number     // Timestamp
  isRegular?: boolean   // Is this a returning regular?
  preferredDrink?: string  // If regular, what's their usual?
}

// An order being worked on (drink has been selected)
export interface Order {
  id: string
  customerName: string
  customerEmoji: string
  drink: string
  drinkEmoji: string
  value: number
  workRequired: number
  workDone: number
  isSpecial?: boolean
  wasRegular?: boolean      // Was this customer a regular?
  gotPreferred?: boolean    // Did they get their preferred drink?
}

// Track regular customers
export interface Regular {
  name: string
  visitsCount: number
  favoriteDrink: string      // The drink they order most
  drinkCounts: Record<string, number>  // Track all drinks they've had
  lastVisit: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  emoji: string
  requirement: (state: GameState) => boolean
  bonus: number  // Permanent multiplier bonus
  bonusType: 'value' | 'speed' | 'work'
}

export interface GameState {
  // Currency
  beans: number
  lifetimeBeans: number
  totalLifetimeBeans: number  // Never resets, used for unlocks

  // The Pipeline (new system)
  waitingCustomers: WaitingCustomer[]  // Customers in line, no drink yet
  currentOrder: Order | null            // Order being worked on

  // Legacy (for migration) - will be removed
  orderQueue?: Order[]

  // Stats
  ordersCompleted: number
  totalOrdersCompleted: number  // Never resets
  customersLost: number  // Customers who left due to impatience

  // Recipe Mastery - tracks how many of each drink made
  drinksMade: Record<string, number>

  // Regulars - customers who keep coming back
  regulars: Record<string, Regular>

  // Upgrade levels (for cost calculation)
  upgradeLevels: {
    // Tier 1 - Basic
    tapPower: number
    baristas: number
    orderValue: number
    serviceSpeed: number
    customerRate: number
    // Tier 2 - Advanced (unlocks at Franchise 1)
    doubleShot: number      // Chance for 2x work per tap
    tippingCulture: number  // Chance for tips
    expressLine: number     // Second order slot
    // Tier 3 - Elite (unlocks at Empire 1)
    masterBarista: number   // Baristas 2x effective
    vipLounge: number       // Special customers appear
    coffeeEmpire: number    // Passive income even with no orders
  }

  // Derived stats (calculated from upgrades)
  tapPower: number
  baristas: number

  // Prestige Layer 1: Franchises
  franchises: number
  franchiseBonus: number

  // Prestige Layer 2: Empires (resets franchises)
  empires: number
  empireBonus: number

  // Prestige Layer 3: Dynasties (resets empires)
  dynasties: number
  dynastyBonus: number

  // Achievements
  unlockedAchievements: string[]

  // Timestamps
  lastUpdate: number
  lastCustomerTime: number
}

// ============================================
// DRINKS - Unlock at order milestones
// ============================================

export interface DrinkType {
  drink: string
  emoji: string
  baseValue: number
  baseWork: number
  unlocksAt: number  // Orders completed to unlock
  origin?: string
  notes?: string
  description?: string
}

export const ALL_DRINKS: DrinkType[] = [
  // Starting drinks - POUROVERS
  {
    drink: 'Easy Drinker',
    emoji: '☕',
    baseValue: 5,
    baseWork: 10,
    unlocksAt: 0,
    origin: 'Colombia | Washed | Opal',
    notes: 'Honeydew, lemongrass, pluot',
    description: 'Served hot or iced'
  },
  {
    drink: 'The Usual',
    emoji: '🥛',
    baseValue: 8,
    baseWork: 12,
    unlocksAt: 0,
    description: 'Espresso dulce + brown sugar + milk. Served hot or iced'
  },
  // Unlock at 25 orders
  {
    drink: 'Crowd Pleaser',
    emoji: '🫖',
    baseValue: 10,
    baseWork: 15,
    unlocksAt: 25,
    origin: 'Ethiopia | Washed',
    notes: 'Mandarin, raspberry, black tea',
    description: 'Served hot or iced'
  },
  {
    drink: 'Gold Rush',
    emoji: '✨',
    baseValue: 12,
    baseWork: 18,
    unlocksAt: 25,
    description: 'Espresso dulce + warming spice blend + milk. Served cappuccino style, hot or iced'
  },
  // Unlock at 100 orders
  {
    drink: 'Short Stack',
    emoji: '🧇',
    baseValue: 15,
    baseWork: 20,
    unlocksAt: 100,
    description: 'Chilled espresso dulce + maple cream + milk + maldon salt + ice. Served cappuccino style, iced'
  },
  {
    drink: 'Wildcard',
    emoji: '🎰',
    baseValue: 18,
    baseWork: 22,
    unlocksAt: 100,
    origin: 'Colombia | Co-ferment | Black and White',
    notes: 'Peach ring, sweet tart, grape candy',
    description: 'Served hot or iced'
  },
  // Unlock at 500 orders
  {
    drink: 'Mint & Midnight',
    emoji: '🌙',
    baseValue: 22,
    baseWork: 25,
    unlocksAt: 500,
    description: 'Espresso + raw cacao mocha + candy cane milk. Served hot or iced'
  },
  {
    drink: 'Fridge Cigarette',
    emoji: '🥤',
    baseValue: 25,
    baseWork: 28,
    unlocksAt: 500,
    description: 'Chilled espresso + diet coke + ice. Served iced'
  },
]

export function getUnlockedDrinks(totalOrders: number): DrinkType[] {
  return ALL_DRINKS.filter(d => d.unlocksAt <= totalOrders)
}

export function getNextDrinkUnlock(totalOrders: number): DrinkType | null {
  const locked = ALL_DRINKS.filter(d => d.unlocksAt > totalOrders)
  if (locked.length === 0) return null
  return locked.reduce((min, d) => d.unlocksAt < min.unlocksAt ? d : min)
}

// ============================================
// CUSTOMERS - Unlock at milestones
// ============================================

export interface CustomerType {
  name: string
  emoji: string
  valueMultiplier: number
  patience: number  // Base patience in seconds
  unlocksAt: { type: 'orders' | 'franchises' | 'empires', count: number }
}

export const ALL_CUSTOMERS: CustomerType[] = [
  // Starting customers - patience varies by type
  { name: 'Regular', emoji: '🧑', valueMultiplier: 1, patience: 30, unlocksAt: { type: 'orders', count: 0 } },
  { name: 'Student', emoji: '👩‍🎓', valueMultiplier: 0.8, patience: 45, unlocksAt: { type: 'orders', count: 0 } },  // Patient, less money
  { name: 'Worker', emoji: '👨‍💼', valueMultiplier: 1.1, patience: 20, unlocksAt: { type: 'orders', count: 0 } },  // Rushed, more money
  // Unlock with progress
  { name: 'Foodie', emoji: '🧔', valueMultiplier: 1.3, patience: 40, unlocksAt: { type: 'orders', count: 200 } },
  { name: 'Influencer', emoji: '💁‍♀️', valueMultiplier: 1.5, patience: 25, unlocksAt: { type: 'orders', count: 500 } },  // Impatient
  { name: 'Executive', emoji: '👩‍💼', valueMultiplier: 2.0, patience: 15, unlocksAt: { type: 'franchises', count: 1 } },  // Very rushed
  { name: 'Celebrity', emoji: '🤩', valueMultiplier: 3.0, patience: 20, unlocksAt: { type: 'franchises', count: 3 } },
  { name: 'Royalty', emoji: '🤴', valueMultiplier: 5.0, patience: 35, unlocksAt: { type: 'empires', count: 1 } },  // Expects good service, patient
  { name: 'Billionaire', emoji: '🧐', valueMultiplier: 10.0, patience: 12, unlocksAt: { type: 'empires', count: 3 } },  // Time is money
]

// How many visits before someone becomes a Regular
export const VISITS_TO_BECOME_REGULAR = 5
// Bonus multiplier for serving a regular their preferred drink
export const REGULAR_PREFERRED_BONUS = 2.0
// Penalty multiplier for giving a regular the wrong drink
export const REGULAR_WRONG_PENALTY = 0.5

export const CUSTOMER_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Quinn',
  'Avery', 'Blake', 'Charlie', 'Drew', 'Finn', 'Harper', 'Jamie', 'Kelly',
  'Luna', 'Max', 'Nova', 'Sage', 'River', 'Sky', 'Phoenix', 'Rowan',
]

export function getUnlockedCustomers(state: GameState): CustomerType[] {
  return ALL_CUSTOMERS.filter(c => {
    if (c.unlocksAt.type === 'orders') return state.totalOrdersCompleted >= c.unlocksAt.count
    if (c.unlocksAt.type === 'franchises') return state.franchises >= c.unlocksAt.count
    if (c.unlocksAt.type === 'empires') return state.empires >= c.unlocksAt.count
    return false
  })
}

// ============================================
// UPGRADES - Tiered system
// ============================================

export type UpgradeId = keyof GameState['upgradeLevels']

export interface Upgrade {
  id: UpgradeId
  name: string
  description: string
  emoji: string
  tier: 1 | 2 | 3
  baseCost: number
  costMultiplier: number
  baseNounCost: number
  nounCostMultiplier: number
  maxLevel: number
  getEffect: (level: number) => string
}

export const UPGRADES: Upgrade[] = [
  // ========== TIER 1 - Basic (always available) ==========
  {
    id: 'tapPower',
    name: 'Faster Hands',
    description: 'Each tap does more work',
    emoji: '✋',
    tier: 1,
    baseCost: 15,
    costMultiplier: 1.4,
    baseNounCost: 1000,
    nounCostMultiplier: 1.15,
    maxLevel: 100,
    getEffect: (level) => `+${1 + level} per tap`,
  },
  {
    id: 'baristas',
    name: 'Hire Barista',
    description: 'Baristas auto-complete orders',
    emoji: '👨‍🍳',
    tier: 1,
    baseCost: 50,
    costMultiplier: 1.8,
    baseNounCost: 5000,
    nounCostMultiplier: 1.2,
    maxLevel: 50,
    getEffect: (level) => `${level} barista${level !== 1 ? 's' : ''} working`,
  },
  {
    id: 'orderValue',
    name: 'Premium Beans',
    description: 'Use more beans per drink',
    emoji: '✨',
    tier: 1,
    baseCost: 100,
    costMultiplier: 1.5,
    baseNounCost: 10000,
    nounCostMultiplier: 1.15,
    maxLevel: 50,
    getEffect: (level) => `+${level * 20}% beans per order`,
  },
  {
    id: 'serviceSpeed',
    name: 'Better Equipment',
    description: 'Orders require less work',
    emoji: '⚡',
    tier: 1,
    baseCost: 75,
    costMultiplier: 1.6,
    baseNounCost: 8000,
    nounCostMultiplier: 1.15,
    maxLevel: 30,
    getEffect: (level) => `-${level * 5}% work needed`,
  },
  {
    id: 'customerRate',
    name: 'Marketing',
    description: 'Customers arrive faster',
    emoji: '📢',
    tier: 1,
    baseCost: 200,
    costMultiplier: 2.0,
    baseNounCost: 20000,
    nounCostMultiplier: 1.2,
    maxLevel: 20,
    getEffect: (level) => `+${level * 6}% more customers`,
  },

  // ========== TIER 2 - Advanced (unlock at Franchise 1) ==========
  {
    id: 'doubleShot',
    name: 'Double Shot',
    description: 'Chance for 2x work per tap',
    emoji: '💪',
    tier: 2,
    baseCost: 5000,
    costMultiplier: 1.8,
    baseNounCost: 50000,
    nounCostMultiplier: 1.2,
    maxLevel: 25,
    getEffect: (level) => `${level * 4}% chance 2x tap`,
  },
  {
    id: 'tippingCulture',
    name: 'Tip Jar',
    description: 'Chance for bonus tips',
    emoji: '💵',
    tier: 2,
    baseCost: 8000,
    costMultiplier: 1.7,
    baseNounCost: 80000,
    nounCostMultiplier: 1.15,
    maxLevel: 20,
    getEffect: (level) => `${level * 5}% tip chance`,
  },
  {
    id: 'expressLine',
    name: 'Express Line',
    description: 'Longer customer queue',
    emoji: '🚀',
    tier: 2,
    baseCost: 10000,
    costMultiplier: 2.5,
    baseNounCost: 100000,
    nounCostMultiplier: 1.3,
    maxLevel: 10,
    getEffect: (level) => `${8 + level * 2} queue slots`,
  },

  // ========== TIER 3 - Elite (unlock at Empire 1) ==========
  {
    id: 'masterBarista',
    name: 'Master Baristas',
    description: 'Baristas are 2x more effective',
    emoji: '🏆',
    tier: 3,
    baseCost: 1000000,
    costMultiplier: 2.0,
    baseNounCost: 500000,
    nounCostMultiplier: 1.25,
    maxLevel: 10,
    getEffect: (level) => `Baristas ${1 + level}x effective`,
  },
  {
    id: 'vipLounge',
    name: 'VIP Lounge',
    description: 'Special customers appear more',
    emoji: '🎩',
    tier: 3,
    baseCost: 2000000,
    costMultiplier: 2.2,
    baseNounCost: 1000000,
    nounCostMultiplier: 1.3,
    maxLevel: 10,
    getEffect: (level) => `+${level * 10}% VIP chance`,
  },
  {
    id: 'coffeeEmpire',
    name: 'Coffee Empire',
    description: 'Earn beans even with no orders',
    emoji: '🏰',
    tier: 3,
    baseCost: 5000000,
    costMultiplier: 2.5,
    baseNounCost: 2000000,
    nounCostMultiplier: 1.35,
    maxLevel: 10,
    getEffect: (level) => `+${level * 10} beans/sec passive`,
  },
]

export function getUnlockedUpgrades(state: GameState): Upgrade[] {
  return UPGRADES.filter(u => {
    if (u.tier === 1) return true
    if (u.tier === 2) return state.franchises >= 1 || state.empires >= 1 || state.dynasties >= 1
    if (u.tier === 3) return state.empires >= 1 || state.dynasties >= 1
    return false
  })
}

export function getUpgradeCost(upgrade: Upgrade, level: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level))
}

export function getUpgradeNounCost(upgrade: Upgrade, level: number): number {
  return Math.floor(upgrade.baseNounCost * Math.pow(upgrade.nounCostMultiplier, level))
}

// ============================================
// PRESTIGE SYSTEMS
// ============================================

// Layer 1: Franchises
export const FRANCHISE_MILESTONES = [
  { beans: 10000, bonus: 0.25, name: 'Second Location', emoji: '🏪' },
  { beans: 100000, bonus: 0.5, name: 'Downtown Shop', emoji: '🏙️' },
  { beans: 1000000, bonus: 1.0, name: 'Airport Kiosk', emoji: '✈️' },
  { beans: 10000000, bonus: 2.0, name: 'Hotel Chain', emoji: '🏨' },
  { beans: 100000000, bonus: 4.0, name: 'National Brand', emoji: '🗺️' },
]

// Layer 2: Empires (reset franchises for bigger bonuses)
export const EMPIRE_MILESTONES = [
  { franchises: 5, bonus: 2.0, name: 'Coffee Empire', emoji: '🌍' },
  { franchises: 5, bonus: 4.0, name: 'Global Dominance', emoji: '🌐' },
  { franchises: 5, bonus: 8.0, name: 'Interstellar Cafe', emoji: '🚀' },
  { franchises: 5, bonus: 16.0, name: 'Galactic Roasters', emoji: '🌌' },
  { franchises: 5, bonus: 32.0, name: 'Universal Bean', emoji: '✨' },
]

// Layer 3: Dynasties (reset empires for even bigger bonuses)
export const DYNASTY_MILESTONES = [
  { empires: 5, bonus: 10.0, name: 'Coffee Dynasty', emoji: '👑' },
  { empires: 5, bonus: 25.0, name: 'Eternal Brew', emoji: '♾️' },
  { empires: 5, bonus: 50.0, name: 'Transcendent Roast', emoji: '🔮' },
  { empires: 5, bonus: 100.0, name: 'Cosmic Blend', emoji: '💫' },
  { empires: 5, bonus: 200.0, name: 'Omnipresent Cafe', emoji: '🌟' },
]

export function getNextFranchise(state: GameState) {
  if (state.franchises >= FRANCHISE_MILESTONES.length) return null
  return FRANCHISE_MILESTONES[state.franchises]
}

export function getNextEmpire(state: GameState) {
  if (state.empires >= EMPIRE_MILESTONES.length) return null
  return EMPIRE_MILESTONES[state.empires]
}

export function getNextDynasty(state: GameState) {
  if (state.dynasties >= DYNASTY_MILESTONES.length) return null
  return DYNASTY_MILESTONES[state.dynasties]
}

export function canPrestigeFranchise(state: GameState): boolean {
  const next = getNextFranchise(state)
  if (!next) return false
  return state.lifetimeBeans >= next.beans
}

export function canPrestigeEmpire(state: GameState): boolean {
  const next = getNextEmpire(state)
  if (!next) return false
  return state.franchises >= next.franchises
}

export function canPrestigeDynasty(state: GameState): boolean {
  const next = getNextDynasty(state)
  if (!next) return false
  return state.empires >= next.empires
}

// ============================================
// ACHIEVEMENTS
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  // Order milestones
  { id: 'orders_100', name: 'Getting Started', description: 'Complete 100 orders', emoji: '📦', requirement: (s) => s.totalOrdersCompleted >= 100, bonus: 0.1, bonusType: 'value' },
  { id: 'orders_1000', name: 'Busy Barista', description: 'Complete 1,000 orders', emoji: '☕', requirement: (s) => s.totalOrdersCompleted >= 1000, bonus: 0.2, bonusType: 'value' },
  { id: 'orders_10000', name: 'Coffee Master', description: 'Complete 10,000 orders', emoji: '🏆', requirement: (s) => s.totalOrdersCompleted >= 10000, bonus: 0.5, bonusType: 'value' },
  { id: 'orders_100000', name: 'Legendary Barista', description: 'Complete 100,000 orders', emoji: '👑', requirement: (s) => s.totalOrdersCompleted >= 100000, bonus: 1.0, bonusType: 'value' },

  // Bean milestones
  { id: 'beans_1m', name: 'Millionaire', description: 'Earn 1M lifetime beans', emoji: '💰', requirement: (s) => s.totalLifetimeBeans >= 1000000, bonus: 0.15, bonusType: 'value' },
  { id: 'beans_1b', name: 'Billionaire', description: 'Earn 1B lifetime beans', emoji: '🏦', requirement: (s) => s.totalLifetimeBeans >= 1000000000, bonus: 0.5, bonusType: 'value' },

  // Prestige milestones
  { id: 'franchise_1', name: 'Franchise Owner', description: 'Open your first franchise', emoji: '🏪', requirement: (s) => s.franchises >= 1, bonus: 0.25, bonusType: 'value' },
  { id: 'empire_1', name: 'Empire Builder', description: 'Build your first empire', emoji: '🌍', requirement: (s) => s.empires >= 1, bonus: 0.5, bonusType: 'value' },
  { id: 'dynasty_1', name: 'Dynasty Founder', description: 'Found your first dynasty', emoji: '👑', requirement: (s) => s.dynasties >= 1, bonus: 1.0, bonusType: 'value' },

  // Speed achievements
  { id: 'baristas_10', name: 'Full Staff', description: 'Hire 10 baristas', emoji: '👨‍🍳', requirement: (s) => s.upgradeLevels.baristas >= 10, bonus: 0.1, bonusType: 'speed' },
  { id: 'baristas_50', name: 'Coffee Army', description: 'Hire 50 baristas', emoji: '⚔️', requirement: (s) => s.upgradeLevels.baristas >= 50, bonus: 0.25, bonusType: 'speed' },
]

export function getAchievementBonus(state: GameState, bonusType: 'value' | 'speed' | 'work'): number {
  let bonus = 0
  for (const achievement of ACHIEVEMENTS) {
    if (state.unlockedAchievements.includes(achievement.id) && achievement.bonusType === bonusType) {
      bonus += achievement.bonus
    }
  }
  return bonus
}

export function checkNewAchievements(state: GameState): Achievement[] {
  const newAchievements: Achievement[] = []
  for (const achievement of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.includes(achievement.id) && achievement.requirement(state)) {
      newAchievements.push(achievement)
    }
  }
  return newAchievements
}

// ============================================
// CUSTOMER GENERATION (New System)
// ============================================

// Generate a customer who arrives and waits (no drink yet)
export function generateCustomer(state: GameState, customNames: string[] = []): WaitingCustomer {
  const unlockedCustomers = getUnlockedCustomers(state)

  // Pick random customer type
  const customerType = unlockedCustomers[Math.floor(Math.random() * unlockedCustomers.length)]

  // Pick random name
  const allNames = [...CUSTOMER_NAMES, ...customNames]
  const customerName = allNames[Math.floor(Math.random() * allNames.length)]

  // Check if this person is a known regular
  const regular = state.regulars[customerName]
  const isRegular = regular && regular.visitsCount >= VISITS_TO_BECOME_REGULAR

  return {
    id: `customer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerName,
    customerEmoji: customerType.emoji,
    customerType: customerType.name,
    valueMultiplier: customerType.valueMultiplier,
    patience: customerType.patience,
    maxPatience: customerType.patience,
    arrivedAt: Date.now(),
    isRegular,
    preferredDrink: isRegular ? regular.favoriteDrink : undefined,
  }
}

// Create an order from a waiting customer after drink is selected
export function createOrderFromCustomer(
  customer: WaitingCustomer,
  drink: DrinkType,
  state: GameState
): Order {
  // Calculate value multipliers
  const achievementBonus = getAchievementBonus(state, 'value')
  const masteryBonus = getMasteryBonus(state, drink.drink)
  const baseMultiplier = 1 + (state.upgradeLevels.orderValue * 0.2) +
    state.franchiseBonus + state.empireBonus + state.dynastyBonus + achievementBonus + masteryBonus

  // Check if this is a regular getting their preferred drink
  const gotPreferred = customer.isRegular && customer.preferredDrink === drink.drink
  const gotWrong = customer.isRegular && customer.preferredDrink !== drink.drink

  // Apply regular bonus/penalty
  let regularMultiplier = 1
  if (gotPreferred) {
    regularMultiplier = REGULAR_PREFERRED_BONUS
  } else if (gotWrong) {
    regularMultiplier = REGULAR_WRONG_PENALTY
  }

  const valueMultiplier = baseMultiplier * customer.valueMultiplier * regularMultiplier
  const workReduction = 1 - (state.upgradeLevels.serviceSpeed * 0.05)

  const isSpecial = customer.valueMultiplier > 1.5

  return {
    id: customer.id,
    customerName: customer.customerName,
    customerEmoji: customer.customerEmoji,
    drink: drink.drink,
    drinkEmoji: drink.emoji,
    value: Math.floor(drink.baseValue * valueMultiplier),
    workRequired: Math.max(5, Math.floor(drink.baseWork * workReduction)),
    workDone: 0,
    isSpecial,
    wasRegular: customer.isRegular,
    gotPreferred,
  }
}

// Update regulars tracking after serving a customer
export function updateRegulars(
  regulars: Record<string, Regular>,
  customerName: string,
  drinkName: string
): Record<string, Regular> {
  const existing = regulars[customerName]

  if (existing) {
    const newDrinkCounts = {
      ...existing.drinkCounts,
      [drinkName]: (existing.drinkCounts[drinkName] || 0) + 1,
    }

    // Find the most ordered drink
    let favoriteDrink = drinkName
    let maxCount = 0
    for (const [drink, count] of Object.entries(newDrinkCounts)) {
      if (count > maxCount) {
        maxCount = count
        favoriteDrink = drink
      }
    }

    return {
      ...regulars,
      [customerName]: {
        ...existing,
        visitsCount: existing.visitsCount + 1,
        favoriteDrink,
        drinkCounts: newDrinkCounts,
        lastVisit: Date.now(),
      },
    }
  } else {
    // First time customer
    return {
      ...regulars,
      [customerName]: {
        name: customerName,
        visitsCount: 1,
        favoriteDrink: drinkName,
        drinkCounts: { [drinkName]: 1 },
        lastVisit: Date.now(),
      },
    }
  }
}

// Legacy function for backwards compatibility (used by baristas)
export function generateOrder(state: GameState, customNames: string[] = []): Order {
  const customer = generateCustomer(state, customNames)
  const unlockedDrinks = getUnlockedDrinks(state.totalOrdersCompleted)
  const drink = unlockedDrinks[Math.floor(Math.random() * unlockedDrinks.length)]
  return createOrderFromCustomer(customer, drink, state)
}

// ============================================
// INITIAL STATE
// ============================================

export function createInitialState(): GameState {
  return {
    beans: 0,
    lifetimeBeans: 0,
    totalLifetimeBeans: 0,
    waitingCustomers: [],
    currentOrder: null,
    ordersCompleted: 0,
    totalOrdersCompleted: 0,
    customersLost: 0,
    drinksMade: {},
    regulars: {},
    tapPower: 1,
    baristas: 0,
    upgradeLevels: {
      tapPower: 0,
      baristas: 0,
      orderValue: 0,
      serviceSpeed: 0,
      customerRate: 0,
      doubleShot: 0,
      tippingCulture: 0,
      expressLine: 0,
      masterBarista: 0,
      vipLounge: 0,
      coffeeEmpire: 0,
    },
    franchises: 0,
    franchiseBonus: 0,
    empires: 0,
    empireBonus: 0,
    dynasties: 0,
    dynastyBonus: 0,
    unlockedAchievements: [],
    lastUpdate: Date.now(),
    lastCustomerTime: Date.now(),
  }
}

// Reset for franchise prestige
export function resetForFranchise(state: GameState, bonusToAdd: number): GameState {
  return {
    ...createInitialState(),
    totalLifetimeBeans: state.totalLifetimeBeans,
    totalOrdersCompleted: state.totalOrdersCompleted,
    franchises: state.franchises + 1,
    franchiseBonus: state.franchiseBonus + bonusToAdd,
    empires: state.empires,
    empireBonus: state.empireBonus,
    dynasties: state.dynasties,
    dynastyBonus: state.dynastyBonus,
    unlockedAchievements: state.unlockedAchievements,
  }
}

// Reset for empire prestige
export function resetForEmpire(state: GameState, bonusToAdd: number): GameState {
  return {
    ...createInitialState(),
    totalLifetimeBeans: state.totalLifetimeBeans,
    totalOrdersCompleted: state.totalOrdersCompleted,
    franchises: 0,
    franchiseBonus: 0,
    empires: state.empires + 1,
    empireBonus: state.empireBonus + bonusToAdd,
    dynasties: state.dynasties,
    dynastyBonus: state.dynastyBonus,
    unlockedAchievements: state.unlockedAchievements,
  }
}

// Reset for dynasty prestige
export function resetForDynasty(state: GameState, bonusToAdd: number): GameState {
  return {
    ...createInitialState(),
    totalLifetimeBeans: state.totalLifetimeBeans,
    totalOrdersCompleted: state.totalOrdersCompleted,
    franchises: 0,
    franchiseBonus: 0,
    empires: 0,
    empireBonus: 0,
    dynasties: state.dynasties + 1,
    dynastyBonus: state.dynastyBonus + bonusToAdd,
    unlockedAchievements: state.unlockedAchievements,
  }
}

// ============================================
// UTILITIES
// ============================================

export function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.floor(n).toString()
}

export function getMaxQueueSize(state: GameState): number {
  return 8 + (state.upgradeLevels.expressLine * 2)
}

export function getBaristaEffectiveness(state: GameState): number {
  return 1 + state.upgradeLevels.masterBarista
}

export function getOrdersPerMinute(state: GameState): number {
  if (state.baristas === 0) return 0
  const effectiveness = getBaristaEffectiveness(state)
  const avgWork = 15 * (1 - state.upgradeLevels.serviceSpeed * 0.05)
  const workPerMinute = state.baristas * effectiveness * 2 * 60
  return workPerMinute / Math.max(5, avgWork)
}

export function getBeansPerMinute(state: GameState): number {
  const ordersPerMin = getOrdersPerMinute(state)
  const achievementBonus = getAchievementBonus(state, 'value')
  const avgValue = 10 * (1 + state.upgradeLevels.orderValue * 0.2 + state.franchiseBonus + state.empireBonus + state.dynastyBonus + achievementBonus)
  const passiveIncome = state.upgradeLevels.coffeeEmpire * 10 * 60
  return ordersPerMin * avgValue + passiveIncome
}

export function getTotalMultiplier(state: GameState): number {
  const achievementBonus = getAchievementBonus(state, 'value')
  return 1 + state.upgradeLevels.orderValue * 0.2 + state.franchiseBonus + state.empireBonus + state.dynastyBonus + achievementBonus
}

// Cost to add a custom customer name (in $NOUN)
export const CUSTOM_NAME_COST = 100000

// For backwards compatibility
export const MENU = ALL_DRINKS.filter(d => d.unlocksAt === 0)
export const CUSTOMER_EMOJIS = ALL_CUSTOMERS.filter(c => c.unlocksAt.count === 0).map(c => c.emoji)

// ============================================
// RECIPE MASTERY SYSTEM
// ============================================

export interface MasteryTier {
  count: number        // Drinks made to reach this tier
  beanBonus: number    // % bonus beans for this drink
  tierName: string
  emoji: string
}

export const MASTERY_TIERS: MasteryTier[] = [
  { count: 0, beanBonus: 0, tierName: 'Novice', emoji: '⚪' },
  { count: 50, beanBonus: 10, tierName: 'Apprentice', emoji: '🟢' },
  { count: 200, beanBonus: 25, tierName: 'Skilled', emoji: '🔵' },
  { count: 500, beanBonus: 50, tierName: 'Expert', emoji: '🟣' },
  { count: 1000, beanBonus: 100, tierName: 'Master', emoji: '🟡' },
  { count: 5000, beanBonus: 200, tierName: 'Legendary', emoji: '🔴' },
]

export function getMasteryTier(drinksMade: number): MasteryTier {
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (drinksMade >= MASTERY_TIERS[i].count) {
      return MASTERY_TIERS[i]
    }
  }
  return MASTERY_TIERS[0]
}

export function getNextMasteryTier(drinksMade: number): MasteryTier | null {
  for (const tier of MASTERY_TIERS) {
    if (drinksMade < tier.count) {
      return tier
    }
  }
  return null // Max tier reached
}

export function getMasteryBonus(state: GameState, drinkName: string): number {
  const made = state.drinksMade[drinkName] || 0
  const tier = getMasteryTier(made)
  return tier.beanBonus / 100 // Return as multiplier (e.g., 0.25 for 25%)
}

export function getTotalMasteryLevel(state: GameState): number {
  // Sum up all mastery progress across all drinks
  let total = 0
  for (const drink of ALL_DRINKS) {
    const made = state.drinksMade[drink.drink] || 0
    const tier = getMasteryTier(made)
    total += MASTERY_TIERS.indexOf(tier)
  }
  return total
}

// ============================================
// OFFLINE EARNINGS
// ============================================

export const MAX_OFFLINE_HOURS = 8
export const OFFLINE_EFFICIENCY = 0.5 // Earn 50% of normal rate while offline

export interface OfflineEarnings {
  beans: number
  timeAway: number // in seconds
  ordersEstimated: number
}

export function calculateOfflineEarnings(state: GameState, lastActiveTime: number): OfflineEarnings {
  const now = Date.now()
  const timeAwayMs = now - lastActiveTime
  const timeAwaySec = Math.min(timeAwayMs / 1000, MAX_OFFLINE_HOURS * 60 * 60)

  if (timeAwaySec < 60) {
    // Less than a minute, no offline earnings
    return { beans: 0, timeAway: 0, ordersEstimated: 0 }
  }

  // Calculate beans per second from baristas
  const baristaEffectiveness = getBaristaEffectiveness(state)
  const baristaWorkPerSec = state.baristas * baristaEffectiveness * 2 // 2 work per barista per second
  const avgWorkPerOrder = 15 * (1 - state.upgradeLevels.serviceSpeed * 0.05)
  const ordersPerSec = state.baristas > 0 ? baristaWorkPerSec / Math.max(5, avgWorkPerOrder) : 0

  // Calculate average order value
  const achievementBonus = getAchievementBonus(state, 'value')
  const avgOrderValue = 10 * (1 + state.upgradeLevels.orderValue * 0.2 +
    state.franchiseBonus + state.empireBonus + state.dynastyBonus + achievementBonus)

  // Passive income from Coffee Empire upgrade
  const passivePerSec = state.upgradeLevels.coffeeEmpire * 10

  // Total beans per second
  const beansPerSec = (ordersPerSec * avgOrderValue + passivePerSec) * OFFLINE_EFFICIENCY

  const totalBeans = Math.floor(beansPerSec * timeAwaySec)
  const totalOrders = Math.floor(ordersPerSec * timeAwaySec * OFFLINE_EFFICIENCY)

  return {
    beans: totalBeans,
    timeAway: timeAwaySec,
    ordersEstimated: totalOrders,
  }
}

export function formatTimeAway(seconds: number): string {
  if (seconds < 60) return 'less than a minute'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`
  return `${hours}h ${mins}m`
}

// ============================================
// DAILY CHALLENGES
// ============================================

export type ChallengeType = 'orders' | 'beans' | 'taps' | 'upgrades'

export interface DailyChallenge {
  id: string
  type: ChallengeType
  target: number
  reward: number  // Beans reward
  rewardMultiplier?: number  // Optional temporary multiplier
  description: string
  emoji: string
}

export interface ChallengeState {
  challenge: DailyChallenge | null
  progress: number
  completed: boolean
  dateKey: string  // YYYY-MM-DD to track daily reset
  claimed: boolean
}

// Get today's date key
export function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Challenge templates - scale based on player progress
const CHALLENGE_TEMPLATES: { type: ChallengeType; baseTarget: number; scale: (state: GameState) => number; emoji: string; verb: string }[] = [
  { type: 'orders', baseTarget: 25, scale: (s) => Math.max(1, Math.floor(s.totalOrdersCompleted / 100) + 1), emoji: '📦', verb: 'Complete' },
  { type: 'beans', baseTarget: 500, scale: (s) => Math.max(1, Math.floor(s.totalLifetimeBeans / 10000) + 1), emoji: '☕', verb: 'Earn' },
  { type: 'taps', baseTarget: 100, scale: (s) => Math.max(1, s.franchises + 1), emoji: '✋', verb: 'Tap' },
  { type: 'upgrades', baseTarget: 3, scale: (s) => Math.max(1, Math.floor(s.empires + 1)), emoji: '⬆️', verb: 'Purchase' },
]

// Generate daily challenge based on date seed and player progress
export function generateDailyChallenge(state: GameState): DailyChallenge {
  const dateKey = getTodayKey()
  // Use date as seed for consistent daily challenge
  const seed = dateKey.split('-').reduce((a, b) => a + parseInt(b), 0)
  const templateIndex = seed % CHALLENGE_TEMPLATES.length
  const template = CHALLENGE_TEMPLATES[templateIndex]

  const scaleFactor = template.scale(state)
  const target = template.baseTarget * scaleFactor
  const reward = Math.floor(target * (template.type === 'beans' ? 0.5 : 10) * scaleFactor)

  const typeLabels: Record<ChallengeType, string> = {
    orders: 'orders',
    beans: 'beans',
    taps: 'times',
    upgrades: 'upgrades',
  }

  return {
    id: `daily-${dateKey}`,
    type: template.type,
    target,
    reward,
    description: `${template.verb} ${formatNumber(target)} ${typeLabels[template.type]}`,
    emoji: template.emoji,
  }
}

// Check if challenge state needs reset (new day)
export function shouldResetChallenge(challengeState: ChallengeState | null): boolean {
  if (!challengeState) return true
  return challengeState.dateKey !== getTodayKey()
}

// Create fresh challenge state
export function createChallengeState(state: GameState): ChallengeState {
  return {
    challenge: generateDailyChallenge(state),
    progress: 0,
    completed: false,
    dateKey: getTodayKey(),
    claimed: false,
  }
}
