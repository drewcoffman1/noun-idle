'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Game state types
interface Customer {
  id: number;
  order: string;
  patience: number;
  maxPatience: number;
  position: number;
  served: boolean;
}

interface Staff {
  id: string;
  name: string;
  cost: number;
  multiplier: number;
  owned: boolean;
  isNounExclusive?: boolean;
  sprite: string;
}

interface Equipment {
  id: string;
  name: string;
  cost: number;
  speedBonus: number;
  owned: boolean;
  isNounExclusive?: boolean;
  sprite: string;
}

interface Decoration {
  id: string;
  name: string;
  cost: number;
  bonus: number;
  owned: boolean;
  isNounExclusive?: boolean;
}

interface GameState {
  coins: number;
  totalEarned: number;
  customersServed: number;
  combo: number;
  maxCombo: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  nounBalance: number;
  staff: Staff[];
  equipment: Equipment[];
  decorations: Decoration[];
  unlockedAchievements: string[];
}

const ORDERS = ['Espresso', 'Latte', 'Cappuccino', 'Americano', 'Mocha', 'Cold Brew'];
const ORDER_EMOJIS: Record<string, string> = {
  'Espresso': '☕',
  'Latte': '🥛',
  'Cappuccino': '☕',
  'Americano': '🫖',
  'Mocha': '🍫',
  'Cold Brew': '🧊',
};

const INITIAL_STAFF: Staff[] = [
  { id: 'barista1', name: 'Junior Barista', cost: 100, multiplier: 1.5, owned: false, sprite: '👨‍🍳' },
  { id: 'barista2', name: 'Senior Barista', cost: 500, multiplier: 2, owned: false, sprite: '👩‍🍳' },
  { id: 'barista3', name: 'Master Barista', cost: 2500, multiplier: 3, owned: false, sprite: '🧑‍🍳' },
  { id: 'nounBarista', name: 'Noun Barista ⌐◨-◨', cost: 0, multiplier: 5, owned: false, isNounExclusive: true, sprite: '⌐◨-◨' },
];

const INITIAL_EQUIPMENT: Equipment[] = [
  { id: 'machine1', name: 'Basic Machine', cost: 200, speedBonus: 1.2, owned: true, sprite: '⚙️' },
  { id: 'machine2', name: 'Pro Machine', cost: 1000, speedBonus: 1.5, owned: false, sprite: '🔧' },
  { id: 'machine3', name: 'Industrial Machine', cost: 5000, speedBonus: 2, owned: false, sprite: '🏭' },
  { id: 'nounMachine', name: 'Golden Noun Machine', cost: 0, speedBonus: 3, owned: false, isNounExclusive: true, sprite: '✨' },
];

const INITIAL_DECORATIONS: Decoration[] = [
  { id: 'plant', name: 'Potted Plant', cost: 50, bonus: 1.1, owned: false },
  { id: 'art', name: 'Wall Art', cost: 150, bonus: 1.15, owned: false },
  { id: 'neon', name: 'Neon Sign', cost: 500, bonus: 1.25, owned: false },
  { id: 'fountain', name: 'Coffee Fountain', cost: 2000, bonus: 1.5, owned: false },
  { id: 'nounStatue', name: 'Noun Statue ⌐◨-◨', cost: 0, bonus: 2, owned: false, isNounExclusive: true },
];

export default function CoffeeShopGame({ fid }: { fid: number }) {
  const [gameState, setGameState] = useState<GameState>({
    coins: 0,
    totalEarned: 0,
    customersServed: 0,
    combo: 0,
    maxCombo: 0,
    prestigeLevel: 0,
    prestigeMultiplier: 1,
    nounBalance: 0, // Would come from blockchain
    staff: INITIAL_STAFF,
    equipment: INITIAL_EQUIPMENT,
    decorations: INITIAL_DECORATIONS,
    unlockedAchievements: [],
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; text: string; x: number; y: number; color: string }[]>([]);
  const [selectedTab, setSelectedTab] = useState<'shop' | 'staff' | 'equipment' | 'decor'>('shop');
  const customerIdRef = useRef(0);
  const floatIdRef = useRef(0);

  // Calculate multipliers
  const getEarningsMultiplier = useCallback(() => {
    let mult = gameState.prestigeMultiplier;
    gameState.staff.forEach(s => { if (s.owned) mult *= s.multiplier; });
    gameState.decorations.forEach(d => { if (d.owned) mult *= d.bonus; });
    if (gameState.nounBalance > 0) mult *= 2; // $NOUN holder bonus
    return mult;
  }, [gameState]);

  const getSpeedMultiplier = useCallback(() => {
    let speed = 1;
    gameState.equipment.forEach(e => { if (e.owned) speed *= e.speedBonus; });
    return speed;
  }, [gameState]);

  // Spawn customers
  useEffect(() => {
    const spawnCustomer = () => {
      if (customers.length >= 5) return; // Max 5 customers

      const newCustomer: Customer = {
        id: customerIdRef.current++,
        order: ORDERS[Math.floor(Math.random() * ORDERS.length)],
        patience: 100,
        maxPatience: 100,
        position: customers.length,
        served: false,
      };
      setCustomers(prev => [...prev, newCustomer]);
    };

    const baseInterval = 3000;
    const speed = getSpeedMultiplier();
    const interval = setInterval(spawnCustomer, baseInterval / speed);
    return () => clearInterval(interval);
  }, [customers.length, getSpeedMultiplier]);

  // Decrease patience
  useEffect(() => {
    const interval = setInterval(() => {
      setCustomers(prev => {
        const updated = prev.map(c => ({
          ...c,
          patience: Math.max(0, c.patience - 2),
        }));
        // Remove customers who ran out of patience
        const remaining = updated.filter(c => c.patience > 0 || c.served);
        if (remaining.length < updated.length) {
          // Lost a customer, reset combo
          setGameState(g => ({ ...g, combo: 0 }));
        }
        return remaining;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Serve a customer
  const serveCustomer = useCallback((customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || customer.served) return;

    // Calculate earnings based on patience (bonus for fast service)
    const speedBonus = customer.patience / customer.maxPatience;
    const comboBonus = 1 + (gameState.combo * 0.1);
    const baseEarning = 10;
    const earnings = Math.floor(baseEarning * speedBonus * comboBonus * getEarningsMultiplier());

    // Update game state
    setGameState(prev => ({
      ...prev,
      coins: prev.coins + earnings,
      totalEarned: prev.totalEarned + earnings,
      customersServed: prev.customersServed + 1,
      combo: prev.combo + 1,
      maxCombo: Math.max(prev.maxCombo, prev.combo + 1),
    }));

    // Mark customer as served (will animate out)
    setCustomers(prev => prev.map(c =>
      c.id === customerId ? { ...c, served: true } : c
    ));

    // Remove after animation
    setTimeout(() => {
      setCustomers(prev => prev.filter(c => c.id !== customerId));
    }, 500);

    // Floating text
    const floatId = floatIdRef.current++;
    const colors = earnings > 20 ? '#22c55e' : earnings > 15 ? '#eab308' : '#f97316';
    setFloatingTexts(prev => [...prev, {
      id: floatId,
      text: `+${earnings}`,
      x: 50 + Math.random() * 20,
      y: 30,
      color: colors,
    }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(f => f.id !== floatId));
    }, 1000);

  }, [customers, gameState.combo, getEarningsMultiplier]);

  // Buy items
  const buyItem = useCallback((type: 'staff' | 'equipment' | 'decorations', id: string) => {
    setGameState(prev => {
      const items = prev[type] as (Staff | Equipment | Decoration)[];
      const item = items.find(i => i.id === id);
      if (!item || item.owned) return prev;
      if (item.isNounExclusive && prev.nounBalance <= 0) return prev;
      if (!item.isNounExclusive && prev.coins < item.cost) return prev;

      return {
        ...prev,
        coins: item.isNounExclusive ? prev.coins : prev.coins - item.cost,
        [type]: items.map(i => i.id === id ? { ...i, owned: true } : i),
      };
    });
  }, []);

  // Prestige
  const prestige = useCallback(() => {
    if (gameState.customersServed < 100) return;

    const newMultiplier = 1 + (gameState.prestigeLevel + 1) * 0.5;
    setGameState(prev => ({
      ...prev,
      coins: 0,
      customersServed: 0,
      combo: 0,
      prestigeLevel: prev.prestigeLevel + 1,
      prestigeMultiplier: newMultiplier,
      staff: INITIAL_STAFF,
      equipment: INITIAL_EQUIPMENT,
      decorations: INITIAL_DECORATIONS.map(d => d.isNounExclusive && prev.nounBalance > 0 ? { ...d, owned: true } : d),
    }));
    setCustomers([]);
  }, [gameState]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-900 via-amber-950 to-stone-950 text-amber-50 overflow-hidden">
      {/* Header Stats */}
      <div className="p-4 bg-black/30 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <div className="text-2xl font-bold text-amber-400">
              {gameState.coins.toLocaleString()} <span className="text-sm">coins</span>
            </div>
            <div className="text-xs text-amber-300/70">
              {gameState.combo > 0 && <span className="text-green-400">🔥 {gameState.combo}x COMBO</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-amber-300">
              ⌐◨-◨ Prestige Lv.{gameState.prestigeLevel}
            </div>
            <div className="text-xs text-amber-400/70">
              {getEarningsMultiplier().toFixed(1)}x earnings
            </div>
          </div>
        </div>
      </div>

      {/* Isometric Shop View */}
      <div className="relative h-64 overflow-hidden">
        {/* Shop Floor */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #78350f 0%, #451a03 50%, #292524 100%)',
          }}
        >
          {/* Counter */}
          <div className="absolute bottom-8 w-4/5 h-16 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 rounded-t-lg border-t-4 border-amber-600 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-2 bg-amber-600/50" />
            {/* Coffee Machine */}
            <div className="absolute left-4 -top-8 text-4xl">☕</div>
            {/* Owned equipment */}
            {gameState.equipment.filter(e => e.owned).slice(0, 3).map((eq, i) => (
              <div key={eq.id} className="absolute -top-8 text-3xl" style={{ left: `${20 + i * 25}%` }}>
                {eq.sprite}
              </div>
            ))}
          </div>

          {/* Customers */}
          {customers.map((customer, idx) => (
            <button
              key={customer.id}
              onClick={() => serveCustomer(customer.id)}
              className={`absolute transition-all duration-300 ${customer.served ? 'opacity-0 translate-y-4' : ''}`}
              style={{
                bottom: '100px',
                left: `${15 + idx * 18}%`,
                transform: customer.served ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              {/* Customer */}
              <div className="relative">
                <div className="text-4xl animate-bounce" style={{ animationDuration: '0.5s' }}>
                  🧑
                </div>
                {/* Order bubble */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded-full text-sm font-bold whitespace-nowrap shadow-lg">
                  {ORDER_EMOJIS[customer.order]} {customer.order}
                </div>
                {/* Patience bar */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${customer.patience}%`,
                      backgroundColor: customer.patience > 50 ? '#22c55e' : customer.patience > 25 ? '#eab308' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </button>
          ))}

          {/* Staff */}
          <div className="absolute bottom-12 right-4 flex gap-2">
            {gameState.staff.filter(s => s.owned).map(staff => (
              <div key={staff.id} className="text-2xl animate-pulse">
                {staff.sprite}
              </div>
            ))}
          </div>

          {/* Floating Texts */}
          {floatingTexts.map(float => (
            <div
              key={float.id}
              className="absolute pointer-events-none font-bold text-xl"
              style={{
                left: `${float.x}%`,
                bottom: '150px',
                color: float.color,
                animation: 'floatUp 1s ease-out forwards',
              }}
            >
              {float.text}
            </div>
          ))}
        </div>

        {/* Decorations */}
        <div className="absolute top-4 left-4 flex gap-2">
          {gameState.decorations.filter(d => d.owned).map(dec => (
            <span key={dec.id} className="text-2xl">🪴</span>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {customers.length > 0 && (
        <div className="text-center py-2 text-amber-300 text-sm animate-pulse">
          👆 Tap customers to serve them!
        </div>
      )}
      {customers.length === 0 && (
        <div className="text-center py-2 text-amber-400/50 text-sm">
          Waiting for customers...
        </div>
      )}

      {/* Shop Tabs */}
      <div className="sticky top-16 z-10 bg-stone-900/90 backdrop-blur-sm">
        <div className="flex justify-around max-w-lg mx-auto py-2">
          {(['staff', 'equipment', 'decor'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedTab === tab
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-300 hover:bg-amber-800/50'
              }`}
            >
              {tab === 'staff' && '👥 Staff'}
              {tab === 'equipment' && '⚙️ Equipment'}
              {tab === 'decor' && '🪴 Decor'}
            </button>
          ))}
        </div>
      </div>

      {/* Shop Content */}
      <div className="p-4 max-w-lg mx-auto space-y-3 pb-24">
        {selectedTab === 'staff' && gameState.staff.map(item => (
          <ShopItem
            key={item.id}
            name={item.name}
            cost={item.cost}
            bonus={`${item.multiplier}x earnings`}
            owned={item.owned}
            canAfford={gameState.coins >= item.cost}
            isNounExclusive={item.isNounExclusive}
            hasNoun={gameState.nounBalance > 0}
            onBuy={() => buyItem('staff', item.id)}
            sprite={item.sprite}
          />
        ))}
        {selectedTab === 'equipment' && gameState.equipment.map(item => (
          <ShopItem
            key={item.id}
            name={item.name}
            cost={item.cost}
            bonus={`${item.speedBonus}x speed`}
            owned={item.owned}
            canAfford={gameState.coins >= item.cost}
            isNounExclusive={item.isNounExclusive}
            hasNoun={gameState.nounBalance > 0}
            onBuy={() => buyItem('equipment', item.id)}
            sprite={item.sprite}
          />
        ))}
        {selectedTab === 'decor' && gameState.decorations.map(item => (
          <ShopItem
            key={item.id}
            name={item.name}
            cost={item.cost}
            bonus={`${item.bonus}x bonus`}
            owned={item.owned}
            canAfford={gameState.coins >= item.cost}
            isNounExclusive={item.isNounExclusive}
            hasNoun={gameState.nounBalance > 0}
            onBuy={() => buyItem('decorations', item.id)}
          />
        ))}

        {/* Prestige Button */}
        <div className="pt-4 border-t border-amber-800/50">
          <button
            onClick={prestige}
            disabled={gameState.customersServed < 100}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              gameState.customersServed >= 100
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white animate-pulse'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            ✨ Open New Location (Prestige)
            <div className="text-xs font-normal mt-1">
              {gameState.customersServed >= 100
                ? `Reset for ${(1 + (gameState.prestigeLevel + 1) * 0.5).toFixed(1)}x permanent multiplier!`
                : `Serve ${100 - gameState.customersServed} more customers`
              }
            </div>
          </button>
        </div>

        {/* $NOUN Section */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30">
          <h3 className="font-bold text-purple-300 flex items-center gap-2">
            ⌐◨-◨ $NOUN Holder Benefits
          </h3>
          <ul className="mt-2 text-sm text-purple-200/80 space-y-1">
            <li>✓ Permanent 2x earnings multiplier</li>
            <li>✓ Exclusive Noun Barista (5x multiplier)</li>
            <li>✓ Golden Noun Machine (3x speed)</li>
            <li>✓ Noun Statue decoration</li>
            <li>✓ VIP badge on leaderboard</li>
          </ul>
          {gameState.nounBalance <= 0 && (
            <button className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium text-sm transition-colors">
              Get $NOUN →
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 p-4 rounded-xl bg-stone-800/50 text-sm">
          <div className="grid grid-cols-2 gap-2 text-amber-300/70">
            <div>Total Earned: {gameState.totalEarned.toLocaleString()}</div>
            <div>Customers Served: {gameState.customersServed}</div>
            <div>Max Combo: {gameState.maxCombo}</div>
            <div>Prestige Level: {gameState.prestigeLevel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shop Item Component
function ShopItem({
  name,
  cost,
  bonus,
  owned,
  canAfford,
  isNounExclusive,
  hasNoun,
  onBuy,
  sprite,
}: {
  name: string;
  cost: number;
  bonus: string;
  owned: boolean;
  canAfford: boolean;
  isNounExclusive?: boolean;
  hasNoun?: boolean;
  onBuy: () => void;
  sprite?: string;
}) {
  const locked = isNounExclusive && !hasNoun;

  return (
    <button
      onClick={onBuy}
      disabled={owned || (!isNounExclusive && !canAfford) || locked}
      className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
        owned
          ? 'bg-green-900/30 border border-green-500/30'
          : locked
            ? 'bg-purple-900/20 border border-purple-500/30'
            : canAfford || isNounExclusive
              ? 'bg-amber-800/50 hover:bg-amber-700/50 border border-amber-600/30'
              : 'bg-stone-800/30 border border-stone-700/30 opacity-50'
      }`}
    >
      {sprite && <span className="text-3xl">{sprite}</span>}
      <div className="flex-1 text-left">
        <div className="font-medium flex items-center gap-2">
          {name}
          {isNounExclusive && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">$NOUN</span>}
        </div>
        <div className="text-xs text-amber-300/70">{bonus}</div>
      </div>
      <div className="text-right">
        {owned ? (
          <span className="text-green-400 text-sm">✓ Owned</span>
        ) : locked ? (
          <span className="text-purple-400 text-sm">Hold $NOUN</span>
        ) : (
          <span className={canAfford ? 'text-amber-400' : 'text-gray-500'}>
            {isNounExclusive ? 'FREE' : cost.toLocaleString()}
          </span>
        )}
      </div>
    </button>
  );
}
