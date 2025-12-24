'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// COZY COFFEE SHOP IDLE GAME
// ============================================

interface GameState {
  coffee: number;
  totalCoffee: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  upgrades: {
    tapPower: number;
    coffeeMachine: number;
    barista: number;
    pastryCase: number;
    cozySeating: number;
    bookshelf: number;
    plants: number;
    lighting: number;
  };
  unlocks: Set<string>;
}

const UPGRADES = {
  tapPower: { name: 'Better Beans', desc: '+1 per tap', cost: 10, mult: 1.5, max: 50, perTap: 1, perSec: 0 },
  coffeeMachine: { name: 'Coffee Machine', desc: '+2/sec each', cost: 100, mult: 1.8, max: 10, perTap: 0, perSec: 2, unlock: 50 },
  barista: { name: 'Barista', desc: '+5/sec each', cost: 500, mult: 2.0, max: 5, perTap: 0, perSec: 5, unlock: 200 },
  pastryCase: { name: 'Pastry Case', desc: '+10/sec', cost: 2000, mult: 2.2, max: 3, perTap: 0, perSec: 10, unlock: 1000 },
  cozySeating: { name: 'Cozy Seating', desc: '+15/sec', cost: 5000, mult: 2.5, max: 4, perTap: 0, perSec: 15, unlock: 3000 },
  bookshelf: { name: 'Bookshelf', desc: '+8/sec', cost: 3000, mult: 2.0, max: 3, perTap: 0, perSec: 8, unlock: 2000 },
  plants: { name: 'Plants', desc: '+3/sec', cost: 800, mult: 1.6, max: 6, perTap: 0, perSec: 3, unlock: 400 },
  lighting: { name: 'String Lights', desc: '+12/sec', cost: 4000, mult: 2.3, max: 3, perTap: 0, perSec: 12, unlock: 2500 },
};

const getCost = (key: keyof typeof UPGRADES, level: number) =>
  Math.floor(UPGRADES[key].cost * Math.pow(UPGRADES[key].mult, level));

const fmt = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
};

// Warm cozy color palette
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
};

export default function CoffeeShopGame({ fid }: { fid: number }) {
  const [state, setState] = useState<GameState>({
    coffee: 0,
    totalCoffee: 0,
    prestigeLevel: 0,
    prestigeMultiplier: 1,
    upgrades: {
      tapPower: 0,
      coffeeMachine: 0,
      barista: 0,
      pastryCase: 0,
      cozySeating: 0,
      bookshelf: 0,
      plants: 0,
      lighting: 0,
    },
    unlocks: new Set(['tapPower']),
  });

  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: number }>>([]);
  const [steamParticles, setSteamParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shop' | 'upgrades'>('shop');
  const particleId = useRef(0);

  // Calculate rates
  const getPerTap = useCallback(() => {
    const base = 1 + state.upgrades.tapPower * UPGRADES.tapPower.perTap;
    return Math.floor(base * state.prestigeMultiplier);
  }, [state.upgrades.tapPower, state.prestigeMultiplier]);

  const getPerSec = useCallback(() => {
    let total = 0;
    (Object.keys(UPGRADES) as Array<keyof typeof UPGRADES>).forEach(key => {
      total += state.upgrades[key] * UPGRADES[key].perSec;
    });
    return Math.floor(total * state.prestigeMultiplier);
  }, [state.upgrades, state.prestigeMultiplier]);

  // Check unlocks
  useEffect(() => {
    setState(prev => {
      const newUnlocks = new Set(prev.unlocks);
      let notify = '';

      (Object.keys(UPGRADES) as Array<keyof typeof UPGRADES>).forEach(key => {
        const upgrade = UPGRADES[key];
        if ('unlock' in upgrade && !newUnlocks.has(key) && prev.totalCoffee >= (upgrade as any).unlock) {
          newUnlocks.add(key);
          notify = `${upgrade.name} Unlocked!`;
        }
      });

      if (notify) {
        setNotification(notify);
        setTimeout(() => setNotification(null), 2500);
        return { ...prev, unlocks: newUnlocks };
      }
      return prev;
    });
  }, [state.totalCoffee]);

  // Auto production
  useEffect(() => {
    const interval = setInterval(() => {
      const perSec = getPerSec();
      if (perSec > 0) {
        setState(prev => ({
          ...prev,
          coffee: prev.coffee + perSec,
          totalCoffee: prev.totalCoffee + perSec,
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [getPerSec]);

  // Steam animation
  useEffect(() => {
    if (state.upgrades.coffeeMachine === 0) return;
    const interval = setInterval(() => {
      setSteamParticles(prev => [
        ...prev.slice(-10),
        { id: Date.now(), x: Math.random() * 30, delay: Math.random() * 0.5 }
      ]);
    }, 800);
    return () => clearInterval(interval);
  }, [state.upgrades.coffeeMachine]);

  // Tap handler
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const earned = getPerTap();
    setState(prev => ({
      ...prev,
      coffee: prev.coffee + earned,
      totalCoffee: prev.totalCoffee + earned,
    }));

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 40,
      y: rect.top + 20,
      value: earned,
    }]);
  };

  // Buy upgrade
  const buy = (key: keyof typeof UPGRADES) => {
    const cost = getCost(key, state.upgrades[key]);
    if (state.coffee >= cost && state.upgrades[key] < UPGRADES[key].max) {
      setState(prev => ({
        ...prev,
        coffee: prev.coffee - cost,
        upgrades: { ...prev.upgrades, [key]: prev.upgrades[key] + 1 },
      }));
    }
  };

  const perSec = getPerSec();
  const perTap = getPerTap();

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
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full font-bold shadow-lg animate-bounce"
          style={{ background: COLORS.warm, color: COLORS.brown }}
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="p-4 text-center" style={{ background: COLORS.woodDark }}>
        <h1 className="text-xl font-bold text-amber-100 tracking-wide">NOUN COFFEE</h1>
        <div className="text-3xl font-black text-white mt-1">{fmt(state.coffee)}</div>
        {perSec > 0 && <div className="text-amber-200 text-sm">+{fmt(perSec)}/sec</div>}
      </header>

      {/* ============================================ */}
      {/* THE COZY COFFEE SHOP SCENE */}
      {/* ============================================ */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: '320px', background: `linear-gradient(180deg, ${COLORS.cream} 0%, ${COLORS.bgDark} 100%)` }}
      >
        {/* Back wall */}
        <div className="absolute inset-x-0 top-0 h-40" style={{ background: COLORS.cream }}>
          {/* Shelves */}
          <div className="absolute top-8 left-4 right-4 h-3 rounded" style={{ background: COLORS.wood }} />
          <div className="absolute top-20 left-8 right-8 h-3 rounded" style={{ background: COLORS.wood }} />

          {/* String lights (if owned) */}
          {state.upgrades.lighting > 0 && (
            <div className="absolute top-2 left-0 right-0 flex justify-center gap-6">
              {Array.from({ length: state.upgrades.lighting * 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    background: ['#ffd54f', '#ff8a65', '#fff59d', '#ffcc80'][i % 4],
                    animationDelay: `${i * 0.2}s`,
                    boxShadow: `0 0 8px ${['#ffd54f', '#ff8a65', '#fff59d', '#ffcc80'][i % 4]}`
                  }}
                />
              ))}
            </div>
          )}

          {/* Books on shelf (if owned) */}
          {state.upgrades.bookshelf > 0 && (
            <div className="absolute top-10 left-6 flex gap-1">
              {Array.from({ length: state.upgrades.bookshelf * 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{
                    width: '8px',
                    height: `${16 + (i % 3) * 4}px`,
                    background: ['#8b4513', '#a0522d', '#6b4423', '#4a3520'][i % 4],
                  }}
                />
              ))}
            </div>
          )}

          {/* Plants on shelf (if owned) */}
          {state.upgrades.plants > 0 && (
            <div className="absolute top-12 right-8 flex gap-3">
              {Array.from({ length: Math.min(state.upgrades.plants, 3) }).map((_, i) => (
                <div key={i} className="relative">
                  <div className="w-4 h-5 rounded-b-lg" style={{ background: '#d4a574' }} />
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full"
                    style={{ background: COLORS.plant }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counter */}
        <div
          className="absolute bottom-0 left-0 right-0 h-28"
          style={{ background: `linear-gradient(180deg, ${COLORS.wood} 0%, ${COLORS.woodDark} 100%)` }}
        >
          {/* Counter top */}
          <div className="absolute top-0 left-0 right-0 h-4" style={{ background: COLORS.woodLight }} />

          {/* Coffee Machine (if owned) */}
          {state.upgrades.coffeeMachine > 0 && (
            <div className="absolute left-4 -top-16">
              {/* Machine body */}
              <div className="relative">
                <div className="w-16 h-20 rounded-t-lg" style={{ background: '#4a4a4a' }}>
                  {/* Display */}
                  <div className="absolute top-2 left-2 right-2 h-6 rounded bg-black/30" />
                  {/* Buttons */}
                  <div className="absolute top-10 left-3 flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                  </div>
                </div>
                {/* Drip tray */}
                <div className="w-16 h-3 rounded-b" style={{ background: '#3a3a3a' }} />

                {/* Steam */}
                {steamParticles.map(s => (
                  <div
                    key={s.id}
                    className="absolute w-2 h-2 rounded-full opacity-60"
                    style={{
                      left: 20 + s.x,
                      top: -8,
                      background: 'white',
                      animation: `steamRise 1.5s ease-out forwards`,
                      animationDelay: `${s.delay}s`
                    }}
                  />
                ))}
              </div>
              {state.upgrades.coffeeMachine > 1 && (
                <div className="text-[10px] text-center mt-1 text-amber-200">x{state.upgrades.coffeeMachine}</div>
              )}
            </div>
          )}

          {/* Pastry Case (if owned) */}
          {state.upgrades.pastryCase > 0 && (
            <div className="absolute left-24 -top-12">
              <div className="w-20 h-14 rounded-lg border-2" style={{ background: 'rgba(255,255,255,0.9)', borderColor: COLORS.accent }}>
                <div className="flex gap-1 p-2 flex-wrap">
                  {Array.from({ length: state.upgrades.pastryCase * 2 }).map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-full" style={{ background: ['#d4a574', '#e8c4a0', '#c49a6c'][i % 3] }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Baristas (if owned) */}
          {state.upgrades.barista > 0 && (
            <div className="absolute right-4 -top-20 flex gap-2">
              {Array.from({ length: state.upgrades.barista }).map((_, i) => (
                <div key={i} className="relative animate-bounce" style={{ animationDuration: '2s', animationDelay: `${i * 0.3}s` }}>
                  {/* Head */}
                  <div className="w-6 h-6 rounded-full mx-auto" style={{ background: '#e8c4a0' }}>
                    <div className="absolute top-2 left-1 w-1 h-1 rounded-full bg-black" />
                    <div className="absolute top-2 right-1 w-1 h-1 rounded-full bg-black" />
                  </div>
                  {/* Body with apron */}
                  <div className="w-8 h-10 rounded-t-lg mt-1" style={{ background: COLORS.plant }}>
                    <div className="absolute bottom-0 left-1 right-1 h-4 rounded-b" style={{ background: COLORS.brown }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tap target - Coffee Cup */}
          <button
            onClick={handleTap}
            className="absolute left-1/2 -translate-x-1/2 -top-10 transition-transform active:scale-90 hover:scale-105 cursor-pointer"
          >
            {/* Cup */}
            <div className="relative">
              {/* Steam from cup */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1 opacity-60">
                <div className="w-1 h-4 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: '0s' }} />
                <div className="w-1 h-6 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: '0.3s' }} />
                <div className="w-1 h-4 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: '0.6s' }} />
              </div>

              {/* Mug body */}
              <div className="w-14 h-12 rounded-b-2xl border-4" style={{ background: COLORS.cream, borderColor: 'black' }}>
                {/* Coffee inside */}
                <div className="absolute top-2 left-1 right-1 bottom-1 rounded-b-xl overflow-hidden">
                  <div className="h-2" style={{ background: '#c4956a' }} />
                  <div className="flex-1 h-full" style={{ background: COLORS.brown }} />
                </div>
              </div>

              {/* Handle */}
              <div
                className="absolute top-2 -right-3 w-4 h-6 rounded-r-full border-4"
                style={{ borderColor: 'black', background: COLORS.cream }}
              />

              {/* Saucer */}
              <div className="w-18 h-2 rounded-full -mx-2 border-2" style={{ background: COLORS.cream, borderColor: 'black', width: '72px' }} />
            </div>

            <div className="text-center mt-2 font-bold px-2 py-1 rounded" style={{ background: COLORS.brown, color: COLORS.cream }}>
              +{fmt(perTap)}
            </div>
          </button>
        </div>

        {/* Cozy seating area (if owned) */}
        {state.upgrades.cozySeating > 0 && (
          <div className="absolute bottom-28 right-4 flex gap-2">
            {Array.from({ length: Math.min(state.upgrades.cozySeating, 2) }).map((_, i) => (
              <div key={i} className="relative">
                {/* Chair */}
                <div className="w-8 h-6 rounded-t-lg" style={{ background: '#b8860b' }} />
                <div className="w-10 h-2 rounded -mx-1" style={{ background: '#8b6914' }} />
                {/* Table */}
                {i === 0 && (
                  <div className="absolute -right-6 top-0">
                    <div className="w-6 h-1 rounded" style={{ background: COLORS.woodDark }} />
                    <div className="w-1 h-4 mx-auto" style={{ background: COLORS.woodDark }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* More plants on floor */}
        {state.upgrades.plants > 3 && (
          <div className="absolute bottom-28 left-4">
            <div className="w-6 h-8 rounded-b-lg" style={{ background: '#d4a574' }} />
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full"
              style={{ background: COLORS.plant }}
            />
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* UPGRADE SHOP */}
      {/* ============================================ */}
      <div className="p-4 space-y-2">
        <h2 className="font-bold text-lg" style={{ color: COLORS.brown }}>Upgrades</h2>

        {(Object.keys(UPGRADES) as Array<keyof typeof UPGRADES>).map(key => {
          if (!state.unlocks.has(key)) return null;
          const upgrade = UPGRADES[key];
          const level = state.upgrades[key];
          const cost = getCost(key, level);
          const maxed = level >= upgrade.max;
          const canAfford = state.coffee >= cost;

          return (
            <button
              key={key}
              onClick={() => buy(key)}
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
                <div className="font-bold" style={{ color: COLORS.brown }}>{upgrade.name}</div>
                <div className="text-xs" style={{ color: COLORS.accent }}>{upgrade.desc}</div>
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: COLORS.accent }}>{level}/{upgrade.max}</div>
                {maxed ? (
                  <div className="font-bold" style={{ color: COLORS.plant }}>MAX</div>
                ) : (
                  <div className="font-bold" style={{ color: canAfford ? COLORS.brown : COLORS.bgDark }}>
                    {fmt(cost)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
