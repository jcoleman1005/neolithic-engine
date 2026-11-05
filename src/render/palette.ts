/**
 * src/render/palette.ts
 * Restricted 4-tone palette system and atmospheric elevation haze math.
 */

export interface MaterialRamp {
  readonly highlight: number; // 32-bit ABGR for direct ImageData/PixelBuffer write
  readonly base: number;
  readonly shadow: number;
  readonly rim: number;
  readonly highlightHex: string;
  readonly baseHex: string;
  readonly shadowHex: string;
  readonly rimHex: string;
}

export function hexToABGR(hex: string, alpha = 255): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (((alpha & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0;
}

function makeRamp(highlightHex: string, baseHex: string, shadowHex: string, rimHex: string): MaterialRamp {
  return {
    highlight: hexToABGR(highlightHex),
    base: hexToABGR(baseHex),
    shadow: hexToABGR(shadowHex),
    rim: hexToABGR(rimHex),
    highlightHex,
    baseHex,
    shadowHex,
    rimHex,
  };
}

export const PALETTE = {
  deepWater: makeRamp('#1b324b', '#14243b', '#0f1a2d', '#09101d'),
  shallowWater: makeRamp('#2b536e', '#1e3f57', '#162f43', '#101f2e'),
  sand: makeRamp('#d4b27b', '#be9b62', '#9d7a46', '#5e4524'),
  grass: makeRamp('#608643', '#4a6f30', '#395523', '#223514'),
  shrub: makeRamp('#7a8c4f', '#63733b', '#4c5929', '#2f3818'),
  rock: makeRamp('#7d828c', '#646973', '#4d515a', '#2b2d33'),
  snow: makeRamp('#edf2f7', '#d5deeb', '#b1c0d4', '#586c87'),
  stoneWall: makeRamp('#9fa3a9', '#7a8089', '#5a6069', '#25282d'),
  timber: makeRamp('#9c7247', '#7c5632', '#5c3d20', '#331f0d'),
  hearthFire: makeRamp('#ffe066', '#f59f00', '#d9480f', '#3b0d0c'),
} as const;

/**
 * Shifts an ABGR color toward cool slate-blue atmospheric haze for lower Z-tiers.
 * tierDrop = 0 (active plane), 1, 2, ... (lower planes).
 * Decreases overall exposure while increasing relative blue/slate saturation.
 */
export function applyAtmosphericHaze(abgr: number, tierDrop: number): number {
  if (tierDrop <= 0) return abgr >>> 0;
  const a = (abgr >>> 24) & 0xff;
  let b = (abgr >>> 16) & 0xff;
  let g = (abgr >>> 8) & 0xff;
  let r = abgr & 0xff;

  // Dim exposure
  const mul = Math.pow(0.84, tierDrop);
  r = Math.floor(r * mul * 0.88);
  g = Math.floor(g * mul * 0.92);
  b = Math.floor(b * mul);

  // Blend with cool slate-blue (#384a66: r=56, g=74, b=102)
  const hazeT = Math.min(0.65, tierDrop * 0.15);
  r = Math.floor(r * (1 - hazeT) + 56 * hazeT);
  g = Math.floor(g * (1 - hazeT) + 74 * hazeT);
  b = Math.floor(b * (1 - hazeT) + 102 * hazeT);

  return (((a << 24) | (b << 16) | (g << 8) | r)) >>> 0;
}
