'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { sdk } from '@farcaster/miniapp-sdk'
import {
  GameState,
  Order,
  Achievement,
  ChallengeState,
  UPGRADES,
  FRANCHISE_MILESTONES,
  EMPIRE_MILESTONES,
  DYNASTY_MILESTONES,
  ACHIEVEMENTS,
  CUSTOMER_NAMES,
  ALL_DRINKS,
  generateOrder,
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
  CUSTOM_NAME_COST,
  UpgradeId,
  shouldResetChallenge,
  createChallengeState,
  getTodayKey,
} from '@/lib/game'
import { NOUN_TOKEN_ADDRESS, BURN_ADDRESS, ERC20_ABI } from '@/lib/constants'

const STORAGE_KEY = 'noun-idle-v5-save'

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

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const customNamesRef = useRef<string[]>([])
  const lastCloudSaveRef = useRef<string>('')

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

  // Load local save on startup (before wallet connects)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = migrateSave(JSON.parse(saved) as GameState)
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

        // Customer arrivals
        const customerInterval = Math.max(1, 5 - prev.upgradeLevels.customerRate * 0.3) * 1000
        if (now - prev.lastCustomerTime >= customerInterval && prev.orderQueue.length < maxQueue) {
          const newOrder = generateOrder(prev, customNamesRef.current)
          updated.orderQueue = [...prev.orderQueue, newOrder]
          updated.lastCustomerTime = now
        }

        // Ensure current order
        if (!updated.currentOrder && updated.orderQueue.length > 0) {
          updated.currentOrder = updated.orderQueue[0]
          updated.orderQueue = updated.orderQueue.slice(1)
        }

        // Baristas work
        if (updated.currentOrder && prev.baristas > 0) {
          const effectiveness = getBaristaEffectiveness(prev)
          const baristaWork = prev.baristas * effectiveness * 0.2
          updated.currentOrder = {
            ...updated.currentOrder,
            workDone: updated.currentOrder.workDone + baristaWork,
          }

          if (updated.currentOrder.workDone >= updated.currentOrder.workRequired) {
            // Tips chance
            let payment = updated.currentOrder.value
            if (prev.upgradeLevels.tippingCulture > 0 && Math.random() < prev.upgradeLevels.tippingCulture * 0.05) {
              payment = Math.floor(payment * 1.5)
            }

            updated.beans = prev.beans + payment
            updated.lifetimeBeans = prev.lifetimeBeans + payment
            updated.totalLifetimeBeans = prev.totalLifetimeBeans + payment
            updated.ordersCompleted = prev.ordersCompleted + 1
            updated.totalOrdersCompleted = prev.totalOrdersCompleted + 1

            if (updated.orderQueue.length > 0) {
              updated.currentOrder = updated.orderQueue[0]
              updated.orderQueue = updated.orderQueue.slice(1)
            } else {
              updated.currentOrder = null
            }
          }
        }

        // Passive income from Coffee Empire upgrade
        if (prev.upgradeLevels.coffeeEmpire > 0) {
          const passivePerTick = prev.upgradeLevels.coffeeEmpire * 10 * 0.1
          updated.beans = updated.beans + passivePerTick
          updated.lifetimeBeans = updated.lifetimeBeans + passivePerTick
          updated.totalLifetimeBeans = updated.totalLifetimeBeans + passivePerTick
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

  // Tap handler
  const handleTap = useCallback(() => {
    if (!gameState.currentOrder) return

    // Track tap for challenge
    setSessionTaps(prev => prev + 1)

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

        const nextOrder = prev.orderQueue.length > 0 ? prev.orderQueue[0] : null
        const newQueue = prev.orderQueue.slice(1)

        return {
          ...prev,
          beans: prev.beans + payment,
          lifetimeBeans: prev.lifetimeBeans + payment,
          totalLifetimeBeans: prev.totalLifetimeBeans + payment,
          ordersCompleted: prev.ordersCompleted + 1,
          totalOrdersCompleted: prev.totalOrdersCompleted + 1,
          currentOrder: nextOrder,
          orderQueue: newQueue,
        }
      }

      return {
        ...prev,
        currentOrder: { ...prev.currentOrder, workDone: newWorkDone },
      }
    })
  }, [gameState.currentOrder])

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
    <div className="min-h-screen flex flex-col px-4 py-4 max-w-md mx-auto">
      {/* Drink info modal */}
      {selectedDrink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setSelectedDrink(null)}
        >
          <div
            className="bg-silver-900 border border-silver-700 rounded-2xl p-4 max-w-xs w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-3">
              <span className="text-4xl">{selectedDrink.emoji}</span>
              <h3 className="text-xl font-bold text-silver-100 mt-2">{selectedDrink.drink}</h3>
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
                <div className="text-xs text-amber-400/80">$NOUN</div>
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
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="bg-silver-800/50 border border-silver-600/50 rounded-lg px-3 py-2 text-sm text-silver-300"
            >
              Connect
            </button>
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

      {/* Order Queue */}
      <div className="mb-3">
        <div className="text-silver-400 text-xs mb-1 flex justify-between">
          <span>Queue</span>
          <span>{gameState.orderQueue.length}/{maxQueue}</span>
        </div>
        <div className="flex gap-1 h-8 bg-silver-900/50 rounded-lg p-1 overflow-hidden">
          {gameState.orderQueue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-silver-600 text-xs">
              Waiting for customers...
            </div>
          ) : (
            gameState.orderQueue.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-sm
                  ${order.isSpecial ? 'bg-amber-500/30 border border-amber-500/50' : 'bg-silver-800'}`}
                title={`${order.customerName} wants ${order.drink}`}
              >
                {order.customerEmoji}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Next unlock teaser */}
      {nextDrink && (
        <div className="bg-silver-800/30 rounded-lg px-3 py-1.5 mb-3 text-xs text-silver-400">
          <span className="text-silver-500">Next unlock:</span> {nextDrink.emoji} {nextDrink.drink} at {nextDrink.unlocksAt} orders
          <span className="text-silver-500 ml-1">({gameState.totalOrdersCompleted}/{nextDrink.unlocksAt})</span>
        </div>
      )}

      {/* Current Order */}
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
            </div>

            <div className="mb-3">
              <div className="h-3 bg-silver-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    currentOrder.isSpecial
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                      : 'bg-gradient-to-r from-silver-400 to-silver-300'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-silver-500 mt-1">
                <span>{Math.floor(currentOrder.workDone)}/{currentOrder.workRequired}</span>
                <span className={currentOrder.isSpecial ? 'text-amber-300 font-medium' : 'text-silver-300'}>
                  +{currentOrder.value} beans
                </span>
              </div>
            </div>

            <button
              onClick={handleTap}
              className="relative w-full py-6 rounded-2xl bg-gradient-to-br from-silver-300 to-silver-500
                         text-silver-900 font-bold text-xl active:scale-95 transition-transform shadow-lg"
            >
              ☕ Make Drink
              {showPayment && (
                <span className="absolute top-1 right-3 text-green-400 font-bold animate-bounce text-sm">
                  +{showPayment.amount}
                </span>
              )}
            </button>

            <div className="text-center text-silver-500 text-xs mt-1">
              +{gameState.tapPower} per tap
              {gameState.baristas > 0 && ` • ${gameState.baristas} barista${gameState.baristas !== 1 ? 's' : ''} helping`}
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

            {/* Locked tier hints */}
            {gameState.franchises === 0 && gameState.empires === 0 && (
              <div className="text-center text-silver-500 text-xs py-2">
                🔒 Tier 2 upgrades unlock at first Franchise
              </div>
            )}
            {gameState.empires === 0 && gameState.franchises > 0 && (
              <div className="text-center text-silver-500 text-xs py-2">
                🔒 Tier 3 upgrades unlock at first Empire
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

            {/* Achievements compact */}
            <div className="bg-silver-800/50 border border-silver-700/50 rounded-xl p-2">
              <div className="text-xs text-silver-400 mb-1">
                Achievements: {gameState.unlockedAchievements.length}/{ACHIEVEMENTS.length}
              </div>
              <div className="flex flex-wrap gap-1">
                {ACHIEVEMENTS.map(a => (
                  <span
                    key={a.id}
                    className={`text-sm ${gameState.unlockedAchievements.includes(a.id) ? '' : 'opacity-30'}`}
                    title={`${a.name}: ${a.description}`}
                  >
                    {a.emoji}
                  </span>
                ))}
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
