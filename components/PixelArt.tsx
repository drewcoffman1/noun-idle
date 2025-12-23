'use client';

// Pixel art components using CSS box-shadow technique
// Each "pixel" is a 1x1 box-shadow, scaled up for visibility

const PIXEL_SIZE = 4; // Each pixel is 4x4 CSS pixels

// Color palette - cozy coffee shop vibes
const COLORS = {
  // Skin tones
  skin1: '#ffd5b5',
  skin2: '#e8b796',
  // Hair
  hairBrown: '#5c4033',
  hairBlonde: '#d4a574',
  hairBlack: '#2d2d2d',
  // Clothes
  apronGreen: '#4a7c59',
  apronBrown: '#8b5a2b',
  shirtWhite: '#f5f5f5',
  shirtBlue: '#5b7fa3',
  // Coffee shop
  wood: '#8b5a2b',
  woodDark: '#5c3d2e',
  woodLight: '#a67c52',
  counter: '#deb887',
  metal: '#708090',
  metalDark: '#4a5568',
  coffee: '#3d2314',
  coffeeCream: '#d4a574',
  steam: '#e8e8e8',
  // UI
  white: '#ffffff',
  black: '#1a1a1a',
  green: '#4ade80',
  red: '#ef4444',
};

// Helper to create pixel art from a 2D array of colors
function createPixelArt(pixels: (string | null)[][]): string {
  const shadows: string[] = [];
  pixels.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        shadows.push(`${x * PIXEL_SIZE}px ${y * PIXEL_SIZE}px 0 ${color}`);
      }
    });
  });
  return shadows.join(', ');
}

// Barista character (16x20 pixels)
const BARISTA_PIXELS = [
  [null, null, null, null, null, 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', null, null, null, null, null],
  [null, null, null, null, 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', null, null, null, null],
  [null, null, null, 'hairBrown', 'hairBrown', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'hairBrown', 'hairBrown', null, null, null],
  [null, null, null, 'hairBrown', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'hairBrown', null, null, null],
  [null, null, null, null, 'skin1', 'black', 'skin1', 'skin1', 'skin1', 'skin1', 'black', 'skin1', null, null, null, null],
  [null, null, null, null, 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', null, null, null, null],
  [null, null, null, null, null, 'skin1', 'skin1', 'skin2', 'skin2', 'skin1', 'skin1', null, null, null, null, null],
  [null, null, null, null, null, null, 'skin1', 'skin1', 'skin1', 'skin1', null, null, null, null, null, null],
  [null, null, null, null, 'shirtWhite', 'shirtWhite', 'shirtWhite', 'shirtWhite', 'shirtWhite', 'shirtWhite', 'shirtWhite', 'shirtWhite', null, null, null, null],
  [null, null, null, 'shirtWhite', 'shirtWhite', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'shirtWhite', 'shirtWhite', null, null, null],
  [null, null, 'skin1', 'shirtWhite', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'shirtWhite', 'skin1', null, null],
  [null, null, 'skin1', 'shirtWhite', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'shirtWhite', 'skin1', null, null],
  [null, null, null, null, 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', null, null, null, null],
  [null, null, null, null, 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', 'apronGreen', null, null, null, null],
  [null, null, null, null, null, 'hairBrown', 'hairBrown', null, null, 'hairBrown', 'hairBrown', null, null, null, null, null],
  [null, null, null, null, null, 'hairBrown', 'hairBrown', null, null, 'hairBrown', 'hairBrown', null, null, null, null, null],
].map(row => row.map(c => c ? COLORS[c as keyof typeof COLORS] : null));

// Customer character (14x18 pixels)
const CUSTOMER_PIXELS = [
  [null, null, null, null, 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', null, null, null, null],
  [null, null, null, 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', 'hairBlack', null, null, null],
  [null, null, 'hairBlack', 'hairBlack', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'hairBlack', 'hairBlack', null, null],
  [null, null, null, 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', null, null, null],
  [null, null, null, 'skin1', 'black', 'skin1', 'skin1', 'skin1', 'skin1', 'black', 'skin1', null, null, null],
  [null, null, null, 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', 'skin1', null, null, null],
  [null, null, null, null, 'skin1', 'skin1', 'skin2', 'skin2', 'skin1', 'skin1', null, null, null, null],
  [null, null, null, null, null, 'skin1', 'skin1', 'skin1', 'skin1', null, null, null, null, null],
  [null, null, null, 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', null, null, null],
  [null, null, 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', null, null],
  [null, 'skin1', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'skin1', null],
  [null, 'skin1', null, 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', 'shirtBlue', null, 'skin1', null],
  [null, null, null, null, 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', 'hairBrown', null, null, null, null],
  [null, null, null, null, 'hairBrown', 'hairBrown', null, null, 'hairBrown', 'hairBrown', null, null, null, null],
].map(row => row.map(c => c ? COLORS[c as keyof typeof COLORS] : null));

// Coffee cup (10x12 pixels)
const COFFEE_CUP_PIXELS = [
  [null, null, 'steam', null, 'steam', null, 'steam', null, null, null],
  [null, 'steam', null, 'steam', null, 'steam', null, 'steam', null, null],
  [null, null, null, null, null, null, null, null, null, null],
  [null, 'white', 'white', 'white', 'white', 'white', 'white', 'white', null, null],
  ['white', 'coffee', 'coffee', 'coffeeCream', 'coffeeCream', 'coffee', 'coffee', 'coffee', 'white', null],
  ['white', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'white', 'white'],
  ['white', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'white', 'white'],
  ['white', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'white', 'white'],
  [null, 'white', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'white', null, 'white'],
  [null, null, 'white', 'white', 'white', 'white', 'white', null, null, null],
].map(row => row.map(c => c ? COLORS[c as keyof typeof COLORS] : null));

// Coffee machine (20x24 pixels)
const COFFEE_MACHINE_PIXELS = [
  [null, null, null, 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', null, null, null],
  [null, null, 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', null, null],
  [null, 'metal', 'metalDark', 'metalDark', 'metal', 'metal', 'metal', 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', 'metal', 'metal', 'metal', 'metalDark', 'metalDark', 'metal', null],
  [null, 'metal', 'metalDark', 'metal', 'green', 'green', 'metal', 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', 'red', 'red', 'metal', 'metal', 'metalDark', 'metal', null],
  [null, 'metal', 'metalDark', 'metal', 'metal', 'metal', 'metal', 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', 'metal', 'metal', 'metal', 'metal', 'metalDark', 'metal', null],
  [null, 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', null],
  [null, 'metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal', null],
  ['metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal'],
  ['metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal'],
  ['metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'coffee', 'coffee', 'coffee', 'coffee', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal'],
  ['metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'coffee', 'coffee', 'coffee', 'coffee', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal'],
  ['metal', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metalDark', 'metal'],
  ['metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal', 'metal'],
].map(row => row.map(c => c ? COLORS[c as keyof typeof COLORS] : null));

// Counter section (repeating pattern, 8x8 pixels)
const COUNTER_PIXELS = [
  ['woodLight', 'woodLight', 'woodLight', 'woodLight', 'woodLight', 'woodLight', 'woodLight', 'woodLight'],
  ['wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood'],
  ['wood', 'woodDark', 'wood', 'wood', 'wood', 'woodDark', 'wood', 'wood'],
  ['wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood'],
  ['wood', 'wood', 'woodDark', 'wood', 'wood', 'wood', 'woodDark', 'wood'],
  ['wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood'],
  ['woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark'],
  ['woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark', 'woodDark'],
].map(row => row.map(c => c ? COLORS[c as keyof typeof COLORS] : null));

// Component to render pixel art
export function PixelSprite({
  pixels,
  scale = 1,
  className = ''
}: {
  pixels: (string | null)[][];
  scale?: number;
  className?: string;
}) {
  const width = pixels[0]?.length || 0;
  const height = pixels.length;
  const boxShadow = createPixelArt(pixels);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: width * PIXEL_SIZE * scale,
        height: height * PIXEL_SIZE * scale,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PIXEL_SIZE * scale,
          height: PIXEL_SIZE * scale,
          boxShadow,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// Pre-built components
export function Barista({ scale = 1, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite pixels={BARISTA_PIXELS} scale={scale} className={className} />;
}

export function Customer({ scale = 1, className = '', variant = 0 }: { scale?: number; className?: string; variant?: number }) {
  // Could add more variants later
  return <PixelSprite pixels={CUSTOMER_PIXELS} scale={scale} className={className} />;
}

export function CoffeeCup({ scale = 1, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite pixels={COFFEE_CUP_PIXELS} scale={scale} className={className} />;
}

export function CoffeeMachine({ scale = 1, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite pixels={COFFEE_MACHINE_PIXELS} scale={scale} className={className} />;
}

export function Counter({ width = 200, className = '' }: { width?: number; className?: string }) {
  const tilesNeeded = Math.ceil(width / (8 * PIXEL_SIZE));
  return (
    <div className={`flex ${className}`} style={{ width }}>
      {Array.from({ length: tilesNeeded }).map((_, i) => (
        <PixelSprite key={i} pixels={COUNTER_PIXELS} scale={1} />
      ))}
    </div>
  );
}

// Animated steam component
export function Steam({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1 bg-white/40 rounded-full animate-steam"
          style={{
            height: `${8 + Math.random() * 8}px`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export { COLORS };
