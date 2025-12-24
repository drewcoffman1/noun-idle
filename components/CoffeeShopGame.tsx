'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Game state
interface GameState {
  coffee: number;
  totalCoffee: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  upgrades: {
    fingers: number;
    autoBrewer: number;
    espresso: number;
    barista: number;
    franchise: number;
  };
  unlocks: {
    autoBrewer: boolean;
    espresso: boolean;
    barista: boolean;
    franchise: boolean;
    prestige: boolean;
    goldenBeans: boolean;
  };
}

const UPGRADES = {
  fingers: { name: 'Tap Power', desc: '+1 per tap', baseCost: 10, mult: 1.5, max: 50, icon: '👆' },
  autoBrewer: { name: 'Auto Brew', desc: '+1/sec', baseCost: 50, mult: 1.4, max: 50, icon: '⚡', unlock: 25 },
  espresso: { name: 'Espresso', desc: '+5/sec', baseCost: 500, mult: 1.5, max: 30, icon: '☕', unlock: 200 },
  barista: { name: 'Barista', desc: '+20/sec', baseCost: 5000, mult: 1.6, max: 20, icon: '👤', unlock: 2000 },
  franchise: { name: 'Franchise', desc: '2x all', baseCost: 50000, mult: 3, max: 5, icon: '🏪', unlock: 20000 },
};

const getCost = (key: keyof typeof UPGRADES, level: number) =>
  Math.floor(UPGRADES[key].baseCost * Math.pow(UPGRADES[key].mult, level));

const fmt = (n: number): string => {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
};

export default function CoffeeShopGame({ fid }: { fid: number }) {
  const [state, setState] = useState<GameState>({
    coffee: 0,
    totalCoffee: 0,
    prestigeLevel: 0,
    prestigeMultiplier: 1,
    upgrades: { fingers: 0, autoBrewer: 0, espresso: 0, barista: 0, franchise: 0 },
    unlocks: { autoBrewer: false, espresso: false, barista: false, franchise: false, prestige: false, goldenBeans: false },
  });

  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: number }>>([]);
  const [goldenBean, setGoldenBean] = useState(false);
  const [boost, setBoost] = useState<{ mult: number; end: number } | null>(null);
  const [tapAnim, setTapAnim] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const particleId = useRef(0);

  // Calculate rates
  const getPerTap = useCallback(() => {
    const base = 1 + state.upgrades.fingers;
    const franchise = Math.pow(2, state.upgrades.franchise);
    const boostMult = boost && Date.now() < boost.end ? boost.mult : 1;
    return Math.floor(base * franchise * state.prestigeMultiplier * boostMult);
  }, [state, boost]);

  const getPerSec = useCallback(() => {
    const base = state.upgrades.autoBrewer * 1 + state.upgrades.espresso * 5 + state.upgrades.barista * 20;
    const franchise = Math.pow(2, state.upgrades.franchise);
    const boostMult = boost && Date.now() < boost.end ? boost.mult : 1;
    return Math.floor(base * franchise * state.prestigeMultiplier * boostMult);
  }, [state, boost]);

  // Check unlocks
  useEffect(() => {
    setState(prev => {
      const u = { ...prev.unlocks };
      let notify = '';
      if (!u.autoBrewer && prev.totalCoffee >= 25) { u.autoBrewer = true; notify = 'Auto Brew Unlocked!'; }
      if (!u.espresso && prev.totalCoffee >= 200) { u.espresso = true; notify = 'Espresso Unlocked!'; }
      if (!u.barista && prev.totalCoffee >= 2000) { u.barista = true; notify = 'Barista Unlocked!'; }
      if (!u.franchise && prev.totalCoffee >= 20000) { u.franchise = true; notify = 'Franchise Unlocked!'; }
      if (!u.prestige && prev.totalCoffee >= 100000) { u.prestige = true; notify = 'Prestige Unlocked!'; }
      if (!u.goldenBeans && prev.totalCoffee >= 500) { u.goldenBeans = true; }
      if (notify) {
        setNotification(notify);
        setTimeout(() => setNotification(null), 2500);
        return { ...prev, unlocks: u };
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

  // Golden bean spawner
  useEffect(() => {
    if (!state.unlocks.goldenBeans) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.12 && !goldenBean) setGoldenBean(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [state.unlocks.goldenBeans, goldenBean]);

  // Tap handler
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const earned = getPerTap();
    setState(prev => ({ ...prev, coffee: prev.coffee + earned, totalCoffee: prev.totalCoffee + earned }));

    setTapAnim(true);
    setTimeout(() => setTapAnim(false), 150);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 80,
      y: rect.top + rect.height / 3,
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

  // Collect golden bean
  const collectGolden = () => {
    const effects = [
      { name: 'FRENZY', mult: 7, dur: 30 },
      { name: 'LUCKY', mult: 3, dur: 77 },
      { name: 'OVERDRIVE', mult: 11, dur: 11 },
    ];
    const fx = effects[Math.floor(Math.random() * effects.length)];
    setBoost({ mult: fx.mult, end: Date.now() + fx.dur * 1000 });
    setGoldenBean(false);
    setNotification(`${fx.name}! ${fx.mult}x for ${fx.dur}s`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Prestige
  const prestige = () => {
    if (state.totalCoffee < 100000) return;
    const newMult = state.prestigeMultiplier + 0.5;
    setState({
      coffee: 0,
      totalCoffee: 0,
      prestigeLevel: state.prestigeLevel + 1,
      prestigeMultiplier: newMult,
      upgrades: { fingers: 0, autoBrewer: 0, espresso: 0, barista: 0, franchise: 0 },
      unlocks: { autoBrewer: false, espresso: false, barista: false, franchise: false, prestige: false, goldenBeans: false },
    });
    setNotification(`PRESTIGE ${state.prestigeLevel + 1}! ${newMult}x forever`);
    setTimeout(() => setNotification(null), 3500);
  };

  const perTap = getPerTap();
  const perSec = getPerSec();
  const boostLeft = boost && Date.now() < boost.end ? Math.ceil((boost.end - Date.now()) / 1000) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none font-black text-2xl text-amber-400 z-50"
          style={{ left: p.x, top: p.y, animation: 'rise 0.8s ease-out forwards' }}
          onAnimationEnd={() => setParticles(prev => prev.filter(x => x.id !== p.id))}
        >
          +{fmt(p.value)}
        </div>
      ))}

      {/* Golden Bean */}
      {goldenBean && (
        <button
          onClick={collectGolden}
          className="fixed z-50 animate-bounce"
          style={{ left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 40}%` }}
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-pulse">
            ☕
          </div>
        </button>
      )}

      {/* Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-6 py-3 rounded-full font-bold text-lg shadow-2xl animate-bounce">
          {notification}
        </div>
      )}

      {/* Boost indicator */}
      {boostLeft > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-full text-sm font-bold">
          {boost?.mult}x · {boostLeft}s
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Prestige badge */}
        {state.prestigeLevel > 0 && (
          <div className="text-center mb-2">
            <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full">
              ★ Prestige {state.prestigeLevel} · {state.prestigeMultiplier}x
            </span>
          </div>
        )}

        {/* Big Number */}
        <div className="text-center mb-2">
          <div className="text-7xl font-black tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            {fmt(state.coffee)}
          </div>
          <div className="text-lg text-white/40 font-medium tracking-widest uppercase mt-1">
            coffee
          </div>
        </div>

        {/* Per second */}
        {perSec > 0 && (
          <div className="text-center text-white/30 text-sm mb-8">
            +{fmt(perSec)} per second
          </div>
        )}

        {/* THE BUTTON */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleTap}
            className={`relative w-44 h-44 rounded-full transition-all duration-150 ${tapAnim ? 'scale-90' : 'scale-100 hover:scale-105'}`}
          >
            {/* Outer glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-500/20 to-transparent blur-2xl" />

            {/* Button surface */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-amber-600 to-amber-800 shadow-[0_10px_40px_rgba(217,119,6,0.4),inset_0_2px_0_rgba(255,255,255,0.2)]">
              {/* Inner highlight */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-b from-amber-500 to-amber-700">
                {/* Coffee surface */}
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-900 via-amber-950 to-black overflow-hidden">
                  {/* Shine */}
                  <div className="absolute top-2 left-1/4 w-1/2 h-4 bg-gradient-to-b from-white/20 to-transparent rounded-full blur-sm" />
                </div>
              </div>
            </div>

            {/* Tap value */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-amber-400 font-bold">
              +{fmt(perTap)}
            </div>
          </button>
        </div>

        {/* Upgrades */}
        <div className="space-y-2">
          <Upgrade
            data={UPGRADES.fingers}
            level={state.upgrades.fingers}
            cost={getCost('fingers', state.upgrades.fingers)}
            canAfford={state.coffee >= getCost('fingers', state.upgrades.fingers)}
            onBuy={() => buy('fingers')}
          />

          {state.unlocks.autoBrewer && (
            <Upgrade
              data={UPGRADES.autoBrewer}
              level={state.upgrades.autoBrewer}
              cost={getCost('autoBrewer', state.upgrades.autoBrewer)}
              canAfford={state.coffee >= getCost('autoBrewer', state.upgrades.autoBrewer)}
              onBuy={() => buy('autoBrewer')}
              isNew={state.upgrades.autoBrewer === 0}
            />
          )}

          {state.unlocks.espresso && (
            <Upgrade
              data={UPGRADES.espresso}
              level={state.upgrades.espresso}
              cost={getCost('espresso', state.upgrades.espresso)}
              canAfford={state.coffee >= getCost('espresso', state.upgrades.espresso)}
              onBuy={() => buy('espresso')}
              isNew={state.upgrades.espresso === 0}
            />
          )}

          {state.unlocks.barista && (
            <Upgrade
              data={UPGRADES.barista}
              level={state.upgrades.barista}
              cost={getCost('barista', state.upgrades.barista)}
              canAfford={state.coffee >= getCost('barista', state.upgrades.barista)}
              onBuy={() => buy('barista')}
              isNew={state.upgrades.barista === 0}
            />
          )}

          {state.unlocks.franchise && (
            <Upgrade
              data={UPGRADES.franchise}
              level={state.upgrades.franchise}
              cost={getCost('franchise', state.upgrades.franchise)}
              canAfford={state.coffee >= getCost('franchise', state.upgrades.franchise)}
              onBuy={() => buy('franchise')}
              isNew={state.upgrades.franchise === 0}
            />
          )}

          {/* Prestige */}
          {state.unlocks.prestige && (
            <button
              onClick={prestige}
              className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 hover:border-purple-500/60 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div className="text-left">
                    <div className="font-bold text-purple-300">New Location</div>
                    <div className="text-xs text-purple-400/60">Reset for +0.5x permanent</div>
                  </div>
                </div>
                <div className="text-purple-400 font-bold group-hover:scale-110 transition-transform">
                  GO →
                </div>
              </div>
            </button>
          )}

          {/* Progress hint */}
          {!state.unlocks.autoBrewer && state.totalCoffee < 25 && (
            <div className="text-center text-white/20 text-sm mt-6">
              {25 - Math.floor(state.totalCoffee)} more to unlock...
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes rise {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function Upgrade({
  data,
  level,
  cost,
  canAfford,
  onBuy,
  isNew = false,
}: {
  data: typeof UPGRADES.fingers;
  level: number;
  cost: number;
  canAfford: boolean;
  onBuy: () => void;
  isNew?: boolean;
}) {
  const maxed = level >= data.max;

  return (
    <button
      onClick={onBuy}
      disabled={maxed || !canAfford}
      className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
        maxed
          ? 'bg-green-500/10 border border-green-500/20'
          : canAfford
            ? 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
            : 'bg-white/[0.02] border border-white/5 opacity-40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
          {data.icon}
        </div>
        <div className="text-left">
          <div className="font-semibold flex items-center gap-2">
            {data.name}
            {isNew && <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold">NEW</span>}
          </div>
          <div className="text-xs text-white/40">{data.desc}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/30">{level}/{data.max}</div>
        {maxed ? (
          <div className="text-green-400 font-semibold text-sm">MAX</div>
        ) : (
          <div className={`font-semibold ${canAfford ? 'text-white' : 'text-white/30'}`}>
            {fmt(cost)}
          </div>
        )}
      </div>
    </button>
  );
}
