import { describe, expect, it } from 'vitest';
import { AutoCamera, DEFAULT_CAMERA_SETTINGS, type CameraBand, type CameraEvent } from '../src/ui/auto-camera';

const S = 1000;
const band = (id: number, foundedTick: number, size = 50, cx = id, cy = id): CameraBand => ({ id, size, cx, cy, foundedTick });
const event = (seq: number, priority: number, x = 200, y = 200, b = 0): CameraEvent => ({ seq, priority, x, y, band: b });

describe('Phase 4 auto-camera', () => {
  it('follows the oldest large band and ignores small ones', () => {
    const cam = new AutoCamera();
    const t = cam.update(0, [band(1, 500), band(2, 100), band(3, 10, 5)]);
    expect(t).toMatchObject({ kind: 'band', x: 2, y: 2 });
  });

  it('sticks with its focus band even when an older band appears', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 500)]);
    const t = cam.update(40 * S, [band(1, 500), band(2, 100)]);
    expect(t).toMatchObject({ kind: 'band', x: 1, y: 1 });
  });

  it('switches at once when the focus band dies, without waiting out the hold', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 100), band(2, 200)]);
    const t = cam.update(1 * S, [band(2, 200)]);
    expect(t).toMatchObject({ kind: 'band', x: 2, y: 2 });
  });

  it('cuts to an event straight away when nothing is being watched', () => {
    const cam = new AutoCamera();
    cam.notifyEvents([event(1, 4, 90, 40)], 0);
    expect(cam.update(0, [])).toMatchObject({ kind: 'event', x: 90, y: 40 });
  });

  it('holds a shot for at least 30 seconds before a higher-priority event takes over', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 100)]);
    cam.notifyEvents([event(1, 4, 90, 40)], 5 * S);
    expect(cam.update(10 * S, [band(1, 100)]).kind).toBe('band');
    expect(cam.update(29 * S, [band(1, 100)]).kind).toBe('band');
    expect(cam.update(30 * S, [band(1, 100)])).toMatchObject({ kind: 'event', x: 90, y: 40 });
  });

  it('a lower-priority event cannot cut an event shot; the highest priority waits its turn', () => {
    const cam = new AutoCamera();
    cam.notifyEvents([event(1, 2, 50, 50)], 0);
    cam.update(0, []);
    cam.notifyEvents([event(2, 1, 10, 10), event(3, 4, 150, 150)], 5 * S);
    expect(cam.update(20 * S, [])).toMatchObject({ kind: 'event', x: 50, y: 50 });
    expect(cam.update(31 * S, [])).toMatchObject({ kind: 'event', x: 150, y: 150 });
  });

  it('picks battles over splits over leader deaths over migrations', () => {
    const cam = new AutoCamera();
    cam.notifyEvents([event(1, 1, 1, 1), event(2, 2, 2, 2), event(3, 4, 4, 4), event(4, 3, 3, 3)], 0);
    expect(cam.update(0, [])).toMatchObject({ x: 4, y: 4 });
  });

  it('famine and boom (priority 0) never move the camera', () => {
    const cam = new AutoCamera();
    cam.notifyEvents([event(1, 0, -1, -1)], 0);
    expect(cam.update(0, [band(1, 10)])).toMatchObject({ kind: 'band' });
    expect(cam.update(60 * S, [band(1, 10)])).toMatchObject({ kind: 'band' });
  });

  it('returns to the focus band when an event shot has run its hold', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 100)]);
    cam.notifyEvents([event(1, 3, 90, 40)], 0);
    expect(cam.update(30 * S, [band(1, 100)]).kind).toBe('event');
    expect(cam.update(61 * S, [band(1, 100)]).kind).toBe('band');
  });

  it('drifts slowly when there is nothing to look at', () => {
    const cam = new AutoCamera();
    const a = cam.update(0, [])!;
    const b = cam.update(1000, [])!;
    const moved = Math.hypot(b.x - a.x, b.y - a.y);
    expect(a.kind).toBe('drift');
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(DEFAULT_CAMERA_SETTINGS.driftCellsPerSecond * 1.01);
  });

  it('backs off for 20 seconds after manual input, then resumes', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 100)]);
    cam.notifyUserInput(10 * S);
    expect(cam.update(15 * S, [band(1, 100)])).toBeNull();
    expect(cam.update(29 * S, [band(1, 100)])).toBeNull();
    expect(cam.update(30 * S, [band(1, 100)])).not.toBeNull();
  });

  it('does nothing when switched off', () => {
    const cam = new AutoCamera();
    cam.enabled = false;
    expect(cam.update(0, [band(1, 100)])).toBeNull();
  });

  it('drops events that have gone stale', () => {
    const cam = new AutoCamera();
    cam.update(0, [band(1, 100)]);
    cam.notifyEvents([event(1, 4, 90, 40)], 0);
    // Held band shot until 30 s; the event is 100 s old by the time anything is checked.
    cam.configure({ holdMs: 100 * S });
    expect(cam.update(99 * S, [band(1, 100)]).kind).toBe('band');
    expect(cam.update(101 * S, [band(1, 100)]).kind).toBe('band');
  });
});
