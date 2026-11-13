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

import { LIMITED, paletteHex } from './limited-palette';

/** A `#rrggbb` colour as 0xAABBGGRR, moved into the limited palette when it is on (limited-palette.ts). */
export function hexToABGR(hex: string, alpha = 255): number {
  const clean = paletteHex(hex.startsWith('#') ? hex : `#${hex}`).replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (((alpha & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0;
}

export type TerrainTheme = 'classic' | 'mountainhome' | 'wilds';

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

export const PALETTE_DF_CLASSIC = {
  deepWater: makeRamp('#254363', '#14243b', '#0f1a2d', '#09101d'),
  shallowWater: makeRamp('#3d7194', '#1e3f57', '#162f43', '#101f2e'),
  sand: makeRamp('#e2c99b', '#be9b62', '#9d7a46', '#5e4524'),
  grass: makeRamp('#73b06f', '#4a6f30', '#395523', '#223514'),
  soil: makeRamp('#926b42', '#5e4023', '#442d17', '#27180b'),
  shrub: makeRamp('#7a8c4f', '#63733b', '#4c5929', '#2f3818'),
  rock: makeRamp('#aaadb5', '#6f737b', '#53565e', '#2c2e33'),
  snow: makeRamp('#ffffff', '#d5deeb', '#b1c0d4', '#586c87'),
  stoneWall: makeRamp('#9fa3a9', '#7a8089', '#5a6069', '#25282d'),
  earthWall: makeRamp('#d2a873', '#a87c4c', '#7c5733', '#3d2915'), // S3 packed earth walls: warm clay, lighter than bare soil
  timber: makeRamp('#9c7247', '#7c5632', '#5c3d20', '#331f0d'),
  hearthFire: makeRamp('#ffe066', '#f59f00', '#d9480f', '#3b0d0c'),
} as const;

export const PALETTE_DF_MOUNTAINHOME = {
  deepWater: makeRamp('#173d4e', '#0a1e28', '#06131a', '#030a0d'),
  shallowWater: makeRamp('#2d889f', '#154f5e', '#0e3843', '#082128'),
  sand: makeRamp('#ebd09c', '#c59e5e', '#9f7b41', '#5c431d'),
  grass: makeRamp('#52994a', '#2f5c2a', '#22431e', '#152912'),
  soil: makeRamp('#83603e', '#523921', '#3a2614', '#201408'),
  shrub: makeRamp('#628a52', '#456a37', '#324e27', '#1f3118'),
  rock: makeRamp('#828b9c', '#444b56', '#2f343d', '#1b1e23'),
  snow: makeRamp('#ffffff', '#cddae9', '#a8bbd3', '#4f6482'),
  stoneWall: makeRamp('#a0a8b4', '#6b7381', '#474e5a', '#1e2229'),
  earthWall: makeRamp('#c9a06c', '#9c7246', '#71502f', '#372513'), // S3 packed earth walls: warm clay, lighter than bare soil
  timber: makeRamp('#946b43', '#724f2e', '#53361c', '#2c1a0c'),
  hearthFire: makeRamp('#ffe066', '#f59f00', '#d9480f', '#3b0d0c'),
} as const;

export const PALETTE_DF_WILDS = {
  deepWater: makeRamp('#1d2c38', '#0d161d', '#080d12', '#040608'),
  shallowWater: makeRamp('#355f73', '#19333e', '#11232c', '#0a141a'),
  sand: makeRamp('#cebea9', '#9f8b73', '#7c6b55', '#453a2d'),
  grass: makeRamp('#6b843d', '#435525', '#313f1b', '#1f2710'),
  soil: makeRamp('#614735', '#3b291d', '#291c13', '#160e08'),
  shrub: makeRamp('#757947', '#565a31', '#3c3e21', '#232512'),
  rock: makeRamp('#7d857d', '#4a504a', '#353a35', '#1e221e'),
  snow: makeRamp('#f0f4f5', '#cbd6dc', '#a3b4bf', '#506371'),
  stoneWall: makeRamp('#8e9590', '#636b65', '#434a45', '#1f2320'),
  earthWall: makeRamp('#b9976d', '#8c6c4a', '#664d33', '#33261a'), // S3 packed earth walls: warm clay, lighter than bare soil
  timber: makeRamp('#87623e', '#66472a', '#4a311b', '#27170b'),
  hearthFire: makeRamp('#ffe066', '#f59f00', '#d9480f', '#3b0d0c'),
} as const;

// Limited palette (limited-palette.ts): ramps picked by hand from its GBA-inspired colours, per theme.
// Highlight, base, shadow, rim. Sand uses the two muted tones added to calm it down.
export const PALETTE_LIMITED_CLASSIC = {
  deepWater: makeRamp('#2850a8', '#182868', '#101828', '#101828'),
  shallowWater: makeRamp('#3880d0', '#2850a8', '#182868', '#101828'),
  sand: makeRamp('#f8e090', '#d8c088', '#b89860', '#a85828'),
  grass: makeRamp('#78c850', '#40a048', '#207840', '#104830'),
  soil: makeRamp('#985038', '#703020', '#482018', '#101828'),
  shrub: makeRamp('#40a048', '#207840', '#104830', '#101828'),
  rock: makeRamp('#c0c8d8', '#8890a8', '#586078', '#303048'),
  snow: makeRamp('#f8f8f8', '#a8e0f8', '#8890a8', '#586078'),
  stoneWall: makeRamp('#c0c8d8', '#8890a8', '#586078', '#303048'),
  earthWall: makeRamp('#e8b850', '#d08838', '#a85828', '#703020'),
  timber: makeRamp('#985038', '#703020', '#482018', '#101828'),
  hearthFire: makeRamp('#f8e090', '#f87058', '#d03838', '#882030'),
} as const;

export const PALETTE_LIMITED_MOUNTAINHOME = {
  ...PALETTE_LIMITED_CLASSIC,
  grass: makeRamp('#40a048', '#207840', '#104830', '#101828'),
  shrub: makeRamp('#207840', '#104830', '#101828', '#101828'),
  rock: makeRamp('#8890a8', '#586078', '#303048', '#101828'),
} as const;

export const PALETTE_LIMITED_WILDS = {
  ...PALETTE_LIMITED_CLASSIC,
  sand: makeRamp('#c0c8d8', '#8890a8', '#586078', '#303048'),
  grass: makeRamp('#40a048', '#207840', '#104830', '#101828'),
} as const;

export function getPaletteForTheme(theme: TerrainTheme) {
  switch (theme) {
    case 'mountainhome': return LIMITED ? PALETTE_LIMITED_MOUNTAINHOME : PALETTE_DF_MOUNTAINHOME;
    case 'wilds': return LIMITED ? PALETTE_LIMITED_WILDS : PALETTE_DF_WILDS;
    case 'classic':
    default:
      return LIMITED ? PALETTE_LIMITED_CLASSIC : PALETTE_DF_CLASSIC;
  }
}

export const PALETTE = LIMITED ? PALETTE_LIMITED_CLASSIC : PALETTE_DF_CLASSIC;

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
