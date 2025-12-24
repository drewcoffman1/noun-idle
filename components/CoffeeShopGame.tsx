'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Game state
interface GameState {
  coffee: number;
  totalCoffee: number;
  coffeePerTap: number;
  coffeePerSecond: number;
  prestigeLevel: number;
  prestigeMultiplier: number;

  // Upgrades (unlocked progressively)
  upgrades: {
    fingers: number;      // +1 per tap
    autoBrewer: number;   // +1 per second
    espresso: number;     // +5 per second
    barista: number;      // +20 per second
    franchise: number;    // 2x multiplier
  };

  // Unlocks (what player has discovered)
  unlocks: {
    autoBrewer: boolean;
    espresso: boolean;
    barista: boolean;
    franchise: boolean;
    prestige: boolean;
    goldenBeans: boolean;
  };

  // Milestones for $NOUN
  milestonesClaimed: string[];
}

// Upgrade definitions
const UPGRADES = {
  fingers: {
    name: 'Extra Fingers',
    desc: '+1 coffee per tap',
    baseCost: 10,
    costMultiplier: 1.5,
    maxLevel: 50,
  },
  autoBrewer: {
    name: 'Auto-Brewer',
    desc: '+1 coffee per second',
    baseCost: 50,
    costMultiplier: 1.4,
    maxLevel: 50,
    unlockAt: 25,
  },
  espresso: {
    name: 'Espresso Machine',
    desc: '+5 coffee per second',
    baseCost: 500,
    costMultiplier: 1.5,
    maxLevel: 30,
    unlockAt: 200,
  },
  barista: {
    name: 'Hire Barista',
    desc: '+20 coffee per second',
    baseCost: 5000,
    costMultiplier: 1.6,
    maxLevel: 20,
    unlockAt: 2000,
  },
  franchise: {
    name: 'Open Franchise',
    desc: '2x all production',
    baseCost: 50000,
    costMultiplier: 3,
    maxLevel: 5,
    unlockAt: 20000,
  },
};

const MILESTONES = [
  { id: 'first100', requirement: 100, reward: 1, desc: 'Brew 100 coffee' },
  { id: 'first1k', requirement: 1000, reward: 5, desc: 'Brew 1,000 coffee' },
  { id: 'first10k', requirement: 10000, reward: 10, desc: 'Brew 10,000 coffee' },
  { id: 'first100k', requirement: 100000, reward: 25, desc: 'Brew 100,000 coffee' },
  { id: 'first1m', requirement: 1000000, reward: 50, desc: 'Brew 1,000,000 coffee' },
];

function getUpgradeCost(upgrade: keyof typeof UPGRADES, level: number): number {
  const u = UPGRADES[upgrade];
  return Math.floor(u.baseCost * Math.pow(u.costMultiplier, level));
}

function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

// Particle component
function Particle({ x, y, value, onComplete }: { x: number; y: number; value: number; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed pointer-events-none font-bold text-2xl z-50"
      style={{
        left: x,
        top: y,
        animation: 'floatUp 1s ease-out forwards',
        color: value >= 100 ? '#fbbf24' : value >= 10 ? '#22c55e' : '#ffffff',
        textShadow: '0 0 10px currentColor',
      }}
    >
      +{formatNumber(value)}
    </div>
  );
}

// Golden Bean Event
function GoldenBean({ onCollect, onExpire }: { onCollect: () => void; onExpire: () => void }) {
  const [position] = useState(() => ({
    x: 20 + Math.random() * 60,
    y: 30 + Math.random() * 40,
  }));

  useEffect(() => {
    const timer = setTimeout(onExpire, 7000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    <button
      onClick={onCollect}
      className="fixed z-40 animate-pulse cursor-pointer transition-transform hover:scale-125"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        animation: 'bounce 0.5s ease-in-out infinite, glow 1s ease-in-out infinite alternate',
      }}
    >
      <div className="text-5xl" style={{ filter: 'drop-shadow(0 0 20px gold)' }}>
        &#9749;
      </div>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-yellow-400 font-bold whitespace-nowrap bg-black/50 px-2 rounded">
        GOLDEN BEAN!
      </div>
    </button>
  );
}

export default function CoffeeShopGame({ fid }: { fid: number }) {
  const [state, setState] = useState<GameState>({
    coffee: 0,
    totalCoffee: 0,
    coffeePerTap: 1,
    coffeePerSecond: 0,
    prestigeLevel: 0,
    prestigeMultiplier: 1,
    upgrades: {
      fingers: 0,
      autoBrewer: 0,
      espresso: 0,
      barista: 0,
      franchise: 0,
    },
    unlocks: {
      autoBrewer: false,
      espresso: false,
      barista: false,
      franchise: false,
      prestige: false,
      goldenBeans: false,
    },
    milestonesClaimed: [],
  });

  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; value: number }>>([]);
  const [shake, setShake] = useState(false);
  const [goldenBean, setGoldenBean] = useState(false);
  const [boostActive, setBoostActive] = useState<{ multiplier: number; endsAt: number } | null>(null);
  const [tapScale, setTapScale] = useState(1);
  const [newUnlock, setNewUnlock] = useState<string | null>(null);

  const particleId = useRef(0);

  // Calculate production rates
  const calculateRates = useCallback((s: GameState) => {
    const basePerTap = 1 + s.upgrades.fingers;
    const basePerSecond =
      s.upgrades.autoBrewer * 1 +
      s.upgrades.espresso * 5 +
      s.upgrades.barista * 20;

    const franchiseMultiplier = Math.pow(2, s.upgrades.franchise);
    const boostMult = boostActive && Date.now() < boostActive.endsAt ? boostActive.multiplier : 1;

    return {
      perTap: Math.floor(basePerTap * franchiseMultiplier * s.prestigeMultiplier * boostMult),
      perSecond: Math.floor(basePerSecond * franchiseMultiplier * s.prestigeMultiplier * boostMult),
    };
  }, [boostActive]);

  // Check for unlocks
  useEffect(() => {
    setState(prev => {
      const newUnlocks = { ...prev.unlocks };
      let changed = false;
      let unlockName = '';

      if (!newUnlocks.autoBrewer && prev.totalCoffee >= 25) {
        newUnlocks.autoBrewer = true;
        changed = true;
        unlockName = 'Auto-Brewer';
      }
      if (!newUnlocks.espresso && prev.totalCoffee >= 200) {
        newUnlocks.espresso = true;
        changed = true;
        unlockName = 'Espresso Machine';
      }
      if (!newUnlocks.barista && prev.totalCoffee >= 2000) {
        newUnlocks.barista = true;
        changed = true;
        unlockName = 'Barista';
      }
      if (!newUnlocks.franchise && prev.totalCoffee >= 20000) {
        newUnlocks.franchise = true;
        changed = true;
        unlockName = 'Franchise';
      }
      if (!newUnlocks.prestige && prev.totalCoffee >= 100000) {
        newUnlocks.prestige = true;
        changed = true;
        unlockName = 'PRESTIGE';
      }
      if (!newUnlocks.goldenBeans && prev.totalCoffee >= 500) {
        newUnlocks.goldenBeans = true;
        changed = true;
      }

      if (changed) {
        if (unlockName) {
          setNewUnlock(unlockName);
          setTimeout(() => setNewUnlock(null), 3000);
        }
        return { ...prev, unlocks: newUnlocks };
      }
      return prev;
    });
  }, [state.totalCoffee]);

  // Auto production
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const rates = calculateRates(prev);
        if (rates.perSecond === 0) return prev;
        return {
          ...prev,
          coffee: prev.coffee + rates.perSecond,
          totalCoffee: prev.totalCoffee + rates.perSecond,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateRates]);

  // Golden bean spawner
  useEffect(() => {
    if (!state.unlocks.goldenBeans) return;

    const spawn = () => {
      if (Math.random() < 0.15) { // 15% chance every check
        setGoldenBean(true);
      }
    };

    const interval = setInterval(spawn, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [state.unlocks.goldenBeans]);

  // Handle tap
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rates = calculateRates(state);
    const earned = rates.perTap;

    // Update state
    setState(prev => ({
      ...prev,
      coffee: prev.coffee + earned,
      totalCoffee: prev.totalCoffee + earned,
    }));

    // Visual feedback
    setTapScale(0.85);
    setTimeout(() => setTapScale(1), 100);

    // Particles
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
    const y = rect.top + (Math.random() - 0.5) * 40;

    setParticles(prev => [...prev, { id: particleId.current++, x, y, value: earned }]);

    // Big purchase shake
    if (earned >= 100) {
      setShake(true);
      setTimeout(() => setShake(false), 100);
    }
  }, [state, calculateRates]);

  // Handle upgrade purchase
  const buyUpgrade = useCallback((upgrade: keyof typeof UPGRADES) => {
    const cost = getUpgradeCost(upgrade, state.upgrades[upgrade]);
    if (state.coffee < cost) return;
    if (state.upgrades[upgrade] >= UPGRADES[upgrade].maxLevel) return;

    setState(prev => ({
      ...prev,
      coffee: prev.coffee - cost,
      upgrades: {
        ...prev.upgrades,
        [upgrade]: prev.upgrades[upgrade] + 1,
      },
    }));

    // Shake on purchase
    setShake(true);
    setTimeout(() => setShake(false), 150);
  }, [state]);

  // Handle golden bean collection
  const collectGoldenBean = useCallback(() => {
    const effects = [
      { name: 'FRENZY', multiplier: 7, duration: 30000 },
      { name: 'COFFEE RUSH', multiplier: 3, duration: 60000 },
      { name: 'MEGA BREW', multiplier: 10, duration: 15000 },
    ];
    const effect = effects[Math.floor(Math.random() * effects.length)];

    setBoostActive({ multiplier: effect.multiplier, endsAt: Date.now() + effect.duration });
    setGoldenBean(false);

    // Big shake
    setShake(true);
    setTimeout(() => setShake(false), 300);

    setNewUnlock(`${effect.name}! ${effect.multiplier}x for ${effect.duration / 1000}s`);
    setTimeout(() => setNewUnlock(null), 3000);
  }, []);

  // Handle prestige
  const prestige = useCallback(() => {
    if (state.totalCoffee < 100000) return;

    const newMultiplier = state.prestigeMultiplier + 0.5;

    setState({
      coffee: 0,
      totalCoffee: 0,
      coffeePerTap: 1,
      coffeePerSecond: 0,
      prestigeLevel: state.prestigeLevel + 1,
      prestigeMultiplier: newMultiplier,
      upgrades: {
        fingers: 0,
        autoBrewer: 0,
        espresso: 0,
        barista: 0,
        franchise: 0,
      },
      unlocks: {
        autoBrewer: false,
        espresso: false,
        barista: false,
        franchise: false,
        prestige: false,
        goldenBeans: false,
      },
      milestonesClaimed: state.milestonesClaimed,
    });

    setNewUnlock(`PRESTIGE ${state.prestigeLevel + 1}! ${newMultiplier}x forever!`);
    setTimeout(() => setNewUnlock(null), 4000);
  }, [state]);

  const rates = calculateRates(state);
  const boostTimeLeft = boostActive && Date.now() < boostActive.endsAt
    ? Math.ceil((boostActive.endsAt - Date.now()) / 1000)
    : 0;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-amber-950 via-stone-900 to-stone-950 text-amber-50 ${shake ? 'animate-shake' : ''}`}>
      {/* Particles */}
      {particles.map(p => (
        <Particle
          key={p.id}
          x={p.x}
          y={p.y}
          value={p.value}
          onComplete={() => setParticles(prev => prev.filter(pp => pp.id !== p.id))}
        />
      ))}

      {/* Golden Bean */}
      {goldenBean && (
        <GoldenBean
          onCollect={collectGoldenBean}
          onExpire={() => setGoldenBean(false)}
        />
      )}

      {/* New Unlock Banner */}
      {newUnlock && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-6 py-3 rounded-full font-bold text-lg shadow-2xl animate-bounce">
          NEW: {newUnlock}
        </div>
      )}

      {/* Boost Active Banner */}
      {boostTimeLeft > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm">
          {boostActive?.multiplier}x BOOST - {boostTimeLeft}s
        </div>
      )}

      {/* Stats Header */}
      <header className="pt-8 pb-4 text-center">
        {state.prestigeLevel > 0 && (
          <div className="text-purple-400 text-sm mb-1">
            Prestige {state.prestigeLevel} ({state.prestigeMultiplier}x)
          </div>
        )}
        <div
          className="text-6xl font-bold text-amber-200 transition-transform"
          style={{
            transform: `scale(${1 + (rates.perSecond > 0 ? 0.02 * Math.sin(Date.now() / 200) : 0)})`,
            textShadow: '0 0 30px rgba(251, 191, 36, 0.5)',
          }}
        >
          {formatNumber(state.coffee)}
        </div>
        <div className="text-amber-400 text-lg mt-2">
          coffee
        </div>
        {rates.perSecond > 0 && (
          <div className="text-amber-500 text-sm mt-1">
            +{formatNumber(rates.perSecond)}/sec
          </div>
        )}
      </header>

      {/* The Coffee Cup - TAP TARGET */}
      <div className="flex justify-center py-8">
        <button
          onClick={handleTap}
          className="relative select-none transition-transform active:scale-90 cursor-pointer"
          style={{ transform: `scale(${tapScale})` }}
        >
          {/* Cup Glow */}
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-50"
            style={{
              background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
              transform: 'scale(1.5)',
            }}
          />

          {/* The Cup */}
          <div className="relative w-40 h-48">
            {/* Steam */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-white/30"
                  style={{
                    height: `${20 + Math.random() * 15}px`,
                    animation: `steam 2s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>

            {/* Cup Body */}
            <div className="absolute inset-x-2 top-4 bottom-0 bg-gradient-to-b from-amber-100 to-amber-200 rounded-b-[60px] rounded-t-lg shadow-2xl border-4 border-amber-300">
              {/* Coffee Inside */}
              <div className="absolute inset-3 top-6 bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 rounded-b-[50px] overflow-hidden">
                {/* Coffee Surface Shimmer */}
                <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 opacity-80" />
              </div>
            </div>

            {/* Handle */}
            <div className="absolute right-0 top-1/3 w-6 h-14 border-4 border-amber-300 rounded-r-full bg-amber-100" />

            {/* Tap Indicator */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-sm px-4 py-1 rounded-full font-bold shadow-lg animate-pulse">
              +{formatNumber(rates.perTap)}
            </div>
          </div>
        </button>
      </div>

      {/* Upgrades */}
      <div className="px-4 pb-24 space-y-3 max-w-md mx-auto">
        <h2 className="text-lg font-bold text-amber-300 mb-3">Upgrades</h2>

        {/* Fingers - Always visible */}
        <UpgradeButton
          name={UPGRADES.fingers.name}
          desc={UPGRADES.fingers.desc}
          level={state.upgrades.fingers}
          maxLevel={UPGRADES.fingers.maxLevel}
          cost={getUpgradeCost('fingers', state.upgrades.fingers)}
          canAfford={state.coffee >= getUpgradeCost('fingers', state.upgrades.fingers)}
          onClick={() => buyUpgrade('fingers')}
        />

        {/* Auto-Brewer - Unlocks at 25 total */}
        {state.unlocks.autoBrewer && (
          <UpgradeButton
            name={UPGRADES.autoBrewer.name}
            desc={UPGRADES.autoBrewer.desc}
            level={state.upgrades.autoBrewer}
            maxLevel={UPGRADES.autoBrewer.maxLevel}
            cost={getUpgradeCost('autoBrewer', state.upgrades.autoBrewer)}
            canAfford={state.coffee >= getUpgradeCost('autoBrewer', state.upgrades.autoBrewer)}
            onClick={() => buyUpgrade('autoBrewer')}
            isNew={state.upgrades.autoBrewer === 0}
          />
        )}

        {/* Espresso - Unlocks at 200 total */}
        {state.unlocks.espresso && (
          <UpgradeButton
            name={UPGRADES.espresso.name}
            desc={UPGRADES.espresso.desc}
            level={state.upgrades.espresso}
            maxLevel={UPGRADES.espresso.maxLevel}
            cost={getUpgradeCost('espresso', state.upgrades.espresso)}
            canAfford={state.coffee >= getUpgradeCost('espresso', state.upgrades.espresso)}
            onClick={() => buyUpgrade('espresso')}
            isNew={state.upgrades.espresso === 0}
          />
        )}

        {/* Barista - Unlocks at 2000 total */}
        {state.unlocks.barista && (
          <UpgradeButton
            name={UPGRADES.barista.name}
            desc={UPGRADES.barista.desc}
            level={state.upgrades.barista}
            maxLevel={UPGRADES.barista.maxLevel}
            cost={getUpgradeCost('barista', state.upgrades.barista)}
            canAfford={state.coffee >= getUpgradeCost('barista', state.upgrades.barista)}
            onClick={() => buyUpgrade('barista')}
            isNew={state.upgrades.barista === 0}
          />
        )}

        {/* Franchise - Unlocks at 20000 total */}
        {state.unlocks.franchise && (
          <UpgradeButton
            name={UPGRADES.franchise.name}
            desc={UPGRADES.franchise.desc}
            level={state.upgrades.franchise}
            maxLevel={UPGRADES.franchise.maxLevel}
            cost={getUpgradeCost('franchise', state.upgrades.franchise)}
            canAfford={state.coffee >= getUpgradeCost('franchise', state.upgrades.franchise)}
            onClick={() => buyUpgrade('franchise')}
            isNew={state.upgrades.franchise === 0}
          />
        )}

        {/* Prestige - Unlocks at 100000 total */}
        {state.unlocks.prestige && (
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl border border-purple-500/50">
            <h3 className="text-purple-300 font-bold text-lg">Open New Location</h3>
            <p className="text-purple-200 text-sm mt-1">
              Reset everything for a permanent +0.5x multiplier
            </p>
            <p className="text-purple-400 text-xs mt-2">
              Current: {state.prestigeMultiplier}x → Next: {state.prestigeMultiplier + 0.5}x
            </p>
            <button
              onClick={prestige}
              className="mt-3 w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-bold transition-all hover:scale-[1.02] active:scale-95"
            >
              PRESTIGE
            </button>
          </div>
        )}

        {/* Progress hints */}
        {!state.unlocks.autoBrewer && (
          <div className="text-center text-amber-600 text-sm mt-4">
            Brew {25 - state.totalCoffee} more to unlock something new...
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.5); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.15s ease-in-out;
        }
        @keyframes glow {
          0% { filter: drop-shadow(0 0 10px gold); }
          100% { filter: drop-shadow(0 0 30px gold); }
        }
      `}</style>
    </div>
  );
}

// Upgrade Button Component
function UpgradeButton({
  name,
  desc,
  level,
  maxLevel,
  cost,
  canAfford,
  onClick,
  isNew = false,
}: {
  name: string;
  desc: string;
  level: number;
  maxLevel: number;
  cost: number;
  canAfford: boolean;
  onClick: () => void;
  isNew?: boolean;
}) {
  const isMaxed = level >= maxLevel;

  return (
    <button
      onClick={onClick}
      disabled={isMaxed || !canAfford}
      className={`w-full p-4 rounded-xl text-left transition-all relative overflow-hidden ${
        isMaxed
          ? 'bg-green-900/30 border border-green-700/30'
          : canAfford
            ? 'bg-amber-800/60 border border-amber-600/50 hover:bg-amber-700/60 hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-stone-800/40 border border-stone-700/30 opacity-60'
      }`}
    >
      {isNew && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded font-bold animate-pulse">
          NEW
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <div className="font-bold text-amber-100">{name}</div>
          <div className="text-xs text-amber-400">{desc}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-500">Lv {level}/{maxLevel}</div>
          {isMaxed ? (
            <div className="text-green-400 font-bold">MAX</div>
          ) : (
            <div className={`font-bold ${canAfford ? 'text-amber-200' : 'text-stone-500'}`}>
              {formatNumber(cost)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
