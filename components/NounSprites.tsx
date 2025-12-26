'use client';

import React, { useMemo } from 'react';

// ============================================
// NOUNS COFFEE EMPIRE - PIXEL ART SYSTEM
// ============================================

// Nouns-inspired color palette (bold, limited, iconic)
export const PALETTE = {
  // Backgrounds
  bgDark: '#1a1a2e',
  bgMid: '#16213e',
  bgLight: '#0f3460',
  bgAccent: '#e94560',

  // Nouns classic colors
  nounRed: '#d63c5e',
  nounOrange: '#e76f51',
  nounYellow: '#f4a261',
  nounGreen: '#52b788',
  nounBlue: '#4361ee',
  nounPurple: '#7209b7',
  nounPink: '#ff6b9d',
  nounTeal: '#2ec4b6',

  // Coffee colors
  coffee: '#3d2314',
  coffeeLight: '#6f4e37',
  coffeeCream: '#e8d4b8',
  espresso: '#1a0f0a',

  // Skin tones
  skin1: '#ffecd2',
  skin2: '#ddb892',
  skin3: '#b08968',
  skin4: '#7f5539',
  skin5: '#3d2314',

  // Glasses frames (Nouns signature)
  glassesBlack: '#000000',
  glassesRed: '#e63946',
  glassesBlue: '#1d3557',
  glassesGreen: '#2d6a4f',
  glassesPurple: '#6a0572',
  glassesOrange: '#f77f00',
  glassesPink: '#ff85a1',
  glassesGold: '#ffd700',

  // UI colors
  white: '#ffffff',
  black: '#000000',
  gray: '#6c757d',
  success: '#52b788',
  warning: '#f4a261',
  danger: '#e63946',

  // Wood & Materials
  wood: '#8b5a2b',
  woodDark: '#5c3d2e',
  woodLight: '#c4956a',
  metal: '#71797e',
  metalDark: '#3d4145',
  copper: '#b87333',
};

// Glasses styles (the signature Nouns look)
export const GLASSES_STYLES = [
  { frame: PALETTE.glassesBlack, lens: PALETTE.white },
  { frame: PALETTE.glassesRed, lens: PALETTE.white },
  { frame: PALETTE.glassesBlue, lens: PALETTE.nounYellow },
  { frame: PALETTE.glassesGreen, lens: PALETTE.white },
  { frame: PALETTE.glassesPurple, lens: PALETTE.nounPink },
  { frame: PALETTE.glassesOrange, lens: PALETTE.white },
  { frame: PALETTE.glassesPink, lens: PALETTE.white },
  { frame: PALETTE.glassesGold, lens: PALETTE.black },
  { frame: PALETTE.nounTeal, lens: PALETTE.nounYellow },
  { frame: PALETTE.white, lens: PALETTE.nounRed },
];

// Helper to create CSS pixel art using box-shadow
function createPixelArt(pixels: (string | null)[][], pixelSize: number = 4): string {
  const shadows: string[] = [];
  pixels.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        shadows.push(`${x * pixelSize}px ${y * pixelSize}px 0 0 ${color}`);
      }
    });
  });
  return shadows.join(', ');
}

// ============================================
// NOUNS GLASSES COMPONENT
// ============================================

interface NounGlassesProps {
  style?: number;
  size?: number;
  className?: string;
}

// 10x4 pixel Nouns glasses
function createGlassesPixels(frameColor: string, lensColor: string): (string | null)[][] {
  return [
    [frameColor, frameColor, frameColor, frameColor, null, null, frameColor, frameColor, frameColor, frameColor],
    [frameColor, lensColor, lensColor, frameColor, frameColor, frameColor, frameColor, lensColor, lensColor, frameColor],
    [frameColor, lensColor, lensColor, frameColor, null, null, frameColor, lensColor, lensColor, frameColor],
    [frameColor, frameColor, frameColor, frameColor, null, null, frameColor, frameColor, frameColor, frameColor],
  ];
}

export function NounGlasses({ style = 0, size = 4, className = '' }: NounGlassesProps) {
  const glassStyle = GLASSES_STYLES[style % GLASSES_STYLES.length];
  const pixels = createGlassesPixels(glassStyle.frame, glassStyle.lens);
  const boxShadow = useMemo(() => createPixelArt(pixels, size), [pixels, size]);

  return (
    <div
      className={className}
      style={{
        width: 10 * size,
        height: 4 * size,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          boxShadow,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// ============================================
// CHARACTER SPRITES
// ============================================

interface CharacterProps {
  skinTone?: number;
  glassesStyle?: number;
  shirtColor?: string;
  size?: number;
  className?: string;
  animate?: boolean;
}

// Create a character pixel grid (12x16)
function createCharacterPixels(
  skinColor: string,
  shirtColor: string,
  glassesFrame: string,
  glassesLens: string
): (string | null)[][] {
  const s = skinColor;
  const t = shirtColor;
  const f = glassesFrame;
  const l = glassesLens;
  const h = PALETTE.coffee; // hair

  return [
    // Row 0-2: Hair
    [null, null, null, h, h, h, h, h, h, null, null, null],
    [null, null, h, h, h, h, h, h, h, h, null, null],
    [null, h, h, h, h, h, h, h, h, h, h, null],
    // Row 3: Forehead
    [null, h, s, s, s, s, s, s, s, s, h, null],
    // Row 4-5: Glasses
    [null, f, f, f, f, f, f, f, f, f, f, null],
    [null, f, l, l, f, f, f, f, l, l, f, null],
    // Row 6: Nose/cheeks
    [null, null, s, s, s, s, s, s, s, s, null, null],
    // Row 7: Mouth
    [null, null, s, s, s, PALETTE.nounRed, PALETTE.nounRed, s, s, s, null, null],
    // Row 8-9: Neck
    [null, null, null, s, s, s, s, s, s, null, null, null],
    [null, null, null, null, s, s, s, s, null, null, null, null],
    // Row 10-13: Shirt
    [null, null, t, t, t, t, t, t, t, t, null, null],
    [null, t, t, t, t, t, t, t, t, t, t, null],
    [s, t, t, t, t, t, t, t, t, t, t, s],
    [s, t, t, t, t, t, t, t, t, t, t, s],
    // Row 14-15: Arms/bottom
    [null, s, t, t, t, t, t, t, t, t, s, null],
    [null, null, t, t, t, t, t, t, t, t, null, null],
  ];
}

const SKIN_TONES = [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3, PALETTE.skin4, PALETTE.skin5];

export function Character({
  skinTone = 0,
  glassesStyle = 0,
  shirtColor = PALETTE.nounGreen,
  size = 4,
  className = '',
  animate = false,
}: CharacterProps) {
  const skin = SKIN_TONES[skinTone % SKIN_TONES.length];
  const glasses = GLASSES_STYLES[glassesStyle % GLASSES_STYLES.length];
  const pixels = useMemo(
    () => createCharacterPixels(skin, shirtColor, glasses.frame, glasses.lens),
    [skin, shirtColor, glasses]
  );
  const boxShadow = useMemo(() => createPixelArt(pixels, size), [pixels, size]);

  return (
    <div
      className={`${className} ${animate ? 'animate-bounce' : ''}`}
      style={{
        width: 12 * size,
        height: 16 * size,
        position: 'relative',
        animationDuration: animate ? '2s' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          boxShadow,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// ============================================
// COFFEE MUG (Main tap target)
// ============================================

interface CoffeeMugProps {
  size?: number;
  fillPercent?: number;
  className?: string;
  hasSteam?: boolean;
}

function createMugPixels(fillPercent: number = 100): (string | null)[][] {
  const w = PALETTE.white;
  const b = PALETTE.black;
  const c = fillPercent > 50 ? PALETTE.coffee : PALETTE.coffeeLight;
  const cr = PALETTE.coffeeCream;

  // 14x16 pixel mug with handle
  return [
    // Steam area (rows 0-2)
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    // Mug top rim (row 3)
    [null, null, b, b, b, b, b, b, b, b, b, null, null, null],
    // Mug interior top (row 4)
    [null, b, w, w, w, w, w, w, w, w, w, b, null, null],
    // Coffee surface with cream (row 5)
    [null, b, w, cr, cr, c, c, c, cr, cr, w, b, b, null],
    // Coffee body (rows 6-10)
    [null, b, w, c, c, c, c, c, c, c, w, b, b, b],
    [null, b, w, c, c, c, c, c, c, c, w, b, w, b],
    [null, b, w, c, c, c, c, c, c, c, w, b, w, b],
    [null, b, w, c, c, c, c, c, c, c, w, b, w, b],
    [null, b, w, c, c, c, c, c, c, c, w, b, b, b],
    // Mug bottom (rows 11-12)
    [null, b, w, w, w, w, w, w, w, w, w, b, b, null],
    [null, null, b, b, b, b, b, b, b, b, b, null, null, null],
    // Saucer (rows 13-15)
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    [null, b, b, b, b, b, b, b, b, b, b, b, b, null],
    [b, w, w, w, w, w, w, w, w, w, w, w, w, b],
  ];
}

export function CoffeeMug({ size = 6, fillPercent = 100, className = '', hasSteam = true }: CoffeeMugProps) {
  const pixels = useMemo(() => createMugPixels(fillPercent), [fillPercent]);
  const boxShadow = useMemo(() => createPixelArt(pixels, size), [pixels, size]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: 14 * size,
        height: 16 * size,
      }}
    >
      {/* Steam */}
      {hasSteam && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-2 opacity-60">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 bg-white/50 rounded-full"
              style={{
                height: 12 + Math.random() * 8,
                animation: `steam 2s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* Mug */}
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          boxShadow,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// ============================================
// COFFEE MACHINE
// ============================================

interface CoffeeMachineProps {
  size?: number;
  active?: boolean;
  className?: string;
}

function createMachinePixels(): (string | null)[][] {
  const m = PALETTE.metal;
  const d = PALETTE.metalDark;
  const c = PALETTE.copper;
  const b = PALETTE.black;
  const g = PALETTE.success;
  const r = PALETTE.danger;

  // 16x20 pixel espresso machine
  return [
    // Top dome
    [null, null, null, null, d, d, d, d, d, d, d, d, null, null, null, null],
    [null, null, null, d, m, m, m, m, m, m, m, m, d, null, null, null],
    [null, null, d, m, m, m, m, m, m, m, m, m, m, d, null, null],
    // Display area
    [null, d, m, m, b, b, b, b, b, b, b, b, m, m, d, null],
    [null, d, m, b, g, g, b, b, b, b, r, r, b, m, d, null],
    [null, d, m, m, b, b, b, b, b, b, b, b, m, m, d, null],
    // Body
    [d, d, d, d, d, d, d, d, d, d, d, d, d, d, d, d],
    [d, m, m, m, m, m, m, m, m, m, m, m, m, m, m, d],
    [d, m, m, c, c, m, m, m, m, m, m, c, c, m, m, d],
    [d, m, m, c, c, m, m, m, m, m, m, c, c, m, m, d],
    // Portafilter area
    [d, m, m, m, m, m, m, b, b, m, m, m, m, m, m, d],
    [d, m, m, m, m, m, b, PALETTE.coffee, PALETTE.coffee, b, m, m, m, m, m, d],
    [d, m, m, m, m, m, b, PALETTE.coffee, PALETTE.coffee, b, m, m, m, m, m, d],
    // Drip tray
    [d, d, d, d, d, d, d, d, d, d, d, d, d, d, d, d],
    [null, d, m, m, m, m, m, m, m, m, m, m, m, m, d, null],
    [null, d, d, d, d, d, d, d, d, d, d, d, d, d, d, null],
  ];
}

export function CoffeeMachine({ size = 4, active = true, className = '' }: CoffeeMachineProps) {
  const pixels = useMemo(() => createMachinePixels(), []);
  const boxShadow = useMemo(() => createPixelArt(pixels, size), [pixels, size]);

  return (
    <div className={`relative ${className}`} style={{ width: 16 * size, height: 16 * size }}>
      {/* Steam when active */}
      {active && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1 opacity-40">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="w-2 h-4 bg-white/50 rounded-full"
              style={{
                animation: `steam 1.5s ease-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          boxShadow,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// ============================================
// SHOP COUNTER
// ============================================

interface CounterProps {
  width?: number;
  height?: number;
  size?: number;
  className?: string;
}

function createCounterTile(): (string | null)[][] {
  const w = PALETTE.wood;
  const d = PALETTE.woodDark;
  const l = PALETTE.woodLight;

  // 8x8 repeating wood pattern
  return [
    [l, l, l, l, l, l, l, l],
    [w, w, w, d, w, w, w, w],
    [w, w, w, w, w, w, d, w],
    [w, d, w, w, w, w, w, w],
    [w, w, w, w, w, d, w, w],
    [w, w, d, w, w, w, w, w],
    [d, d, d, d, d, d, d, d],
    [d, d, d, d, d, d, d, d],
  ];
}

export function Counter({ width = 200, height = 32, size = 4, className = '' }: CounterProps) {
  const tile = useMemo(() => createCounterTile(), []);
  const tileWidth = 8 * size;
  const tilesNeeded = Math.ceil(width / tileWidth);
  const tileShadow = useMemo(() => createPixelArt(tile, size), [tile, size]);

  return (
    <div className={`flex ${className}`} style={{ width, height, overflow: 'hidden' }}>
      {Array.from({ length: tilesNeeded }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8 * size,
            height: 8 * size,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: size,
              height: size,
              boxShadow: tileShadow,
              imageRendering: 'pixelated',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================
// BEAN ICON (Currency)
// ============================================

interface BeanIconProps {
  size?: number;
  color?: string;
  className?: string;
}

function createBeanPixels(color: string): (string | null)[][] {
  const c = color;
  const d = PALETTE.black;

  // 8x10 coffee bean
  return [
    [null, null, d, d, d, d, null, null],
    [null, d, c, c, c, c, d, null],
    [d, c, c, c, c, c, c, d],
    [d, c, c, d, d, c, c, d],
    [d, c, c, d, d, c, c, d],
    [d, c, c, d, d, c, c, d],
    [d, c, c, d, d, c, c, d],
    [d, c, c, c, c, c, c, d],
    [null, d, c, c, c, c, d, null],
    [null, null, d, d, d, d, null, null],
  ];
}

export function BeanIcon({ size = 3, color = PALETTE.coffee, className = '' }: BeanIconProps) {
  const pixels = useMemo(() => createBeanPixels(color), [color]);
  const boxShadow = useMemo(() => createPixelArt(pixels, size), [pixels, size]);

  return (
    <div className={className} style={{ width: 8 * size, height: 10 * size, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          boxShadow,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// ============================================
// GOLDEN BEAN (Special event)
// ============================================

export function GoldenBean({ size = 4, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <BeanIcon size={size} color={PALETTE.glassesGold} />
    </div>
  );
}

// ============================================
// FLOATING NUMBER (Tap feedback)
// ============================================

interface FloatingNumberProps {
  value: string;
  x: number;
  y: number;
  color?: string;
  onComplete: () => void;
}

export function FloatingNumber({ value, x, y, color = PALETTE.nounYellow, onComplete }: FloatingNumberProps) {
  return (
    <div
      className="fixed pointer-events-none font-bold text-xl z-50"
      style={{
        left: x,
        top: y,
        color,
        textShadow: '2px 2px 0 #000, -1px -1px 0 #000',
        animation: 'floatUp 0.8s ease-out forwards',
      }}
      onAnimationEnd={onComplete}
    >
      {value}
    </div>
  );
}

// ============================================
// PROGRESS BAR
// ============================================

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  bgColor?: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max,
  color = PALETTE.nounGreen,
  bgColor = PALETTE.bgDark,
  height = 12,
  className = '',
  showLabel = false,
}: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        height,
        background: bgColor,
        border: `2px solid ${PALETTE.black}`,
        imageRendering: 'pixelated',
      }}
    >
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${percent}%`,
          background: color,
        }}
      />
      {showLabel && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-bold"
          style={{ color: PALETTE.white, textShadow: '1px 1px 0 #000' }}
        >
          {Math.floor(percent)}%
        </div>
      )}
    </div>
  );
}

// ============================================
// SHOP SCENE (Background)
// ============================================

interface ShopSceneProps {
  tier: number;
  className?: string;
  children?: React.ReactNode;
}

const SHOP_BG_COLORS: { bg: string; wall: string; floor: string }[] = [
  { bg: '#87ceeb', wall: '#f5deb3', floor: '#8b7355' }, // Cart - outdoor
  { bg: '#deb887', wall: '#ffe4c4', floor: '#8b7355' }, // Kiosk - warm
  { bg: '#b8860b', wall: '#faebd7', floor: '#5c4033' }, // Café - cozy
  { bg: '#4a4a4a', wall: '#696969', floor: '#3d3d3d' }, // Roastery - industrial
  { bg: '#2f4f4f', wall: '#708090', floor: '#1a1a1a' }, // Chain - modern
  { bg: '#1a1a2e', wall: '#16213e', floor: '#0f3460' }, // Empire - futuristic
];

export function ShopScene({ tier, className = '', children }: ShopSceneProps) {
  const colors = SHOP_BG_COLORS[Math.min(tier, SHOP_BG_COLORS.length - 1)];

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.wall} 50%, ${colors.floor} 100%)`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// COMBO INDICATOR
// ============================================

interface ComboIndicatorProps {
  count: number;
  multiplier: number;
  className?: string;
}

export function ComboIndicator({ count, multiplier, className = '' }: ComboIndicatorProps) {
  if (count < 2) return null;

  const intensity = Math.min(count / 50, 1);
  const color = `hsl(${60 - intensity * 60}, 100%, 50%)`; // Yellow to red

  return (
    <div
      className={`font-bold text-center ${className}`}
      style={{
        color,
        textShadow: `0 0 ${10 + intensity * 20}px ${color}`,
        animation: count > 10 ? 'pulse 0.5s ease-in-out infinite' : undefined,
      }}
    >
      <div className="text-3xl">{count}x</div>
      <div className="text-sm opacity-80">COMBO</div>
      <div className="text-lg">×{multiplier.toFixed(1)}</div>
    </div>
  );
}

// ============================================
// EVENT BANNER
// ============================================

interface EventBannerProps {
  type: 'rush_hour' | 'golden_bean' | 'special_order' | 'noun_rain';
  multiplier: number;
  timeLeft: number;
  className?: string;
}

const EVENT_STYLES: Record<string, { bg: string; icon: string; name: string }> = {
  rush_hour: { bg: PALETTE.nounOrange, icon: '⚡', name: 'RUSH HOUR' },
  golden_bean: { bg: PALETTE.glassesGold, icon: '✨', name: 'GOLDEN BEAN' },
  special_order: { bg: PALETTE.nounPurple, icon: '📋', name: 'SPECIAL ORDER' },
  noun_rain: { bg: PALETTE.nounBlue, icon: '⌐◨-◨', name: 'NOUN RAIN' },
};

export function EventBanner({ type, multiplier, timeLeft, className = '' }: EventBannerProps) {
  const style = EVENT_STYLES[type];

  return (
    <div
      className={`px-4 py-2 text-center font-bold ${className}`}
      style={{
        background: style.bg,
        color: PALETTE.white,
        textShadow: '2px 2px 0 #000',
        animation: 'pulse 1s ease-in-out infinite',
      }}
    >
      <span className="mr-2">{style.icon}</span>
      {style.name} - {multiplier}x
      <span className="ml-2 opacity-80">({Math.ceil(timeLeft / 1000)}s)</span>
    </div>
  );
}
