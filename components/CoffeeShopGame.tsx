'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// PIXEL ART SPRITES (CSS box-shadow technique)
// ============================================
const P = 3; // pixel size

const COLORS = {
  black: '#1a1a1a',
  outline: '#2d2d2d',
  darkBrown: '#4a3728',
  brown: '#6b5344',
  medBrown: '#8b7355',
  lightBrown: '#a89070',
  tan: '#c4a882',
  cream: '#e0d4c0',
  white: '#f5f0e8',
  coffee: '#3d2314',
  coffeeMed: '#5c3d2e',
  steam: '#d0d0d0',
};

// Coffee Mug - 16x18 pixels (matches reference style)
const MUG_SPRITE = `
................
....wwwwwwww....
...wccccccccw...
..wcccccccccw...
..wccccccccccw..
.wbcccccccccbww.
.wbcccccccccbww.
.wbcccccccccb.w.
.wbcccccccccb.w.
.wbcccccccccb.w.
.wbBBBBBBBBBb.w.
.wbBBBBBBBBBbw..
..wbBBBBBBBbw...
..wbBBBBBBBbw...
...wbbbbbbbw....
...wwwwwwwww....
....wttttw......
....wwwwww......
`.trim().split('\n');

// Coffee Bag - 14x16 pixels
const BAG_SPRITE = `
..............
...wwwwwwww...
..wttttttttw..
..wttttttttw..
.wttttttttttw.
.wttttttttttw.
.wtttbbbbtttw.
.wttbBBBBbttw.
.wttbBBBBbttw.
.wtttbbbbtttw.
.wttttttttttw.
.wttttttttttw.
.wttttttttttw.
.wttttttttttw.
..wwwwwwwwww..
..............
`.trim().split('\n');

// Coffee Bean (golden) - 10x8 pixels
const BEAN_SPRITE = `
..........
...bBBb...
..bBBBBb..
.bBBbBBBb.
.bBBbBBBb.
..bBBBBb..
...bBBb...
..........
`.trim().split('\n');

// Steam wisps - 8x6 pixels
const STEAM_SPRITE = `
........
.s..s.s.
s.s..s..
.s.s..s.
..s.s...
........
`.trim().split('\n');

function spriteToBoxShadow(sprite: string[], colors: Record<string, string>, pixelSize: number): string {
  const shadows: string[] = [];
  const colorMap: Record<string, string> = {
    'w': colors.white,
    'c': colors.cream,
    't': colors.tan,
    'l': colors.lightBrown,
    'm': colors.medBrown,
    'b': colors.brown,
    'B': colors.darkBrown,
    'k': colors.black,
    's': colors.steam,
    'o': colors.outline,
    'C': colors.coffee,
    'M': colors.coffeeMed,
  };

  sprite.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char !== '.' && colorMap[char]) {
        shadows.push(`${x * pixelSize}px ${y * pixelSize}px 0 ${colorMap[char]}`);
      }
    });
  });

  return shadows.join(',');
}

function PixelSprite({ sprite, size = P, className = '' }: { sprite: string[]; size?: number; className?: string }) {
  const width = sprite[0]?.length || 0;
  const height = sprite.length;
  const boxShadow = spriteToBoxShadow(sprite, COLORS, size);

  return (
    <div className={className} style={{ width: width * size, height: height * size, position: 'relative' }}>
      <div style={{
        position: 'absolute',
        width: size,
        height: size,
        boxShadow,
        imageRendering: 'pixelated',
      }} />
    </div>
  );
}

// ============================================
// GAME LOGIC
// ============================================
interface GameState {
  coffee: number;
  totalCoffee: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  upgrades: { fingers: number; autoBrewer: number; espresso: number; barista: number; franchise: number };
  unlocks: { autoBrewer: boolean; espresso: boolean; barista: boolean; franchise: boolean; prestige: boolean; goldenBeans: boolean };
}

const UPGRADES = {
  fingers: { name: 'Tap Power', desc: '+1 per tap', baseCost: 10, mult: 1.5, max: 50 },
  autoBrewer: { name: 'Auto Brew', desc: '+1/sec', baseCost: 50, mult: 1.4, max: 50, unlock: 25 },
  espresso: { name: 'Espresso', desc: '+5/sec', baseCost: 500, mult: 1.5, max: 30, unlock: 200 },
  barista: { name: 'Barista', desc: '+20/sec', baseCost: 5000, mult: 1.6, max: 20, unlock: 2000 },
  franchise: { name: 'Franchise', desc: '2x all', baseCost: 50000, mult: 3, max: 5, unlock: 20000 },
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
  const [goldenBean, setGoldenBean] = useState<{ x: number; y: number } | null>(null);
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
      if (!u.goldenBeans && prev.totalCoffee >= 500) u.goldenBeans = true;
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
        setState(prev => ({ ...prev, coffee: prev.coffee + perSec, totalCoffee: prev.totalCoffee + perSec }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [getPerSec]);

  // Golden bean spawner
  useEffect(() => {
    if (!state.unlocks.goldenBeans) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.12 && !goldenBean) {
        setGoldenBean({ x: 15 + Math.random() * 70, y: 20 + Math.random() * 30 });
      }
    }, 18000);
    return () => clearInterval(interval);
  }, [state.unlocks.goldenBeans, goldenBean]);

  // Golden bean timeout
  useEffect(() => {
    if (!goldenBean) return;
    const timeout = setTimeout(() => setGoldenBean(null), 8000);
    return () => clearTimeout(timeout);
  }, [goldenBean]);

  // Tap handler
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const earned = getPerTap();
    setState(prev => ({ ...prev, coffee: prev.coffee + earned, totalCoffee: prev.totalCoffee + earned }));

    setTapAnim(true);
    setTimeout(() => setTapAnim(false), 100);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles(prev => [...prev, {
      id: particleId.current++,
      x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 60,
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

  // Collect golden bean
  const collectGolden = () => {
    const effects = [
      { name: 'FRENZY', mult: 7, dur: 30 },
      { name: 'LUCKY', mult: 3, dur: 77 },
      { name: 'OVERDRIVE', mult: 11, dur: 11 },
    ];
    const fx = effects[Math.floor(Math.random() * effects.length)];
    setBoost({ mult: fx.mult, end: Date.now() + fx.dur * 1000 });
    setGoldenBean(null);
    setNotification(`${fx.name}! ${fx.mult}x for ${fx.dur}s`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Prestige
  const prestige = () => {
    if (state.totalCoffee < 100000) return;
    const newMult = state.prestigeMultiplier + 0.5;
    setState({
      coffee: 0, totalCoffee: 0,
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
    <div className="min-h-screen text-stone-900 overflow-hidden" style={{ background: '#f5ebe0' }}>
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none font-black text-xl z-50"
          style={{ left: p.x, top: p.y, color: COLORS.darkBrown, animation: 'rise 0.8s ease-out forwards' }}
          onAnimationEnd={() => setParticles(prev => prev.filter(x => x.id !== p.id))}
        >
          +{fmt(p.value)}
        </div>
      ))}

      {/* Golden Bean */}
      {goldenBean && (
        <button
          onClick={collectGolden}
          className="fixed z-50 cursor-pointer transition-transform hover:scale-110"
          style={{ left: `${goldenBean.x}%`, top: `${goldenBean.y}%`, animation: 'float 1s ease-in-out infinite' }}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ background: 'rgba(255, 200, 50, 0.5)', transform: 'scale(2)' }} />
            <PixelSprite sprite={BEAN_SPRITE} size={6} />
          </div>
          <div className="text-xs font-bold text-amber-700 text-center mt-1 animate-pulse">GOLDEN!</div>
        </button>
      )}

      {/* Notification */}
      {notification && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-lg font-bold shadow-lg"
          style={{ background: COLORS.tan, color: COLORS.darkBrown, border: `3px solid ${COLORS.brown}` }}
        >
          {notification}
        </div>
      )}

      {/* Boost indicator */}
      {boostLeft > 0 && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-1 rounded-full text-sm font-bold"
          style={{ background: COLORS.brown, color: COLORS.cream }}
        >
          {boost?.mult}x BOOST - {boostLeft}s
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black tracking-wide" style={{ color: COLORS.darkBrown }}>
            NOUN COFFEE
          </h1>
          {state.prestigeLevel > 0 && (
            <div className="text-xs font-medium mt-1" style={{ color: COLORS.brown }}>
              Prestige {state.prestigeLevel} ({state.prestigeMultiplier}x)
            </div>
          )}
        </div>

        {/* Big Number */}
        <div className="text-center mb-2">
          <div className="text-6xl font-black" style={{ color: COLORS.darkBrown }}>
            {fmt(state.coffee)}
          </div>
          <div className="text-sm font-medium tracking-widest uppercase" style={{ color: COLORS.brown }}>
            coffee brewed
          </div>
          {perSec > 0 && (
            <div className="text-xs mt-1" style={{ color: COLORS.medBrown }}>
              +{fmt(perSec)} per second
            </div>
          )}
        </div>

        {/* THE MUG - Tap Target */}
        <div className="flex justify-center my-8">
          <button
            onClick={handleTap}
            className={`relative transition-transform ${tapAnim ? 'scale-90' : 'hover:scale-105'}`}
            style={{ cursor: 'pointer' }}
          >
            {/* Steam */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2" style={{ animation: 'steam 2s ease-in-out infinite' }}>
              <PixelSprite sprite={STEAM_SPRITE} size={4} />
            </div>

            {/* Mug */}
            <div className="relative">
              <PixelSprite sprite={MUG_SPRITE} size={5} />
            </div>

            {/* Tap value */}
            <div
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm font-bold px-2 py-0.5 rounded"
              style={{ background: COLORS.brown, color: COLORS.cream }}
            >
              +{fmt(perTap)}
            </div>
          </button>
        </div>

        {/* Upgrades */}
        <div className="space-y-2 mt-12">
          <div className="flex items-center gap-2 mb-3">
            <PixelSprite sprite={BAG_SPRITE} size={2} />
            <h2 className="font-bold" style={{ color: COLORS.darkBrown }}>Upgrades</h2>
          </div>

          <UpgradeBtn
            name={UPGRADES.fingers.name}
            desc={UPGRADES.fingers.desc}
            level={state.upgrades.fingers}
            max={UPGRADES.fingers.max}
            cost={getCost('fingers', state.upgrades.fingers)}
            canAfford={state.coffee >= getCost('fingers', state.upgrades.fingers)}
            onClick={() => buy('fingers')}
          />

          {state.unlocks.autoBrewer && (
            <UpgradeBtn
              name={UPGRADES.autoBrewer.name}
              desc={UPGRADES.autoBrewer.desc}
              level={state.upgrades.autoBrewer}
              max={UPGRADES.autoBrewer.max}
              cost={getCost('autoBrewer', state.upgrades.autoBrewer)}
              canAfford={state.coffee >= getCost('autoBrewer', state.upgrades.autoBrewer)}
              onClick={() => buy('autoBrewer')}
              isNew={state.upgrades.autoBrewer === 0}
            />
          )}

          {state.unlocks.espresso && (
            <UpgradeBtn
              name={UPGRADES.espresso.name}
              desc={UPGRADES.espresso.desc}
              level={state.upgrades.espresso}
              max={UPGRADES.espresso.max}
              cost={getCost('espresso', state.upgrades.espresso)}
              canAfford={state.coffee >= getCost('espresso', state.upgrades.espresso)}
              onClick={() => buy('espresso')}
              isNew={state.upgrades.espresso === 0}
            />
          )}

          {state.unlocks.barista && (
            <UpgradeBtn
              name={UPGRADES.barista.name}
              desc={UPGRADES.barista.desc}
              level={state.upgrades.barista}
              max={UPGRADES.barista.max}
              cost={getCost('barista', state.upgrades.barista)}
              canAfford={state.coffee >= getCost('barista', state.upgrades.barista)}
              onClick={() => buy('barista')}
              isNew={state.upgrades.barista === 0}
            />
          )}

          {state.unlocks.franchise && (
            <UpgradeBtn
              name={UPGRADES.franchise.name}
              desc={UPGRADES.franchise.desc}
              level={state.upgrades.franchise}
              max={UPGRADES.franchise.max}
              cost={getCost('franchise', state.upgrades.franchise)}
              canAfford={state.coffee >= getCost('franchise', state.upgrades.franchise)}
              onClick={() => buy('franchise')}
              isNew={state.upgrades.franchise === 0}
            />
          )}

          {/* Prestige */}
          {state.unlocks.prestige && (
            <button
              onClick={prestige}
              className="w-full mt-4 p-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${COLORS.brown}, ${COLORS.darkBrown})`,
                color: COLORS.cream,
                border: `3px solid ${COLORS.darkBrown}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div>New Location</div>
                  <div className="text-xs opacity-80">Reset for +0.5x permanent</div>
                </div>
                <div className="text-lg">PRESTIGE</div>
              </div>
            </button>
          )}

          {/* Progress hint */}
          {!state.unlocks.autoBrewer && state.totalCoffee < 25 && (
            <div className="text-center text-sm mt-6" style={{ color: COLORS.medBrown }}>
              {25 - Math.floor(state.totalCoffee)} more to unlock something new...
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes rise {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1.3); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes steam {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

function UpgradeBtn({ name, desc, level, max, cost, canAfford, onClick, isNew = false }: {
  name: string; desc: string; level: number; max: number; cost: number; canAfford: boolean; onClick: () => void; isNew?: boolean;
}) {
  const maxed = level >= max;

  return (
    <button
      onClick={onClick}
      disabled={maxed || !canAfford}
      className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
        maxed ? '' : canAfford ? 'hover:scale-[1.02] active:scale-[0.98]' : 'opacity-50'
      }`}
      style={{
        background: maxed ? COLORS.tan : COLORS.cream,
        border: `3px solid ${maxed ? COLORS.brown : canAfford ? COLORS.brown : COLORS.lightBrown}`,
      }}
    >
      <div className="text-left">
        <div className="font-bold flex items-center gap-2" style={{ color: COLORS.darkBrown }}>
          {name}
          {isNew && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: COLORS.brown, color: COLORS.cream }}>
              NEW
            </span>
          )}
        </div>
        <div className="text-xs" style={{ color: COLORS.medBrown }}>{desc}</div>
      </div>
      <div className="text-right">
        <div className="text-xs" style={{ color: COLORS.medBrown }}>{level}/{max}</div>
        {maxed ? (
          <div className="font-bold" style={{ color: COLORS.brown }}>MAX</div>
        ) : (
          <div className="font-bold" style={{ color: canAfford ? COLORS.darkBrown : COLORS.lightBrown }}>
            {fmt(cost)}
          </div>
        )}
      </div>
    </button>
  );
}
