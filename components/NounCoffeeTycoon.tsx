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
  createInitialState,
} from '@/lib/game';

const fmt = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
};

interface Props {
  fid: number;
}

type Tab = 'game' | 'upgrades' | 'premium' | 'quests' | 'achievements' | 'prestige';

export default function NounCoffeeTycoon({ fid }: Props) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: number }>>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const particleId = useRef(0);

  // Load game state
  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch(`/api/game/state?fid=${fid}`);
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.idleEarnings?.coins > 0) {
            showNotification(`Earned ${fmt(data.idleEarnings.coins)} while away`);
          }
        } else {
          // API failed, create initial state locally
          setState(createInitialState(fid));
        }
      } catch (error) {
        console.error('Failed to load state:', error);
        // Fallback to local state
        setState(createInitialState(fid));
      } finally {
        setLoading(false);
      }
    }
    loadState();
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
        console.error('Failed to save:', error);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fid, state]);

  // Quest reset check
  useEffect(() => {
    if (!state || !shouldResetQuests(state)) return;
    setState(prev => {
      if (!prev) return prev;
      const allCompleted = prev.dailyQuests.every(q => q.claimed);
      return {
        ...prev,
        dailyQuests: generateDailyQuests(),
        lastQuestReset: Date.now(),
        questStreak: allCompleted ? prev.questStreak + 1 : 0,
      };
    });
    showNotification('New daily quests available');
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
        updateQuestProgress(newState, { type: 'idle', amount: perSec });
        const achievements = checkAchievements(newState);
        if (achievements.length > 0) {
          showNotification(`Achievement: ${achievements[0].name}`);
        }
        return newState;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

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
      return newState;
    });

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2,
      y: rect.top,
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
  }, [state]);

  const buyPremiumUpgrade = useCallback(async (upgradeKey: keyof typeof PREMIUM_UPGRADE_COSTS) => {
    if (!state) return;
    const cost = getPremiumUpgradeCost(upgradeKey, state.upgrades[upgradeKey]);
    if (!cost) return;
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        upgrades: { ...prev.upgrades, [upgradeKey]: prev.upgrades[upgradeKey] + 1 },
        nounTokensSpent: prev.nounTokensSpent + cost,
      };
    });
    showNotification(`Purchased ${upgradeKey}`);
  }, [state]);

  const claimQuest = useCallback((questId: string) => {
    if (!state) return;
    setState(prev => {
      if (!prev) return prev;
      const quest = prev.dailyQuests.find(q => q.id === questId);
      if (!quest || !quest.completed || quest.claimed) return prev;
      quest.claimed = true;
      return { ...prev, coins: prev.coins + quest.reward };
    });
    showNotification('Quest reward claimed');
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
      console.error('Failed to claim:', error);
    }
  }, [fid, state]);

  const handlePrestige = useCallback(() => {
    if (!state || !canPrestige(state)) return;
    setState(prev => {
      if (!prev) return prev;
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
    showNotification('Prestiged! +10% production boost');
  }, [state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center text-gray-600">
          <div className="text-xl mb-2">Error loading game</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const perSec = calculateProductionRate(state);
  const perTap = calculateTapPower(state);
  const unclaimedMilestones = getUnclaimedMilestones(state);

  return (
    <div className="min-h-screen bg-white">
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none font-bold text-xl z-50"
          style={{
            left: p.x,
            top: p.y,
            color: '#000',
            animation: 'floatUp 1s ease-out forwards',
          }}
          onAnimationEnd={() => setParticles(prev => prev.filter(x => x.id !== p.id))}
        >
          +{fmt(p.value)}
        </div>
      ))}

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg font-medium shadow-lg bg-black text-white animate-slideDown">
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black flex items-center gap-2">
                <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                  <rect width="9" height="9" fill="#000" />
                  <rect x="15" width="9" height="9" fill="#000" />
                  <rect x="9" y="3" width="6" height="3" fill="#000" />
                </svg>
                NOUN COFFEE
              </h1>
              {state.prestigeLevel > 0 && (
                <div className="text-xs text-gray-500 mt-1">Prestige {state.prestigeLevel}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-black">{fmt(state.coins)}</div>
              {perSec > 0 && (
                <div className="text-sm text-gray-500">+{fmt(perSec)}/s</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Game View */}
      {activeTab === 'game' && (
        <div className="max-w-md mx-auto px-6 py-8">
          {/* Tap Area */}
          <div className="text-center mb-8">
            <button
              onClick={handleTap}
              className="mx-auto transition-transform active:scale-95 hover:scale-105"
            >
              {/* Minimal Coffee Cup */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Cup */}
                  <rect x="20" y="30" width="50" height="60" rx="5" fill="white" stroke="black" strokeWidth="2"/>
                  {/* Coffee */}
                  <rect x="22" y="40" width="46" height="48" rx="3" fill="#1a1a1a"/>
                  {/* Nouns Glasses */}
                  <g transform="translate(30, 55)">
                    <rect width="15" height="15" fill="white"/>
                    <rect x="25" width="15" height="15" fill="white"/>
                    <rect x="15" y="5" width="10" height="5" fill="white"/>
                  </g>
                  {/* Handle */}
                  <path d="M 70 45 Q 85 45 85 60 Q 85 75 70 75" fill="none" stroke="black" strokeWidth="2"/>
                  {/* Saucer */}
                  <ellipse cx="45" cy="90" rx="35" ry="5" fill="white" stroke="black" strokeWidth="2"/>
                </svg>
              </div>
              <div className="px-6 py-2 bg-black text-white rounded-full font-bold inline-block">
                Tap +{fmt(perTap)}
              </div>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Total Brewed</div>
              <div className="text-lg font-bold">{fmt(state.totalCoffees)}</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Per Second</div>
              <div className="text-lg font-bold">{fmt(perSec)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-t border-gray-200 bg-white sticky bottom-0">
        <div className="max-w-md mx-auto flex">
          {(['game', 'upgrades', 'premium', 'quests', 'achievements', 'prestige'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-medium relative ${
                activeTab === tab
                  ? 'text-black border-t-2 border-black'
                  : 'text-gray-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'quests' && state.dailyQuests.some(q => q.completed && !q.claimed) && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-black rounded-full" />
              )}
              {tab === 'achievements' && unclaimedMilestones.length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-black rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-md mx-auto px-6 py-6 pb-24">
        {activeTab === 'upgrades' && (
          <>
            <h2 className="text-lg font-bold mb-4">Upgrades</h2>
            <div className="space-y-2">
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
                    className={`w-full p-4 border rounded-lg text-left transition-all ${
                      maxed
                        ? 'border-gray-200 bg-gray-50'
                        : canAfford
                        ? 'border-black hover:bg-gray-50 active:bg-gray-100'
                        : 'border-gray-200 opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Level {level}/{upgradeData.max}
                        </div>
                      </div>
                      <div className="text-right">
                        {maxed ? (
                          <div className="text-sm font-medium">MAX</div>
                        ) : (
                          <div className="font-bold">
                            {cost !== null ? fmt(cost) : 'MAX'}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'premium' && (
          <>
            <h2 className="text-lg font-bold mb-2">Premium Upgrades</h2>
            <p className="text-sm text-gray-600 mb-4">Requires $NOUN tokens</p>
            <div className="space-y-2">
              {(Object.keys(PREMIUM_UPGRADE_COSTS) as Array<keyof typeof PREMIUM_UPGRADE_COSTS>).map(key => {
                const upgradeData = PREMIUM_UPGRADE_COSTS[key];
                const level = state.upgrades[key];
                const cost = getPremiumUpgradeCost(key, level);
                const maxed = level >= upgradeData.max;

                return (
                  <button
                    key={key}
                    onClick={() => buyPremiumUpgrade(key)}
                    disabled={maxed}
                    className={`w-full p-4 border rounded-lg text-left ${
                      maxed
                        ? 'border-gray-200 bg-gray-50 opacity-50'
                        : 'border-black hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Level {level}/{upgradeData.max}
                        </div>
                      </div>
                      <div className="text-right">
                        {maxed ? (
                          <div className="text-sm font-medium">MAX</div>
                        ) : (
                          <div className="font-bold text-sm">
                            {cost !== null ? `${fmt(cost)} $NOUN` : 'MAX'}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'quests' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Daily Quests</h2>
              {state.questStreak > 0 && (
                <div className="text-sm font-medium">{state.questStreak} day streak</div>
              )}
            </div>
            <div className="space-y-3">
              {state.dailyQuests.map(quest => {
                const progress = Math.min(quest.progress, quest.target);
                const percentage = (progress / quest.target) * 100;

                return (
                  <div
                    key={quest.id}
                    className={`p-4 border rounded-lg ${
                      quest.claimed
                        ? 'border-gray-200 bg-gray-50'
                        : quest.completed
                        ? 'border-black'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium">{quest.description}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          Reward: {quest.reward} coins
                        </div>
                      </div>
                      {quest.completed && !quest.claimed && (
                        <button
                          onClick={() => claimQuest(quest.id)}
                          className="px-3 py-1 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
                        >
                          Claim
                        </button>
                      )}
                      {quest.claimed && <div className="text-xl">✓</div>}
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {progress} / {quest.target}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'achievements' && (
          <>
            <h2 className="text-lg font-bold mb-2">Milestones</h2>
            <p className="text-sm text-gray-600 mb-4">Earn $NOUN tokens</p>
            <div className="space-y-2">
              {Object.entries(MILESTONES).map(([key, milestone]) => {
                const claimed = state.milestones.includes(key);
                const canClaim = unclaimedMilestones.includes(key);

                return (
                  <div
                    key={key}
                    className={`p-4 border rounded-lg ${
                      claimed
                        ? 'border-gray-200 bg-gray-50'
                        : canClaim
                        ? 'border-black'
                        : 'border-gray-200 opacity-40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{milestone.description}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {milestone.reward} $NOUN
                        </div>
                      </div>
                      {claimed ? (
                        <div className="text-xl">✓</div>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimMilestone(key)}
                          className="px-3 py-1 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
                        >
                          Claim
                        </button>
                      ) : (
                        <div className="text-sm text-gray-400">Locked</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="text-lg font-bold mt-8 mb-4">Achievements</h2>
            <div className="space-y-2">
              {state.achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={`p-4 border rounded-lg ${
                    achievement.unlocked ? 'border-black' : 'border-gray-200 opacity-40'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{achievement.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {achievement.description}
                      </div>
                      {achievement.unlocked && (
                        <div className="text-xs text-black mt-2">Bonus Active</div>
                      )}
                    </div>
                    {achievement.unlocked && <div className="text-xl">✓</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'prestige' && (
          <>
            <h2 className="text-lg font-bold mb-4">Prestige</h2>
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold mb-2">{state.prestigeLevel}</div>
                <div className="text-sm text-gray-600">
                  +{state.prestigeLevel * 10}% production bonus
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700">
                Prestiging resets basic upgrades but keeps premium upgrades and grants +10% permanent production bonus
              </div>
              <div className="text-center mb-4">
                <div className="text-xs text-gray-500 mb-1">Required:</div>
                <div className="font-bold">{fmt(calculatePrestigeCost(state.prestigeLevel))} coffees</div>
              </div>
              <button
                onClick={() => setShowPrestigeModal(true)}
                disabled={!canPrestige(state)}
                className={`w-full py-3 rounded-lg font-bold ${
                  canPrestige(state)
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canPrestige(state) ? 'Prestige Now' : 'Not Ready'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Prestige Modal */}
      {showPrestigeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Prestige</h3>
            <p className="text-sm text-gray-600 mb-6">
              Reset basic upgrades and coffee count for +10% permanent production bonus?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrestigeModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePrestige}
                className="flex-1 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Prestige
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-60px); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
