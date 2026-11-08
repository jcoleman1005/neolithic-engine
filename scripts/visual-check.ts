/**
 * Autonomous visual check: drives the real app in headless Chromium through a fixed scenario, saves
 * screenshots to visual/out/, and compares each against visual/baseline/.
 *
 *   npm run visual                      compare against the baselines (exit 1 on any failure)
 *   npm run visual -- --update true     rewrite the baselines from this run (only if nothing else failed)
 *
 * What it does:
 *   1. builds (or reuses) a saved world of a fixed seed, 3 ticks before its first band split
 *      (scripts/visual-snapshot.ts), so the split is the same one every run;
 *   2. starts the vite dev server and opens the app at ?capture, with Playwright's fake clock, so
 *      every animation and every camera timer is a function of the scripted time;
 *   3. resets to the fixed seed, then zooms with the mouse wheel, pans with a mouse drag, and visits
 *      the cliffs and the shoreline the elevation data says are best (src/ui/capture-hook.ts);
 *   4. loads the pre-split world, turns the auto-camera (Phase 4c) on, lets it settle on a band,
 *      steps the sim until the split entry appears, and records the camera cutting to it.
 *
 * It fails when a frame is blank or mostly empty, when it differs from its baseline by more than the
 * tolerance, when the camera is not where it should be, jumps, or cuts to the wrong event, and when
 * the page logs an error. Screenshots show the world view only (the DOM chrome is hidden), so text
 * rendering on another machine does not move the pixels; pass --ui true to keep it.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';
import { parseArgs } from './args';
import { decodePng, encodePngRgba } from './png';
import { blankProblems, DEFAULT_BLANK_LIMITS, DEFAULT_DIFF, diffFrames, frameStats, type BlankLimits, type FrameStats } from './visual-lib';
import { LEAD_TICKS, splitSnapshot, type SplitSnapshot } from './visual-snapshot';

const VIEWPORT = { width: 1280, height: 800 };
const CHROMIUM_FALLBACK = '/opt/pw-browsers/chromium';

// ---- what the page reports (src/ui/capture-hook.ts) ----

interface View {
  cellSize: number;
  panX: number;
  panY: number;
  centerX: number;
  centerY: number;
  /** Usable canvas size in px: the stage minus the sheet that covers part of it. */
  availW: number;
  availH: number;
  insetLeft: number;
  insetTop: number;
  gliding: boolean;
  target: { x: number; y: number } | null;
  canvasWidth: number;
  canvasHeight: number;
}
interface ChronicleEntry {
  seq: number;
  tick: number;
  type: string;
  priority: number;
  x: number;
  y: number;
  band: number;
  text: string;
}
interface Shot {
  kind: 'event' | 'band' | 'drift';
  priority: number;
  band: number;
}
interface PageState {
  seed: number;
  tick: number;
  running: boolean;
  population: number | null;
  terrainReady: boolean;
  bands: number;
  cameraEnabled: boolean;
  shot: Shot | null;
  chronicle: ChronicleEntry[];
}
interface Landmark {
  x: number;
  y: number;
  score: number;
}
interface Landmarks {
  cliff: Landmark | null;
  shore: Landmark | null;
  waterCells: number;
  cliffCells: number;
}
interface Sample {
  view: View;
  state: PageState;
}

// ---- results ----

interface ShotResult {
  name: string;
  file: string;
  /** What the check saw: facts to read next to the picture. */
  info: string[];
  /** Why this shot fails. */
  problems: string[];
  stats: FrameStats | null;
  diff: { fraction: number; differing: number; maxDelta: number; sizeMismatch: boolean } | null;
  status: 'pass' | 'fail' | 'new' | 'updated';
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function launch(): Promise<Browser> {
  const args = ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars'];
  const fromEnv = process.env.VISUAL_CHROMIUM;
  if (fromEnv) return chromium.launch({ executablePath: fromEnv, args });
  try {
    return await chromium.launch({ args });
  } catch (e) {
    if (existsSync(CHROMIUM_FALLBACK)) return chromium.launch({ executablePath: CHROMIUM_FALLBACK, args });
    throw new Error(
      `Playwright cannot start Chromium (${(e as Error).message.split('\n')[0]}). Run "npx playwright install chromium", or set VISUAL_CHROMIUM to a Chrome binary.`
    );
  }
}

class Check {
  public readonly results: ShotResult[] = [];
  public readonly pageErrors: string[] = [];
  private readonly out: string;
  private readonly baseline: string;
  private current: ShotResult | null = null;
  private styled = false;

  constructor(
    private readonly page: Page,
    private readonly opts: { update: boolean; tolerance: number; threshold: number; keepUi: boolean; seed: number },
    dirs: { out: string; baseline: string }
  ) {
    this.out = dirs.out;
    this.baseline = dirs.baseline;
  }

  // ---- talking to the page ----

  public async state(): Promise<PageState> {
    return (await this.page.evaluate('window.__capture.state()')) as PageState;
  }
  public async view(): Promise<View> {
    return (await this.page.evaluate('window.__capture.view()')) as View;
  }
  public async sample(): Promise<Sample> {
    return (await this.page.evaluate('({ view: window.__capture.view(), state: window.__capture.state() })')) as Sample;
  }
  /** Moves the fake clock on; the page renders and the camera ticks as it goes. */
  public async run(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
  }
  /** Polls the page in real time (the fake clock is frozen, so page-side timers would never fire). */
  public async until(what: string, cond: () => Promise<boolean>, timeoutMs = 30000): Promise<void> {
    const t0 = Date.now();
    while (!(await cond())) {
      if (Date.now() - t0 > timeoutMs) throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for ${what}`);
      await sleep(50);
    }
  }

  /** Advances fake time in small steps, sampling the view, until `done` or `maxMs` have passed. */
  public async watch(done: (s: Sample) => boolean, maxMs: number, stepMs = 100): Promise<Sample[]> {
    const samples: Sample[] = [await this.sample()];
    for (let t = 0; t < maxMs && !done(samples[samples.length - 1]); t += stepMs) {
      await this.run(stepMs);
      samples.push(await this.sample());
    }
    return samples;
  }

  /**
   * Lets the view come to rest: runs until it has not moved for half a second (a goTo glide and the
   * auto-camera's own glide both count), then a little longer. Fails if it never rests.
   */
  public async settle(maxMs = 30000): Promise<Sample[]> {
    const samples: Sample[] = [await this.sample()];
    const resting = (): boolean => {
      if (samples.length < 6) return false;
      const last = samples.slice(-6);
      return last.every((s) => !s.view.gliding && s.view.panX === last[0].view.panX && s.view.panY === last[0].view.panY);
    };
    for (let t = 0; t < maxMs && !resting(); t += 100) {
      await this.run(100);
      samples.push(await this.sample());
    }
    if (!resting()) throw new Error(`The view was still moving after ${maxMs / 1000}s of scripted time`);
    await this.run(500);
    return samples;
  }

  public async goTo(x: number, y: number): Promise<Sample[]> {
    await this.page.evaluate(`window.__capture.goTo(${x}, ${y})`);
    return this.settle();
  }

  // ---- wheel, drag, menu: the same inputs a person uses ----

  private async stageBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.page.locator('.stage').boundingBox();
    if (!box) throw new Error('The .stage element has no box');
    return box;
  }

  /** Wheel zoom about the middle of the world view, one step per notch, until the cell size is `cs`. */
  public async zoomTo(cs: number): Promise<void> {
    const box = await this.stageBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 20; i++) {
      const cur = (await this.view()).cellSize;
      if (cur === cs) return;
      await this.page.mouse.wheel(0, cur < cs ? -100 : 100);
      await this.run(100);
    }
    throw new Error(`Could not zoom to cell size ${cs}; stuck at ${(await this.view()).cellSize}`);
  }

  public async drag(dx: number, dy: number): Promise<void> {
    const box = await this.stageBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 10 });
    await this.page.mouse.up();
    await this.run(300);
  }

  private async openMenu(): Promise<void> {
    if ((await this.page.locator('#pill-menu').getAttribute('hidden')) !== null) {
      await this.page.locator('#btn-pill-menu').click();
      await this.run(50);
    }
  }
  public async setTerrain(theme: 'classic' | 'mountainhome' | 'wilds'): Promise<void> {
    await this.openMenu();
    await this.page.locator('#select-terrain-style').selectOption(theme);
    await this.run(500);
  }
  public async setAutoCamera(on: boolean): Promise<void> {
    await this.openMenu();
    const btn = this.page.locator('#btn-auto-camera');
    if (((await btn.getAttribute('aria-pressed')) === 'true') !== on) await btn.click();
    await this.run(50);
  }
  /** Closes the pill menu by clicking outside it, on the sheet header (not on the canvas: that would count as camera input). */
  public async closeMenu(): Promise<void> {
    if ((await this.page.locator('#pill-menu').getAttribute('hidden')) === null) {
      await this.page.locator('#btn-pill-menu').click();
      await this.run(50);
    }
  }

  // ---- shots ----

  /**
   * Where the middle of the usable view should be for a target. This follows what is drawn: the pan
   * is clamped so the world stays inside the whole canvas (render()), while the middle is measured
   * in the area left by the sheet. A world smaller than the canvas is centred in it.
   */
  public expectedCenter(v: View, target: { x: number; y: number }): { x: number; y: number } {
    const axis = (t: number, canvasPx: number, insetPx: number, availPx: number): number => {
      const worldPx = 256 * v.cellSize;
      const want = insetPx + availPx / 2 - t * v.cellSize;
      const pan = worldPx <= canvasPx ? Math.round((canvasPx - worldPx) / 2) : Math.min(0, Math.max(canvasPx - worldPx, want));
      return (insetPx + availPx / 2 - pan) / v.cellSize;
    };
    return { x: axis(target.x, v.canvasWidth, v.insetLeft, v.availW), y: axis(target.y, v.canvasHeight, v.insetTop, v.availH) };
  }

  public begin(name: string): ShotResult {
    const r: ShotResult = { name, file: join(this.out, `${name}.png`), info: [], problems: [], stats: null, diff: null, status: 'pass' };
    this.current = r;
    return r;
  }

  /** Records a failed expectation on the current shot. */
  public expect(ok: boolean, problem: string): void {
    if (!ok) this.current!.problems.push(problem);
  }
  public note(text: string): void {
    this.current!.info.push(text);
  }

  /** Is the view centred where `target` says it should be? Records the answer on the current shot. */
  public async expectCentered(target: { x: number; y: number }, label: string, toleranceCells = 1): Promise<void> {
    const v = await this.view();
    const exp = this.expectedCenter(v, target);
    const off = Math.hypot(v.centerX - exp.x, v.centerY - exp.y);
    this.note(`view centre ${v.centerX.toFixed(1)},${v.centerY.toFixed(1)} at cell size ${v.cellSize}; ${label} ${target.x.toFixed(1)},${target.y.toFixed(1)}${exp.x !== target.x || exp.y !== target.y ? ` (clamped to ${exp.x.toFixed(1)},${exp.y.toFixed(1)} by the world edge)` : ''}`);
    this.expect(off <= toleranceCells, `the camera is ${off.toFixed(1)} cells from ${label} (allowed ${toleranceCells}); it should be at ${exp.x.toFixed(1)},${exp.y.toFixed(1)} but is at ${v.centerX.toFixed(1)},${v.centerY.toFixed(1)}`);
  }

  /** A glide must be a glide: no step may carry more than a fraction of the whole move. */
  public expectSmooth(samples: Sample[], label: string): void {
    if (samples.length < 2) return;
    const first = samples[0].view;
    const last = samples[samples.length - 1].view;
    const total = Math.hypot(last.panX - first.panX, last.panY - first.panY);
    let biggest = 0;
    for (let i = 1; i < samples.length; i++) {
      biggest = Math.max(biggest, Math.hypot(samples[i].view.panX - samples[i - 1].view.panX, samples[i].view.panY - samples[i - 1].view.panY));
    }
    this.note(`${label}: moved ${total.toFixed(0)} px over ${samples.length - 1} steps of 100 ms; largest single step ${biggest.toFixed(0)} px`);
    if (total > 40) this.expect(biggest <= 0.3 * total + 12, `${label} jumped: one 100 ms step moved ${biggest.toFixed(0)} px of a ${total.toFixed(0)} px move`);
  }

  /** The camera must hold still when nothing should move it. */
  public expectStill(samples: Sample[], label: string, maxCells: number): void {
    const a = samples[0].view;
    let worst = 0;
    for (const s of samples) worst = Math.max(worst, Math.hypot(s.view.centerX - a.centerX, s.view.centerY - a.centerY));
    this.note(`${label}: the view moved at most ${worst.toFixed(2)} cells`);
    this.expect(worst <= maxCells, `${label}: the view moved ${worst.toFixed(1)} cells (allowed ${maxCells}); the camera should have held`);
  }

  /** Takes the screenshot of the world view, checks it for blankness and against its baseline. */
  public async capture(blank: BlankLimits = DEFAULT_BLANK_LIMITS): Promise<ShotResult> {
    const r = this.current!;
    await this.run(100);
    if (!this.opts.keepUi) {
      if (!this.styled) {
        await this.page.addStyleTag({ content: '.vc-hide .playback-pill, .vc-hide .away-card, .vc-hide .notice { visibility: hidden !important; }' });
        this.styled = true;
      }
      await this.page.evaluate("document.documentElement.classList.add('vc-hide')");
    }
    const png = await this.page.locator(this.opts.keepUi ? 'body' : '.stage').screenshot({ animations: 'allow', caret: 'initial' });
    if (!this.opts.keepUi) await this.page.evaluate("document.documentElement.classList.remove('vc-hide')");
    writeFileSync(r.file, png);
    const frame = decodePng(png);
    r.stats = frameStats(frame);
    r.info.push(`${frame.width}x${frame.height}, ${r.stats.distinctColors} colours, ${(r.stats.dominantFraction * 100).toFixed(1)}% ${r.stats.dominantColor}, ${(r.stats.drawnFraction * 100).toFixed(0)}% drawn`);
    for (const p of blankProblems(r.stats, blank)) r.problems.push(`blank frame: ${p}`);

    const basePath = join(this.baseline, `${r.name}.png`);
    if (existsSync(basePath)) {
      const base = decodePng(readFileSync(basePath));
      const d = diffFrames(base, frame, { pixelThreshold: this.opts.threshold, tolerance: this.opts.tolerance });
      r.diff = { fraction: d.fraction, differing: d.differing, maxDelta: d.maxDelta, sizeMismatch: d.sizeMismatch };
      if (!d.pass) {
        r.problems.push(
          d.sizeMismatch
            ? `size changed from ${base.width}x${base.height} to ${frame.width}x${frame.height}`
            : `${(d.fraction * 100).toFixed(3)}% of pixels differ from the baseline (${d.differing} pixels, largest change ${d.maxDelta}; tolerance ${(this.opts.tolerance * 100).toFixed(3)}%)`
        );
        if (d.image) {
          mkdirSync(join(this.out, 'diff'), { recursive: true });
          writeFileSync(join(this.out, 'diff', `${r.name}.png`), encodePngRgba(d.image.width, d.image.height, d.image.rgba));
        }
      }
    }
    this.finish(r, existsSync(basePath));
    return r;
  }

  private finish(r: ShotResult, hadBaseline: boolean): void {
    if (r.problems.length > 0) r.status = 'fail';
    else if (!hadBaseline) {
      r.status = 'new';
      if (!this.opts.update) {
        r.status = 'fail';
        r.problems.push('no baseline yet (run: npm run visual -- --update true)');
      }
    }
    this.results.push(r);
    this.current = null;
  }

  public commitBaselines(): number {
    mkdirSync(this.baseline, { recursive: true });
    let n = 0;
    for (const r of this.results) {
      if (r.status === 'new' || (r.status === 'fail' && r.diff && r.problems.every((p) => p.includes('differ from the baseline') || p.startsWith('size changed')))) {
        copyFileSync(r.file, join(this.baseline, `${r.name}.png`));
        r.status = 'updated';
        n++;
      }
    }
    return n;
  }
}

// ---- the scenario ----

async function scenario(c: Check, page: Page, snap: SplitSnapshot, seed: number, log: (m: string) => void): Promise<void> {
  // Boot. The app starts on its default seed; resetting to the fixed seed is the same call as the Settings box.
  await c.until('the app to start', async () => {
    const s = (await page.evaluate('window.__capture ? window.__capture.state() : null')) as PageState | null;
    return !!s && s.terrainReady;
  });
  await page.clock.pauseAt(2000);
  await page.evaluate(`window.__capture.pause(); window.__capture.reset(${seed})`);
  await c.until(`seed ${seed} at tick 0`, async () => {
    const s = await c.state();
    return s.seed === seed && s.tick === 0 && s.terrainReady && s.population !== null && s.population > 0;
  });
  await c.run(1000);
  const lm = (await page.evaluate('window.__capture.landmarks()')) as Landmarks;
  if (!lm.cliff || !lm.shore) throw new Error(`Seed ${seed} has no ${!lm.cliff ? 'cliffs' : 'shoreline'} away from the world edge; pick another seed`);
  log(`seed ${seed}: ${lm.waterCells} water cells, ${lm.cliffCells} cliff cells; cliffs best at ${lm.cliff.x},${lm.cliff.y} (${lm.cliff.score} in view window), shore at ${lm.shore.x},${lm.shore.y} (${lm.shore.score})`);

  // 1. The whole world at the default zoom.
  c.begin('01-world-overview');
  const s0 = await c.state();
  c.note(`seed ${s0.seed}, tick ${s0.tick}, ${s0.population} people, ${lm.waterCells} water cells and ${lm.cliffCells} cliff cells in the world`);
  c.expect((await c.view()).cellSize === 3, `expected the default cell size 3, got ${(await c.view()).cellSize}`);
  // The world is smaller than the window at this zoom, so a fifth of the picture is void by design.
  await c.capture({ ...DEFAULT_BLANK_LIMITS, maxDominantFraction: 0.5 });

  // 2. Zoom in with the wheel and glide to the cliffs.
  c.begin('02-cliffs-zoom6');
  await c.zoomTo(6);
  const glide1 = await c.goTo(lm.cliff.x, lm.cliff.y);
  c.expectSmooth(glide1, 'glide to the cliffs');
  await c.expectCentered(lm.cliff, 'the cliffs');
  await c.capture();

  // 3. Pan with a drag: the view must move by exactly what the mouse moved.
  c.begin('03-pan-drag');
  const before = await c.view();
  await c.drag(160, 90);
  const after = await c.view();
  const moved = { x: after.panX - before.panX, y: after.panY - before.panY };
  c.note(`dragged the mouse by 160,90; the view moved by ${moved.x},${moved.y} px (pan ${before.panX},${before.panY} -> ${after.panX},${after.panY})`);
  c.expect(Math.abs(moved.x - 160) <= 1 && Math.abs(moved.y - 90) <= 1, `a drag of 160,90 moved the view by ${moved.x},${moved.y}`);
  c.expect(after.cellSize === before.cellSize, `the drag changed the zoom from ${before.cellSize} to ${after.cellSize}`);
  await c.capture();

  // 4. Close zoom on the cliffs.
  c.begin('04-cliffs-zoom16');
  await c.zoomTo(16);
  const glide2 = await c.goTo(lm.cliff.x, lm.cliff.y);
  c.expectSmooth(glide2, 'glide to the cliffs at close zoom');
  await c.expectCentered(lm.cliff, 'the cliffs');
  await c.capture();

  // 5. Close zoom on the shoreline.
  c.begin('05-water-shore-zoom16');
  const glide3 = await c.goTo(lm.shore.x, lm.shore.y);
  c.expectSmooth(glide3, 'glide to the shore');
  await c.expectCentered(lm.shore, 'the shoreline');
  await c.capture();

  // 6. The same cliffs in another terrain theme, chosen from the playback menu.
  c.begin('06-cliffs-mountainhome-zoom16');
  await c.setTerrain('mountainhome');
  await c.goTo(lm.cliff.x, lm.cliff.y);
  await c.closeMenu();
  await c.expectCentered(lm.cliff, 'the cliffs');
  await c.capture();
  await c.setTerrain('classic');
  await c.closeMenu();

  // 7 and 8. The auto-camera (Phase 4c) and the band split.
  log(`loading the world saved ${LEAD_TICKS} ticks before the split (tick ${snap.meta.savedTick}, split at ${snap.meta.splitTick}, ${snap.meta.x.toFixed(1)},${snap.meta.y.toFixed(1)})`);
  await c.zoomTo(6);
  await page.evaluate(`window.__capture.load(${JSON.stringify(snap.saved)})`);
  await c.until('the saved world', async () => {
    const s = await c.state();
    return s.tick === snap.meta.savedTick && s.terrainReady && s.bands > 0;
  });
  await c.setAutoCamera(true);
  await c.closeMenu();
  // The camera backs off for cameraResumeSeconds after the last wheel turn; wait that out, then let it arrive.
  await c.run(21000);
  await c.settle();

  c.begin('07-camera-band-focus');
  const focus = await c.sample();
  const shot = focus.state.shot;
  c.note(`auto-camera on; shot is ${shot ? `${shot.kind} (priority ${shot.priority}, band ${shot.band})` : 'none'}`);
  c.expect(shot?.kind === 'band', `the camera should be following the focus band before the split, but its shot is ${shot?.kind ?? 'none'}`);
  const bandViews = (await page.evaluate('window.__capture.bandViews()')) as { id: number; size: number; cx: number; cy: number }[];
  const watched = bandViews.find((b) => b.id === shot?.band);
  c.expect(!!watched, `the shot's band ${shot?.band} is not among the tracked bands`);
  if (watched) {
    c.note(`following band ${watched.id}: ${watched.size} people, centred at ${watched.cx.toFixed(1)},${watched.cy.toFixed(1)}`);
    await c.expectCentered({ x: watched.cx, y: watched.cy }, 'the band it follows', 2);
  }
  await c.capture();

  // The split arrives. The camera is mid-shot, so it must not move until the hold is up.
  await page.evaluate(`window.__capture.step(${LEAD_TICKS})`);
  await c.until('the split entry', async () => (await c.state()).chronicle.some((e) => e.type === 'split'));
  const arrived = await c.state();
  const split = arrived.chronicle.filter((e) => e.type === 'split').pop()!;
  const holdWatch = await c.watch(() => false, 5000, 250);
  const heldShot = (await c.state()).shot;

  c.begin('08-camera-split-cut');
  c.note(`sim at tick ${arrived.tick}; chronicle entry #${split.seq} at tick ${split.tick}: "${split.text}" (type ${split.type}, priority ${split.priority}, band ${split.band}) at ${split.x.toFixed(1)},${split.y.toFixed(1)}`);
  c.expect(split.tick === snap.meta.splitTick, `the split came at tick ${split.tick}, expected ${snap.meta.splitTick}`);
  c.expect(Math.abs(split.x - snap.meta.x) < 0.01 && Math.abs(split.y - snap.meta.y) < 0.01, `the split is at ${split.x},${split.y}, expected ${snap.meta.x},${snap.meta.y}`);
  const otherPriority = arrived.chronicle.filter((e) => e.priority > 0 && e.seq !== split.seq);
  c.expect(otherPriority.length === 0, `another camera-worthy entry arrived with the split: ${otherPriority.map((e) => `${e.type} (priority ${e.priority})`).join(', ')}`);
  c.expect(heldShot?.kind === 'band', `five seconds after the split the camera should still be holding its band shot, but the shot is ${heldShot?.kind ?? 'none'}`);
  c.expectStill(holdWatch, 'while the shot was held', 3);

  // Hold is 30 s by default; run until the cut.
  const cutWatch = await c.watch((s) => s.state.shot?.kind === 'event', 60000);
  const cut = cutWatch[cutWatch.length - 1];
  c.expect(cut.state.shot?.kind === 'event', 'the camera never cut to the split within 60 s');
  c.note(`cut after ${((cutWatch.length - 1) * 0.1).toFixed(1)} s more; shot is now ${cut.state.shot ? `${cut.state.shot.kind} (priority ${cut.state.shot.priority}, band ${cut.state.shot.band})` : 'none'}`);
  c.expect(cut.state.shot?.priority === split.priority, `the camera cut to a priority ${cut.state.shot?.priority} shot; the split is priority ${split.priority}`);
  c.expect(cut.state.shot?.band === split.band, `the camera cut to band ${cut.state.shot?.band}, not the splitting band ${split.band}`);
  const glide = await c.settle();
  c.expectSmooth([...cutWatch.slice(-1), ...glide], 'glide to the split');
  await c.expectCentered({ x: split.x, y: split.y }, 'the split', 8);
  await c.capture();
}

// ---- main ----

async function main(): Promise<void> {
  const { named } = parseArgs(process.argv.slice(2), ['seed', 'update', 'tolerance', 'threshold', 'ui', 'port'], []);
  const seed = parseInt(named.seed ?? '4', 10);
  const update = named.update === 'true';
  const tolerance = parseFloat(named.tolerance ?? String(DEFAULT_DIFF.tolerance));
  const threshold = parseInt(named.threshold ?? String(DEFAULT_DIFF.pixelThreshold), 10);
  const keepUi = named.ui === 'true';
  const out = resolve('visual/out');
  const baseline = resolve('visual/baseline');
  const log = (m: string): void => console.log(`[visual] ${m}`);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(baseline, { recursive: true });

  const snap = splitSnapshot(seed, resolve('visual/.cache'), log);

  delete process.env.ALIFE_SERVER; // vite.config.ts would proxy /api to a live server
  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;
  let check: Check | null = null;
  let failure: string | null = null;
  try {
    server = await createServer({
      logLevel: 'warn',
      clearScreen: false,
      server: { host: '127.0.0.1', port: named.port ? parseInt(named.port, 10) : 5199, strictPort: false, hmr: false },
    });
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('The vite dev server gave no URL');
    log(`dev server at ${url}`);

    browser = await launch();
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    check = new Check(page, { update, tolerance, threshold, keepUi, seed }, { out, baseline });
    page.on('pageerror', (e) => check!.pageErrors.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) check!.pageErrors.push(`console error: ${m.text()}`);
    });
    await page.clock.install({ time: 0 });
    await page.goto(`${url}?capture`);
    await scenario(check, page, snap, seed, log);
  } catch (e) {
    failure = (e as Error).stack ?? String(e);
  } finally {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
  }

  if (!check) {
    console.error(failure);
    process.exit(1);
  }
  if (update && !failure && check.pageErrors.length === 0) {
    const n = check.commitBaselines();
    log(`wrote ${n} baseline${n === 1 ? '' : 's'} to ${baseline}`);
  }

  let failed = failure !== null || check.pageErrors.length > 0;
  console.log('');
  for (const r of check.results) {
    const diff = r.diff ? `diff ${(r.diff.fraction * 100).toFixed(3)}%` : 'no baseline';
    console.log(`${r.status.toUpperCase().padEnd(7)} ${r.name.padEnd(30)} ${diff}`);
    for (const i of r.info) console.log(`          ${i}`);
    for (const p of r.problems) console.log(`          PROBLEM: ${p}`);
    if (r.status === 'fail') failed = true;
  }
  if (failure) console.log(`\nSCENARIO STOPPED: ${failure}`);
  if (check.pageErrors.length > 0) console.log(`\nPAGE ERRORS:\n${[...new Set(check.pageErrors)].join('\n')}`);
  writeFileSync(join(out, 'report.json'), JSON.stringify({ seed, results: check.results, pageErrors: check.pageErrors, failure }, null, 2));
  const files = readdirSync(out).filter((f) => f.endsWith('.png'));
  console.log(`\n${files.length} screenshots in ${out}`);
  console.log(failed ? 'visual-check FAILED' : `visual-check passed (${check.results.length} shots)`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
