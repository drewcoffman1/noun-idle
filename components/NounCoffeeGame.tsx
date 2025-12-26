'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GameStateV2,
  createInitialStateV2,
  calculateProduction,
  calculateTapValue,
  calculateAutoTap,
  calculateCritChance,
  calculatePrestigeGain,
  updateCombo,
  formatNumber,
  formatShort,
  SHOP_TIERS,
  UPGRADES,
  ACHIEVEMENTS,
  getUpgradeLevel,
  getUpgradeCost,
  canAffordUpgrade,
  meetsUpgradeRequirements,
  checkAchievement,
  generateStaff,
  getStaffCost,
  Upgrade,
  Staff,
} from '@/lib/gameV2';
import {
  PALETTE,
  CoffeeMug,
  Character,
  CoffeeMachine,
  Counter,
  BeanIcon,
  GoldenBean,
  FloatingNumber,
  ComboIndicator,
  EventBanner,
  ProgressBar,
  ShopScene,
  NounGlasses,
} from './NounSprites';

// ============================================
// MAIN GAME COMPONENT
// ============================================

interface NounCoffeeGameProps {
  fid: number;
}

export default function NounCoffeeGame({ fid }: NounCoffeeGameProps) {
  // Game state
  const [state, setState] = useState<GameStateV2>(() => createInitialStateV2(fid));

  // UI state
  const [activeTab, setActiveTab] = useState<'shop' | 'upgrades' | 'staff' | 'prestige'>('shop');
  const [floatingNumbers, setFloatingNumbers] = useState<Array<{ id: number; value: string; x: number; y: number; color: string }>>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [mugScale, setMugScale] = useState(1);

  const floatIdRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  // Calculated values
  const production = useMemo(() => calculateProduction(state), [state]);
  const tapValue = useMemo(() => calculateTapValue(state), [state]);
  const autoTaps = useMemo(() => calculateAutoTap(state), [state]);
  const critChance = useMemo(() => calculateCritChance(state), [state]);
  const shopTier = SHOP_TIERS[state.shopTier] || SHOP_TIERS[0];

  // Show notification
  const showNotification = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2500);
  }, []);

  // Add floating number
  const addFloatingNumber = useCallback((value: string, x: number, y: number, color: string = PALETTE.nounYellow) => {
    const id = floatIdRef.current++;
    setFloatingNumbers(prev => [...prev, { id, value, x, y, color }]);
  }, []);

  // Handle tap
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const isCrit = Math.random() < critChance;
    const earned = isCrit ? tapValue * 10 : tapValue;

    // Update combo
    const newCombo = updateCombo(state);

    setState(prev => ({
      ...prev,
      currency: {
        ...prev.currency,
        beans: prev.currency.beans + earned,
      },
      combo: newCombo,
      stats: {
        ...prev.stats,
        totalTaps: prev.stats.totalTaps + 1,
        totalBeansEarned: prev.stats.totalBeansEarned + earned,
        highestCombo: Math.max(prev.stats.highestCombo, newCombo.count),
      },
    }));

    // Visual feedback
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
    const y = rect.top + 20;

    addFloatingNumber(
      `+${formatShort(earned)}${isCrit ? ' CRIT!' : ''}`,
      x,
      y,
      isCrit ? PALETTE.nounRed : PALETTE.nounYellow
    );

    // Mug bounce
    setMugScale(0.9);
    setTimeout(() => setMugScale(1), 100);
  }, [state, tapValue, critChance, addFloatingNumber]);

  // Buy upgrade
  const buyUpgrade = useCallback((upgrade: Upgrade) => {
    const level = getUpgradeLevel(state, upgrade.id);
    if (level >= upgrade.maxLevel) return;
    if (!canAffordUpgrade(state, upgrade)) return;
    if (!meetsUpgradeRequirements(state, upgrade)) return;

    const cost = getUpgradeCost(upgrade, level);

    setState(prev => {
      const newCurrency = { ...prev.currency };

      switch (upgrade.currency) {
        case 'beans': newCurrency.beans -= cost; break;
        case 'roastPoints': newCurrency.roastPoints -= cost; break;
        case 'franchiseTokens': newCurrency.franchiseTokens -= cost; break;
        case 'nounTokens': newCurrency.nounTokens -= cost; break;
      }

      return {
        ...prev,
        currency: newCurrency,
        upgrades: { ...prev.upgrades, [upgrade.id]: level + 1 },
      };
    });

    showNotification(`${upgrade.name} upgraded to level ${level + 1}!`, 'success');
  }, [state, showNotification]);

  // Hire staff
  const hireStaff = useCallback((role: Staff['role']) => {
    const cost = getStaffCost(state, role);

    if (state.currency[cost.currency] < cost.amount) {
      showNotification(`Not enough ${cost.currency}!`, 'warning');
      return;
    }

    const newStaff = generateStaff(role);

    setState(prev => ({
      ...prev,
      currency: {
        ...prev.currency,
        [cost.currency]: prev.currency[cost.currency] - cost.amount,
      },
      staff: [...prev.staff, newStaff],
    }));

    showNotification(`${newStaff.name} joined your team!`, 'success');
  }, [state, showNotification]);

  // Upgrade shop tier
  const upgradeShop = useCallback(() => {
    const nextTier = SHOP_TIERS[state.shopTier + 1];
    if (!nextTier) return;

    const { unlockCost, unlockCurrency } = nextTier;
    if (state.currency[unlockCurrency] < unlockCost) {
      showNotification(`Need ${formatNumber(unlockCost)} ${unlockCurrency}!`, 'warning');
      return;
    }

    setState(prev => ({
      ...prev,
      shopTier: prev.shopTier + 1,
      currency: {
        ...prev.currency,
        [unlockCurrency]: prev.currency[unlockCurrency] - unlockCost,
      },
    }));

    showNotification(`Upgraded to ${nextTier.name}!`, 'success');
  }, [state, showNotification]);

  // Prestige (beans → roast points)
  const prestige = useCallback(() => {
    const gain = calculatePrestigeGain(state, 0);
    if (gain < 1) {
      showNotification('Need more beans to prestige!', 'warning');
      return;
    }

    setState(prev => ({
      ...prev,
      currency: {
        beans: 0,
        roastPoints: prev.currency.roastPoints + gain,
        franchiseTokens: prev.currency.franchiseTokens,
        nounTokens: prev.currency.nounTokens,
      },
      shopTier: 0,
      upgrades: Object.fromEntries(
        Object.entries(prev.upgrades).filter(([id]) => {
          const upgrade = UPGRADES.find(u => u.id === id);
          return upgrade?.currency !== 'beans';
        })
      ),
      staff: prev.staff.filter(s => s.role !== 'barista'),
      stats: {
        ...prev.stats,
        totalBeansEarned: 0,
        prestigeCount: [prev.stats.prestigeCount[0] + 1, prev.stats.prestigeCount[1], prev.stats.prestigeCount[2]],
      },
      prestigeStats: {
        ...prev.prestigeStats,
        totalPrestiges: prev.prestigeStats.totalPrestiges + 1,
        highestBeans: Math.max(prev.prestigeStats.highestBeans, prev.currency.beans),
        totalBeansEarned: prev.prestigeStats.totalBeansEarned + prev.stats.totalBeansEarned,
      },
      combo: { count: 0, lastTap: 0, multiplier: 1 },
    }));

    setShowPrestigeModal(false);
    showNotification(`Earned ${formatNumber(gain)} Roast Points!`, 'success');
  }, [state, showNotification]);

  // Game tick (production + auto-tap)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setState(prev => {
        // Auto production
        const produced = Math.floor(production * deltaSeconds);
        // Auto taps
        const autoProduced = Math.floor(autoTaps * calculateTapValue(prev) * deltaSeconds);
        const totalEarned = produced + autoProduced;

        if (totalEarned === 0) return prev;

        return {
          ...prev,
          currency: {
            ...prev.currency,
            beans: prev.currency.beans + totalEarned,
          },
          stats: {
            ...prev.stats,
            totalBeansEarned: prev.stats.totalBeansEarned + totalEarned,
            playTimeSeconds: prev.stats.playTimeSeconds + deltaSeconds,
          },
          lastTick: now,
        };
      });
    }, 100); // 10 ticks per second for smooth updates

    return () => clearInterval(interval);
  }, [production, autoTaps]);

  // Check achievements
  useEffect(() => {
    ACHIEVEMENTS.forEach(achievement => {
      if (checkAchievement(state, achievement) && !state.achievements.includes(achievement.id)) {
        setState(prev => ({
          ...prev,
          achievements: [...prev.achievements, achievement.id],
          currency: {
            ...prev.currency,
            [achievement.reward.type]: prev.currency[achievement.reward.type as keyof typeof prev.currency] + achievement.reward.amount,
          },
        }));
        showNotification(`🏆 ${achievement.name}!`, 'success');
      }
    });
  }, [state.stats, showNotification]);

  // Random events
  useEffect(() => {
    const interval = setInterval(() => {
      // 1% chance per tick for an event
      if (Math.random() < 0.01 && state.activeEvents.length === 0) {
        const eventTypes = ['rush_hour', 'golden_bean'] as const;
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const multiplier = type === 'rush_hour' ? 2 + Math.random() * 3 : 5;
        const duration = type === 'rush_hour' ? 30000 : 10000;

        setState(prev => ({
          ...prev,
          activeEvents: [{
            type,
            multiplier,
            endsAt: Date.now() + duration,
          }],
        }));

        showNotification(`${type === 'rush_hour' ? '⚡ Rush Hour!' : '✨ Golden Bean!'}`, 'info');
      }

      // Clean up expired events
      setState(prev => ({
        ...prev,
        activeEvents: prev.activeEvents.filter(e => e.endsAt > Date.now()),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.activeEvents.length, showNotification]);

  // Prestige gain preview
  const prestigeGain = useMemo(() => calculatePrestigeGain(state, 0), [state]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: PALETTE.bgDark }}>
      {/* Floating numbers */}
      {floatingNumbers.map(f => (
        <FloatingNumber
          key={f.id}
          value={f.value}
          x={f.x}
          y={f.y}
          color={f.color}
          onComplete={() => setFloatingNumbers(prev => prev.filter(p => p.id !== f.id))}
        />
      ))}

      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg font-bold shadow-lg animate-bounce"
          style={{
            background: notification.type === 'success' ? PALETTE.success :
                        notification.type === 'warning' ? PALETTE.warning : PALETTE.nounBlue,
            color: PALETTE.white,
            border: `2px solid ${PALETTE.black}`,
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Active events */}
      {state.activeEvents.map((event, i) => (
        <EventBanner
          key={i}
          type={event.type}
          multiplier={event.multiplier}
          timeLeft={event.endsAt - Date.now()}
        />
      ))}

      {/* ============================================ */}
      {/* HEADER - Currency Display */}
      {/* ============================================ */}
      <header className="p-3" style={{ background: PALETTE.bgMid, borderBottom: `3px solid ${PALETTE.black}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NounGlasses style={0} size={3} />
            <span className="font-bold text-lg" style={{ color: PALETTE.white }}>NOUN COFFEE</span>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-60" style={{ color: PALETTE.coffeeCream }}>
              {shopTier.name}
            </div>
          </div>
        </div>

        {/* Currency row */}
        <div className="flex gap-4 mt-2">
          {/* Beans */}
          <div className="flex items-center gap-1">
            <BeanIcon size={2} color={PALETTE.coffee} />
            <span className="font-bold" style={{ color: PALETTE.coffeeCream }}>
              {formatNumber(state.currency.beans)}
            </span>
          </div>

          {/* Roast Points */}
          {(state.currency.roastPoints > 0 || state.stats.prestigeCount[0] > 0) && (
            <div className="flex items-center gap-1">
              <span style={{ color: PALETTE.nounOrange }}>🔥</span>
              <span className="font-bold" style={{ color: PALETTE.nounOrange }}>
                {formatNumber(state.currency.roastPoints)}
              </span>
            </div>
          )}

          {/* Franchise Tokens */}
          {state.currency.franchiseTokens > 0 && (
            <div className="flex items-center gap-1">
              <span style={{ color: PALETTE.nounPurple }}>⭐</span>
              <span className="font-bold" style={{ color: PALETTE.nounPurple }}>
                {formatNumber(state.currency.franchiseTokens)}
              </span>
            </div>
          )}
        </div>

        {/* Production rate */}
        <div className="text-xs mt-1" style={{ color: PALETTE.coffeeCream, opacity: 0.7 }}>
          +{formatNumber(production)}/sec
          {autoTaps > 0 && ` | Auto: ${autoTaps}/sec`}
          {state.combo.count > 1 && ` | Combo: ${state.combo.count}x`}
        </div>
      </header>

      {/* ============================================ */}
      {/* SHOP SCENE - Main tap area */}
      {/* ============================================ */}
      <ShopScene tier={state.shopTier} className="flex-1 relative min-h-[280px]">
        {/* Counter at bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <Counter width={400} size={4} />
        </div>

        {/* Coffee Machine */}
        <div className="absolute bottom-8 left-4">
          <CoffeeMachine size={4} active={production > 0} />
        </div>

        {/* Staff display */}
        <div className="absolute bottom-10 right-4 flex gap-2">
          {state.staff.slice(0, 3).map((s, i) => (
            <Character
              key={s.id}
              skinTone={s.skinTone}
              glassesStyle={s.glassesStyle}
              shirtColor={s.role === 'barista' ? PALETTE.nounGreen :
                         s.role === 'roaster' ? PALETTE.nounOrange :
                         s.role === 'manager' ? PALETTE.nounBlue : PALETTE.nounPurple}
              size={3}
              animate
            />
          ))}
        </div>

        {/* Main Tap Target - Coffee Mug */}
        <button
          onClick={handleTap}
          className="absolute left-1/2 -translate-x-1/2 bottom-16 transition-transform cursor-pointer active:scale-95"
          style={{ transform: `translateX(-50%) scale(${mugScale})` }}
        >
          <CoffeeMug size={8} hasSteam />
          <div
            className="text-center mt-2 px-3 py-1 rounded font-bold"
            style={{
              background: PALETTE.nounYellow,
              color: PALETTE.black,
              border: `2px solid ${PALETTE.black}`,
            }}
          >
            +{formatShort(tapValue)}
          </div>
        </button>

        {/* Combo indicator */}
        {state.combo.count > 1 && (
          <ComboIndicator
            count={state.combo.count}
            multiplier={state.combo.multiplier}
            className="absolute top-4 right-4"
          />
        )}

        {/* Prestige progress */}
        {state.stats.totalBeansEarned > 1000 && (
          <div className="absolute top-4 left-4 w-32">
            <div className="text-xs mb-1 font-bold" style={{ color: PALETTE.nounOrange }}>
              Next Roast: +{formatShort(prestigeGain)}
            </div>
            <ProgressBar
              value={state.stats.totalBeansEarned}
              max={10000}
              color={PALETTE.nounOrange}
              height={8}
            />
          </div>
        )}
      </ShopScene>

      {/* ============================================ */}
      {/* TAB BAR */}
      {/* ============================================ */}
      <div className="flex" style={{ background: PALETTE.bgMid, borderTop: `2px solid ${PALETTE.black}` }}>
        {(['shop', 'upgrades', 'staff', 'prestige'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 font-bold text-sm transition-all"
            style={{
              background: activeTab === tab ? PALETTE.bgLight : 'transparent',
              color: activeTab === tab ? PALETTE.white : PALETTE.gray,
              borderBottom: activeTab === tab ? `3px solid ${PALETTE.nounYellow}` : '3px solid transparent',
            }}
          >
            {tab === 'shop' && '🏪'}
            {tab === 'upgrades' && '⬆️'}
            {tab === 'staff' && '👥'}
            {tab === 'prestige' && '🔥'}
            <span className="ml-1 hidden sm:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* TAB CONTENT */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto p-3" style={{ background: PALETTE.bgDark }}>
        {/* SHOP TAB */}
        {activeTab === 'shop' && (
          <div className="space-y-3">
            {/* Current shop info */}
            <div
              className="p-3 rounded-lg"
              style={{ background: PALETTE.bgMid, border: `2px solid ${PALETTE.black}` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold" style={{ color: PALETTE.white }}>{shopTier.name}</div>
                  <div className="text-sm" style={{ color: PALETTE.coffeeCream }}>
                    Base: {shopTier.baseProduction}/sec
                  </div>
                </div>
                {state.shopTier < SHOP_TIERS.length - 1 && (
                  <button
                    onClick={upgradeShop}
                    className="px-3 py-2 rounded font-bold transition-all hover:scale-105"
                    style={{
                      background: PALETTE.success,
                      color: PALETTE.black,
                      border: `2px solid ${PALETTE.black}`,
                    }}
                  >
                    Upgrade
                    <div className="text-xs">
                      {formatNumber(SHOP_TIERS[state.shopTier + 1].unlockCost)} {SHOP_TIERS[state.shopTier + 1].unlockCurrency}
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div
              className="p-3 rounded-lg grid grid-cols-2 gap-2"
              style={{ background: PALETTE.bgMid, border: `2px solid ${PALETTE.black}` }}
            >
              <div>
                <div className="text-xs" style={{ color: PALETTE.gray }}>Total Taps</div>
                <div className="font-bold" style={{ color: PALETTE.white }}>{formatNumber(state.stats.totalTaps)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: PALETTE.gray }}>Highest Combo</div>
                <div className="font-bold" style={{ color: PALETTE.white }}>{state.stats.highestCombo}x</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: PALETTE.gray }}>Total Beans</div>
                <div className="font-bold" style={{ color: PALETTE.coffeeCream }}>{formatNumber(state.stats.totalBeansEarned)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: PALETTE.gray }}>Prestiges</div>
                <div className="font-bold" style={{ color: PALETTE.nounOrange }}>{state.stats.prestigeCount[0]}</div>
              </div>
            </div>

            {/* Achievements preview */}
            <div className="text-sm" style={{ color: PALETTE.gray }}>
              Achievements: {state.achievements.length}/{ACHIEVEMENTS.length}
            </div>
          </div>
        )}

        {/* UPGRADES TAB */}
        {activeTab === 'upgrades' && (
          <div className="space-y-2">
            {UPGRADES.filter(u => u.currency === 'beans' || (u.currency === 'roastPoints' && state.stats.prestigeCount[0] > 0))
              .map(upgrade => {
                const level = getUpgradeLevel(state, upgrade.id);
                const maxed = level >= upgrade.maxLevel;
                const cost = getUpgradeCost(upgrade, level);
                const affordable = canAffordUpgrade(state, upgrade);
                const meetsReqs = meetsUpgradeRequirements(state, upgrade);

                return (
                  <button
                    key={upgrade.id}
                    onClick={() => buyUpgrade(upgrade)}
                    disabled={maxed || !affordable || !meetsReqs}
                    className="w-full p-3 rounded-lg flex items-center justify-between transition-all"
                    style={{
                      background: maxed ? PALETTE.bgLight : affordable && meetsReqs ? PALETTE.bgMid : PALETTE.bgDark,
                      border: `2px solid ${maxed ? PALETTE.success : affordable && meetsReqs ? PALETTE.nounYellow : PALETTE.gray}`,
                      opacity: meetsReqs ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{upgrade.icon}</span>
                      <div className="text-left">
                        <div className="font-bold" style={{ color: PALETTE.white }}>
                          {upgrade.name}
                        </div>
                        <div className="text-xs" style={{ color: PALETTE.gray }}>
                          {upgrade.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: PALETTE.gray }}>
                        {level}/{upgrade.maxLevel}
                      </div>
                      {maxed ? (
                        <div className="font-bold" style={{ color: PALETTE.success }}>MAX</div>
                      ) : (
                        <div
                          className="font-bold"
                          style={{ color: affordable ? PALETTE.nounYellow : PALETTE.gray }}
                        >
                          {formatShort(cost)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-3">
            {/* Current staff */}
            {state.staff.length > 0 && (
              <div className="space-y-2">
                <div className="font-bold" style={{ color: PALETTE.white }}>Your Team</div>
                {state.staff.map(s => (
                  <div
                    key={s.id}
                    className="p-2 rounded-lg flex items-center gap-3"
                    style={{ background: PALETTE.bgMid, border: `2px solid ${PALETTE.black}` }}
                  >
                    <Character
                      skinTone={s.skinTone}
                      glassesStyle={s.glassesStyle}
                      shirtColor={s.role === 'barista' ? PALETTE.nounGreen :
                                 s.role === 'roaster' ? PALETTE.nounOrange :
                                 s.role === 'manager' ? PALETTE.nounBlue : PALETTE.nounPurple}
                      size={3}
                    />
                    <div>
                      <div className="font-bold" style={{ color: PALETTE.white }}>{s.name}</div>
                      <div className="text-xs" style={{ color: PALETTE.gray }}>
                        {s.role} • +{(s.bonus * 100).toFixed(0)}% bonus
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hire buttons */}
            <div className="font-bold" style={{ color: PALETTE.white }}>Hire Staff</div>
            {(['barista', 'roaster', 'manager', 'influencer'] as const).map(role => {
              const cost = getStaffCost(state, role);
              const affordable = state.currency[cost.currency] >= cost.amount;
              const locked = (role === 'roaster' && state.stats.prestigeCount[0] === 0) ||
                           (role === 'manager' && state.currency.franchiseTokens === 0) ||
                           (role === 'influencer' && state.currency.nounTokens === 0);

              if (locked) return null;

              return (
                <button
                  key={role}
                  onClick={() => hireStaff(role)}
                  disabled={!affordable}
                  className="w-full p-3 rounded-lg flex items-center justify-between transition-all"
                  style={{
                    background: affordable ? PALETTE.bgMid : PALETTE.bgDark,
                    border: `2px solid ${affordable ? PALETTE.success : PALETTE.gray}`,
                    opacity: affordable ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Character
                      glassesStyle={Math.floor(Math.random() * 10)}
                      shirtColor={role === 'barista' ? PALETTE.nounGreen :
                                 role === 'roaster' ? PALETTE.nounOrange :
                                 role === 'manager' ? PALETTE.nounBlue : PALETTE.nounPurple}
                      size={2}
                    />
                    <div className="text-left">
                      <div className="font-bold capitalize" style={{ color: PALETTE.white }}>
                        {role}
                      </div>
                      <div className="text-xs" style={{ color: PALETTE.gray }}>
                        +{role === 'barista' ? 5 : role === 'roaster' ? 10 : role === 'manager' ? 15 : 20}% bonus
                      </div>
                    </div>
                  </div>
                  <div className="font-bold" style={{ color: affordable ? PALETTE.nounYellow : PALETTE.gray }}>
                    {formatShort(cost.amount)} {cost.currency}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* PRESTIGE TAB */}
        {activeTab === 'prestige' && (
          <div className="space-y-4">
            {/* Prestige explanation */}
            <div
              className="p-4 rounded-lg"
              style={{ background: PALETTE.bgMid, border: `2px solid ${PALETTE.nounOrange}` }}
            >
              <div className="font-bold text-lg mb-2" style={{ color: PALETTE.nounOrange }}>
                🔥 Roast Your Beans
              </div>
              <div className="text-sm mb-3" style={{ color: PALETTE.coffeeCream }}>
                Reset your beans and basic upgrades to earn <strong>Roast Points</strong>.
                Each prestige gives +10% permanent production bonus!
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs" style={{ color: PALETTE.gray }}>You will earn:</div>
                  <div className="text-2xl font-bold" style={{ color: PALETTE.nounOrange }}>
                    +{formatNumber(prestigeGain)} RP
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: PALETTE.gray }}>Current bonus:</div>
                  <div className="font-bold" style={{ color: PALETTE.success }}>
                    +{(state.stats.prestigeCount[0] * 10)}%
                  </div>
                </div>
              </div>

              <button
                onClick={prestige}
                disabled={prestigeGain < 1}
                className="w-full py-3 rounded-lg font-bold text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: prestigeGain >= 1 ? PALETTE.nounOrange : PALETTE.gray,
                  color: PALETTE.white,
                  border: `3px solid ${PALETTE.black}`,
                }}
              >
                {prestigeGain >= 1 ? `Roast for ${formatNumber(prestigeGain)} RP` : 'Earn more beans first!'}
              </button>
            </div>

            {/* Roast Point upgrades */}
            {state.currency.roastPoints > 0 && (
              <div>
                <div className="font-bold mb-2" style={{ color: PALETTE.nounOrange }}>
                  Roast Upgrades
                </div>
                {UPGRADES.filter(u => u.currency === 'roastPoints').map(upgrade => {
                  const level = getUpgradeLevel(state, upgrade.id);
                  const maxed = level >= upgrade.maxLevel;
                  const cost = getUpgradeCost(upgrade, level);
                  const affordable = state.currency.roastPoints >= cost;

                  return (
                    <button
                      key={upgrade.id}
                      onClick={() => buyUpgrade(upgrade)}
                      disabled={maxed || !affordable}
                      className="w-full p-3 rounded-lg flex items-center justify-between transition-all mb-2"
                      style={{
                        background: maxed ? PALETTE.bgLight : affordable ? PALETTE.bgMid : PALETTE.bgDark,
                        border: `2px solid ${maxed ? PALETTE.success : affordable ? PALETTE.nounOrange : PALETTE.gray}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{upgrade.icon}</span>
                        <div className="text-left">
                          <div className="font-bold" style={{ color: PALETTE.white }}>
                            {upgrade.name}
                          </div>
                          <div className="text-xs" style={{ color: PALETTE.gray }}>
                            {upgrade.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs" style={{ color: PALETTE.gray }}>
                          {level}/{upgrade.maxLevel}
                        </div>
                        {maxed ? (
                          <div className="font-bold" style={{ color: PALETTE.success }}>MAX</div>
                        ) : (
                          <div
                            className="font-bold"
                            style={{ color: affordable ? PALETTE.nounOrange : PALETTE.gray }}
                          >
                            {formatShort(cost)} RP
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Prestige stats */}
            <div
              className="p-3 rounded-lg"
              style={{ background: PALETTE.bgMid, border: `2px solid ${PALETTE.black}` }}
            >
              <div className="font-bold mb-2" style={{ color: PALETTE.white }}>Lifetime Stats</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span style={{ color: PALETTE.gray }}>Total Prestiges: </span>
                  <span style={{ color: PALETTE.nounOrange }}>{state.prestigeStats.totalPrestiges}</span>
                </div>
                <div>
                  <span style={{ color: PALETTE.gray }}>Highest Beans: </span>
                  <span style={{ color: PALETTE.coffeeCream }}>{formatNumber(state.prestigeStats.highestBeans)}</span>
                </div>
                <div>
                  <span style={{ color: PALETTE.gray }}>All-time Beans: </span>
                  <span style={{ color: PALETTE.coffeeCream }}>{formatNumber(state.prestigeStats.totalBeansEarned)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes steam {
          0% { opacity: 0.6; transform: translateY(0) scaleX(1); }
          50% { opacity: 0.3; transform: translateY(-10px) scaleX(1.2); }
          100% { opacity: 0; transform: translateY(-20px) scaleX(0.8); }
        }
        @keyframes floatUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px) scale(1.2); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
