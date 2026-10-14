import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StrokeSettling } from '../../src/settling.js';

const simulationTimes = new WeakMap();

function gesture(speed, fps = 120) {
  const settling = new StrokeSettling();
  const dt = 1 / fps;
  for (let frame = 0; frame <= fps; frame++) {
    const seconds = frame / fps;
    settling.move(seconds * speed, 0, seconds * 1000);
    settling.step(seconds * 1000, dt, .85);
  }
  return settling;
}

function release(settling, seconds, fps = 120) {
  const start = simulationTimes.get(settling) ?? settling.lastMove;
  for (let frame = 1; frame <= Math.round(seconds * fps); frame++) settling.step(start + frame / fps * 1000, 1 / fps, .85);
  simulationTimes.set(settling, start + seconds * 1000);
  return settling;
}

test('a fast stroke retains its tail while forming a sphere, then fully settles', () => {
  const settling = release(gesture(9), 1.2);
  assert.ok(settling.morph > .55, 'the shape should still be gathering after an abrupt stop');
  assert.ok(settling.trailTime - settling.lastMove < 340, 'the history clock must not consume the entire 1.2 second tail');
  release(settling, 6);
  assert.ok(settling.morph < .02, 'the remaining shape must eventually settle into a sphere');
});

test('a quick gesture carries more settling inertia than a slow gesture', () => {
  const fast = release(gesture(9), 1.5);
  const slow = release(gesture(.3), 1.5);
  assert.ok(fast.morph > slow.morph + .15);
});

test('resuming the stroke preserves the current shape and morph velocity', () => {
  const settling = release(gesture(9), 1);
  const before = { morph: settling.morph, velocity: settling.velocity };
  settling.move(9.1, .1, 2010);
  assert.equal(settling.morph, before.morph);
  assert.equal(settling.velocity, before.velocity);
  settling.step(2020, .01, .85);
  assert.ok(Math.abs(settling.morph - before.morph) < .03);
});

test('settling has consistent timing at different display refresh rates', () => {
  const at60 = release(gesture(9, 60), 2, 60);
  const at120 = release(gesture(9, 120), 2, 120);
  assert.ok(Math.abs(at60.morph - at120.morph) < .015);
});
