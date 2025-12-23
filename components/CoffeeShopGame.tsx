'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Barista, Customer as PixelCustomer, CoffeeMachine, Counter, CoffeeCup, Steam } from './PixelArt';

// Types
interface Customer {
  id: number;
  order: string;
  patience: number;
  maxPatience: number;
  position: number;
  served: boolean;
  tip: number;
}

interface GameState {
  coins: number;
  coinsPerSecond: number;
  totalEarned: number;
  customersServed: number;
  prestigeLevel: number;
  nounHolder: boolean;
  // Upgrades
  baristas: number;
  machineLevel: number;
  decorLevel: number;
  menuItems: number;
}

const BARISTA_COSTS = [50, 200, 800, 3200, 12800];
const MACHINE_COSTS = [100, 500, 2500, 12500];
const DECOR_COSTS = [75, 300, 1200, 4800];
const MENU_COSTS = [150, 600, 2400, 9600];

export default function CoffeeShopGame({ fid }: { fid: number }) {
  const [gameState, setGameState] = useState<GameState>({
    coins: 0,
    coinsPerSecond: 1,
    totalEarned: 0,
    customersServed: 0,
    prestigeLevel: 0,
    nounHolder: false,
    baristas: 0,
    machineLevel: 1,
    decorLevel: 0,
    menuItems: 1,
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [floats, setFloats] = useState<{ id: number; value: number; x: number }[]>([]);
  const [shopTab, setShopTab] = useState<'upgrades' | 'prestige' | 'noun'>('upgrades');
  const customerIdRef = useRef(0);

  // Calculate coins per second (IDLE earnings)
  const calculateCPS = useCallback((state: GameState) => {
    let base = 1;
    base += state.baristas * 2; // Each barista adds 2/sec
    base *= (1 + state.machineLevel * 0.5); // Machine multiplier
    base *= (1 + state.decorLevel * 0.25); // Decor multiplier
    base *= (1 + state.menuItems * 0.3); // Menu multiplier
    base *= (1 + state.prestigeLevel * 0.5); // Prestige multiplier
    if (state.nounHolder) base *= 2; // $NOUN 2x bonus
    return Math.floor(base * 10) / 10;
  }, []);

  // IDLE: Passive income every second
  useEffect(() => {
    const cps = calculateCPS(gameState);
    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        coins: prev.coins + cps,
        totalEarned: prev.totalEarned + cps,
        coinsPerSecond: cps,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.baristas, gameState.machineLevel, gameState.decorLevel, gameState.menuItems, gameState.prestigeLevel, gameState.nounHolder, calculateCPS]);

  // Spawn customers (visual only - they give bonus when tapped)
  useEffect(() => {
    const spawn = () => {
      if (customers.length >= 4) return;
      const customer: Customer = {
        id: customerIdRef.current++,
        order: ['Latte', 'Espresso', 'Mocha', 'Cold Brew'][Math.floor(Math.random() * 4)],
        patience: 100,
        maxPatience: 100,
        position: customers.length,
        served: false,
        tip: Math.floor(5 + Math.random() * 15 + gameState.menuItems * 5),
      };
      setCustomers(prev => [...prev, customer]);
    };
    const interval = setInterval(spawn, 3000 / (1 + gameState.baristas * 0.3));
    spawn(); // Initial customer
    return () => clearInterval(interval);
  }, [gameState.baristas, gameState.menuItems]);

  // Auto-serve customers (IDLE) - baristas serve automatically
  useEffect(() => {
    if (gameState.baristas === 0) return;
    const autoServe = () => {
      setCustomers(prev => {
        if (prev.length === 0) return prev;
        const toServe = prev[0];
        if (toServe.served) return prev;

        // Auto-serve gives base tip (no bonus)
        setGameState(g => ({
          ...g,
          coins: g.coins + toServe.tip * 0.5, // Half tip for auto
          totalEarned: g.totalEarned + toServe.tip * 0.5,
          customersServed: g.customersServed + 1,
        }));

        return prev.slice(1);
      });
    };
    const interval = setInterval(autoServe, 4000 / gameState.baristas);
    return () => clearInterval(interval);
  }, [gameState.baristas]);

  // Manual serve (ACTIVE bonus)
  const serveCustomer = (id: number) => {
    const customer = customers.find(c => c.id === id);
    if (!customer || customer.served) return;

    const bonus = customer.tip * (1 + customer.patience / 100); // Speed bonus
    setGameState(prev => ({
      ...prev,
      coins: prev.coins + bonus,
      totalEarned: prev.totalEarned + bonus,
      customersServed: prev.customersServed + 1,
    }));

    // Float animation
    setFloats(prev => [...prev, { id: Date.now(), value: Math.floor(bonus), x: 30 + Math.random() * 40 }]);
    setTimeout(() => setFloats(prev => prev.slice(1)), 1000);

    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Decrease patience
  useEffect(() => {
    const interval = setInterval(() => {
      setCustomers(prev => prev.map(c => ({
        ...c,
        patience: Math.max(0, c.patience - 1),
      })).filter(c => c.patience > 0));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Buy upgrades
  const buyUpgrade = (type: 'baristas' | 'machineLevel' | 'decorLevel' | 'menuItems') => {
    const costs = {
      baristas: BARISTA_COSTS,
      machineLevel: MACHINE_COSTS,
      decorLevel: DECOR_COSTS,
      menuItems: MENU_COSTS,
    };
    const level = gameState[type];
    const cost = costs[type][level];
    if (!cost || gameState.coins < cost) return;

    setGameState(prev => ({
      ...prev,
      coins: prev.coins - cost,
      [type]: prev[type] + 1,
    }));
  };

  // Prestige
  const prestige = () => {
    if (gameState.customersServed < 100) return;
    setGameState(prev => ({
      ...prev,
      coins: 0,
      customersServed: 0,
      baristas: 0,
      machineLevel: 1,
      decorLevel: 0,
      menuItems: 1,
      prestigeLevel: prev.prestigeLevel + 1,
    }));
    setCustomers([]);
  };

  const cps = calculateCPS(gameState);

  return (
    <div className="min-h-screen bg-stone-900 text-amber-50 font-mono">
      {/* Stats Header */}
      <header className="bg-gradient-to-b from-amber-900 to-amber-950 p-4 border-b-4 border-amber-700">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-300 tracking-wide">
              {Math.floor(gameState.coins).toLocaleString()}
            </div>
            <div className="text-amber-500 text-sm">
              +{cps.toFixed(1)}/sec {gameState.nounHolder && <span className="text-purple-400">⌐◨-◨ 2x</span>}
            </div>
          </div>
          <div className="flex justify-between text-xs text-amber-600 mt-2">
            <span>Served: {gameState.customersServed}</span>
            <span>Prestige: Lv.{gameState.prestigeLevel}</span>
          </div>
        </div>
      </header>

      {/* Coffee Shop Visual */}
      <div className="relative h-72 bg-gradient-to-b from-amber-950 via-stone-900 to-stone-950 overflow-hidden">
        {/* Background - Wall */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-900/30 to-transparent">
          {/* Shelves */}
          <div className="absolute top-8 left-8 right-8 h-3 bg-amber-800 rounded shadow-lg" />
          <div className="absolute top-20 left-12 right-12 h-3 bg-amber-800 rounded shadow-lg" />
          {/* Decorations based on level */}
          {gameState.decorLevel >= 1 && (
            <div className="absolute top-4 left-12 w-6 h-6 bg-green-600 rounded-full shadow-md" />
          )}
          {gameState.decorLevel >= 2 && (
            <div className="absolute top-4 right-12 w-8 h-8 bg-amber-600 rounded shadow-md" />
          )}
          {gameState.decorLevel >= 3 && (
            <div className="absolute top-14 left-20 w-4 h-8 bg-amber-400 rounded-sm shadow-md" />
          )}
        </div>

        {/* Counter - Pixel Art */}
        <div className="absolute bottom-0 left-0 right-0 h-28">
          {/* Pixel Art Counter */}
          <div className="absolute top-0 left-4 right-4 overflow-hidden">
            <Counter width={400} />
          </div>
          {/* Counter body for equipment */}
          <div className="absolute top-8 left-4 right-4 bottom-0 bg-gradient-to-b from-amber-800 to-amber-900">
            {/* Coffee Machine - Pixel Art */}
            <div
              className="absolute left-4 -top-16 transition-all duration-300"
              style={{ transform: `scale(${0.8 + gameState.machineLevel * 0.1})` }}
            >
              <Steam className="absolute -top-3 left-1/2 -translate-x-1/2" />
              <CoffeeMachine scale={1} />
            </div>

            {/* Menu Board */}
            <div className="absolute right-4 -top-10 w-20 h-14 bg-stone-800 rounded border-2 border-amber-700 p-1">
              <div className="text-[8px] text-amber-400 text-center">MENU</div>
              <div className="space-y-0.5 mt-1">
                {gameState.menuItems >= 1 && <div className="h-1 bg-amber-600/50 rounded" />}
                {gameState.menuItems >= 2 && <div className="h-1 bg-amber-600/50 rounded" />}
                {gameState.menuItems >= 3 && <div className="h-1 bg-amber-600/50 rounded" />}
                {gameState.menuItems >= 4 && <div className="h-1 bg-amber-600/50 rounded" />}
              </div>
            </div>

            {/* Baristas - Pixel Art */}
            <div className="absolute bottom-0 left-28 flex gap-2">
              {Array.from({ length: gameState.baristas }).map((_, i) => (
                <div key={i} className="relative animate-bounce" style={{ animationDelay: `${i * 0.2}s`, animationDuration: '2s' }}>
                  <Barista scale={1} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customers - Pixel Art */}
        <div className="absolute bottom-32 left-0 right-0 flex justify-center gap-6 px-4">
          {customers.map((customer, idx) => (
            <button
              key={customer.id}
              onClick={() => serveCustomer(customer.id)}
              className="relative group transition-transform hover:scale-110 active:scale-95"
            >
              {/* Pixel Art Customer */}
              <div className="relative">
                <PixelCustomer scale={1.2} />
              </div>
              {/* Order bubble with coffee icon */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-stone-800 px-2 py-1 rounded-lg text-xs font-bold shadow-lg whitespace-nowrap flex items-center gap-1">
                <span className="inline-block w-4 h-4">
                  <CoffeeCup scale={0.4} />
                </span>
                {customer.order}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
              </div>
              {/* Patience bar */}
              <div className="absolute -bottom-3 left-0 right-0 h-2 bg-stone-700 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${customer.patience}%`,
                    backgroundColor: customer.patience > 50 ? '#22c55e' : customer.patience > 25 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              {/* Tip preview */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                +{Math.floor(customer.tip * (1 + customer.patience / 100))}
              </div>
            </button>
          ))}
        </div>

        {/* Floating numbers */}
        {floats.map(f => (
          <div
            key={f.id}
            className="absolute bottom-40 text-xl font-bold text-green-400 pointer-events-none"
            style={{
              left: `${f.x}%`,
              animation: 'floatUp 1s ease-out forwards',
            }}
          >
            +{f.value}
          </div>
        ))}

        {/* Tap hint */}
        {customers.length > 0 && gameState.baristas === 0 && (
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-amber-400 text-xs animate-pulse bg-stone-900/80 px-3 py-1 rounded-full">
            TAP customers to serve them!
          </div>
        )}
      </div>

      {/* Shop Tabs */}
      <div className="bg-stone-800 border-y border-amber-900/50">
        <div className="flex max-w-md mx-auto">
          {(['upgrades', 'prestige', 'noun'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setShopTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                shopTab === tab ? 'bg-amber-800 text-amber-100' : 'text-amber-500 hover:bg-stone-700'
              }`}
            >
              {tab === 'upgrades' && 'UPGRADES'}
              {tab === 'prestige' && 'PRESTIGE'}
              {tab === 'noun' && '$NOUN'}
            </button>
          ))}
        </div>
      </div>

      {/* Shop Content */}
      <div className="max-w-md mx-auto p-4 space-y-3 pb-20">
        {shopTab === 'upgrades' && (
          <>
            <UpgradeCard
              name="Hire Barista"
              description="Auto-serves customers"
              level={gameState.baristas}
              maxLevel={5}
              cost={BARISTA_COSTS[gameState.baristas]}
              coins={gameState.coins}
              effect={`+2/sec, ${gameState.baristas + 1} auto-serve`}
              onBuy={() => buyUpgrade('baristas')}
            />
            <UpgradeCard
              name="Coffee Machine"
              description="Faster brewing"
              level={gameState.machineLevel}
              maxLevel={5}
              cost={MACHINE_COSTS[gameState.machineLevel - 1]}
              coins={gameState.coins}
              effect={`${(1 + gameState.machineLevel * 0.5).toFixed(1)}x speed`}
              onBuy={() => buyUpgrade('machineLevel')}
            />
            <UpgradeCard
              name="Decorations"
              description="Attract more tips"
              level={gameState.decorLevel}
              maxLevel={4}
              cost={DECOR_COSTS[gameState.decorLevel]}
              coins={gameState.coins}
              effect={`${(1 + gameState.decorLevel * 0.25).toFixed(2)}x tips`}
              onBuy={() => buyUpgrade('decorLevel')}
            />
            <UpgradeCard
              name="Menu Items"
              description="More variety = more customers"
              level={gameState.menuItems}
              maxLevel={5}
              cost={MENU_COSTS[gameState.menuItems - 1]}
              coins={gameState.coins}
              effect={`${(1 + gameState.menuItems * 0.3).toFixed(1)}x earnings`}
              onBuy={() => buyUpgrade('menuItems')}
            />
          </>
        )}

        {shopTab === 'prestige' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4 text-amber-300 font-bold">NEW LOCATION</div>
            <h3 className="text-lg text-amber-400 mb-2">Expand your empire</h3>
            <p className="text-amber-500 text-sm mb-4">
              Reset your progress for a permanent {(1.5 + gameState.prestigeLevel * 0.5).toFixed(1)}x multiplier
            </p>
            <div className="text-amber-400 mb-4">
              {gameState.customersServed >= 100
                ? 'Ready to expand!'
                : `Serve ${100 - gameState.customersServed} more customers`}
            </div>
            <button
              onClick={prestige}
              disabled={gameState.customersServed < 100}
              className={`px-8 py-3 rounded-xl font-bold transition-all ${
                gameState.customersServed >= 100
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105'
                  : 'bg-stone-700 text-stone-500'
              }`}
            >
              Prestige →
            </button>
          </div>
        )}

        {shopTab === 'noun' && (
          <div className="text-center py-6">
            <div className="text-3xl mb-4 font-mono text-purple-300">{"⌐◨-◨"}</div>
            <h3 className="text-xl font-bold text-purple-300 mb-4">$NOUN Holder Benefits</h3>
            <div className="space-y-2 text-left bg-purple-900/20 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-2">
                <span className={gameState.nounHolder ? 'text-green-400' : 'text-stone-500'}>
                  {gameState.nounHolder ? '✓' : '○'}
                </span>
                <span className="text-purple-200">Permanent 2x earnings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={gameState.nounHolder ? 'text-green-400' : 'text-stone-500'}>
                  {gameState.nounHolder ? '✓' : '○'}
                </span>
                <span className="text-purple-200">Exclusive Noun Barista (coming soon)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={gameState.nounHolder ? 'text-green-400' : 'text-stone-500'}>
                  {gameState.nounHolder ? '✓' : '○'}
                </span>
                <span className="text-purple-200">Golden decorations (coming soon)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={gameState.nounHolder ? 'text-green-400' : 'text-stone-500'}>
                  {gameState.nounHolder ? '✓' : '○'}
                </span>
                <span className="text-purple-200">Leaderboard VIP badge</span>
              </div>
            </div>
            {!gameState.nounHolder && (
              <button className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors">
                Get $NOUN to unlock →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UpgradeCard({
  name,
  description,
  level,
  maxLevel,
  cost,
  coins,
  effect,
  onBuy,
}: {
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost?: number;
  coins: number;
  effect: string;
  onBuy: () => void;
}) {
  const maxed = level >= maxLevel;
  const canAfford = cost !== undefined && coins >= cost;

  return (
    <button
      onClick={onBuy}
      disabled={maxed || !canAfford}
      className={`w-full p-4 rounded-xl text-left transition-all ${
        maxed
          ? 'bg-green-900/20 border border-green-700/30'
          : canAfford
            ? 'bg-amber-900/40 border border-amber-700/50 hover:bg-amber-800/40 hover:scale-[1.02]'
            : 'bg-stone-800/50 border border-stone-700/30 opacity-60'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-amber-200">{name}</div>
          <div className="text-xs text-amber-500">{description}</div>
          <div className="text-xs text-green-400 mt-1">{effect}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-600">Lv.{level}/{maxLevel}</div>
          {maxed ? (
            <div className="text-green-400 text-sm">MAX</div>
          ) : (
            <div className={`font-bold ${canAfford ? 'text-amber-300' : 'text-stone-500'}`}>
              {cost?.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
