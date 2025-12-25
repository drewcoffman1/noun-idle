'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  UPGRADE_COSTS,
  PREMIUM_UPGRADE_COSTS,
  MILESTONES,
  ACHIEVEMENTS,
  calculateProductionRate,
  calculateTapPower,
  getUpgradeCost,
  getPremiumUpgradeCost,
  getUnclaimedMilestones,
  checkAchievements,
  updateQuestProgress,
  shouldResetQuests,
  generateDailyQuests,
  calculatePrestigeCost,
  canPrestige,
} from '@/lib/game';

// ============================================
// NOUN COFFEE TYCOON - COMPREHENSIVE GAME
// ============================================

const fmt = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
};

const COLORS = {
  bg: '#f5ebe0',
  bgDark: '#e8dcc8',
  wood: '#8b6914',
  woodDark: '#5c4a2a',
  woodLight: '#b8956c',
  cream: '#fff8f0',
  brown: '#4a3728',
  accent: '#c4956a',
  warm: '#e8a87c',
  plant: '#6b8c5a',
  plantDark: '#4a6b3a',
  gold: '#ffd700',
  purple: '#9b59b6',
};

interface Props {
  fid: number;
}

type Tab = 'game' | 'upgrades' | 'premium' | 'quests' | 'achievements' | 'social' | 'prestige';

export default function NounCoffeeTycoon({ fid }: Props) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: number }>>([]);
  const [steamParticles, setSteamParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const particleId = useRef(0);

  // Load game state from API
  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch(`/api/game/state?fid=${fid}`);
        if (res.ok) {
          const data = await res.json();
          setState(data.state);

          // Show idle earnings notification
          if (data.idleEarnings && data.idleEarnings.coins > 0) {
            showNotification(`Welcome back! Earned ${fmt(data.idleEarnings.coins)} while away!`);
          }
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      } finally {
        setLoading(false);
      }
    }

    loadState();
  }, [fid]);

  // Auto-save state periodically
  useEffect(() => {
    if (!state) return;

    const interval = setInterval(async () => {
      try {
        await fetch('/api/game/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid, state }),
        });
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [fid, state]);

  // Check for daily quest reset
  useEffect(() => {
    if (!state) return;

    if (shouldResetQuests(state)) {
      setState(prev => {
        if (!prev) return prev;

        // Check if any quests were completed yesterday
        const allCompleted = prev.dailyQuests.every(q => q.claimed);
        const newStreak = allCompleted ? prev.questStreak + 1 : 0;

        return {
          ...prev,
          dailyQuests: generateDailyQuests(),
          lastQuestReset: Date.now(),
          questStreak: newStreak,
        };
      });

      showNotification('New daily quests available!');
    }
  }, [state]);

  // Auto production
  useEffect(() => {
    if (!state) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;

        const perSec = calculateProductionRate(prev);
        if (perSec === 0) return prev;

        const newState = {
          ...prev,
          coins: prev.coins + perSec,
          totalCoffees: prev.totalCoffees + perSec,
          lastCollected: Date.now(),
        };

        // Update quest progress
        updateQuestProgress(newState, { type: 'idle', amount: perSec });

        // Check achievements
        const newAchievements = checkAchievements(newState);
        if (newAchievements.length > 0) {
          showNotification(`Achievement unlocked: ${newAchievements[0].name}!`);
        }

        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  // Steam animation
  useEffect(() => {
    if (!state || state.upgrades.coffeeMachine === 0) return;

    const interval = setInterval(() => {
      setSteamParticles(prev => [
        ...prev.slice(-10),
        { id: Date.now(), x: Math.random() * 30, delay: Math.random() * 0.5 }
      ]);
    }, 800);

    return () => clearInterval(interval);
  }, [state?.upgrades.coffeeMachine]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!state) return;

    const earned = calculateTapPower(state);
    setState(prev => {
      if (!prev) return prev;

      const newState = {
        ...prev,
        coins: prev.coins + earned,
        totalCoffees: prev.totalCoffees + earned,
        totalTaps: prev.totalTaps + 1,
      };

      updateQuestProgress(newState, { type: 'tap', amount: earned });

      const newAchievements = checkAchievements(newState);
      if (newAchievements.length > 0) {
        showNotification(`Achievement: ${newAchievements[0].name}!`);
      }

      return newState;
    });

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 40,
      y: rect.top + 20,
      value: earned,
    }]);
  }, [state]);

  const buyUpgrade = useCallback(async (upgradeKey: keyof typeof UPGRADE_COSTS) => {
    if (!state) return;

    const cost = getUpgradeCost(upgradeKey, state.upgrades[upgradeKey]);
    if (!cost || state.coins < cost) return;

    setState(prev => {
      if (!prev) return prev;

      const newState = {
        ...prev,
        coins: prev.coins - cost,
        upgrades: { ...prev.upgrades, [upgradeKey]: prev.upgrades[upgradeKey] + 1 },
      };

      updateQuestProgress(newState, { type: 'upgrade' });

      return newState;
    });

    showNotification(`Upgraded ${upgradeKey}!`);
  }, [state]);

  const buyPremiumUpgrade = useCallback(async (upgradeKey: keyof typeof PREMIUM_UPGRADE_COSTS) => {
    if (!state) return;

    const cost = getPremiumUpgradeCost(upgradeKey, state.upgrades[upgradeKey]);
    if (!cost) return;

    // TODO: Verify $NOUN token payment
    // For now, we'll just deduct from a theoretical balance

    setState(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        upgrades: { ...prev.upgrades, [upgradeKey]: prev.upgrades[upgradeKey] + 1 },
        nounTokensSpent: prev.nounTokensSpent + cost,
      };
    });

    showNotification(`Purchased ${upgradeKey} with $NOUN!`);
  }, [state]);

  const claimQuest = useCallback((questId: string) => {
    if (!state) return;

    setState(prev => {
      if (!prev) return prev;

      const quest = prev.dailyQuests.find(q => q.id === questId);
      if (!quest || !quest.completed || quest.claimed) return prev;

      quest.claimed = true;

      return {
        ...prev,
        coins: prev.coins + quest.reward,
      };
    });

    showNotification('Quest reward claimed!');
  }, [state]);

  const claimMilestone = useCallback(async (milestoneKey: string) => {
    if (!state) return;

    try {
      const res = await fetch('/api/token/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, milestone: milestoneKey }),
      });

      if (res.ok) {
        const data = await res.json();
        setState(prev => prev ? data.state : prev);
        showNotification(data.message);
      }
    } catch (error) {
      console.error('Failed to claim milestone:', error);
    }
  }, [fid, state]);

  const handlePrestige = useCallback(() => {
    if (!state || !canPrestige(state)) return;

    setState(prev => {
      if (!prev) return prev;

      // Reset most progress, but keep prestige bonuses
      return {
        ...prev,
        coins: 0,
        totalCoffees: 0,
        upgrades: {
          tapPower: 0,
          coffeeMachine: 0,
          barista: 0,
          pastryCase: 0,
          cozySeating: 0,
          bookshelf: 0,
          plants: 0,
          lighting: 0,
          espressoBar: prev.upgrades.espressoBar,
          roastery: prev.upgrades.roastery,
          franchise: prev.upgrades.franchise,
        },
        prestigeLevel: prev.prestigeLevel + 1,
        prestigePoints: prev.prestigePoints + 1,
      };
    });

    setShowPrestigeModal(false);
    showNotification('Prestiged! +10% production multiplier!');
  }, [state]);

  if (loading || !state) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: COLORS.brown }}>
        <div className="text-center">
          <div className="text-4xl mb-4 text-amber-100">☕ NOUN COFFEE</div>
          <div className="text-amber-300 animate-pulse">Loading your coffee shop...</div>
        </div>
      </div>
    );
  }

  const perSec = calculateProductionRate(state);
  const perTap = calculateTapPower(state);
  const unclaimedMilestones = getUnclaimedMilestones(state);

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: COLORS.bg }}>
      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none font-bold text-lg z-50"
          style={{ left: p.x, top: p.y, color: COLORS.brown, animation: 'rise 0.8s ease-out forwards' }}
          onAnimationEnd={() => setParticles(prev => prev.filter(x => x.id !== p.id))}
        >
          +{fmt(p.value)}
        </div>
      ))}

      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full font-bold shadow-lg"
          style={{ background: COLORS.warm, color: COLORS.brown }}
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="p-4 text-center" style={{ background: COLORS.woodDark }}>
        <h1 className="text-xl font-bold text-amber-100 tracking-wide">☕ NOUN COFFEE TYCOON</h1>
        <div className="text-3xl font-black text-white mt-1">{fmt(state.coins)}</div>
        {perSec > 0 && <div className="text-amber-200 text-sm">+{fmt(perSec)}/sec</div>}
        {state.prestigeLevel > 0 && (
          <div className="text-purple-300 text-xs mt-1">⭐ Prestige {state.prestigeLevel}</div>
        )}
      </header>

      {/* Main game view */}
      {activeTab === 'game' && (
        <div className="relative w-full overflow-hidden" style={{ height: '320px', background: `linear-gradient(180deg, ${COLORS.cream} 0%, ${COLORS.bgDark} 100%)` }}>
          {/* Back wall */}
          <div className="absolute inset-x-0 top-0 h-40" style={{ background: COLORS.cream }}>
            {/* Decorations based on upgrades */}
            <div className="absolute top-8 left-4 right-4 h-3 rounded" style={{ background: COLORS.wood }} />

            {state.upgrades.lighting > 0 && (
              <div className="absolute top-2 left-0 right-0 flex justify-center gap-6">
                {Array.from({ length: state.upgrades.lighting * 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: ['#ffd54f', '#ff8a65', '#fff59d', '#ffcc80'][i % 4],
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {state.upgrades.bookshelf > 0 && (
              <div className="absolute top-10 left-6 flex gap-1">
                {Array.from({ length: state.upgrades.bookshelf * 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: '8px',
                      height: `${16 + (i % 3) * 4}px`,
                      background: ['#8b4513', '#a0522d', '#6b4423'][i % 3],
                    }}
                  />
                ))}
              </div>
            )}

            {state.upgrades.plants > 0 && (
              <div className="absolute top-12 right-8 flex gap-3">
                {Array.from({ length: Math.min(state.upgrades.plants, 3) }).map((_, i) => (
                  <div key={i} className="relative">
                    <div className="w-4 h-5 rounded-b-lg" style={{ background: '#d4a574' }} />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full" style={{ background: COLORS.plant }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Counter */}
          <div className="absolute bottom-0 left-0 right-0 h-28" style={{ background: `linear-gradient(180deg, ${COLORS.wood} 0%, ${COLORS.woodDark} 100%)` }}>
            <div className="absolute top-0 left-0 right-0 h-4" style={{ background: COLORS.woodLight }} />

            {/* Coffee machine */}
            {state.upgrades.coffeeMachine > 0 && (
              <div className="absolute left-4 -top-16">
                <div className="relative">
                  <div className="w-16 h-20 rounded-t-lg" style={{ background: '#4a4a4a' }}>
                    <div className="absolute top-2 left-2 right-2 h-6 rounded bg-black/30" />
                  </div>
                  {steamParticles.map(s => (
                    <div
                      key={s.id}
                      className="absolute w-2 h-2 rounded-full opacity-60"
                      style={{
                        left: 20 + s.x,
                        top: -8,
                        background: 'white',
                        animation: `steamRise 1.5s ease-out forwards`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Baristas */}
            {state.upgrades.barista > 0 && (
              <div className="absolute right-4 -top-20 flex gap-2">
                {Array.from({ length: Math.min(state.upgrades.barista, 3) }).map((_, i) => (
                  <div key={i} className="relative animate-bounce" style={{ animationDuration: '2s', animationDelay: `${i * 0.3}s` }}>
                    <div className="w-6 h-6 rounded-full mx-auto" style={{ background: '#e8c4a0' }} />
                    <div className="w-8 h-10 rounded-t-lg mt-1" style={{ background: COLORS.plant }} />
                  </div>
                ))}
              </div>
            )}

            {/* Tap target - Coffee Cup */}
            <button
              onClick={handleTap}
              className="absolute left-1/2 -translate-x-1/2 -top-10 transition-transform active:scale-90 hover:scale-105 cursor-pointer"
            >
              <div className="relative">
                <div className="w-14 h-12 rounded-b-2xl border-4" style={{ background: COLORS.cream, borderColor: 'black' }}>
                  <div className="absolute top-2 left-1 right-1 bottom-1 rounded-b-xl overflow-hidden">
                    <div className="h-full" style={{ background: COLORS.brown }} />
                  </div>
                </div>
                <div className="absolute top-2 -right-3 w-4 h-6 rounded-r-full border-4" style={{ borderColor: 'black', background: COLORS.cream }} />
                <div className="w-18 h-2 rounded-full -mx-2 border-2" style={{ background: COLORS.cream, borderColor: 'black', width: '72px' }} />
              </div>
              <div className="text-center mt-2 font-bold px-2 py-1 rounded" style={{ background: COLORS.brown, color: COLORS.cream }}>
                +{fmt(perTap)}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-2 overflow-x-auto" style={{ background: COLORS.woodDark }}>
        {(['game', 'upgrades', 'premium', 'quests', 'achievements', 'social', 'prestige'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-sm font-bold whitespace-nowrap ${activeTab === tab ? 'bg-white' : ''}`}
            style={{ color: activeTab === tab ? COLORS.brown : 'white' }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'quests' && state.dailyQuests.some(q => q.completed && !q.claimed) && ' 🔴'}
            {tab === 'achievements' && unclaimedMilestones.length > 0 && ' 🔴'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 pb-20 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 480px)' }}>
        {/* Upgrades Tab */}
        {activeTab === 'upgrades' && (
          <div className="space-y-2">
            <h2 className="font-bold text-lg mb-3" style={{ color: COLORS.brown }}>Basic Upgrades</h2>
            {(Object.keys(UPGRADE_COSTS) as Array<keyof typeof UPGRADE_COSTS>).map(key => {
              const upgradeData = UPGRADE_COSTS[key];
              const level = state.upgrades[key];
              const cost = getUpgradeCost(key, level);
              const maxed = level >= upgradeData.max;
              const canAfford = cost !== null && state.coins >= cost;

              return (
                <button
                  key={key}
                  onClick={() => buyUpgrade(key)}
                  disabled={maxed || !canAfford}
                  className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
                    maxed ? '' : canAfford ? 'hover:scale-[1.02] active:scale-[0.98]' : 'opacity-50'
                  }`}
                  style={{
                    background: maxed ? COLORS.bgDark : COLORS.cream,
                    border: `3px solid ${maxed ? COLORS.accent : canAfford ? COLORS.brown : COLORS.bgDark}`,
                  }}
                >
                  <div className="text-left">
                    <div className="font-bold capitalize" style={{ color: COLORS.brown }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="text-xs" style={{ color: COLORS.accent }}>Level {level}/{upgradeData.max}</div>
                  </div>
                  <div className="text-right">
                    {maxed ? (
                      <div className="font-bold" style={{ color: COLORS.plant }}>MAX</div>
                    ) : (
                      <div className="font-bold" style={{ color: canAfford ? COLORS.brown : COLORS.bgDark }}>
                        {cost !== null ? fmt(cost) : 'MAX'}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Premium Tab */}
        {activeTab === 'premium' && (
          <div className="space-y-2">
            <h2 className="font-bold text-lg mb-3" style={{ color: COLORS.purple }}>Premium Upgrades ($NOUN)</h2>
            <p className="text-sm mb-4" style={{ color: COLORS.accent }}>
              These powerful upgrades require $NOUN tokens. Earn tokens by completing milestones!
            </p>
            {(Object.keys(PREMIUM_UPGRADE_COSTS) as Array<keyof typeof PREMIUM_UPGRADE_COSTS>).map(key => {
              const upgradeData = PREMIUM_UPGRADE_COSTS[key];
              const level = state.upgrades[key];
              const cost = getPremiumUpgradeCost(key, level);
              const maxed = level >= upgradeData.max;

              let description = '';
              if (key === 'espressoBar') description = '+50 coffees/sec each';
              if (key === 'roastery') description = '2x all production each';
              if (key === 'franchise') description = '+100 coffees/sec each';

              return (
                <button
                  key={key}
                  onClick={() => buyPremiumUpgrade(key)}
                  disabled={maxed}
                  className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
                    maxed ? 'opacity-50' : 'hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                  style={{
                    background: COLORS.purple + '20',
                    border: `3px solid ${COLORS.purple}`,
                  }}
                >
                  <div className="text-left">
                    <div className="font-bold capitalize" style={{ color: COLORS.purple }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="text-xs" style={{ color: COLORS.accent }}>{description}</div>
                    <div className="text-xs" style={{ color: COLORS.brown }}>Level {level}/{upgradeData.max}</div>
                  </div>
                  <div className="text-right">
                    {maxed ? (
                      <div className="font-bold" style={{ color: COLORS.plant }}>MAX</div>
                    ) : (
                      <div className="font-bold" style={{ color: COLORS.purple }}>
                        {cost !== null ? `${fmt(cost)} $NOUN` : 'MAX'}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quests Tab */}
        {activeTab === 'quests' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg" style={{ color: COLORS.brown }}>Daily Quests</h2>
              {state.questStreak > 0 && (
                <div className="text-sm font-bold" style={{ color: COLORS.gold }}>
                  🔥 {state.questStreak} day streak!
                </div>
              )}
            </div>

            {state.dailyQuests.map(quest => {
              const progress = Math.min(quest.progress, quest.target);
              const percentage = (progress / quest.target) * 100;

              return (
                <div
                  key={quest.id}
                  className="p-3 rounded-xl"
                  style={{
                    background: quest.claimed ? COLORS.bgDark : COLORS.cream,
                    border: `2px solid ${quest.completed ? COLORS.plant : COLORS.accent}`,
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold" style={{ color: COLORS.brown }}>{quest.description}</div>
                      <div className="text-xs mt-1" style={{ color: COLORS.accent }}>
                        Reward: {quest.reward} coins
                      </div>
                    </div>
                    {quest.completed && !quest.claimed && (
                      <button
                        onClick={() => claimQuest(quest.id)}
                        className="px-3 py-1 rounded font-bold text-white"
                        style={{ background: COLORS.plant }}
                      >
                        Claim
                      </button>
                    )}
                    {quest.claimed && (
                      <div className="text-xl">✓</div>
                    )}
                  </div>

                  <div className="w-full h-2 rounded-full" style={{ background: COLORS.bgDark }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, background: COLORS.plant }}
                    />
                  </div>
                  <div className="text-xs mt-1 text-right" style={{ color: COLORS.accent }}>
                    {progress} / {quest.target}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-bold text-lg mb-3" style={{ color: COLORS.gold }}>Milestones</h2>
              <p className="text-sm mb-3" style={{ color: COLORS.accent }}>
                Complete milestones to earn $NOUN tokens!
              </p>

              <div className="space-y-2">
                {Object.entries(MILESTONES).map(([key, milestone]) => {
                  const claimed = state.milestones.includes(key);
                  const canClaim = unclaimedMilestones.includes(key);

                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl flex justify-between items-center"
                      style={{
                        background: claimed ? COLORS.bgDark : COLORS.cream,
                        border: `2px solid ${canClaim ? COLORS.gold : COLORS.accent}`,
                      }}
                    >
                      <div>
                        <div className="font-bold" style={{ color: COLORS.brown }}>{milestone.description}</div>
                        <div className="text-xs" style={{ color: COLORS.gold }}>
                          Reward: {milestone.reward} $NOUN
                        </div>
                      </div>
                      {claimed ? (
                        <div className="text-xl">✓</div>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimMilestone(key)}
                          className="px-3 py-1 rounded font-bold text-white"
                          style={{ background: COLORS.gold }}
                        >
                          Claim
                        </button>
                      ) : (
                        <div className="text-xs" style={{ color: COLORS.accent }}>Locked</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="font-bold text-lg mb-3 mt-6" style={{ color: COLORS.purple }}>Achievements</h2>
              <div className="space-y-2">
                {state.achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className="p-3 rounded-xl"
                    style={{
                      background: achievement.unlocked ? COLORS.purple + '20' : COLORS.bgDark,
                      border: `2px solid ${achievement.unlocked ? COLORS.purple : COLORS.accent}`,
                    }}
                  >
                    <div className="font-bold" style={{ color: COLORS.brown }}>{achievement.name}</div>
                    <div className="text-xs" style={{ color: COLORS.accent }}>{achievement.description}</div>
                    {achievement.unlocked && (
                      <div className="text-xs mt-1" style={{ color: COLORS.purple }}>
                        ✓ Unlocked - Bonus Active!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prestige Tab */}
        {activeTab === 'prestige' && (
          <div className="space-y-3">
            <h2 className="font-bold text-lg mb-3" style={{ color: COLORS.purple }}>Prestige System</h2>

            <div className="p-4 rounded-xl" style={{ background: COLORS.purple + '20', border: `2px solid ${COLORS.purple}` }}>
              <div className="text-center mb-4">
                <div className="text-4xl font-black" style={{ color: COLORS.purple }}>
                  ⭐ Level {state.prestigeLevel}
                </div>
                <div className="text-sm mt-2" style={{ color: COLORS.accent }}>
                  Current Bonus: +{state.prestigeLevel * 10}% production
                </div>
              </div>

              <div className="text-sm mb-4" style={{ color: COLORS.brown }}>
                Prestiging resets your basic upgrades and coffee count, but keeps your premium upgrades and grants a permanent +10% production bonus!
              </div>

              <div className="text-center">
                <div className="mb-2" style={{ color: COLORS.accent }}>
                  Next prestige requires: {fmt(calculatePrestigeCost(state.prestigeLevel))} total coffees
                </div>

                <button
                  onClick={() => setShowPrestigeModal(true)}
                  disabled={!canPrestige(state)}
                  className="px-6 py-3 rounded-xl font-bold text-white disabled:opacity-50"
                  style={{ background: COLORS.purple }}
                >
                  {canPrestige(state) ? 'Prestige Now!' : 'Not Ready'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Social Tab */}
        {activeTab === 'social' && (
          <div className="space-y-3">
            <h2 className="font-bold text-lg mb-3" style={{ color: COLORS.brown }}>Social Features</h2>

            <div className="p-3 rounded-xl text-center" style={{ background: COLORS.cream }}>
              <div className="text-sm" style={{ color: COLORS.accent }}>
                Social features coming soon!
              </div>
              <div className="text-xs mt-2" style={{ color: COLORS.brown }}>
                • Visit friends' shops<br />
                • Send coffee gifts<br />
                • Compete on leaderboards
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl text-center" style={{ background: COLORS.cream }}>
                <div className="font-bold" style={{ color: COLORS.brown }}>Friend Visits</div>
                <div className="text-2xl font-black" style={{ color: COLORS.accent }}>{state.friendVisits}</div>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: COLORS.cream }}>
                <div className="font-bold" style={{ color: COLORS.brown }}>Gifts Sent</div>
                <div className="text-2xl font-black" style={{ color: COLORS.accent }}>{state.giftsSent}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prestige Confirmation Modal */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="p-6 rounded-2xl max-w-sm w-full" style={{ background: COLORS.cream }}>
            <h3 className="text-xl font-bold mb-3 text-center" style={{ color: COLORS.purple }}>
              Confirm Prestige
            </h3>
            <p className="text-sm mb-4" style={{ color: COLORS.brown }}>
              Are you sure you want to prestige? This will reset your basic upgrades and coffee count, but you'll keep premium upgrades and gain +10% permanent production bonus.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="flex-1 py-2 rounded-lg font-bold"
                style={{ background: COLORS.bgDark, color: COLORS.brown }}
              >
                Cancel
              </button>
              <button
                onClick={handlePrestige}
                className="flex-1 py-2 rounded-lg font-bold text-white"
                style={{ background: COLORS.purple }}
              >
                Prestige!
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes rise {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1.3); }
        }
        @keyframes steamRise {
          0% { opacity: 0.6; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.5); }
        }
      `}</style>
    </div>
  );
}
