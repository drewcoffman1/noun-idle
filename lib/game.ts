// ============================================
// NOUN IDLE - DEEP PROGRESSION SYSTEM
// ============================================
// Prestige Layers: Franchises → Empires → Dynasties
// Unlockable: Drinks, Customers, Upgrades, Achievements
// ============================================

// A customer waiting in line
export interface WaitingCustomer {
  id: string
  customerName: string
  customerEmoji: string
  customerType: string  // 'Regular', 'Student', etc.
  valueMultiplier: number
  patience: number      // Current patience (decreases over time)
  maxPatience: number   // Starting patience
  arrivedAt: number     // Timestamp
  desiredDrink: string  // What they actually want
  desiredDrinkEmoji: string
  isRegular?: boolean   // Is this a returning regular?
  preferredDrink?: string  // If regular, what's their usual? (for hint)
  isNoun?: boolean      // ⌐◨-◨ Special Noun customer!
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
  isNoun?: boolean          // ⌐◨-◨ Was this a Noun customer?
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
  secret?: boolean  // Hidden until unlocked
  hint?: string     // Vague hint for secret achievements
}

// Pop-up Collab - like Cookie Clicker's Golden Cookies
export interface PopupCollab {
  id: string
  name: string
  emoji: string
  description: string
  rarity: 'common' | 'rare' | 'legendary'  // Affects spawn chance and rewards
}

export interface ActivePopup {
  collab: PopupCollab
  spawnedAt: number
  expiresAt: number
  x: number  // Position 0-100 (percentage)
  y: number  // Position 0-100 (percentage)
}

// Themed pop-up collabs
export const POPUP_COLLABS: PopupCollab[] = [
  // Common (60% of spawns)
  { id: 'local_roaster', name: 'Local Roaster Pop-Up!', emoji: '🫘', description: 'Fresh beans from a local roaster', rarity: 'common' },
  { id: 'pastry_collab', name: 'Pastry Collab!', emoji: '🥐', description: 'A local bakery dropped off treats', rarity: 'common' },
  { id: 'latte_art', name: 'Latte Art Contest!', emoji: '🎨', description: 'Show off your skills', rarity: 'common' },
  // Rare (30% of spawns)
  { id: 'artist_takeover', name: 'Artist Takeover!', emoji: '🖼️', description: 'A local artist is featuring their work', rarity: 'rare' },
  { id: 'coffee_critic', name: 'Coffee Critic Visit!', emoji: '📝', description: 'A famous critic is reviewing your shop', rarity: 'rare' },
  { id: 'influencer', name: 'Influencer Spotted!', emoji: '📸', description: 'Someone with followers is posting', rarity: 'rare' },
  // Legendary (10% of spawns) - Nouns themed!
  { id: 'nouns_collab', name: '⌐◨-◨ Nouns Collab!', emoji: '⌐◨-◨', description: 'The Nouns community is here', rarity: 'legendary' },
  { id: 'nounish_popup', name: 'Nounish Pop-Up!', emoji: '🏛️', description: 'One noun, every day, forever', rarity: 'legendary' },
]

// Popup timing constants
export const POPUP_MIN_INTERVAL = 45000   // Minimum 45 seconds between popups
export const POPUP_MAX_INTERVAL = 120000  // Maximum 2 minutes between popups
export const POPUP_DURATION = 5000        // 5 seconds to tap it - quick!

export interface GameState {
  // Currency
  beans: number
  lifetimeBeans: number
  totalLifetimeBeans: number  // Never resets, used for unlocks

  // The Pipeline (new system)
  waitingCustomers: WaitingCustomer[]  // Customers in line, no drink yet
  currentOrder: Order | null            // YOUR order being worked on
  baristaOrders: Order[]                // Orders baristas are working on
  lastBaristaPickup?: number            // Timestamp of last barista pickup (for cooldown)

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
    tapPower: number        // Bonus tap speed
    autoBrew: number        // Auto-brew speed (orders complete themselves)
    baristas: number
    orderValue: number
    serviceSpeed: number
    customerRate: number      // Queue capacity
    customerPatience: number  // Patience bonus
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

  // ⌐◨-◨ Nouns Easter Eggs
  nounsServed: number  // Track how many Noun customers served

  // Pop-up Collabs (like Golden Cookies)
  activePopup: ActivePopup | null
  lastPopupTime: number
  popupsClaimed: number  // Track total popups claimed
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
  // ⌐◨-◨ SECRET NOUNS DRINK - unlocks after serving a Noun customer
  {
    drink: 'The Nounish',
    emoji: '⌐◨-◨',
    baseValue: 42,  // 42 - answer to everything
    baseWork: 20,
    unlocksAt: 99999,  // Hidden by default, special unlock
    origin: 'Ethereum | On-chain | Daily Auction',
    notes: 'Red glasses, pixel perfect, community vibes',
    description: 'A legendary brew for true Nouns believers. One per day, forever.'
  },
]

// Check if The Nounish is unlocked (served a Noun customer)
export function isNounishUnlocked(state: GameState): boolean {
  return state.nounsServed > 0
}

// Get unlocked drinks - includes secret Nounish if unlocked
export function getUnlockedDrinks(totalOrders: number, state?: GameState): DrinkType[] {
  return ALL_DRINKS.filter(d => {
    // Special case for The Nounish - needs state check
    if (d.drink === 'The Nounish') {
      return state ? isNounishUnlocked(state) : false
    }
    return d.unlocksAt <= totalOrders
  })
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

// ⌐◨-◨ NOUNS DAO EASTER EGGS ⌐◨-◨
// Special rare customer type - appears randomly with low chance
export const NOUN_CUSTOMER: CustomerType = {
  name: 'Noun',
  emoji: '⌐◨-◨',  // The iconic Nouns glasses!
  valueMultiplier: 10.0,  // Very generous tipper
  patience: 60,  // Nouns are patient, they think long-term
  unlocksAt: { type: 'orders', count: 0 },  // Always available but rare
}

// Nouns community / founder names as easter egg customers
export const NOUNS_NAMES = [
  '4156',        // Nouns founder
  'punk4156',
  'gremplin',    // Artist
  'Noun 1',
  'Noun 40',
  'Noun 100',
  'seneca',      // Nouns builder
  'toady',       // Nouns builder
  'noun22',
  'nounish',
  '⌐◨-◨',
]

// Chance for a Noun customer to appear (1 in 50)
export const NOUN_CUSTOMER_CHANCE = 0.02

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
    id: 'autoBrew',
    name: 'Coffee Training',
    description: 'Better technique = faster drink prep',
    emoji: '📚',
    tier: 1,
    baseCost: 25,
    costMultiplier: 1.5,
    baseNounCost: 2000,
    nounCostMultiplier: 1.15,
    maxLevel: 50,
    getEffect: (level) => `${(5 + level * 3).toFixed(0)} work/sec`,
  },
  {
    id: 'tapPower',
    name: 'Hospitality',
    description: 'Personal touch speeds up service',
    emoji: '💝',
    tier: 1,
    baseCost: 15,
    costMultiplier: 1.4,
    baseNounCost: 1000,
    nounCostMultiplier: 1.15,
    maxLevel: 100,
    getEffect: (level) => `+${1 + level} per interaction`,
  },
  {
    id: 'baristas',
    name: 'Hire Barista',
    description: 'Baristas auto-serve customers from the queue',
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
    description: 'Bigger reputation = longer lines',
    emoji: '📢',
    tier: 1,
    baseCost: 200,
    costMultiplier: 2.0,
    baseNounCost: 20000,
    nounCostMultiplier: 1.2,
    maxLevel: 20,
    getEffect: (level) => `Queue +${level} capacity`,
  },
  {
    id: 'customerPatience',
    name: 'Cozy Atmosphere',
    description: 'Comfy seating, good vibes',
    emoji: '🛋️',
    tier: 1,
    baseCost: 100,
    costMultiplier: 1.6,
    baseNounCost: 10000,
    nounCostMultiplier: 1.15,
    maxLevel: 20,
    getEffect: (level) => `+${level * 15}% patience`,
  },

  // ========== TIER 2 - Advanced (unlock at Franchise 1) ==========
  {
    id: 'doubleShot',
    name: 'Double Shot',
    description: 'Chance for 2x work when you tap',
    emoji: '💪',
    tier: 2,
    baseCost: 5000,
    costMultiplier: 1.8,
    baseNounCost: 50000,
    nounCostMultiplier: 1.2,
    maxLevel: 25,
    getEffect: (level) => `${level * 4}% chance for 2x`,
  },
  {
    id: 'tippingCulture',
    name: 'Extra Scoop',
    description: 'Chance for 1.5x beans on orders',
    emoji: '☕',
    tier: 2,
    baseCost: 8000,
    costMultiplier: 1.7,
    baseNounCost: 80000,
    nounCostMultiplier: 1.15,
    maxLevel: 20,
    getEffect: (level) => `${level * 5}% bonus chance`,
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

  // SECRET achievements - hidden until unlocked
  { id: 'secret_patience', name: 'Zen Master', description: 'Have 10 customers leave due to impatience', emoji: '🧘', requirement: (s) => s.customersLost >= 10, bonus: 0.1, bonusType: 'value', secret: true, hint: 'Sometimes patience runs out...' },
  { id: 'secret_perfect', name: 'Perfect Service', description: 'Serve 50 orders without losing a customer', emoji: '✨', requirement: (s) => s.ordersCompleted >= 50 && s.customersLost === 0, bonus: 0.2, bonusType: 'value', secret: true, hint: 'Flawless from the start' },
  { id: 'secret_regular_master', name: 'Everybody Knows Your Name', description: 'Have 10 regular customers', emoji: '🍻', requirement: (s) => Object.values(s.regulars).filter(r => r.visitsCount >= 5).length >= 10, bonus: 0.15, bonusType: 'value', secret: true, hint: 'Build your community' },
  { id: 'secret_mastery', name: 'Jack of All Trades', description: 'Reach Apprentice mastery on all drinks', emoji: '🎓', requirement: (s) => {
    const unlockedDrinks = ALL_DRINKS.filter(d => d.unlocksAt <= s.totalOrdersCompleted)
    return unlockedDrinks.length > 0 && unlockedDrinks.every(d => (s.drinksMade[d.drink] || 0) >= 50)
  }, bonus: 0.25, bonusType: 'value', secret: true, hint: 'Master the basics of every recipe' },
  { id: 'secret_speedster', name: 'Caffeine Rush', description: 'Complete 10 orders in under a minute', emoji: '⚡', requirement: (s) => s.upgradeLevels.tapPower >= 20 && s.upgradeLevels.serviceSpeed >= 10, bonus: 0.15, bonusType: 'speed', secret: true, hint: 'Speed is everything' },
  { id: 'secret_millionaire', name: 'Bean Counter', description: 'Have 1M beans at once', emoji: '🏧', requirement: (s) => s.beans >= 1000000, bonus: 0.3, bonusType: 'value', secret: true, hint: 'Hoard your wealth' },

  // ⌐◨-◨ NOUNS DAO SECRET ACHIEVEMENTS
  { id: 'nouns_first', name: 'First Noun', description: 'Serve your first Noun customer', emoji: '⌐◨-◨', requirement: (s) => s.nounsServed >= 1, bonus: 0.42, bonusType: 'value', secret: true, hint: 'One Noun, every day, forever...' },
  { id: 'nouns_10', name: 'Nounish Cafe', description: 'Serve 10 Noun customers', emoji: '🟥', requirement: (s) => s.nounsServed >= 10, bonus: 0.69, bonusType: 'value', secret: true, hint: 'The red glasses keep coming back' },
  { id: 'nouns_42', name: 'The Answer', description: 'Serve 42 Noun customers', emoji: '🌌', requirement: (s) => s.nounsServed >= 42, bonus: 1.0, bonusType: 'value', secret: true, hint: 'What is the answer to life, the universe, and everything?' },
  { id: 'nouns_nounish', name: 'True Believer', description: 'Make 100 Nounish drinks', emoji: '☕', requirement: (s) => (s.drinksMade['The Nounish'] || 0) >= 100, bonus: 0.5, bonusType: 'value', secret: true, hint: 'The secret menu item...' },
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

// Generate a customer who arrives and waits
export function generateCustomer(state: GameState, customNames: string[] = []): WaitingCustomer {
  const unlockedCustomers = getUnlockedCustomers(state)
  const unlockedDrinks = getUnlockedDrinks(state.totalOrdersCompleted, state)

  // ⌐◨-◨ NOUNS EASTER EGG: Small chance for a Noun customer!
  const isNounCustomer = Math.random() < NOUN_CUSTOMER_CHANCE

  // Pick customer type (Noun or regular)
  const customerType = isNounCustomer ? NOUN_CUSTOMER : unlockedCustomers[Math.floor(Math.random() * unlockedCustomers.length)]

  // Pick random name - Nouns names ONLY for actual Noun customers
  const regularNames = [...CUSTOMER_NAMES, ...customNames]
  const customerName = isNounCustomer
    ? NOUNS_NAMES[Math.floor(Math.random() * NOUNS_NAMES.length)]
    : regularNames[Math.floor(Math.random() * regularNames.length)]

  // Check if this person is a known regular
  const regular = state.regulars[customerName]
  const isRegular = regular && regular.visitsCount >= VISITS_TO_BECOME_REGULAR

  // Pick what drink they want
  // Regulars always want their usual, others pick randomly
  let desiredDrink: DrinkType
  if (isRegular && regular.favoriteDrink) {
    desiredDrink = unlockedDrinks.find(d => d.drink === regular.favoriteDrink) || unlockedDrinks[0]
  } else {
    desiredDrink = unlockedDrinks[Math.floor(Math.random() * unlockedDrinks.length)]
  }

  // Apply patience bonus from Cozy Atmosphere upgrade
  const patienceMultiplier = 1 + (state.upgradeLevels.customerPatience * 0.15)
  const finalPatience = customerType.patience * patienceMultiplier

  return {
    id: `customer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerName,
    customerEmoji: customerType.emoji,
    customerType: customerType.name,
    valueMultiplier: customerType.valueMultiplier,
    patience: finalPatience,
    maxPatience: finalPatience,
    arrivedAt: Date.now(),
    desiredDrink: desiredDrink.drink,
    desiredDrinkEmoji: desiredDrink.emoji,
    isRegular,
    preferredDrink: isRegular ? regular.favoriteDrink : undefined,
    isNoun: isNounCustomer,  // ⌐◨-◨
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
    isNoun: customer.isNoun,  // ⌐◨-◨
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

// Barista creates an order from a customer (always picks the right drink!)
export function baristaServeCustomer(customer: WaitingCustomer, state: GameState): Order {
  const unlockedDrinks = getUnlockedDrinks(state.totalOrdersCompleted)
  // Baristas always know the right drink
  const drink = unlockedDrinks.find(d => d.drink === customer.desiredDrink) || unlockedDrinks[0]
  return createOrderFromCustomer(customer, drink, state)
}

// Legacy function for backwards compatibility
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
    baristaOrders: [],
    ordersCompleted: 0,
    totalOrdersCompleted: 0,
    customersLost: 0,
    drinksMade: {},
    regulars: {},
    tapPower: 1,
    baristas: 0,
    upgradeLevels: {
      tapPower: 0,
      autoBrew: 0,
      baristas: 0,
      orderValue: 0,
      serviceSpeed: 0,
      customerRate: 0,
      customerPatience: 0,
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
    nounsServed: 0,  // ⌐◨-◨
    activePopup: null,
    lastPopupTime: Date.now(),
    popupsClaimed: 0,
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
    nounsServed: state.nounsServed,
    popupsClaimed: state.popupsClaimed,
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
    nounsServed: state.nounsServed,
    popupsClaimed: state.popupsClaimed,
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
    nounsServed: state.nounsServed,
    popupsClaimed: state.popupsClaimed,
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
  // Base queue + Marketing bonus + Express Line bonus
  return 5 + state.upgradeLevels.customerRate + (state.upgradeLevels.expressLine * 2)
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

// ============================================
// POP-UP COLLABS (Golden Cookie equivalent)
// ============================================

// Pick a random collab based on rarity weights
function pickRandomCollab(): PopupCollab {
  const roll = Math.random()
  let pool: PopupCollab[]

  if (roll < 0.1) {
    // 10% legendary
    pool = POPUP_COLLABS.filter(c => c.rarity === 'legendary')
  } else if (roll < 0.4) {
    // 30% rare
    pool = POPUP_COLLABS.filter(c => c.rarity === 'rare')
  } else {
    // 60% common
    pool = POPUP_COLLABS.filter(c => c.rarity === 'common')
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

// Check if it's time to spawn a new popup
export function shouldSpawnPopup(state: GameState): boolean {
  // Don't spawn if one is already active
  if (state.activePopup) return false

  // Random interval between min and max
  const timeSinceLastPopup = Date.now() - state.lastPopupTime
  const nextInterval = POPUP_MIN_INTERVAL + Math.random() * (POPUP_MAX_INTERVAL - POPUP_MIN_INTERVAL)

  return timeSinceLastPopup >= nextInterval
}

// Spawn a new popup
export function spawnPopup(state: GameState): GameState {
  const collab = pickRandomCollab()
  const now = Date.now()

  // Random position (avoid edges)
  const x = 15 + Math.random() * 70  // 15-85%
  const y = 20 + Math.random() * 40  // 20-60%

  return {
    ...state,
    activePopup: {
      collab,
      spawnedAt: now,
      expiresAt: now + POPUP_DURATION,
      x,
      y,
    },
    lastPopupTime: now,
  }
}

// Check if popup has expired
export function checkPopupExpiry(state: GameState): GameState {
  if (!state.activePopup) return state

  if (Date.now() >= state.activePopup.expiresAt) {
    return {
      ...state,
      activePopup: null,
    }
  }

  return state
}

// Claim a popup - serves everyone in line instantly!
export function claimPopup(state: GameState): { newState: GameState; beansEarned: number; customersServed: number } {
  if (!state.activePopup) {
    return { newState: state, beansEarned: 0, customersServed: 0 }
  }

  const collab = state.activePopup.collab
  let newState = { ...state }
  let totalBeans = 0
  let customersServed = 0
  let drinksMade = { ...state.drinksMade }
  let regulars = { ...state.regulars }

  // Serve everyone in the waiting line!
  for (const customer of state.waitingCustomers) {
    // Find drink info for value calculation
    const drinkInfo = ALL_DRINKS.find(d => d.drink === customer.desiredDrink)
    const baseValue = drinkInfo?.baseValue || 10

    // Calculate value with multipliers
    const totalMult = getTotalMultiplier(state)
    const valueMult = customer.valueMultiplier || 1
    const beans = Math.floor(baseValue * totalMult * valueMult)

    totalBeans += beans
    customersServed++

    // Track drink made
    drinksMade[customer.desiredDrink] = (drinksMade[customer.desiredDrink] || 0) + 1

    // Update regulars
    regulars = updateRegulars(regulars, customer.customerName, customer.desiredDrink)

    // Track Noun if applicable
    if (customer.isNoun) {
      newState.nounsServed = (newState.nounsServed || 0) + 1
    }
  }

  // Clear the line
  newState.waitingCustomers = []

  // Bonus based on rarity
  let bonusMultiplier = 1
  if (collab.rarity === 'rare') bonusMultiplier = 1.5
  if (collab.rarity === 'legendary') bonusMultiplier = 2

  // Minimum beans if no customers were in line
  if (totalBeans === 0) {
    totalBeans = Math.floor(50 * bonusMultiplier * (1 + newState.franchises * 0.1))
  } else {
    totalBeans = Math.floor(totalBeans * bonusMultiplier)
  }

  newState = {
    ...newState,
    drinksMade,
    regulars,
    beans: newState.beans + totalBeans,
    lifetimeBeans: newState.lifetimeBeans + totalBeans,
    totalLifetimeBeans: newState.totalLifetimeBeans + totalBeans,
    ordersCompleted: newState.ordersCompleted + customersServed,
    totalOrdersCompleted: newState.totalOrdersCompleted + customersServed,
    activePopup: null,
    popupsClaimed: (newState.popupsClaimed || 0) + 1,
  }

  return { newState, beansEarned: totalBeans, customersServed }
}
