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
          const gameState = migrateGameState(data.state);

          const offline = calculateOfflineEarnings(gameState);
          if (offline > 0) {
            gameState.beans += offline;
            gameState.totalBeans += offline;
            gameState.returnBonusActive = true;
            gameState.returnBonusExpires = Date.now() + (2 * 60 * 1000);
            setAchievements([`Welcome back! +${formatNumber(offline)} beans offline! 2x BONUS!`]);
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
    }, 5000);
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

        const newAchievements = checkNewAchievements(newState);
        if (newAchievements.length > 0) {
          setAchievements(p => [...p, ...newAchievements]);
        }

        return newState;
      });
    }, 100);

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
            goldenBeanExpires: Date.now() + 10000,
          };
        }

        return prev;
      });
    }, 1000);

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

      const newAchievements = checkNewAchievements(newState);
      if (newAchievements.length > 0) {
        setAchievements(prevAch => [...prevAch, ...newAchievements]);
      }

      return newState;
    });

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 40,
      y: rect.top + 20 + (Math.random() - 0.5) * 20,
      value: isCrit ? `CRIT! +${formatNumber(earnedPerClick)}` : `+${formatNumber(earnedPerClick)}`,
      isCrit,
    }]);

    setTimeout(() => {
      setState(prev => prev ? { ...prev, criticalHitActive: false } : prev);
    }, 300);
  }, [state]);

  // Handle golden bean tap
  const handleGoldenTap = useCallback(() => {
    if (!state) return;

    const bonus = Math.floor(state.beans * 0.1 + 100);

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
          critChance: prev.upgrades.critChance,
          goldenChance: prev.upgrades.goldenChance,
          offlineBonus: prev.upgrades.offlineBonus,
        },
        prestigeLevel: prev.prestigeLevel + 1,
        prestigeStars: prev.prestigeStars + 1,
        lifetimeBonus: prev.lifetimeBonus + newLifetimeBonus,
      };
    });

    setShowPrestigeModal(false);
    setAchievements(prev => [...prev, `PRESTIGED! Level ${state.prestigeLevel + 1}!`]);
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
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">☕</div>
          <div className="text-xl font-bold text-amber-900">Brewing...</div>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const clickPower = calculateClickPower(state);
  const perSec = calculateProductionRate(state);
  const unclaimedMilestones = getUnclaimedMilestones(state);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 pb-24">
      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className={`fixed pointer-events-none font-black z-50 ${p.isCrit ? 'text-4xl' : 'text-2xl'}`}
          style={{
            left: p.x,
            top: p.y,
            color: p.isCrit ? '#dc2626' : '#92400e',
            animation: 'floatUp 1s ease-out forwards',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
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
          className="fixed right-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold animate-slideIn z-50"
          style={{ top: `${80 + i * 70}px` }}
        >
          ✨ {ach}
        </div>
      ))}

      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-amber-200 z-40 shadow-lg">
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-black flex items-center gap-2 text-amber-900">
                <svg width="24" height="12" viewBox="0 0 24 12" className="drop-shadow">
                  <rect width="9" height="9" fill="#78350f" rx="1" />
                  <rect x="13" width="9" height="9" fill="#78350f" rx="1" />
                  <rect x="9" y="3" width="6" height="3" fill="#78350f" rx="1" />
                </svg>
                NOUN COFFEE
              </div>
              <div className="text-xs text-amber-700 mt-1 font-semibold">
                {state.prestigeLevel > 0 && `⭐ Prestige ${state.prestigeLevel} • `}
                {formatNumber(perSec)}/sec
                {state.returnBonusActive && Date.now() < state.returnBonusExpires && ' • 🔥 2X BONUS!'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black bg-gradient-to-br from-amber-700 to-orange-700 bg-clip-text text-transparent drop-shadow">
                {formatNumber(state.beans)}
              </div>
              {state.goldenBeans > 0 && (
                <div className="text-xs text-yellow-600 font-bold">✨ {state.goldenBeans} golden</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main tap area */}
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="relative">
          {/* Golden bean spawn */}
          {state.goldenBeanSpawned && (
            <button
              onClick={handleGoldenTap}
              className="absolute -top-24 left-1/2 -translate-x-1/2 text-8xl z-10 drop-shadow-2xl"
              style={{
                animation: 'bounce 0.5s infinite, pulse 2s infinite',
                filter: 'drop-shadow(0 0 20px rgba(234, 179, 8, 0.8))'
              }}
            >
              ✨
            </button>
          )}

          {/* Coffee cup with steam */}
          <button
            onClick={handleTap}
            className={`relative w-72 h-72 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
              state.criticalHitActive
                ? 'scale-125'
                : 'hover:scale-110 active:scale-95'
            }`}
            style={{
              background: state.criticalHitActive
                ? 'radial-gradient(circle at 30% 30%, #fef3c7, #fde68a, #fcd34d, #fbbf24)'
                : 'radial-gradient(circle at 30% 30%, #fef3c7, #fed7aa, #fdba74, #fb923c)',
              boxShadow: state.criticalHitActive
                ? '0 25px 60px rgba(239, 68, 68, 0.4), 0 0 80px rgba(239, 68, 68, 0.3), inset 0 2px 20px rgba(255, 255, 255, 0.5)'
                : '0 25px 60px rgba(251, 146, 60, 0.4), 0 10px 30px rgba(251, 146, 60, 0.2), inset 0 2px 20px rgba(255, 255, 255, 0.5)',
            }}
          >
            {/* Steam */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex gap-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="text-3xl opacity-60"
                  style={{
                    animation: `steam 3s ease-in-out infinite`,
                    animationDelay: `${i * 0.5}s`
                  }}
                >
                  ☁️
                </div>
              ))}
            </div>

            {/* Coffee cup */}
            <div
              className={`text-9xl ${state.criticalHitActive ? 'animate-pulse' : ''}`}
              style={{
                filter: state.criticalHitActive
                  ? 'drop-shadow(0 0 30px rgba(239, 68, 68, 0.8))'
                  : 'drop-shadow(0 10px 20px rgba(120, 53, 15, 0.3))'
              }}
            >
              ☕
            </div>
          </button>

          <div className="text-center mt-8">
            <div className="text-3xl font-black bg-gradient-to-r from-amber-700 to-orange-700 bg-clip-text text-transparent">
              +{formatNumber(clickPower)}
            </div>
            <div className="text-sm text-amber-700 font-semibold">per click</div>
            {state.upgrades.critChance > 0 && (
              <div className="text-xs text-red-600 font-bold mt-2 bg-red-50 inline-block px-3 py-1 rounded-full">
                ⚡ {UPGRADES.critChance.effect(state.upgrades.critChance)}% crit (5x dmg)
              </div>
            )}
          </div>
        </div>

        {/* Auto-clickers */}
        {state.upgrades.autoClickers > 0 && (
          <div className="mt-10 p-5 bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl shadow-lg border border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(state.upgrades.autoClickers, 5) }).map((_, i) => (
                  <div
                    key={i}
                    className="text-3xl"
                    style={{
                      animation: 'bounce 1s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`
                    }}
                  >
                    👨‍🍳
                  </div>
                ))}
                {state.upgrades.autoClickers > 5 && (
                  <div className="text-sm font-bold text-amber-900">+{state.upgrades.autoClickers - 5} more</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-amber-900">{state.upgrades.autoClickers} Baristas</div>
                <div className="text-xs text-amber-700 font-semibold">Brewing for you</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrades */}
      <div className="max-w-md mx-auto px-6 pb-6">
        <h2 className="font-black text-xl mb-4 text-amber-900">⚡ Upgrades</h2>
        <div className="space-y-3">
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
                className={`w-full p-4 rounded-2xl text-left transition-all duration-200 ${
                  maxed
                    ? 'bg-gray-100 border-2 border-gray-200 opacity-60'
                    : affordable
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 hover:border-orange-500 hover:shadow-xl hover:scale-105 active:scale-100'
                    : 'bg-white border-2 border-gray-200 opacity-40'
                }`}
                style={{
                  boxShadow: affordable && !maxed ? '0 4px 20px rgba(251, 146, 60, 0.2)' : 'none'
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-black text-amber-900">{upgrade.name}</div>
                    <div className="text-xs text-amber-700 font-semibold">{upgrade.desc}</div>
                    <div className="text-xs text-amber-600 mt-1 font-bold">Level {level}</div>
                  </div>
                  <div className="text-right ml-4">
                    {maxed ? (
                      <div className="text-sm font-black text-amber-900 bg-amber-200 px-3 py-1 rounded-full">MAX</div>
                    ) : (
                      <>
                        <div className="font-black text-amber-900 text-lg">{formatNumber(cost)}</div>
                        <div className="text-xs text-amber-600">beans</div>
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
            <h2 className="font-black text-xl mb-4 mt-10 text-amber-900">🎁 Claim Rewards</h2>
            <div className="space-y-3">
              {unclaimedMilestones.map(key => {
                const milestone = MILESTONES[key as keyof typeof MILESTONES];
                return (
                  <button
                    key={key}
                    onClick={() => claimMilestone(key)}
                    className="w-full p-4 bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 border-3 border-yellow-600 rounded-2xl hover:scale-105 active:scale-100 transition-all shadow-xl"
                    style={{
                      boxShadow: '0 10px 30px rgba(234, 179, 8, 0.4), inset 0 2px 10px rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-black text-amber-900">{milestone.name}</div>
                      <div className="font-black text-yellow-900 text-lg">+{milestone.reward} $NOUN</div>
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
            className="w-full mt-10 p-6 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-2xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl"
            style={{
              boxShadow: '0 20px 40px rgba(147, 51, 234, 0.4), inset 0 2px 20px rgba(255, 255, 255, 0.3)'
            }}
          >
            ⭐ PRESTIGE AVAILABLE ⭐
          </button>
        )}
      </div>

      {/* Prestige modal */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white to-amber-50 p-8 rounded-3xl max-w-sm w-full shadow-2xl border-2 border-amber-200">
            <h3 className="text-2xl font-black mb-4 text-amber-900">⭐ Prestige</h3>
            <p className="text-sm text-amber-800 mb-6 font-semibold leading-relaxed">
              Reset most upgrades but gain <span className="font-black text-orange-700">+10% permanent production bonus</span> and keep <span className="font-black text-orange-700">10% of lifetime beans</span> as permanent bonus!
            </p>
            <div className="text-sm mb-6 p-4 bg-amber-100 rounded-xl">
              <div className="text-amber-800 font-semibold">Current lifetime bonus: {formatNumber(state.lifetimeBonus)}</div>
              <div className="font-black text-orange-700 text-lg">
                After prestige: {formatNumber(state.lifetimeBonus + state.totalBeans * 0.1)}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="flex-1 py-3 border-2 border-amber-300 rounded-xl font-bold text-amber-900 hover:bg-amber-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePrestige}
                className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-black shadow-lg hover:scale-105 active:scale-95"
              >
                Prestige Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
