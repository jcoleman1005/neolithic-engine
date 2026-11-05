import { DEFAULT_CONFIG } from '../src/sim/config';

export type Override = number | boolean;

/**
 * Parses `--name value` pairs for the headless tools. `named` lists the tool's own options; every
 * other flag must be a real config key. Fails loudly, because a silently ignored switch makes an
 * off run look like an on run.
 */
export function parseArgs(
  argv: readonly string[],
  named: readonly string[],
  configKeys: readonly string[] = Object.keys(DEFAULT_CONFIG)
): { named: Record<string, string>; overrides: Record<string, Override> } {
  const args = argv.filter((a) => a !== '--');
  const out: Record<string, string> = {};
  const overrides: Record<string, Override> = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!flag.startsWith('--') || /\s/.test(flag)) {
      throw new Error(`Expected --name value, got "${flag}". In zsh, type flags out: an unquoted $VAR is not split.`);
    }
    const key = flag.slice(2);
    if (i + 1 >= args.length) throw new Error(`${flag} has no value`);
    const value = args[i + 1];
    if (named.includes(key)) {
      out[key] = value;
    } else if (configKeys.includes(key)) {
      overrides[key] = parseOverride(key, value);
    } else {
      throw new Error(`Unknown option or config key: ${flag}`);
    }
  }
  return { named: out, overrides };
}

/** Switches are tested with `!== false`, so a plain 0 would leave one on: treat 0 and 1 as booleans. */
function parseOverride(key: string, value: string): Override {
  if (value === 'true' || value === 'false') return value === 'true';
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n)) throw new Error(`--${key} needs a number or true/false, got "${value}"`);
  if (key.endsWith('Enabled')) {
    if (n === 0 || n === 1) return n === 1;
    throw new Error(`--${key} is a switch: use true or false, got "${value}"`);
  }
  return n;
}
