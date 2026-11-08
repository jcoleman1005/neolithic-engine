/**
 * Screenshots of the real renderer at chosen zooms, on desktop and phone widths.
 *
 *   npm run map -- --seed 1 --years 20 --save scratch/w/world.json   (prints the largest cluster's x,y)
 *   PLAYWRIGHT_DIR=/path/to/throwaway npm run capture -- --world scratch/w/world.json --at 120,80 --out scratch/shots
 *
 * Playwright is a dev dependency now; PLAYWRIGHT_DIR still works and takes precedence if set. The
 * server runs paused on a scratch copy of the world, never the default data folder. For repeatable
 * screenshots and baselines see scripts/visual-check.ts.
 */
import { spawn, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { parseArgs } from './args';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 360, height: 740 },
] as const;

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await wait(200);
  }
  throw new Error(`Server did not answer at ${url}`);
}

async function main(): Promise<void> {
  const { named } = parseArgs(process.argv.slice(2), ['world', 'at', 'out', 'zooms', 'port'], []);
  if (!named.world || !named.at) throw new Error('usage: --world <world.json> --at x,y [--out dir] [--zooms 3,6,12,20] [--port 8097]');
  const pwDir = process.env.PLAYWRIGHT_DIR;
  let chromium;
  if (pwDir) {
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(pwDir, 'browsers');
    ({ chromium } = createRequire(join(resolve(pwDir), 'package.json'))('playwright'));
  } else {
    ({ chromium } = await import('playwright'));
  }
  const executablePath = process.env.VISUAL_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

  const [x, y] = named.at.split(',').map(Number);
  const zooms = (named.zooms ?? '3,6,12,20').split(',').map(Number);
  const port = named.port ?? '8097';
  const out = resolve(named.out ?? 'scratch/shots');
  const data = join(out, 'data');
  if (data === resolve('data')) throw new Error('Refusing to use the default data folder');
  mkdirSync(data, { recursive: true });
  copyFileSync(named.world, join(data, 'world.json'));
  writeFileSync(join(data, 'playback.json'), JSON.stringify({ running: false, ticksPerSecond: 3 }));

  execSync('npm run -s build && npm run -s build:server', { stdio: 'ignore' });
  const server = spawn('node', ['dist-server/main.js', '--port', port, '--host', '127.0.0.1', '--data', data], { stdio: 'ignore' });
  const errors: string[] = [];
  const browser = await chromium.launch(executablePath && !pwDir ? { executablePath } : {});
  try {
    const url = `http://127.0.0.1:${port}/`;
    await waitForServer(url);
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      page.on('pageerror', (e: Error) => errors.push(`${vp.name}: ${e.message}`));
      page.on('console', (m: { type(): string; text(): string }) => {
        if (m.type() === 'error') errors.push(`${vp.name}: ${m.text()}`);
      });
      await page.goto(`${url}?capture`);
      // Strings, because these run in the page and this file is type-checked for Node.
      await page.waitForFunction('/[1-9][\\d,]* alive/.test(document.body.innerText)', undefined, { timeout: 60000 });
      const box = await page.locator('canvas').first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
      for (const zoom of zooms) {
        const cellSize = (): Promise<number> => page.evaluate('window.__capture.cellSize()');
        for (let i = 0; i < 16 && (await cellSize()) !== zoom; i++) {
          await page.mouse.wheel(0, (await cellSize()) < zoom ? -100 : 100);
          await wait(80);
        }
        const got = await cellSize();
        if (got !== zoom) errors.push(`${vp.name}: wanted cell size ${zoom}, got ${got}`);
        await page.evaluate(`window.__capture.goTo(${x}, ${y})`);
        await wait(1500);
        const path = join(out, `${vp.name}-cs${got}.png`);
        await page.screenshot({ path });
        console.log(path);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(errors.length ? `Page errors:\n${[...new Set(errors)].join('\n')}` : 'No page errors');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
