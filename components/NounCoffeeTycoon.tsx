'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  UPGRADES,
  MILESTONES,
  createInitialState,
  migrateGameState,
  calculateClickPower,
  calculateProductionRate,
  calculateOfflineEarnings,
  getUpgradeCost,
  canAfford,
  rollCritical,
  shouldSpawnGolden,
  getPrestigeCost,
  canPrestige,
  getUnclaimedMilestones,
  checkNewAchievements,
  formatNumber,
  UpgradeKey,
} from '@/lib/game';

interface Props {
  fid: number;
}

export default function NounCoffeeTycoon({ fid }: Props) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: string; isCrit: boolean }>>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const particleId = useRef(0);
  const lastAutoClick = useRef(Date.now());

  // Load state
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/game/state?fid=${fid}`);
        if (res.ok) {
          const data = await res.json();
          // Migrate old state to new format (ensures all properties exist)
          const gameState = migrateGameState(data.state);

          // Calculate offline earnings
          const offline = calculateOfflineEarnings(gameState);
          if (offline > 0) {
            gameState.beans += offline;
            gameState.totalBeans += offline;

            // Activate return bonus
            gameState.returnBonusActive = true;
            gameState.returnBonusExpires = Date.now() + (2 * 60 * 1000); // 2 minutes

            setAchievements([`Welcome back! Earned ${formatNumber(offline)} beans offline! 2x BONUS for 2 minutes!`]);
          }

          gameState.lastCollected = Date.now();
          setState(gameState);
        } else {
          setState(createInitialState(fid));
        }
      } catch (error) {
        console.error('Load error:', error);
        setState(createInitialState(fid));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fid]);

  // Auto-save
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
        console.error('Save error:', error);
      }
    }, 5000); // Save every 5 seconds
    return () => clearInterval(interval);
  }, [fid, state]);

  // Auto-production
  useEffect(() => {
    if (!state) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;

        const perSec = calculateProductionRate(prev);
        if (perSec === 0) return prev;

        const now = Date.now();
        const elapsed = (now - lastAutoClick.current) / 1000;
        lastAutoClick.current = now;

        const earned = Math.floor(perSec * elapsed);

        const newState = {
          ...prev,
          beans: prev.beans + earned,
          totalBeans: prev.totalBeans + earned,
          lastCollected: now,
        };

        // Check achievements
        const newAchievements = checkNewAchievements(newState);
        if (newAchievements.length > 0) {
          setAchievements(prev => [...prev, ...newAchievements]);
        }

        return newState;
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [state]);

  // Golden bean spawner
  useEffect(() => {
    if (!state || state.goldenBeanSpawned) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (!prev || prev.goldenBeanSpawned) return prev;

        if (shouldSpawnGolden(prev)) {
          return {
            ...prev,
            goldenBeanSpawned: true,
            goldenBeanExpires: Date.now() + 10000, // 10 seconds to click
          };
        }

        return prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [state]);

  // Golden bean expiry
  useEffect(() => {
    if (!state?.goldenBeanSpawned) return;

    const timeout = setTimeout(() => {
      setState(prev => {
        if (!prev) return prev;
        return { ...prev, goldenBeanSpawned: false };
      });
    }, state.goldenBeanExpires - Date.now());

    return () => clearTimeout(timeout);
  }, [state?.goldenBeanSpawned, state?.goldenBeanExpires]);

  // Handle tap
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!state) return;

    const isCrit = rollCritical(state);
    const basePower = calculateClickPower(state);
    const earnedPerClick = isCrit ? basePower * 5 : basePower;

    setState(prev => {
      if (!prev) return prev;

      const newState = {
        ...prev,
        beans: prev.beans + earnedPerClick,
        totalBeans: prev.totalBeans + earnedPerClick,
        totalTaps: prev.totalTaps + 1,
        criticalHitActive: isCrit,
      };

      // Check achievements
      const newAchievements = checkNewAchievements(newState);
      if (newAchievements.length > 0) {
        setAchievements(prevAch => [...prevAch, ...newAchievements]);
      }

      return newState;
    });

    // Particle effect
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 40,
      y: rect.top + 20 + (Math.random() - 0.5) * 20,
      value: isCrit ? `CRIT! +${formatNumber(earnedPerClick)}` : `+${formatNumber(earnedPerClick)}`,
      isCrit,
    }]);

    // Clear crit state after animation
    setTimeout(() => {
      setState(prev => prev ? { ...prev, criticalHitActive: false } : prev);
    }, 300);
  }, [state]);

  // Handle golden bean tap
  const handleGoldenTap = useCallback(() => {
    if (!state) return;

    const bonus = Math.floor(state.beans * 0.1 + 100); // 10% of current beans + 100

    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        beans: prev.beans + bonus,
        totalBeans: prev.totalBeans + bonus,
        goldenBeans: prev.goldenBeans + 1,
        goldenBeanSpawned: false,
      };
    });

    setAchievements(prev => [...prev, `Golden Bean! +${formatNumber(bonus)}`]);
  }, [state]);

  // Buy upgrade
  const buyUpgrade = useCallback((key: UpgradeKey) => {
    if (!state || !canAfford(state, key)) return;

    const cost = getUpgradeCost(key, state.upgrades[key]);

    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        beans: prev.beans - cost,
        upgrades: { ...prev.upgrades, [key]: prev.upgrades[key] + 1 },
      };
    });
  }, [state]);

  // Prestige
  const handlePrestige = useCallback(() => {
    if (!state || !canPrestige(state)) return;

    setState(prev => {
      if (!prev) return prev;

      // Calculate lifetime bonus (10% of all-time beans)
      const newLifetimeBonus = prev.totalBeans * 0.1;

      return {
        ...prev,
        beans: 0,
        totalBeans: 0,
        totalTaps: 0,
        upgrades: {
          clickPower: 0,
          autoClickers: 0,
          clickMultiplier: 0,
          productionMultiplier: 0,
          critChance: prev.upgrades.critChance, // Keep these
          goldenChance: prev.upgrades.goldenChance,
          offlineBonus: prev.upgrades.offlineBonus,
        },
        prestigeLevel: prev.prestigeLevel + 1,
        prestigeStars: prev.prestigeStars + 1,
        lifetimeBonus: prev.lifetimeBonus + newLifetimeBonus,
      };
    });

    setShowPrestigeModal(false);
    setAchievements(prev => [...prev, `PRESTIGED! Level ${state.prestigeLevel + 1}! Permanent bonus increased!`]);
  }, [state]);

  // Claim milestone
  const claimMilestone = useCallback(async (key: string) => {
    if (!state) return;

    try {
      const res = await fetch('/api/token/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, milestone: key }),
      });

      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        setAchievements(prev => [...prev, data.message]);
      }
    } catch (error) {
      console.error('Claim error:', error);
    }
  }, [fid, state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!state) return null;

  const clickPower = calculateClickPower(state);
  const perSec = calculateProductionRate(state);
  const unclaimedMilestones = getUnclaimedMilestones(state);

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className={`fixed pointer-events-none font-black z-50 ${p.isCrit ? 'text-3xl text-red-600' : 'text-xl text-black'}`}
          style={{
            left: p.x,
            top: p.y,
            animation: 'floatUp 1s ease-out forwards',
          }}
          onAnimationEnd={() => setParticles(prev => prev.filter(x => x.id !== p.id))}
        >
          {p.value}
        </div>
      ))}

      {/* Achievement toasts */}
      {achievements.slice(-3).map((ach, i) => (
        <div
          key={i}
          className="fixed right-4 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-slideIn z-50"
          style={{ top: `${80 + i * 60}px` }}
        >
          🎉 {ach}
        </div>
      ))}

      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <svg width="20" height="10" viewBox="0 0 20 10">
                  <rect width="8" height="8" fill="#000" />
                  <rect x="12" width="8" height="8" fill="#000" />
                  <rect x="8" y="3" width="4" height="2" fill="#000" />
                </svg>
                NOUN COFFEE
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {state.prestigeLevel > 0 && `⭐ Prestige ${state.prestigeLevel} • `}
                {formatNumber(perSec)}/sec
                {state.returnBonusActive && Date.now() < state.returnBonusExpires && ' • 2X BONUS!'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">{formatNumber(state.beans)}</div>
              {state.goldenBeans > 0 && (
                <div className="text-xs text-yellow-600">🌟 {state.goldenBeans} golden</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main tap area */}
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="relative">
          {/* Golden bean spawn */}
          {state.goldenBeanSpawned && (
            <button
              onClick={handleGoldenTap}
              className="absolute -top-20 left-1/2 -translate-x-1/2 text-6xl animate-bounce z-10"
              style={{ animation: 'bounce 0.5s infinite' }}
            >
              🌟
            </button>
          )}

          {/* Main tap button */}
          <button
            onClick={handleTap}
            className={`w-64 h-64 mx-auto rounded-full flex items-center justify-center text-8xl transition-all active:scale-90 ${
              state.criticalHitActive
                ? 'scale-110 bg-red-100 shadow-2xl shadow-red-500'
                : 'hover:scale-105 bg-black shadow-xl'
            }`}
            style={{
              background: state.criticalHitActive
                ? 'radial-gradient(circle, #fee2e2 0%, #fca5a5 100%)'
                : '#000',
            }}
          >
            <div className={state.criticalHitActive ? 'animate-pulse' : ''}>☕</div>
          </button>

          <div className="text-center mt-4">
            <div className="text-2xl font-black">+{formatNumber(clickPower)}</div>
            <div className="text-sm text-gray-500">per click</div>
            {state.upgrades.critChance > 0 && (
              <div className="text-xs text-red-600 mt-1">
                {UPGRADES.critChance.effect(state.upgrades.critChance)}% crit chance (5x)
              </div>
            )}
          </div>
        </div>

        {/* Auto-clickers indicator */}
        {state.upgrades.autoClickers > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(state.upgrades.autoClickers, 5) }).map((_, i) => (
                  <div key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>
                    👤
                  </div>
                ))}
                {state.upgrades.autoClickers > 5 && (
                  <div className="text-sm font-bold">+{state.upgrades.autoClickers - 5} more</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{state.upgrades.autoClickers} Baristas</div>
                <div className="text-xs text-gray-500">Working for you</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrades */}
      <div className="max-w-md mx-auto px-6 pb-6">
        <h2 className="font-bold mb-3">Upgrades</h2>
        <div className="space-y-2">
          {(Object.keys(UPGRADES) as UpgradeKey[]).map(key => {
            const upgrade = UPGRADES[key];
            const level = state.upgrades[key];
            const cost = getUpgradeCost(key, level);
            const affordable = canAfford(state, key);
            const maxed = cost === Infinity;

            return (
              <button
                key={key}
                onClick={() => buyUpgrade(key)}
                disabled={!affordable || maxed}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  maxed
                    ? 'border-gray-200 bg-gray-50 opacity-50'
                    : affordable
                    ? 'border-black hover:bg-gray-50 active:scale-95'
                    : 'border-gray-200 opacity-40'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-bold">{upgrade.name}</div>
                    <div className="text-xs text-gray-500">{upgrade.desc}</div>
                    <div className="text-xs text-gray-400 mt-1">Level {level}</div>
                  </div>
                  <div className="text-right ml-4">
                    {maxed ? (
                      <div className="text-sm font-bold">MAX</div>
                    ) : (
                      <>
                        <div className="font-bold">{formatNumber(cost)}</div>
                        {level > 0 && (
                          <div className="text-xs text-gray-500">
                            Next: {formatNumber(getUpgradeCost(key, level + 1))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Milestones */}
        {unclaimedMilestones.length > 0 && (
          <>
            <h2 className="font-bold mb-3 mt-8">🎁 Claim Rewards</h2>
            <div className="space-y-2">
              {unclaimedMilestones.map(key => {
                const milestone = MILESTONES[key as keyof typeof MILESTONES];
                return (
                  <button
                    key={key}
                    onClick={() => claimMilestone(key)}
                    className="w-full p-3 bg-yellow-50 border-2 border-yellow-500 rounded-lg hover:bg-yellow-100 active:scale-95"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold">{milestone.name}</div>
                      <div className="font-bold text-yellow-600">+{milestone.reward} $NOUN</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Prestige */}
        {canPrestige(state) && (
          <button
            onClick={() => setShowPrestigeModal(true)}
            className="w-full mt-8 p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:scale-105 active:scale-95 transition-all"
          >
            ⭐ PRESTIGE AVAILABLE ⭐
          </button>
        )}
      </div>

      {/* Prestige modal */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">⭐ Prestige</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reset most upgrades but gain +10% permanent production bonus and keep 10% of lifetime beans as bonus!
            </p>
            <div className="text-sm mb-4">
              <div>Current lifetime bonus: {formatNumber(state.lifetimeBonus)}</div>
              <div className="font-bold text-green-600">
                After prestige: {formatNumber(state.lifetimeBonus + state.totalBeans * 0.1)}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePrestige}
                className="flex-1 py-2 bg-black text-white rounded-lg font-bold"
              >
                Prestige
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
