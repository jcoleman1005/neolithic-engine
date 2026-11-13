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

// Limited palette (limited-palette.ts): ramps picked by hand from its 30 colours, per theme. Highlight,
// base, shadow, rim. Its darkest colours are #303843 (cool) and #3d3333 (warm), so water and rims are
// lighter than in the original ramps.
export const PALETTE_LIMITED_CLASSIC = {
  deepWater: makeRamp('#6c81a1', '#405273', '#303843', '#303843'),
  shallowWater: makeRamp('#96a9c1', '#6c81a1', '#405273', '#303843'),
  sand: makeRamp('#d4c692', '#bcad9f', '#a57855', '#734c44'),
  grass: makeRamp('#819447', '#44702d', '#2f4d2f', '#303843'),
  soil: makeRamp('#a57855', '#734c44', '#593e47', '#3d3333'),
  shrub: makeRamp('#a6b04f', '#819447', '#546756', '#2f4d2f'),
  rock: makeRamp('#bbc3d0', '#87857c', '#636663', '#3d3333'),
  snow: makeRamp('#f1f6f0', '#d5d6db', '#bbc3d0', '#6c81a1'),
  stoneWall: makeRamp('#d5d6db', '#bbc3d0', '#87857c', '#3d3333'),
  earthWall: makeRamp('#f2b888', '#a57855', '#734c44', '#3d3333'),
  timber: makeRamp('#a57855', '#734c44', '#593e47', '#3d3333'),
  hearthFire: makeRamp('#fdd179', '#de9f47', '#b55945', '#3d3333'),
} as const;

export const PALETTE_LIMITED_MOUNTAINHOME = {
  ...PALETTE_LIMITED_CLASSIC,
  sand: makeRamp('#fee1b8', '#bcad9f', '#87857c', '#636663'),
  grass: makeRamp('#89a477', '#546756', '#2f4d2f', '#303843'),
  shrub: makeRamp('#a6b04f', '#819447', '#44702d', '#2f4d2f'),
  soil: makeRamp('#7a5859', '#593e47', '#3d3333', '#303843'),
  rock: makeRamp('#96a9c1', '#6c81a1', '#405273', '#303843'),
} as const;

export const PALETTE_LIMITED_WILDS = {
  ...PALETTE_LIMITED_CLASSIC,
  deepWater: makeRamp('#405273', '#303843', '#303843', '#3d3333'),
  shallowWater: makeRamp('#96a9c1', '#6c81a1', '#405273', '#303843'),
  sand: makeRamp('#d4c692', '#bcad9f', '#87857c', '#593e47'),
  grass: makeRamp('#a6b04f', '#819447', '#546756', '#2f4d2f'),
  shrub: makeRamp('#d4c692', '#a6b04f', '#819447', '#546756'),
  soil: makeRamp('#7a5859', '#593e47', '#3d3333', '#303843'),
  rock: makeRamp('#bcad9f', '#87857c', '#636663', '#3d3333'),
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
