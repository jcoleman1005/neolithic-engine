import './style.css';
import { SimulationClient } from './ui/simulation-client';
import { CanvasRenderer } from './render/renderer';
import { MetricsView } from './ui/metrics-view';
import { PlaybackPill, SettingsView } from './ui/controls';
import { InspectorView } from './ui/inspector';
import { HistoryView } from './ui/history-view';
import { BottomSheet } from './ui/sheet';
import { LEGEND_HTML } from './ui/legend';
import { eventListHTML, latestEventHTML } from './ui/events-view';
import { AutoCamera } from './ui/auto-camera';
import { seasonName } from './sim/seasons';
import { awayHTML, readLastSeen, summariseAway, writeLastSeen } from './ui/away-view';
import { APP_VERSION, APP_CODENAME } from './version';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Could not find the #app element.');
}

const GEAR_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h4c.2 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>';

app.innerHTML = `
  <main class="app">
    <section class="stage" aria-label="World">
      <canvas id="sim-canvas" aria-label="The world."></canvas>
      <div id="playback" class="playback-pill" role="group" aria-label="Playback"></div>
      <div class="away-card" role="dialog" aria-label="While you were away" hidden></div>
      <div class="notice" role="status" hidden>
        <span class="notice-text"></span>
        <button type="button" class="notice-close" aria-label="Dismiss">✕</button>
      </div>
    </section>

    <aside class="sheet" data-tab="stats" aria-label="Details">
      <div class="sheet-header">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-peek" role="button" tabindex="0" aria-expanded="false" aria-label="Show details">
          <div class="peek-row">
            <span class="peek-pop">0 alive</span>
            <span class="peek-year">Year 0</span>
            <button type="button" class="round-btn btn-settings" aria-label="Settings">${GEAR_ICON}</button>
          </div>
          <div class="peek-event" aria-live="polite"></div>
        </div>
        <nav class="sheet-tabs" role="tablist">
          <button type="button" role="tab" data-tab="stats" class="active" aria-selected="true">Stats</button>
          <button type="button" role="tab" data-tab="trends" aria-selected="false">Trends</button>
          <button type="button" role="tab" data-tab="inspector" aria-selected="false">Inspector</button>
        </nav>
        <button type="button" class="round-btn btn-collapse-sheet" aria-label="Toggle details panel" title="Toggle details panel">
          <span class="collapse-icon" aria-hidden="true">▾</span>
        </button>
      </div>
      <div class="sheet-body">
        <section class="tab-panel" data-panel="stats">
          <section id="metrics-container" class="metrics-section" aria-label="Simulation metrics"></section>
          <div class="stats-columns">
            <div class="stats-col">
              <h3 class="panel-heading">Recent events</h3>
              <div id="events-container"></div>
            </div>
            <div class="stats-col stats-col-legend">
              ${LEGEND_HTML}
              <div class="stats-version-info">Neolithic Engine <strong>v${APP_VERSION}</strong> · ${APP_CODENAME}</div>
            </div>
          </div>
        </section>
        <section class="tab-panel" data-panel="trends" id="history-container" aria-label="Trends over time"></section>
        <section class="tab-panel" data-panel="inspector" id="inspector-container"></section>
      </div>
    </aside>

    <div class="settings-overlay" hidden>
      <div class="settings-backdrop"></div>
      <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <h2 id="settings-title">Settings <span class="settings-version-tag">v${APP_VERSION}</span></h2>
          <button type="button" class="round-btn settings-close" aria-label="Close settings">✕</button>
        </header>
        <div id="settings-container" class="settings-body"></div>
      </div>
    </div>
  </main>
`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>('#sim-canvas');
const sheetEl = $('.sheet');
const notice = $('.notice');
const noticeText = $('.notice-text');
const peekPop = $('.peek-pop');
const peekYear = $('.peek-year');
const peekEvent = $('.peek-event');
const eventsContainer = $('#events-container');
// Tap a chronicle entry (ticker or list) to glide the camera to where it happened.
for (const el of [peekEvent, eventsContainer]) {
  el.addEventListener('click', (ev) => {
    const hit = (ev.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (!hit) return;
    ev.stopPropagation();
    renderer.goTo(parseFloat(hit.dataset.x ?? '0'), parseFloat(hit.dataset.y ?? '0'));
  });
}

function showNotice(msg: string): void {
  noticeText.textContent = msg;
  notice.hidden = false;
}

$('.notice-close')?.addEventListener('click', () => {
  notice.hidden = true;
});

let isRunning = false;

const awayCard = $('.away-card');
const storage = ((): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const seenOnArrival = readLastSeen(storage);
let awayChecked = false;
let lastSeenWrite = 0;

function checkAway(): void {
  if (awayChecked) return;
  awayChecked = true;
  const summary = summariseAway(sim.worldEvents, seenOnArrival, sim.config.ticksPerYear || 360);
  if (!summary) return;
  awayCard.innerHTML = awayHTML(summary);
  awayCard.hidden = false;
  awayCard.querySelector('.away-close')?.addEventListener('click', () => {
    awayCard.hidden = true;
  });
}

function rememberSeen(): void {
  const now = performance.now();
  if (!awayChecked || now - lastSeenWrite < 2000) return;
  const last = sim.worldEvents[sim.worldEvents.length - 1];
  if (!last) return;
  lastSeenWrite = now;
  writeLastSeen(storage, { seq: last.seq, tick: last.tick });
}

const sim: SimulationClient = new SimulationClient({
  beforeFrame: () => renderer.frameStart(),
  frame: () => {
    onFrame();
    renderer.frameDone();
  },
  reset: () => {
    checkAway();
    isRunning = false;
    pill.update(false, sim.ticksPerSecond);
    renderer.resize();
    renderer.render();
    refreshPanels();
  },
  events: (fresh) => {
    const now = performance.now();
    camera.notifyEvents(
      fresh.flatMap((e) => (e.kind === 'chronicle' ? [{ seq: e.seq, priority: e.priority, x: e.x, y: e.y, band: e.band }] : [])),
      now
    );
    refreshPanels();
  },
  error: (msg) => showNotice(msg),
  config: () => refreshPanels(),
  connection: (connected) => {
    if (connected) notice.hidden = true;
    else showNotice('Lost connection to server; reconnecting…');
  },
});

const renderer = new CanvasRenderer(canvas, sim);

const camera = new AutoCamera();
renderer.onUserInput = () => camera.notifyUserInput(performance.now());

const metricsView = new MetricsView($('#metrics-container'));
const inspectorView = new InspectorView($('#inspector-container'), {
  onSelectPerson: (id) => {
    renderer.selectedSlot = id !== null ? (id > 65535 ? id >> 12 : id) : null;
    sim.select(id);
    refreshPanels();
  },
  onToggleFollow: () => {
    renderer.followSelected = !renderer.followSelected;
    refreshPanels();
  },
  isFollowing: () => renderer.followSelected,
});
const historyView = new HistoryView($('#history-container'));

renderer.onSelect = (slot) => {
  if (slot !== null) {
    sim.select(slot);
    sheet.show('inspector');
  } else {
    sim.select(null);
  }
  refreshPanels();
};

const pill = new PlaybackPill($('#playback'), {
  onPlayPause: () => {
    if (isRunning) sim.pause();
    else sim.play();
    isRunning = !isRunning;
    pill.update(isRunning, sim.ticksPerSecond);
  },
  onStep: () => {
    sim.step();
  },
  onSpeedChange: (speed) => {
    sim.setSpeed(speed * 3);
  },
  onColorModeChange: (mode) => {
    renderer.colorMode = mode;
  },
  onAutoCameraChange: (on) => {
    camera.enabled = on;
    if (!on) renderer.setCameraTarget(null);
  },
});

const sheet = new BottomSheet(sheetEl, () => {
  layout();
  refreshPanels();
});

const settingsOverlay = $('.settings-overlay');
$('.btn-settings').addEventListener('click', () => {
  settingsOverlay.hidden = false;
});
$('.settings-close').addEventListener('click', () => {
  settingsOverlay.hidden = true;
});
$('.settings-backdrop').addEventListener('click', () => {
  settingsOverlay.hidden = true;
});

new SettingsView($('#settings-container'), {
  onReset: (seed) => {
    sim.reset(seed);
    settingsOverlay.hidden = true;
  },
  onNewSeed: () => {
    const seed = Math.floor(Math.random() * 1000000);
    sim.reset(seed);
    settingsOverlay.hidden = true;
  },
  onSaveFile: () => {
    void sim.save().then((saved) => {
      const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neolithic-world-tick-${saved.world.tick}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  },
  onLoadFile: (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        sim.load(parsed);
        settingsOverlay.hidden = true;
      } catch (err) {
        showNotice(`Failed to load file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  },
  onConfigChange: (cfg) => {
    sim.setConfig(cfg);
  },
}, sim.config);

function driveCamera(): void {
  const now = performance.now();
  const c = sim.config;
  camera.configure({
    holdMs: (c.cameraHoldSeconds ?? 30) * 1000,
    resumeMs: (c.cameraResumeSeconds ?? 20) * 1000,
    driftCellsPerSecond: c.cameraDriftCellsPerSecond ?? 0.6,
    minBandSize: c.cameraMinBandSize ?? 20,
  });
  // Following a chosen person is the viewer's own choice; leave it alone.
  if (renderer.followSelected) camera.notifyUserInput(now);
  const target = camera.update(now, sim.bands);
  renderer.setCameraTarget(target);
}
setInterval(driveCamera, 250);

function onFrame(): void {
  rememberSeen();
  isRunning = sim.running;
  pill.update(sim.running, sim.ticksPerSecond);
  pill.showServerSpeed(sim.targetTicksPerSecond);
  const m = sim.getMetrics();
  if (m) {
    peekPop.textContent = `${m.population} alive`;
    peekYear.textContent = `Year ${m.year} · ${seasonName(m.tick, sim.config)}`;
  }
  peekEvent.innerHTML = latestEventHTML(sim.worldEvents);
  refreshPanels();
}

function refreshPanels(): void {
  const m = sim.getMetrics();
  if (m) metricsView.render(m);
  eventsContainer.innerHTML = `<ul class="event-list">${eventListHTML(sim.worldEvents, sim.config.ticksPerYear || 360)}</ul>`;
  inspectorView.render(sim.config, sim.selectedPerson, renderer.selectedSlot, sim.selectedStory);
  historyView.render(sim.getHistorySamples());
}

function layout(): void {
  renderer.setInsets({
    top: 0,
    bottom: sheet.isOpen() ? sheet.peekHeight() : 0,
    left: 0,
    right: 0,
  });
  renderer.render();
}

window.addEventListener('resize', () => layout());

layout();
refreshPanels();
renderer.render();
