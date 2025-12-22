'use client';

import { useState, useEffect, useCallback } from 'react';
import { GameState, calculateProductionRate, UPGRADE_COSTS, getUpgradeCost, MILESTONES, getUnclaimedMilestones } from '@/lib/game';

interface CoffeeShopProps {
  fid: number;
}

export default function CoffeeShop({ fid }: CoffeeShopProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [idleEarnings, setIdleEarnings] = useState<number>(0);

  // Fetch initial state
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`/api/game/state?fid=${fid}`);
        const data = await res.json();
        setState(data.state);
        if (data.idleEarnings?.coins > 0) {
          setIdleEarnings(data.idleEarnings.coins);
        }
      } catch (error) {
        console.error('Failed to fetch state:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchState();
  }, [fid]);

  // Passive earnings tick (visual only, actual earnings calculated on collect)
  useEffect(() => {
    if (!state) return;

    const rate = calculateProductionRate(state);
    const interval = setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coins: prev.coins + rate,
          totalCoffees: prev.totalCoffees + rate,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.upgrades, state?.boostEndTime]);

  const handleCollect = useCallback(async () => {
    if (collecting) return;
    setCollecting(true);

    try {
      const res = await fetch('/api/game/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      setState(data.state);
    } catch (error) {
      console.error('Failed to collect:', error);
    } finally {
      setCollecting(false);
    }
  }, [fid, collecting]);

  const handleUpgrade = useCallback(async (upgrade: keyof typeof UPGRADE_COSTS) => {
    try {
      const res = await fetch('/api/game/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, upgrade }),
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      }
    } catch (error) {
      console.error('Failed to upgrade:', error);
    }
  }, [fid]);

  const handleClaimMilestone = useCallback(async (milestone: string) => {
    try {
      const res = await fetch('/api/token/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, milestone }),
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
        // Show success message
        alert(data.message);
      }
    } catch (error) {
      console.error('Failed to claim milestone:', error);
    }
  }, [fid]);

  const handleBoost = useCallback(async (boostType: 'speed' | 'instant') => {
    try {
      const res = await fetch('/api/token/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, boostType }),
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      }
      alert(data.message);
    } catch (error) {
      console.error('Failed to apply boost:', error);
    }
  }, [fid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-950">
        <div className="text-amber-100 text-xl">Brewing...</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-950">
        <div className="text-red-400">Failed to load game</div>
      </div>
    );
  }

  const rate = calculateProductionRate(state);
  const unclaimedMilestones = getUnclaimedMilestones(state);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 to-amber-900 text-amber-100 p-4">
      {/* Idle earnings notification */}
      {idleEarnings > 0 && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce cursor-pointer"
          onClick={() => setIdleEarnings(0)}
        >
          Welcome back! +{idleEarnings.toLocaleString()} coffees while away!
        </div>
      )}

      {/* Header Stats */}
      <div className="text-center mb-8 pt-8">
        <h1 className="text-3xl font-bold mb-2">N O U N  C O F F E E</h1>
        <div className="text-5xl font-mono mb-2">
          {Math.floor(state.coins).toLocaleString()}
        </div>
        <div className="text-amber-300 text-sm">
          {rate.toFixed(1)} per second
        </div>
        <div className="text-amber-400 text-xs mt-1">
          Total served: {state.totalCoffees.toLocaleString()}
        </div>
      </div>

      {/* Coffee Cup - Tap to Collect */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="relative w-32 h-40 bg-amber-800 rounded-b-3xl rounded-t-lg border-4 border-amber-600 transition-transform active:scale-95 hover:bg-amber-700"
        >
          <div className="absolute inset-2 bg-amber-950 rounded-b-2xl rounded-t overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-600 to-amber-500 transition-all"
              style={{ height: `${Math.min(100, (state.coins % 100))}%` }}
            />
          </div>
          <div className="absolute -right-4 top-1/3 w-6 h-12 border-4 border-amber-600 rounded-r-full bg-amber-800" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-amber-300">
            TAP
          </span>
        </button>
      </div>

      {/* Milestones */}
      {unclaimedMilestones.length > 0 && (
        <div className="mb-6 p-4 bg-amber-800/50 rounded-lg border border-green-500/50">
          <h2 className="text-lg font-semibold mb-2 text-green-400">Claim Rewards!</h2>
          {unclaimedMilestones.map((id) => (
            <button
              key={id}
              onClick={() => handleClaimMilestone(id)}
              className="w-full flex justify-between items-center py-3 px-2 border-b border-amber-700 last:border-0 hover:bg-amber-700/50 rounded transition-colors"
            >
              <span>{MILESTONES[id as keyof typeof MILESTONES].description}</span>
              <span className="text-green-400 font-mono bg-green-900/50 px-2 py-1 rounded">
                +{MILESTONES[id as keyof typeof MILESTONES].reward} $NOUN
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Upgrades */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold mb-2">Upgrades</h2>

        {/* Beans */}
        <UpgradeButton
          name="Better Beans"
          description="1.5x production"
          level={state.upgrades.beans}
          maxLevel={5}
          cost={getUpgradeCost('beans', state.upgrades.beans)}
          coins={state.coins}
          onClick={() => handleUpgrade('beans')}
        />

        {/* Espresso */}
        <UpgradeButton
          name="Espresso Machine"
          description="+2/sec"
          level={state.upgrades.espresso}
          maxLevel={3}
          cost={getUpgradeCost('espresso', state.upgrades.espresso)}
          coins={state.coins}
          onClick={() => handleUpgrade('espresso')}
        />

        {/* Barista */}
        <UpgradeButton
          name="Hire Barista"
          description="24h idle cap"
          level={state.upgrades.barista}
          maxLevel={3}
          cost={getUpgradeCost('barista', state.upgrades.barista)}
          coins={state.coins}
          onClick={() => handleUpgrade('barista')}
        />

        {/* Locations */}
        <UpgradeButton
          name="New Location"
          description="2x everything"
          level={state.upgrades.locations}
          maxLevel={2}
          cost={getUpgradeCost('locations', state.upgrades.locations)}
          coins={state.coins}
          onClick={() => handleUpgrade('locations')}
        />
      </div>

      {/* Boost Section */}
      <div className="mt-8 p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
        <h2 className="text-lg font-semibold mb-2 text-purple-300">$NOUN Boosts</h2>
        <p className="text-sm text-amber-300 mb-3">
          Spend $NOUN tokens to boost your shop
        </p>
        {state.boostEndTime && Date.now() < state.boostEndTime && (
          <div className="mb-3 p-2 bg-purple-600/50 rounded text-center text-sm">
            2x BOOST ACTIVE - {Math.ceil((state.boostEndTime - Date.now()) / 60000)} min remaining
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => handleBoost('speed')}
            className="flex-1 py-3 px-3 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium transition-colors active:scale-95"
          >
            2x Speed<br/>
            <span className="text-purple-200">10 $NOUN</span>
          </button>
          <button
            onClick={() => handleBoost('instant')}
            className="flex-1 py-3 px-3 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium transition-colors active:scale-95"
          >
            Instant Upgrade<br/>
            <span className="text-purple-200">50 $NOUN</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface UpgradeButtonProps {
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  coins: number;
  onClick: () => void;
}

function UpgradeButton({ name, description, level, maxLevel, cost, coins, onClick }: UpgradeButtonProps) {
  const isMaxed = level >= maxLevel;
  const canAfford = cost !== null && coins >= cost;

  return (
    <button
      onClick={onClick}
      disabled={isMaxed || !canAfford}
      className={`w-full p-3 rounded-lg flex justify-between items-center transition-colors ${
        isMaxed
          ? 'bg-amber-800/30 text-amber-500'
          : canAfford
            ? 'bg-amber-700 hover:bg-amber-600'
            : 'bg-amber-800/50 text-amber-400'
      }`}
    >
      <div className="text-left">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-amber-300">{description}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono">
          {isMaxed ? 'MAX' : cost?.toLocaleString()}
        </div>
        <div className="text-xs text-amber-400">
          Lv {level}/{maxLevel}
        </div>
      </div>
    </button>
  );
}
