'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { sdk } from '@farcaster/miniapp-sdk'
import {
  GameState,
  Order,
  WaitingCustomer,
  Achievement,
  ChallengeState,
  OfflineEarnings,
  DrinkType,
  UPGRADES,
  FRANCHISE_MILESTONES,
  EMPIRE_MILESTONES,
  DYNASTY_MILESTONES,
  ACHIEVEMENTS,
  CUSTOMER_NAMES,
  ALL_DRINKS,
  ALL_CUSTOMERS,
  MASTERY_TIERS,
  VISITS_TO_BECOME_REGULAR,
  isNounishUnlocked,
  generateOrder,
  generateCustomer,
  createOrderFromCustomer,
  baristaServeCustomer,
  updateRegulars,
  getUpgradeCost,
  getUpgradeNounCost,
  getUnlockedUpgrades,
  getUnlockedDrinks,
  getNextDrinkUnlock,
  getNextFranchise,
  getNextEmpire,
  getNextDynasty,
  canPrestigeFranchise,
  canPrestigeEmpire,
  canPrestigeDynasty,
  resetForFranchise,
  resetForEmpire,
  resetForDynasty,
  checkNewAchievements,
  createInitialState,
  formatNumber,
  getBeansPerMinute,
  getMaxQueueSize,
  getBaristaEffectiveness,
  getTotalMultiplier,
  getMasteryTier,
  getNextMasteryTier,
  calculateOfflineEarnings,
  formatTimeAway,
  CUSTOM_NAME_COST,
  UpgradeId,
  shouldResetChallenge,
  createChallengeState,
  getTodayKey,
  shouldSpawnPopup,
  spawnPopup,
  checkPopupExpiry,
  claimPopup,
  ActivePopup,
  POPUP_DURATION,
} from '@/lib/game'
import { NOUN_TOKEN_ADDRESS, BURN_ADDRESS, ERC20_ABI } from '@/lib/constants'

const STORAGE_KEY = 'noun-idle-v7-save'

export default function Game() {
  const [gameState, setGameState] = useState<GameState>(createInitialState)
  const [showPayment, setShowPayment] = useState<{ amount: number; id: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'shop' | 'prestige' | 'achievements' | 'vip' | 'daily'>('shop')
  const [customNames, setCustomNames] = useState<string[]>([])
  const [newCustomName, setNewCustomName] = useState('')
  const [pendingUpgrade, setPendingUpgrade] = useState<UpgradeId | null>(null)
  const [pendingCustomName, setPendingCustomName] = useState(false)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  const [newUnlock, setNewUnlock] = useState<string | null>(null)
  const [cloudSaveLoaded, setCloudSaveLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [selectedDrink, setSelectedDrink] = useState<typeof ALL_DRINKS[0] | null>(null)
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ address: string; displayName: string; score: number; rank: number }[]>([])
  const [playerRank, setPlayerRank] = useState<{ rank: number; score: number } | null>(null)
  const [sessionTaps, setSessionTaps] = useState(0)
  const [sessionUpgrades, setSessionUpgrades] = useState(0)
  const [sessionBeans, setSessionBeans] = useState(0)
  const [sessionOrders, setSessionOrders] = useState(0)
  const [offlineEarnings, setOfflineEarnings] = useState<OfflineEarnings | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<WaitingCustomer | null>(null)  // Customer we're picking drink for
  const [customerLeft, setCustomerLeft] = useState<string | null>(null)  // Show when customer leaves angry
  const [screenShake, setScreenShake] = useState(false)  // Shake on wrong drink
  const [showConfetti, setShowConfetti] = useState(false)  // Celebrate on order complete
  const [popupClaimed, setPopupClaimed] = useState<{ name: string; beans: number; orders: number } | null>(null)  // Popup claim notification

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)

  // Haptic feedback helper
  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'error') => {
    // Try Farcaster SDK haptics first
    try {
      if (sdk && 'haptics' in sdk) {
        const haptics = (sdk as { haptics?: { impactOccurred?: (style: string) => void, notificationOccurred?: (type: string) => void } }).haptics
        if (type === 'error' && haptics?.notificationOccurred) {
          haptics.notificationOccurred('error')
        } else if (haptics?.impactOccurred) {
          haptics.impactOccurred(type)
        }
      }
    } catch {}
    // Fallback to Web Vibration API
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const durations = { light: 10, medium: 20, heavy: 40, error: [50, 50, 50] }
      navigator.vibrate(durations[type])
    }
  }, [])
  const customNamesRef = useRef<string[]>([])
  const lastCloudSaveRef = useRef<string>('')
  const selectedCustomerIdRef = useRef<string | null>(null)

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  const { data: nounBalance, refetch: refetchBalance } = useReadContract({
    address: NOUN_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract, data: txHash, isPending: isTxPending } = useWriteContract()
  const { isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Handle successful transaction
  useEffect(() => {
    if (txSuccess) {
      refetchBalance()
      if (pendingUpgrade) {
        const upgradeId = pendingUpgrade
        setPendingUpgrade(null)
        setGameState(prev => {
          const newLevels = { ...prev.upgradeLevels, [upgradeId]: prev.upgradeLevels[upgradeId] + 1 }
          return {
            ...prev,
            upgradeLevels: newLevels,
            tapPower: 1 + newLevels.tapPower,
            baristas: newLevels.baristas,
          }
        })
      }
      if (pendingCustomName && newCustomName) {
        fetch('/api/names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCustomName, txHash }),
        }).then(() => {
          setCustomNames(prev => [newCustomName, ...prev])
          customNamesRef.current = [newCustomName, ...customNamesRef.current]
          setNewCustomName('')
        })
        setPendingCustomName(false)
      }
    }
  }, [txSuccess, pendingUpgrade, pendingCustomName, newCustomName, txHash, refetchBalance])

  // Fetch custom names
  useEffect(() => {
    fetch('/api/names')
      .then(res => res.json())
      .then(data => {
        setCustomNames(data.names || [])
        customNamesRef.current = data.names || []
      })
      .catch(console.error)
  }, [])

  // Sync selected customer ref for game loop access
  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomer?.id || null
  }, [selectedCustomer])

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const url = address ? `/api/leaderboard?address=${address}` : '/api/leaderboard'
        const res = await fetch(url)
        const data = await res.json()
        setLeaderboard(data.leaderboard || [])
        if (data.playerRank) {
          setPlayerRank({ rank: data.playerRank.rank, score: data.playerRank.score })
        }
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e)
      }
    }
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [address])

  // Update leaderboard with player score
  useEffect(() => {
    if (!address || gameState.totalLifetimeBeans === 0) return
    const updateScore = async () => {
      try {
        await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            score: gameState.totalLifetimeBeans,
          }),
        })
      } catch (e) {
        console.error('Failed to update leaderboard:', e)
      }
    }
    const timeout = setTimeout(updateScore, 10000) // Debounce updates
    return () => clearTimeout(timeout)
  }, [address, gameState.totalLifetimeBeans])

  // Initialize and manage daily challenge
  useEffect(() => {
    if (shouldResetChallenge(challengeState)) {
      setChallengeState(createChallengeState(gameState))
      // Reset session counters
      setSessionTaps(0)
      setSessionUpgrades(0)
      setSessionBeans(0)
      setSessionOrders(0)
    }
  }, [gameState, challengeState])

  // Helper to migrate old saves
  const migrateSave = (parsed: GameState): GameState => {
    if (!parsed.upgradeLevels.customerPatience) parsed.upgradeLevels.customerPatience = 0
    if (!parsed.upgradeLevels.doubleShot) parsed.upgradeLevels.doubleShot = 0
    if (!parsed.upgradeLevels.tippingCulture) parsed.upgradeLevels.tippingCulture = 0
    if (!parsed.upgradeLevels.expressLine) parsed.upgradeLevels.expressLine = 0
    if (!parsed.upgradeLevels.masterBarista) parsed.upgradeLevels.masterBarista = 0
    if (!parsed.upgradeLevels.vipLounge) parsed.upgradeLevels.vipLounge = 0
    if (!parsed.upgradeLevels.coffeeEmpire) parsed.upgradeLevels.coffeeEmpire = 0
    if (!parsed.empires) parsed.empires = 0
    if (!parsed.empireBonus) parsed.empireBonus = 0
    if (!parsed.dynasties) parsed.dynasties = 0
    if (!parsed.dynastyBonus) parsed.dynastyBonus = 0
    if (!parsed.totalLifetimeBeans) parsed.totalLifetimeBeans = parsed.lifetimeBeans || 0
    if (!parsed.totalOrdersCompleted) parsed.totalOrdersCompleted = parsed.ordersCompleted || 0
    if (!parsed.unlockedAchievements) parsed.unlockedAchievements = []
    if (!parsed.drinksMade) parsed.drinksMade = {}
    // New fields for patience/regulars system
    if (!parsed.waitingCustomers) parsed.waitingCustomers = []
    if (!parsed.regulars) parsed.regulars = {}
    if (parsed.customersLost === undefined) parsed.customersLost = 0
    if (!parsed.baristaOrders) parsed.baristaOrders = []
    // Migrate old orderQueue to waitingCustomers (clear it since format changed)
    if (parsed.orderQueue && parsed.orderQueue.length > 0) {
      parsed.waitingCustomers = []
      delete parsed.orderQueue
    }
    // ⌐◨-◨ Nouns easter egg migration
    if (parsed.nounsServed === undefined) parsed.nounsServed = 0
    // Auto-brew migration
    if (parsed.upgradeLevels.autoBrew === undefined) parsed.upgradeLevels.autoBrew = 0
    // Pop-up collab migration
    if (parsed.activePopup === undefined) parsed.activePopup = null
    if (parsed.lastPopupTime === undefined) parsed.lastPopupTime = Date.now()
    if (parsed.popupsClaimed === undefined) parsed.popupsClaimed = 0
    return parsed
  }

  // Load from cloud when wallet connects
  useEffect(() => {
    if (!address || cloudSaveLoaded) return

    const loadCloudSave = async () => {
      try {
        const res = await fetch(`/api/save?address=${address}`)
        const data = await res.json()

        if (data.save) {
          const cloudState = migrateSave(typeof data.save === 'string' ? JSON.parse(data.save) : data.save)
          const localSaved = localStorage.getItem(STORAGE_KEY)
          const localState = localSaved ? migrateSave(JSON.parse(localSaved)) : null

          // Use whichever save has more progress (higher totalLifetimeBeans)
          if (!localState || cloudState.totalLifetimeBeans > localState.totalLifetimeBeans) {
            setGameState(cloudState)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudState))
          }
        }
        setCloudSaveLoaded(true)
      } catch (e) {
        console.error('Failed to load cloud save:', e)
        setCloudSaveLoaded(true)
      }
    }

    loadCloudSave()
  }, [address, cloudSaveLoaded])

  // Load local save on startup (before wallet connects) and calculate offline earnings
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = migrateSave(JSON.parse(saved) as GameState)

        // Calculate offline earnings if player has baristas or passive income
        if (parsed.baristas > 0 || parsed.upgradeLevels.coffeeEmpire > 0) {
          const earnings = calculateOfflineEarnings(parsed, parsed.lastUpdate)
          if (earnings.beans > 0) {
            setOfflineEarnings(earnings)
            // Add earnings to state
            parsed.beans += earnings.beans
            parsed.lifetimeBeans += earnings.beans
            parsed.totalLifetimeBeans += earnings.beans
          }
        }

        setGameState(parsed)
      } catch (e) {
        console.error('Failed to load save:', e)
      }
    }
  }, [])

  // Save game (local + cloud)
  useEffect(() => {
    const save = async () => {
      const saveData = { ...gameState, lastUpdate: Date.now() }
      const saveString = JSON.stringify(saveData)

      // Always save to localStorage
      localStorage.setItem(STORAGE_KEY, saveString)

      // Save to cloud if wallet connected and data changed
      if (address && saveString !== lastCloudSaveRef.current) {
        setSaveStatus('saving')
        try {
          await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, gameState: saveData }),
          })
          lastCloudSaveRef.current = saveString
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(null), 2000)
        } catch (e) {
          console.error('Cloud save failed:', e)
          setSaveStatus('error')
        }
      }
    }

    const interval = setInterval(save, 5000)
    return () => clearInterval(interval)
  }, [gameState, address])

  // Main game loop
  useEffect(() => {
    gameLoopRef.current = setInterval(() => {
      setGameState(prev => {
        const now = Date.now()
        let updated = { ...prev }
        const maxQueue = getMaxQueueSize(prev)

        // Customer arrivals (generate WaitingCustomer, not Order)
        // Fixed 3 second arrival rate - Marketing increases queue capacity, not speed
        const customerInterval = 3000
        if (now - prev.lastCustomerTime >= customerInterval && prev.waitingCustomers.length < maxQueue) {
          const newCustomer = generateCustomer(prev, customNamesRef.current)
          updated.waitingCustomers = [...prev.waitingCustomers, newCustomer]
          updated.lastCustomerTime = now
        }

        // Tick patience for waiting customers (use updated.waitingCustomers to include new arrivals)
        // Skip the selected customer - their patience is frozen while being served
        const patienceLossPerTick = 0.1  // Lose 0.1 patience per tick (100ms) = 1 per second
        const selectedId = selectedCustomerIdRef.current
        let customersWhoLeft: string[] = []
        updated.waitingCustomers = updated.waitingCustomers
          .map(customer => ({
            ...customer,
            // Freeze patience if this customer is being served
            patience: customer.id === selectedId ? customer.patience : customer.patience - patienceLossPerTick,
          }))
          .filter(customer => {
            if (customer.patience <= 0) {
              customersWhoLeft.push(customer.customerName)
              return false
            }
            return true
          })

        // Track customers lost
        if (customersWhoLeft.length > 0) {
          updated.customersLost = (prev.customersLost || 0) + customersWhoLeft.length
          // Show notification for first customer who left
          setCustomerLeft(customersWhoLeft[0])
          setTimeout(() => setCustomerLeft(null), 2000)
        }

        // Baristas work independently - they take customers and serve them
        if (prev.baristas > 0) {
          const effectiveness = getBaristaEffectiveness(prev)
          let baristaOrders = [...(updated.baristaOrders || [])]
          let newWaitingCustomers = [...updated.waitingCustomers]

          // VIP customer types that require manual service
          const vipTypes = ['Noun', 'Celebrity', 'Royalty', 'Billionaire']

          // Baristas pick up new customers if they have capacity
          const availableBaristas = prev.baristas - baristaOrders.length

          // Barista cooldown: 1.5 seconds between each pickup
          const lastBaristaPickup = prev.lastBaristaPickup || 0
          const baristaCooldown = 1500 // 1.5 seconds
          const canPickup = now - lastBaristaPickup >= baristaCooldown

          if (canPickup && availableBaristas > 0) {
            // Find eligible customers (not VIP, and waited at least 2.5s for player-first)
            const playerFirstWindow = 2500 // 2.5 seconds
            const eligibleIndex = newWaitingCustomers.findIndex(c =>
              !vipTypes.includes(c.customerType) &&
              !c.isNoun &&
              (now - c.arrivedAt) >= playerFirstWindow
            )

            if (eligibleIndex !== -1) {
              const customer = newWaitingCustomers.splice(eligibleIndex, 1)[0]
              const order = baristaServeCustomer(customer, prev)
              baristaOrders.push(order)
              updated.lastBaristaPickup = now
            }
          }
          updated.waitingCustomers = newWaitingCustomers

          // Baristas work on their orders
          const workPerBarista = effectiveness * 0.2  // Work per tick per barista
          const completedOrders: Order[] = []

          baristaOrders = baristaOrders.map(order => {
            const newWorkDone = order.workDone + workPerBarista
            if (newWorkDone >= order.workRequired) {
              completedOrders.push({ ...order, workDone: newWorkDone })
              return null  // Mark for removal
            }
            return { ...order, workDone: newWorkDone }
          }).filter((o): o is Order => o !== null)

          // Process completed orders
          for (const order of completedOrders) {
            // Tips chance
            let payment = order.value
            if (prev.upgradeLevels.tippingCulture > 0 && Math.random() < prev.upgradeLevels.tippingCulture * 0.05) {
              payment = Math.floor(payment * 1.5)
            }

            // Track drink made for mastery
            updated.drinksMade = {
              ...updated.drinksMade,
              [order.drink]: (updated.drinksMade[order.drink] || 0) + 1,
            }

            // Update regulars tracking
            updated.regulars = updateRegulars(updated.regulars, order.customerName, order.drink)

            updated.beans = updated.beans + payment
            updated.lifetimeBeans = updated.lifetimeBeans + payment
            updated.totalLifetimeBeans = updated.totalLifetimeBeans + payment
            updated.ordersCompleted = updated.ordersCompleted + 1
            updated.totalOrdersCompleted = updated.totalOrdersCompleted + 1

            // ⌐◨-◨ Track Noun customers served by baristas too
            if (order.isNoun) {
              updated.nounsServed = (updated.nounsServed || 0) + 1
            }
          }

          updated.baristaOrders = baristaOrders
        }

        // Passive income from Coffee Empire upgrade
        if (prev.upgradeLevels.coffeeEmpire > 0) {
          const passivePerTick = prev.upgradeLevels.coffeeEmpire * 10 * 0.1
          updated.beans = updated.beans + passivePerTick
          updated.lifetimeBeans = updated.lifetimeBeans + passivePerTick
          updated.totalLifetimeBeans = updated.totalLifetimeBeans + passivePerTick
        }

        // AUTO-BREW: Your current order progresses automatically (tap = bonus speed)
        if (updated.currentOrder) {
          // No auto-brew without upgrade - you must tap!
          // Coffee Training upgrade enables and increases auto-brew
          const autoBrewLevel = prev.upgradeLevels.autoBrew || 0
          const autoBrewSpeed = autoBrewLevel > 0 ? (autoBrewLevel * 0.4) : 0
          const newWorkDone = updated.currentOrder.workDone + autoBrewSpeed

          if (newWorkDone >= updated.currentOrder.workRequired) {
            // Order complete!
            let payment = updated.currentOrder.value

            // Tips chance
            if (prev.upgradeLevels.tippingCulture > 0 && Math.random() < prev.upgradeLevels.tippingCulture * 0.05) {
              payment = Math.floor(payment * 1.5)
            }

            // Track drink made
            updated.drinksMade = {
              ...updated.drinksMade,
              [updated.currentOrder.drink]: (updated.drinksMade[updated.currentOrder.drink] || 0) + 1,
            }

            // Update regulars
            updated.regulars = updateRegulars(updated.regulars, updated.currentOrder.customerName, updated.currentOrder.drink)

            // Track Nouns
            if (updated.currentOrder.isNoun) {
              updated.nounsServed = (updated.nounsServed || 0) + 1
            }

            updated.beans = updated.beans + payment
            updated.lifetimeBeans = updated.lifetimeBeans + payment
            updated.totalLifetimeBeans = updated.totalLifetimeBeans + payment
            updated.ordersCompleted = updated.ordersCompleted + 1
            updated.totalOrdersCompleted = updated.totalOrdersCompleted + 1
            updated.currentOrder = null
          } else {
            updated.currentOrder = { ...updated.currentOrder, workDone: newWorkDone }
          }
        }

        // Pop-up Collab spawning and expiry
        updated = checkPopupExpiry(updated)
        if (shouldSpawnPopup(updated)) {
          updated = spawnPopup(updated)
        }

        // Check achievements
        const newAchievements = checkNewAchievements(updated)
        if (newAchievements.length > 0) {
          updated.unlockedAchievements = [...prev.unlockedAchievements, ...newAchievements.map(a => a.id)]
          setNewAchievement(newAchievements[0])
          setTimeout(() => setNewAchievement(null), 3000)
        }

        return updated
      })
    }, 100)

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [])

  // Auto-connect
  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected && connectors.length > 0) {
        try {
          await connect({ connector: connectors[0] })
        } catch (e) {
          console.log('Auto-connect skipped:', e)
        }
      }
    }
    autoConnect()
  }, [isConnected, connect, connectors])

  // Save immediately when app is closing/hidden (important for mini-apps)
  useEffect(() => {
    const saveNow = () => {
      const saveData = { ...gameState, lastUpdate: Date.now() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))

      // Also try cloud save if connected (using sendBeacon for reliability)
      if (address) {
        const blob = new Blob([JSON.stringify({ address, gameState: saveData })], { type: 'application/json' })
        navigator.sendBeacon('/api/save', blob)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveNow()
      }
    }

    window.addEventListener('pagehide', saveNow)
    window.addEventListener('beforeunload', saveNow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', saveNow)
      window.removeEventListener('beforeunload', saveNow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gameState, address])

  // Handle tapping a waiting customer to start serving them
  const handleSelectCustomer = useCallback((customer: WaitingCustomer) => {
    if (gameState.currentOrder) return  // Already working on an order
    setSelectedCustomer(customer)
  }, [gameState.currentOrder])

  // Handle selecting a drink for the selected customer
  const handleSelectDrink = useCallback((drink: DrinkType) => {
    if (!selectedCustomer) return

    // Check if they picked the RIGHT drink
    const isCorrect = drink.drink === selectedCustomer.desiredDrink

    if (isCorrect) {
      // Correct! Haptic feedback
      haptic('medium')

      // Create order from customer + drink
      const order = createOrderFromCustomer(selectedCustomer, drink, gameState)

      // Remove customer from waiting list and set as current order
      setGameState(prev => ({
        ...prev,
        waitingCustomers: prev.waitingCustomers.filter(c => c.id !== selectedCustomer.id),
        currentOrder: order,
      }))
    } else {
      // Wrong drink! Screen shake + error haptic
      haptic('error')
      setScreenShake(true)
      setTimeout(() => setScreenShake(false), 500)

      setCustomerLeft(`${selectedCustomer.customerName} wanted ${selectedCustomer.desiredDrink}!`)
      setTimeout(() => setCustomerLeft(null), 3000)

      // Remove customer from waiting list, increment lost count
      setGameState(prev => ({
        ...prev,
        waitingCustomers: prev.waitingCustomers.filter(c => c.id !== selectedCustomer.id),
        customersLost: (prev.customersLost || 0) + 1,
      }))
    }

    setSelectedCustomer(null)
  }, [selectedCustomer, gameState, haptic])

  // Pop-up Collab claim handler
  const handleClaimPopup = useCallback(() => {
    if (!gameState.activePopup) return

    haptic('heavy')
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 1500)

    const { newState, beansEarned, customersServed } = claimPopup(gameState)

    // Show notification
    setPopupClaimed({
      name: gameState.activePopup.collab.name,
      beans: beansEarned,
      orders: customersServed,
    })
    setTimeout(() => setPopupClaimed(null), 3000)

    // Track for session/challenges
    setSessionBeans(prev => prev + beansEarned)
    setSessionOrders(prev => prev + customersServed)

    setGameState(newState)
  }, [gameState, haptic])

  // Tap handler - work on current order
  const handleTap = useCallback(() => {
    if (!gameState.currentOrder) return

    // Haptic feedback on tap
    haptic('light')

    // Track tap for challenge
    setSessionTaps(prev => prev + 1)

    // Check if this tap will complete the order
    const willComplete = gameState.currentOrder.workDone + gameState.tapPower >= gameState.currentOrder.workRequired

    if (willComplete) {
      // Order complete! Celebration
      haptic('heavy')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1000)
    }

    setGameState(prev => {
      if (!prev.currentOrder) return prev

      // Double shot chance
      let workMultiplier = 1
      if (prev.upgradeLevels.doubleShot > 0 && Math.random() < prev.upgradeLevels.doubleShot * 0.04) {
        workMultiplier = 2
      }

      const newWorkDone = prev.currentOrder.workDone + prev.tapPower * workMultiplier

      if (newWorkDone >= prev.currentOrder.workRequired) {
        // Tips chance
        let payment = prev.currentOrder.value
        if (prev.upgradeLevels.tippingCulture > 0 && Math.random() < prev.upgradeLevels.tippingCulture * 0.05) {
          payment = Math.floor(payment * 1.5)
        }

        setShowPayment({ amount: payment, id: prev.currentOrder.id })
        setTimeout(() => setShowPayment(null), 800)

        // Track for challenge
        setSessionBeans(b => b + payment)
        setSessionOrders(o => o + 1)

        // Track drink made for mastery
        const drinkName = prev.currentOrder.drink

        // Update regulars tracking
        const newRegulars = updateRegulars(prev.regulars, prev.currentOrder.customerName, drinkName)

        // ⌐◨-◨ Track Noun customers served
        const wasNoun = prev.currentOrder.isNoun

        return {
          ...prev,
          beans: prev.beans + payment,
          lifetimeBeans: prev.lifetimeBeans + payment,
          totalLifetimeBeans: prev.totalLifetimeBeans + payment,
          ordersCompleted: prev.ordersCompleted + 1,
          totalOrdersCompleted: prev.totalOrdersCompleted + 1,
          drinksMade: {
            ...prev.drinksMade,
            [drinkName]: (prev.drinksMade[drinkName] || 0) + 1,
          },
          regulars: newRegulars,
          currentOrder: null,  // Clear order, player must select next customer
          nounsServed: prev.nounsServed + (wasNoun ? 1 : 0),  // ⌐◨-◨
        }
      }

      return {
        ...prev,
        currentOrder: { ...prev.currentOrder, workDone: newWorkDone },
      }
    })
  }, [gameState.currentOrder, gameState.tapPower, haptic])

  // Upgrade handlers
  const handleUpgradeWithBeans = useCallback((upgradeId: UpgradeId) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId)
    if (!upgrade) return
    const level = gameState.upgradeLevels[upgradeId]
    if (level >= upgrade.maxLevel) return
    const cost = getUpgradeCost(upgrade, level)
    if (gameState.beans < cost) return

    // Track upgrade for challenge
    setSessionUpgrades(prev => prev + 1)

    setGameState(prev => {
      const newLevels = { ...prev.upgradeLevels, [upgradeId]: prev.upgradeLevels[upgradeId] + 1 }
      return {
        ...prev,
        beans: prev.beans - cost,
        upgradeLevels: newLevels,
        tapPower: 1 + newLevels.tapPower,
        baristas: newLevels.baristas,
      }
    })
  }, [gameState])

  const handleUpgradeWithNoun = useCallback((upgradeId: UpgradeId) => {
    if (!isConnected) return
    const upgrade = UPGRADES.find(u => u.id === upgradeId)
    if (!upgrade) return
    const level = gameState.upgradeLevels[upgradeId]
    if (level >= upgrade.maxLevel) return
    const nounCost = getUpgradeNounCost(upgrade, level)
    const nounBalanceNum = nounBalance ? parseFloat(formatUnits(nounBalance, 18)) : 0
    if (nounBalanceNum < nounCost) return

    setPendingUpgrade(upgradeId)
    writeContract({
      address: NOUN_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [BURN_ADDRESS, parseUnits(nounCost.toString(), 18)],
    })
  }, [isConnected, gameState.upgradeLevels, nounBalance, writeContract])

  // Prestige handlers
  const handleFranchisePrestige = useCallback(() => {
    if (!canPrestigeFranchise(gameState)) return
    const next = getNextFranchise(gameState)
    if (!next) return
    setGameState(prev => resetForFranchise(prev, next.bonus))
  }, [gameState])

  const handleEmpirePrestige = useCallback(() => {
    if (!canPrestigeEmpire(gameState)) return
    const next = getNextEmpire(gameState)
    if (!next) return
    setGameState(prev => resetForEmpire(prev, next.bonus))
  }, [gameState])

  const handleDynastyPrestige = useCallback(() => {
    if (!canPrestigeDynasty(gameState)) return
    const next = getNextDynasty(gameState)
    if (!next) return
    setGameState(prev => resetForDynasty(prev, next.bonus))
  }, [gameState])

  // Custom name handler
  const handleBuyCustomName = useCallback(() => {
    if (!isConnected || !newCustomName.trim()) return
    const nounBalanceNum = nounBalance ? parseFloat(formatUnits(nounBalance, 18)) : 0
    if (nounBalanceNum < CUSTOM_NAME_COST) return

    setPendingCustomName(true)
    writeContract({
      address: NOUN_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [BURN_ADDRESS, parseUnits(CUSTOM_NAME_COST.toString(), 18)],
    })
  }, [isConnected, newCustomName, nounBalance, writeContract])

  // Share
  const shareMilestone = useCallback(async () => {
    try {
      await sdk.actions.composeCast({
        text: `☕ My Noun Coffee Stats:\n\n📦 ${formatNumber(gameState.totalOrdersCompleted)} orders\n🏪 ${gameState.franchises} franchises\n🌍 ${gameState.empires} empires\n👑 ${gameState.dynasties} dynasties\n\nBuild your coffee empire!`,
        embeds: ['https://noun-idle.vercel.app/'],
      })
    } catch (e) {
      console.error('Failed to compose cast:', e)
    }
  }, [gameState])

  // Get challenge progress based on type
  const getChallengeProgress = useCallback(() => {
    if (!challengeState?.challenge) return 0
    switch (challengeState.challenge.type) {
      case 'orders': return sessionOrders
      case 'beans': return sessionBeans
      case 'taps': return sessionTaps
      case 'upgrades': return sessionUpgrades
      default: return 0
    }
  }, [challengeState, sessionOrders, sessionBeans, sessionTaps, sessionUpgrades])

  // Claim challenge reward
  const claimChallengeReward = useCallback(() => {
    if (!challengeState?.challenge || challengeState.claimed) return
    const progress = getChallengeProgress()
    if (progress < challengeState.challenge.target) return

    setGameState(prev => ({
      ...prev,
      beans: prev.beans + challengeState.challenge!.reward,
      lifetimeBeans: prev.lifetimeBeans + challengeState.challenge!.reward,
      totalLifetimeBeans: prev.totalLifetimeBeans + challengeState.challenge!.reward,
    }))
    setChallengeState(prev => prev ? { ...prev, claimed: true, completed: true } : null)
  }, [challengeState, getChallengeProgress])

  const formattedNounBalance = nounBalance ? parseFloat(formatUnits(nounBalance, 18)).toFixed(0) : '0'
  const nounBalanceNum = nounBalance ? parseFloat(formatUnits(nounBalance, 18)) : 0
  const currentOrder = gameState.currentOrder
  const progress = currentOrder ? Math.min(100, (currentOrder.workDone / currentOrder.workRequired) * 100) : 0
  const beansPerMin = getBeansPerMinute(gameState)
  const maxQueue = getMaxQueueSize(gameState)
  const totalMultiplier = getTotalMultiplier(gameState)
  const unlockedUpgrades = getUnlockedUpgrades(gameState)
  const nextDrink = getNextDrinkUnlock(gameState.totalOrdersCompleted)
  const nextFranchise = getNextFranchise(gameState)
  const nextEmpire = getNextEmpire(gameState)
  const nextDynasty = getNextDynasty(gameState)

  return (
    <div className={`min-h-screen flex flex-col px-4 py-4 max-w-md mx-auto transition-transform ${screenShake ? 'animate-shake' : ''}`}>
      {/* Confetti celebration */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'][i % 5],
                width: '10px',
                height: '10px',
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}

      {/* Pop-up Collab - floating bonus button */}
      {gameState.activePopup && (
        <button
          onClick={handleClaimPopup}
          className={`fixed z-40 transform -translate-x-1/2 -translate-y-1/2
            ${gameState.activePopup.collab.rarity === 'legendary'
              ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 animate-pulse'
              : gameState.activePopup.collab.rarity === 'rare'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
            }
            px-4 py-3 rounded-2xl shadow-2xl border-2 border-white/30
            hover:scale-110 active:scale-95 transition-transform cursor-pointer`}
          style={{
            left: `${gameState.activePopup.x}%`,
            top: `${gameState.activePopup.y}%`,
            animation: 'bounce 1s ease-in-out infinite, pulse 0.5s ease-in-out infinite',
          }}
        >
          <div className="text-center">
            <div className="text-2xl mb-1">{gameState.activePopup.collab.emoji}</div>
            <div className="text-white font-bold text-sm whitespace-nowrap">
              {gameState.activePopup.collab.name}
            </div>
            <div className="text-white/80 text-xs">TAP!</div>
          </div>
          {/* Countdown ring */}
          <div
            className="absolute inset-0 rounded-2xl border-4 border-white/50"
            style={{
              animation: `shrink ${POPUP_DURATION}ms linear forwards`,
            }}
          />
        </button>
      )}

      {/* Pop-up claimed notification */}
      {popupClaimed && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl shadow-xl">
            <div className="font-bold text-center">{popupClaimed.name}</div>
            <div className="text-center text-sm">
              +{formatNumber(popupClaimed.beans)} beans
              {popupClaimed.orders > 0 && ` • ${popupClaimed.orders} customers served!`}
            </div>
          </div>
        </div>
      )}

      {/* Offline earnings modal */}
      {offlineEarnings && offlineEarnings.beans > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setOfflineEarnings(null)}
        >
          <div
            className="bg-gradient-to-b from-silver-800 to-silver-900 border border-amber-500/30 rounded-2xl p-5 max-w-xs w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">☕</div>
              <h3 className="text-xl font-bold text-silver-100 mb-1">Welcome Back!</h3>
              <p className="text-silver-400 text-sm mb-4">
                Your baristas kept working while you were away for {formatTimeAway(offlineEarnings.timeAway)}
              </p>

              <div className="bg-silver-900/50 rounded-xl p-4 mb-4">
                <div className="text-amber-300 text-3xl font-bold">
                  +{formatNumber(offlineEarnings.beans)}
                </div>
                <div className="text-silver-400 text-sm">beans earned</div>
                {offlineEarnings.ordersEstimated > 0 && (
                  <div className="text-silver-500 text-xs mt-1">
                    ~{formatNumber(offlineEarnings.ordersEstimated)} orders completed
                  </div>
                )}
              </div>

              <button
                onClick={() => setOfflineEarnings(null)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl"
              >
                Collect!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drink info modal with mastery */}
      {selectedDrink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setSelectedDrink(null)}
        >
          <div
            className="bg-silver-900 border border-silver-700 rounded-2xl p-4 max-w-xs w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const made = gameState.drinksMade[selectedDrink.drink] || 0
              const currentTier = getMasteryTier(made)
              const nextTier = getNextMasteryTier(made)
              return (
                <>
                  <div className="text-center mb-3">
                    <span className="text-4xl">{selectedDrink.emoji}</span>
                    <h3 className="text-xl font-bold text-silver-100 mt-2">{selectedDrink.drink}</h3>
                  </div>

                  {/* Mastery section */}
                  <div className="bg-silver-800/50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{currentTier.emoji}</span>
                        <span className="text-silver-200 font-medium">{currentTier.tierName}</span>
                      </div>
                      {currentTier.beanBonus > 0 && (
                        <span className="text-green-400 text-sm">+{currentTier.beanBonus}% beans</span>
                      )}
                    </div>
                    <div className="text-silver-400 text-xs mb-1">
                      {formatNumber(made)} made
                    </div>
                    {nextTier && (
                      <>
                        <div className="h-2 bg-silver-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                            style={{ width: `${Math.min(100, (made / nextTier.count) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-silver-500 mt-1">
                          <span>{formatNumber(made)}/{formatNumber(nextTier.count)}</span>
                          <span>{nextTier.emoji} {nextTier.tierName} (+{nextTier.beanBonus}%)</span>
                        </div>
                      </>
                    )}
                    {!nextTier && (
                      <div className="text-center text-amber-300 text-xs">Max Mastery!</div>
                    )}
                  </div>

                  {selectedDrink.origin && (
                    <div className="text-amber-400 text-sm text-center mb-1">{selectedDrink.origin}</div>
                  )}
                  {selectedDrink.notes && (
                    <div className="text-silver-300 text-sm text-center mb-2">
                      <span className="text-silver-500">Notes:</span> {selectedDrink.notes}
                    </div>
                  )}
                  {selectedDrink.description && (
                    <div className="text-silver-400 text-xs text-center">{selectedDrink.description}</div>
                  )}
                  <button
                    onClick={() => setSelectedDrink(null)}
                    className="w-full mt-4 py-2 bg-silver-800 text-silver-300 rounded-lg text-sm"
                  >
                    Close
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Drink Selection Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-silver-900 border border-silver-700 rounded-2xl p-4 max-w-sm w-full shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Customer info and their order */}
            <div className="text-center mb-4">
              <span className="text-4xl">{selectedCustomer.customerEmoji}</span>
              <h3 className="text-lg font-bold text-silver-100 mt-1">{selectedCustomer.customerName}</h3>

              {/* Speech bubble with their order */}
              <div className="mt-3 bg-white text-silver-900 rounded-2xl px-4 py-3 relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45"></div>
                <div>
                  {selectedCustomer.isRegular && (
                    <div className="text-xs text-amber-600 mb-1">⭐ Regular customer</div>
                  )}
                  <div className="text-sm text-silver-600">I'd like a...</div>
                  <div className="font-bold text-lg">{selectedCustomer.desiredDrinkEmoji} {selectedCustomer.desiredDrink}</div>
                </div>
              </div>
            </div>

            {/* Drink options */}
            <div className="text-silver-400 text-xs mb-2">Select the correct drink:</div>
            <div className="grid grid-cols-2 gap-2">
              {getUnlockedDrinks(gameState.totalOrdersCompleted, gameState).map((drink) => {
                const masteryTier = getMasteryTier(gameState.drinksMade[drink.drink] || 0)
                const isNounish = drink.drink === 'The Nounish'

                return (
                  <button
                    key={drink.drink}
                    onClick={() => handleSelectDrink(drink)}
                    className={`p-3 rounded-xl transition-all text-left border hover:bg-silver-700 ${
                      isNounish
                        ? 'bg-gradient-to-br from-red-900/30 to-silver-800 border-red-500/50 hover:border-red-400'
                        : 'bg-silver-800 border-silver-700 hover:border-silver-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{drink.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm truncate ${isNounish ? 'text-red-200' : 'text-silver-100'}`}>
                          {drink.drink}
                        </div>
                        <div className="text-silver-400 text-xs">+{drink.baseValue} beans</div>
                      </div>
                      <span className="text-xs">{masteryTier.emoji}</span>
                    </div>
                  </button>
                )
              })}
              {/* Show locked drinks as teaser */}
              {ALL_DRINKS.filter(d => d.unlocksAt > gameState.totalOrdersCompleted).slice(0, 2).map((drink) => (
                <div
                  key={drink.drink}
                  className="p-3 rounded-xl bg-silver-900/50 border border-silver-800 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl blur-sm">❓</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-silver-500 text-sm">???</div>
                      <div className="text-silver-600 text-xs">🔒 {drink.unlocksAt} orders</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedCustomer(null)}
              className="w-full mt-4 py-2 bg-silver-800 text-silver-400 rounded-lg text-sm"
            >
              Cancel (customer keeps waiting)
            </button>
          </div>
        </div>
      )}

      {/* Achievement popup */}
      {newAchievement && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{newAchievement.emoji}</span>
            <div>
              <div className="font-bold">{newAchievement.name}</div>
              <div className="text-xs opacity-80">+{(newAchievement.bonus * 100).toFixed(0)}% bonus!</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="text-3xl font-bold text-silver-100">
            {formatNumber(gameState.beans)} <span className="text-xl text-silver-400">beans</span>
          </div>
          <div className="text-silver-500 text-xs flex gap-2">
            {beansPerMin > 0 && <span>≈{formatNumber(beansPerMin)}/min</span>}
            <span>{totalMultiplier.toFixed(1)}x multiplier</span>
          </div>
        </div>

        <div className="text-right">
          {isConnected ? (
            <div>
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg px-3 py-1.5">
                <div className="text-xs text-amber-400/80 flex justify-between items-center">
                  <span>$NOUN</span>
                  <a
                    href={`https://app.uniswap.org/swap?outputCurrency=${NOUN_TOKEN_ADDRESS}&chain=base`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500/60 hover:text-amber-400 text-[10px]"
                  >
                    Buy ↗
                  </a>
                </div>
                <div className="text-lg font-bold text-amber-300">{formattedNounBalance}</div>
              </div>
              {saveStatus && (
                <div className={`text-[10px] mt-1 text-center ${
                  saveStatus === 'saved' ? 'text-green-400' :
                  saveStatus === 'saving' ? 'text-silver-400' :
                  'text-red-400'
                }`}>
                  {saveStatus === 'saved' && '☁️ Saved'}
                  {saveStatus === 'saving' && '☁️ Saving...'}
                  {saveStatus === 'error' && '☁️ Save failed'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${NOUN_TOKEN_ADDRESS}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-silver-800/50 border border-silver-600/50 rounded-lg px-3 py-2 text-sm text-silver-400 hover:text-silver-300"
              >
                Buy $NOUN
              </a>
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="bg-silver-800/50 border border-silver-600/50 rounded-lg px-3 py-2 text-sm text-silver-300"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prestige indicators */}
      <div className="flex gap-2 mb-3 text-xs">
        {gameState.franchises > 0 && (
          <div className="bg-blue-500/20 border border-blue-500/30 rounded px-2 py-1 text-blue-300">
            🏪 {gameState.franchises} Franchise{gameState.franchises !== 1 ? 's' : ''}
          </div>
        )}
        {gameState.empires > 0 && (
          <div className="bg-purple-500/20 border border-purple-500/30 rounded px-2 py-1 text-purple-300">
            🌍 {gameState.empires} Empire{gameState.empires !== 1 ? 's' : ''}
          </div>
        )}
        {gameState.dynasties > 0 && (
          <div className="bg-amber-500/20 border border-amber-500/30 rounded px-2 py-1 text-amber-300">
            👑 {gameState.dynasties} Dynast{gameState.dynasties !== 1 ? 'ies' : 'y'}
          </div>
        )}
      </div>

      {/* Customer Left notification */}
      {customerLeft && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <span className="text-xl">😤</span>
            <span className="font-medium">{customerLeft} left!</span>
          </div>
        </div>
      )}

      {/* Waiting Customers Queue (with patience bars) */}
      <div className="mb-3">
        <div className="text-silver-400 text-xs mb-1 flex justify-between">
          <span>Waiting Customers</span>
          <span>{gameState.waitingCustomers.length}/{maxQueue}</span>
        </div>
        <div className="flex gap-1.5 min-h-[52px] bg-silver-900/50 rounded-lg p-1.5 overflow-x-auto">
          {gameState.waitingCustomers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-silver-600 text-xs">
              Waiting for customers...
            </div>
          ) : (
            gameState.waitingCustomers.map((customer) => {
              const patiencePercent = (customer.patience / customer.maxPatience) * 100
              const isUrgent = patiencePercent < 30
              const regular = gameState.regulars[customer.customerName]
              const isKnownRegular = regular && regular.visitsCount >= VISITS_TO_BECOME_REGULAR
              const isNoun = customer.isNoun  // ⌐◨-◨

              return (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  disabled={!!gameState.currentOrder}
                  className={`flex-shrink-0 flex flex-col items-center p-1 rounded-lg transition-all
                    ${gameState.currentOrder ? 'opacity-50 cursor-not-allowed' : 'hover:bg-silver-700/50 cursor-pointer'}
                    ${isNoun ? 'bg-gradient-to-br from-red-600/40 to-red-900/40 border-2 border-red-500/60 animate-pulse' :
                      isKnownRegular ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-silver-800'}
                    ${isUrgent && !isNoun ? 'animate-pulse' : ''}`}
                  title={`${customer.customerName} (${customer.customerType})${isKnownRegular ? ' ⭐ Regular' : ''}${isNoun ? ' ⌐◨-◨ NOUN!' : ''}`}
                >
                  <span className="text-lg">{customer.customerEmoji}</span>
                  <span className="text-[9px] text-silver-400 truncate w-10 text-center">
                    {customer.customerName}
                  </span>
                  {/* Patience bar */}
                  <div className="w-10 h-1 bg-silver-700 rounded-full mt-0.5 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isUrgent ? 'bg-red-500' : patiencePercent < 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${patiencePercent}%` }}
                    />
                  </div>
                  {isKnownRegular && <span className="text-[8px] text-amber-400">⭐</span>}
                </button>
              )
            })
          )}
        </div>
        {gameState.currentOrder && gameState.waitingCustomers.length > 0 && (
          <div className="text-center text-silver-500 text-[10px] mt-1">
            Finish current order to serve next customer
          </div>
        )}
      </div>

      {/* Baristas working */}
      {gameState.baristaOrders && gameState.baristaOrders.length > 0 && (
        <div className="mb-3">
          <div className="text-silver-400 text-xs mb-1 flex justify-between">
            <span>👨‍🍳 Baristas Working</span>
            <span>{gameState.baristaOrders.length}/{gameState.baristas}</span>
          </div>
          <div className="flex gap-2 bg-silver-900/50 rounded-lg p-2">
            {gameState.baristaOrders.map((order) => {
              const progress = (order.workDone / order.workRequired) * 100
              return (
                <div key={order.id} className="flex-1 bg-silver-800 rounded-lg p-2 max-w-[100px]">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{order.customerEmoji}</span>
                    <span className="text-[10px] text-silver-400 truncate">{order.customerName}</span>
                  </div>
                  <div className="text-xs text-silver-300 truncate">{order.drinkEmoji} {order.drink}</div>
                  <div className="h-1 bg-silver-700 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Coming Soon / Goals Teaser */}
      <div className="bg-gradient-to-r from-silver-800/50 to-silver-900/50 rounded-lg px-3 py-2 mb-3 border border-silver-700/30">
        <div className="text-[10px] text-silver-500 mb-1">🎯 NEXT GOALS</div>
        <div className="flex gap-3 overflow-x-auto text-xs">
          {/* Next drink unlock */}
          {nextDrink && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base blur-[2px]">{nextDrink.emoji}</span>
              <div>
                <div className="text-silver-300 font-medium">New Drink</div>
                <div className="text-silver-500 text-[10px]">
                  {gameState.totalOrdersCompleted}/{nextDrink.unlocksAt} orders
                </div>
              </div>
            </div>
          )}

          {/* Next franchise */}
          {nextFranchise && (
            <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-silver-700/50 pl-3">
              <span className="text-base">{nextFranchise.emoji}</span>
              <div>
                <div className="text-blue-300 font-medium">{nextFranchise.name}</div>
                <div className="text-silver-500 text-[10px]">
                  {formatNumber(gameState.lifetimeBeans)}/{formatNumber(nextFranchise.beans)} beans
                </div>
              </div>
            </div>
          )}

          {/* Next customer type unlock */}
          {(() => {
            const nextCustomer = ALL_CUSTOMERS.find(c => {
              if (c.unlocksAt.type === 'orders') return gameState.totalOrdersCompleted < c.unlocksAt.count
              if (c.unlocksAt.type === 'franchises') return gameState.franchises < c.unlocksAt.count
              if (c.unlocksAt.type === 'empires') return gameState.empires < c.unlocksAt.count
              return false
            })
            if (!nextCustomer) return null
            return (
              <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-silver-700/50 pl-3">
                <span className="text-base grayscale">❓</span>
                <div>
                  <div className="text-amber-300 font-medium">New Customer</div>
                  <div className="text-silver-500 text-[10px]">
                    {nextCustomer.unlocksAt.count} {nextCustomer.unlocksAt.type}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Current Order / Select Customer */}
      <div className="flex-1 flex flex-col items-center justify-center mb-3">
        {currentOrder ? (
          <div className="w-full max-w-xs">
            <div className="text-center mb-3">
              <div className={`text-4xl mb-1 ${currentOrder.isSpecial ? 'animate-pulse' : ''}`}>
                {currentOrder.customerEmoji}
              </div>
              <div className="text-silver-200 font-medium">{currentOrder.customerName}</div>
              <button
                onClick={() => {
                  const drink = ALL_DRINKS.find(d => d.drink === currentOrder.drink)
                  if (drink) setSelectedDrink(drink)
                }}
                className="text-silver-400 text-sm hover:text-amber-300 transition-colors underline decoration-dotted"
              >
                {currentOrder.drinkEmoji} {currentOrder.drink}
              </button>
              {/* Show regular status */}
              {currentOrder.wasRegular && (
                <div className={`text-xs mt-1 ${currentOrder.gotPreferred ? 'text-green-400' : 'text-red-400'}`}>
                  {currentOrder.gotPreferred ? '⭐ Their usual! 2x beans' : '😕 Not their usual...'}
                </div>
              )}
            </div>

            <div className="mb-3">
              <div className="h-3 bg-silver-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    currentOrder.isSpecial
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                      : currentOrder.gotPreferred
                        ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                        : 'bg-gradient-to-r from-silver-400 to-silver-300'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-silver-500 mt-1">
                <span>{Math.floor(currentOrder.workDone)}/{currentOrder.workRequired}</span>
                <span className={currentOrder.gotPreferred ? 'text-green-400 font-medium' : currentOrder.isSpecial ? 'text-amber-300 font-medium' : 'text-silver-300'}>
                  +{currentOrder.value} beans
                </span>
              </div>
            </div>

            <button
              onClick={handleTap}
              className="relative w-full py-6 rounded-2xl bg-gradient-to-br from-silver-300 to-silver-500
                         text-silver-900 font-bold text-xl active:scale-95 transition-transform shadow-lg brew-button"
            >
              {gameState.upgradeLevels.autoBrew > 0 ? '⚡ Boost!' : '☕ Make Drink'}
              {showPayment && (
                <span className="absolute top-1 right-3 text-green-400 font-bold animate-bounce text-sm">
                  +{showPayment.amount}
                </span>
              )}
            </button>

            <div className="text-center text-silver-500 text-xs mt-1">
              {gameState.upgradeLevels.autoBrew > 0 ? (
                <span className="text-silver-400">Auto-brewing • Tap for bonus</span>
              ) : (
                <span className="text-silver-400">Tap to make drinks!</span>
              )}
              {gameState.baristas > 0 && <span> • {gameState.baristas} barista{gameState.baristas !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        ) : gameState.waitingCustomers.length > 0 ? (
          <div className="text-center text-silver-400">
            <div className="text-4xl mb-2">👆</div>
            <div className="text-sm">Tap a customer above to serve them!</div>
            <div className="text-xs text-silver-500 mt-1">
              Choose wisely - regulars want their usual drink
            </div>
          </div>
        ) : (
          <div className="text-center text-silver-500">
            <div className="text-4xl mb-2">☕</div>
            <div className="text-sm">Waiting for customers...</div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-4 mb-3 text-center text-xs">
        <div>
          <div className="text-lg font-bold text-silver-200">{formatNumber(gameState.totalOrdersCompleted)}</div>
          <div className="text-silver-500">Orders</div>
        </div>
        <div>
          <div className="text-lg font-bold text-silver-200">{gameState.unlockedAchievements.length}/{ACHIEVEMENTS.length}</div>
          <div className="text-silver-500">Achievements</div>
        </div>
        <div>
          <div className="text-lg font-bold text-silver-200">{getUnlockedDrinks(gameState.totalOrdersCompleted).length}</div>
          <div className="text-silver-500">Drinks</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2">
        {(['shop', 'prestige', 'daily', 'vip'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition-colors ${
              activeTab === tab ? 'bg-silver-300 text-silver-900' : 'bg-silver-800/50 text-silver-400'
            }`}
          >
            {tab === 'shop' && '⬆️ Shop'}
            {tab === 'prestige' && '🏆 Prestige'}
            {tab === 'daily' && '📅 Daily'}
            {tab === 'vip' && '⭐ VIP'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-shrink-0 max-h-52 overflow-y-auto">
        {activeTab === 'shop' && (
          <div className="space-y-2">
            {unlockedUpgrades.map(upgrade => {
              const level = gameState.upgradeLevels[upgrade.id]
              const beanCost = getUpgradeCost(upgrade, level)
              const nounCost = getUpgradeNounCost(upgrade, level)
              const canAffordBeans = gameState.beans >= beanCost
              const canAffordNoun = nounBalanceNum >= nounCost
              const maxed = level >= upgrade.maxLevel

              return (
                <div key={upgrade.id} className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{upgrade.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-silver-200 text-sm truncate">{upgrade.name}</span>
                        <div className="flex items-center gap-1">
                          {upgrade.tier > 1 && (
                            <span className={`text-[10px] px-1 rounded ${
                              upgrade.tier === 2 ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300'
                            }`}>
                              T{upgrade.tier}
                            </span>
                          )}
                          <span className="text-silver-500 text-xs">Lv.{level}</span>
                        </div>
                      </div>
                      <div className="text-silver-400 text-xs">{upgrade.getEffect(level + 1)}</div>
                    </div>
                  </div>
                  {maxed ? (
                    <div className="text-center text-silver-500 text-xs py-0.5">MAX</div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleUpgradeWithBeans(upgrade.id)}
                        disabled={!canAffordBeans}
                        className={`flex-1 py-1 rounded text-xs font-medium ${
                          canAffordBeans ? 'bg-silver-600 text-silver-100' : 'bg-silver-800 text-silver-600'
                        }`}
                      >
                        {formatNumber(beanCost)} beans
                      </button>
                      <button
                        onClick={() => handleUpgradeWithNoun(upgrade.id)}
                        disabled={!canAffordNoun || !isConnected || isTxPending}
                        className={`flex-1 py-1 rounded text-xs font-medium ${
                          canAffordNoun && isConnected
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            : 'bg-silver-800 text-silver-600'
                        }`}
                      >
                        {isTxPending && pendingUpgrade === upgrade.id ? '...' : `${formatNumber(nounCost)} $NOUN`}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Locked Tier 2 upgrades preview */}
            {gameState.franchises === 0 && gameState.empires === 0 && (
              <div className="mt-2 pt-2 border-t border-silver-700/50">
                <div className="text-silver-500 text-xs mb-2 flex items-center gap-1">
                  <span>🔒</span> Unlocks at first Franchise:
                </div>
                {UPGRADES.filter(u => u.tier === 2).slice(0, 2).map(upgrade => (
                  <div key={upgrade.id} className="bg-silver-900/30 border border-silver-800/50 rounded-xl p-2 mb-1 opacity-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl grayscale">{upgrade.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-silver-500 text-sm">{upgrade.name}</div>
                        <div className="text-silver-600 text-xs">{upgrade.description}</div>
                      </div>
                      <span className="text-blue-400/50 text-[10px] px-1 rounded bg-blue-500/10">T2</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Locked Tier 3 upgrades preview */}
            {gameState.empires === 0 && (gameState.franchises > 0 || gameState.dynasties > 0) && (
              <div className="mt-2 pt-2 border-t border-silver-700/50">
                <div className="text-silver-500 text-xs mb-2 flex items-center gap-1">
                  <span>🔒</span> Unlocks at first Empire:
                </div>
                {UPGRADES.filter(u => u.tier === 3).slice(0, 2).map(upgrade => (
                  <div key={upgrade.id} className="bg-silver-900/30 border border-silver-800/50 rounded-xl p-2 mb-1 opacity-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl grayscale">{upgrade.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-silver-500 text-sm">{upgrade.name}</div>
                        <div className="text-silver-600 text-xs">{upgrade.description}</div>
                      </div>
                      <span className="text-purple-400/50 text-[10px] px-1 rounded bg-purple-500/10">T3</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'prestige' && (
          <div className="space-y-3">
            {/* Franchise */}
            {nextFranchise && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{nextFranchise.emoji}</span>
                  <div>
                    <div className="font-medium text-blue-200 text-sm">{nextFranchise.name}</div>
                    <div className="text-blue-400 text-xs">+{(nextFranchise.bonus * 100).toFixed(0)}% value</div>
                  </div>
                </div>
                <div className="h-2 bg-silver-700 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (gameState.lifetimeBeans / nextFranchise.beans) * 100)}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-silver-500">{formatNumber(gameState.lifetimeBeans)}/{formatNumber(nextFranchise.beans)}</span>
                  <button
                    onClick={handleFranchisePrestige}
                    disabled={!canPrestigeFranchise(gameState)}
                    className="px-3 py-1 rounded text-xs font-medium disabled:bg-silver-700 disabled:text-silver-500 bg-blue-500 text-white"
                  >
                    {canPrestigeFranchise(gameState) ? 'Prestige!' : 'Not ready'}
                  </button>
                </div>
              </div>
            )}

            {/* Empire */}
            {nextEmpire && gameState.franchises >= 1 && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{nextEmpire.emoji}</span>
                  <div>
                    <div className="font-medium text-purple-200 text-sm">{nextEmpire.name}</div>
                    <div className="text-purple-400 text-xs">+{(nextEmpire.bonus * 100).toFixed(0)}% value (resets franchises)</div>
                  </div>
                </div>
                <div className="h-2 bg-silver-700 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-purple-500" style={{ width: `${(gameState.franchises / nextEmpire.franchises) * 100}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-silver-500">{gameState.franchises}/{nextEmpire.franchises} franchises</span>
                  <button
                    onClick={handleEmpirePrestige}
                    disabled={!canPrestigeEmpire(gameState)}
                    className="px-3 py-1 rounded text-xs font-medium disabled:bg-silver-700 disabled:text-silver-500 bg-purple-500 text-white"
                  >
                    {canPrestigeEmpire(gameState) ? 'Ascend!' : 'Not ready'}
                  </button>
                </div>
              </div>
            )}

            {/* Dynasty */}
            {nextDynasty && gameState.empires >= 1 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{nextDynasty.emoji}</span>
                  <div>
                    <div className="font-medium text-amber-200 text-sm">{nextDynasty.name}</div>
                    <div className="text-amber-400 text-xs">+{(nextDynasty.bonus * 100).toFixed(0)}% value (resets empires)</div>
                  </div>
                </div>
                <div className="h-2 bg-silver-700 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-amber-500" style={{ width: `${(gameState.empires / nextDynasty.empires) * 100}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-silver-500">{gameState.empires}/{nextDynasty.empires} empires</span>
                  <button
                    onClick={handleDynastyPrestige}
                    disabled={!canPrestigeDynasty(gameState)}
                    className="px-3 py-1 rounded text-xs font-medium disabled:bg-silver-700 disabled:text-silver-500 bg-amber-500 text-white"
                  >
                    {canPrestigeDynasty(gameState) ? 'Transcend!' : 'Not ready'}
                  </button>
                </div>
              </div>
            )}

            {/* Multiplier summary */}
            <div className="text-center text-silver-400 text-xs">
              Total multiplier: {totalMultiplier.toFixed(2)}x
            </div>
          </div>
        )}

        {activeTab === 'daily' && (
          <div className="space-y-3">
            {/* Daily Challenge */}
            {challengeState?.challenge && (
              <div className={`rounded-xl p-3 ${
                challengeState.claimed
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{challengeState.challenge.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold text-silver-100 text-sm">Daily Challenge</div>
                    <div className="text-silver-300 text-xs">{challengeState.challenge.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-300 font-bold text-sm">+{formatNumber(challengeState.challenge.reward)}</div>
                    <div className="text-silver-500 text-xs">beans</div>
                  </div>
                </div>
                <div className="h-2 bg-silver-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all ${challengeState.claimed ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (getChallengeProgress() / challengeState.challenge.target) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-silver-400">
                    {formatNumber(getChallengeProgress())}/{formatNumber(challengeState.challenge.target)}
                  </span>
                  {challengeState.claimed ? (
                    <span className="text-green-400 text-xs font-medium">Claimed!</span>
                  ) : getChallengeProgress() >= challengeState.challenge.target ? (
                    <button
                      onClick={claimChallengeReward}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded text-xs font-medium"
                    >
                      Claim Reward!
                    </button>
                  ) : (
                    <span className="text-silver-500 text-xs">In Progress</span>
                  )}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-silver-100 text-sm">🏆 Leaderboard</div>
                {playerRank && (
                  <div className="text-xs text-silver-400">
                    Your rank: <span className="text-amber-300 font-medium">#{playerRank.rank}</span>
                  </div>
                )}
              </div>
              {leaderboard.length === 0 ? (
                <div className="text-center text-silver-500 text-xs py-2">
                  Connect wallet to join the leaderboard!
                </div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.slice(0, 10).map((entry, i) => (
                    <div
                      key={entry.address}
                      className={`flex items-center gap-2 py-1 px-2 rounded ${
                        address?.toLowerCase() === entry.address
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : i < 3 ? 'bg-silver-700/30' : ''
                      }`}
                    >
                      <span className="w-5 text-center font-bold text-xs">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      <span className="flex-1 text-silver-200 text-xs truncate">
                        {entry.displayName}
                      </span>
                      <span className="text-silver-400 text-xs">
                        {formatNumber(entry.score)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recipe Mastery */}
            <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-silver-100 text-sm">📖 Recipe Mastery</div>
                <div className="text-xs text-silver-400">
                  Tap drinks to see details
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {getUnlockedDrinks(gameState.totalOrdersCompleted, gameState).map(drink => {
                  const made = gameState.drinksMade[drink.drink] || 0
                  const tier = getMasteryTier(made)
                  const isNounish = drink.drink === 'The Nounish'
                  return (
                    <button
                      key={drink.drink}
                      onClick={() => setSelectedDrink(drink)}
                      className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                        isNounish
                          ? 'bg-gradient-to-br from-red-900/50 to-silver-900/50 border border-red-500/30 hover:border-red-400'
                          : 'bg-silver-900/50 hover:bg-silver-700/50'
                      }`}
                    >
                      <span className="text-xl">{drink.emoji}</span>
                      <span className={`text-[10px] truncate w-full text-center ${isNounish ? 'text-red-300' : 'text-silver-400'}`}>
                        {drink.drink}
                      </span>
                      <span className="text-xs">{tier.emoji}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Customer Types - Unlocked & Locked */}
            <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-3">
              <div className="font-bold text-silver-100 text-sm mb-2">👥 Customer Types</div>
              <div className="space-y-1">
                {ALL_CUSTOMERS.map(customer => {
                  const isUnlocked =
                    (customer.unlocksAt.type === 'orders' && gameState.totalOrdersCompleted >= customer.unlocksAt.count) ||
                    (customer.unlocksAt.type === 'franchises' && gameState.franchises >= customer.unlocksAt.count) ||
                    (customer.unlocksAt.type === 'empires' && gameState.empires >= customer.unlocksAt.count)

                  return (
                    <div
                      key={customer.name}
                      className={`flex items-center gap-2 py-1 px-2 rounded ${
                        isUnlocked ? 'bg-silver-700/30' : 'bg-silver-900/30 opacity-50'
                      }`}
                    >
                      <span className={`text-lg ${isUnlocked ? '' : 'grayscale'}`}>
                        {isUnlocked ? customer.emoji : '❓'}
                      </span>
                      <div className="flex-1">
                        <div className={`text-xs font-medium ${isUnlocked ? 'text-silver-200' : 'text-silver-500'}`}>
                          {isUnlocked ? customer.name : '???'}
                        </div>
                        {isUnlocked ? (
                          <div className="text-[10px] text-silver-400">
                            {customer.valueMultiplier}x value • {customer.patience}s patience
                          </div>
                        ) : (
                          <div className="text-[10px] text-silver-600">
                            🔒 {customer.unlocksAt.count} {customer.unlocksAt.type}
                          </div>
                        )}
                      </div>
                      {isUnlocked && customer.valueMultiplier >= 2 && (
                        <span className="text-amber-400 text-[10px]">💰</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Achievements with secrets */}
            <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-silver-100 text-sm">🏅 Achievements</div>
                <div className="text-xs text-silver-400">
                  {gameState.unlockedAchievements.length}/{ACHIEVEMENTS.length}
                </div>
              </div>
              <div className="space-y-1">
                {/* Regular achievements */}
                {ACHIEVEMENTS.filter(a => !a.secret).map(a => {
                  const unlocked = gameState.unlockedAchievements.includes(a.id)
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${
                        unlocked ? 'bg-green-500/20' : 'bg-silver-900/30 opacity-60'
                      }`}
                    >
                      <span>{a.emoji}</span>
                      <span className={unlocked ? 'text-silver-200' : 'text-silver-500'}>{a.name}</span>
                      {unlocked && <span className="text-green-400 ml-auto">✓</span>}
                    </div>
                  )
                })}

                {/* Secret achievements */}
                <div className="text-silver-500 text-[10px] mt-2 mb-1">🔮 Secret Achievements</div>
                {ACHIEVEMENTS.filter(a => a.secret).map(a => {
                  const unlocked = gameState.unlockedAchievements.includes(a.id)
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${
                        unlocked ? 'bg-purple-500/20' : 'bg-silver-900/30'
                      }`}
                    >
                      <span>{unlocked ? a.emoji : '❓'}</span>
                      <div className="flex-1">
                        <div className={unlocked ? 'text-purple-200' : 'text-silver-500'}>
                          {unlocked ? a.name : '???'}
                        </div>
                        {!unlocked && a.hint && (
                          <div className="text-silver-600 text-[10px] italic">{a.hint}</div>
                        )}
                      </div>
                      {unlocked && <span className="text-purple-400 ml-auto">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vip' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-3">
              <div className="text-center mb-2">
                <div className="font-bold text-amber-300">Add Your Name</div>
                <div className="text-silver-400 text-xs">
                  Burn {formatNumber(CUSTOM_NAME_COST)} $NOUN - everyone sees you as a customer!
                </div>
              </div>
              <input
                type="text"
                value={newCustomName}
                onChange={(e) => setNewCustomName(e.target.value.slice(0, 20))}
                placeholder="Your name..."
                className="w-full bg-silver-900/50 border border-silver-700 rounded-lg px-3 py-1.5 text-silver-200 text-sm mb-2"
                maxLength={20}
              />
              <button
                onClick={handleBuyCustomName}
                disabled={!isConnected || !newCustomName.trim() || nounBalanceNum < CUSTOM_NAME_COST || isTxPending}
                className={`w-full py-1.5 rounded-lg font-medium text-sm ${
                  isConnected && newCustomName.trim() && nounBalanceNum >= CUSTOM_NAME_COST
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    : 'bg-silver-700/50 text-silver-500'
                }`}
              >
                {isTxPending && pendingCustomName ? 'Burning...' : `Burn ${formatNumber(CUSTOM_NAME_COST)} $NOUN`}
              </button>
            </div>

            {customNames.length > 0 && (
              <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-2">
                <div className="text-silver-400 text-xs mb-1">VIP Customers ({customNames.length})</div>
                <div className="flex flex-wrap gap-1">
                  {customNames.slice(0, 30).map((name, i) => (
                    <span key={i} className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share */}
      <button
        onClick={shareMilestone}
        className="mt-3 w-full bg-silver-800/50 border border-silver-700/50 rounded-xl py-1.5 text-silver-400 text-sm"
      >
        📣 Share
      </button>
    </div>
  )
}
