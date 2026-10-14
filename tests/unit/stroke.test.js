import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { StrokeTrail } from '../../src/stroke.js';

test('a brush stroke retains both arms of a corner instead of a straight chord', () => {
  const trail = new StrokeTrail();
  trail.add(-1, 0, 0);
  trail.add(0, 0, 500);
  trail.add(0, 1, 1000);
  assert.deepEqual(trail.sample(250, new Vector3()).toArray(), [-.5, 0, 0]);
  assert.deepEqual(trail.sample(750, new Vector3()).toArray(), [0, .5, 0]);
  assert.deepEqual(trail.sample(1500, new Vector3()).toArray(), [0, 1, 0]);
});

test('a new gesture after rest does not draw a bridge to the previous stroke', () => {
  const trail = new StrokeTrail();
  trail.add(-1, 0, 0);
  trail.add(1, 1, 2500);
  assert.deepEqual(trail.sample(2000, new Vector3()).toArray(), [1, 1, 0]);
});

test('long continuous gestures retain a bounded recent history', () => {
  const trail = new StrokeTrail();
  for (let time = 0; time < 60000; time += 5) trail.add(time / 60000, 0, time);
  assert.ok(trail.points.length < 512);
  assert.ok(trail.points[0].time >= 57985);
  assert.equal(trail.sample(59995, new Vector3()).x, 59995 / 60000);
});
