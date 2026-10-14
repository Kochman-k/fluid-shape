import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { RibbonFlow } from '../../src/flow.js';

function movingRibbon(fps = 120) {
  const flow = new RibbonFlow(12);
  const targets = Array.from({ length: 12 }, (_, i) => new Vector3(-i * .1, 0, 0));
  flow.step(targets, 0, .85, 0, 1);
  for (let frame = 1; frame <= fps; frame++) {
    targets.forEach((target, i) => target.set(frame / fps * 2 - i * .1, 0, 0));
    flow.step(targets, 1 / fps, .85, 0, 1);
  }
  return { flow, targets };
}

test('the brush tip responds ahead of the trailing sections', () => {
  const { flow, targets } = movingRibbon();
  assert.ok(targets[0].distanceTo(flow.points[0]) < targets.at(-1).distanceTo(flow.points.at(-1)) * .7);
});

test('the tail continues drifting after a sudden stop, then loses speed', () => {
  const { flow, targets } = movingRibbon();
  const before = flow.points.at(-1).clone();
  for (let frame = 1; frame <= 60; frame++) flow.step(targets, 1 / 120, .85, frame / 120, 1);
  assert.ok(flow.points.at(-1).x > before.x + .1);
  const coastingSpeed = flow.velocities.at(-1).length();
  for (let frame = 61; frame <= 360; frame++) flow.step(targets, 1 / 120, .85, frame / 120, 1);
  assert.ok(flow.velocities.at(-1).length() < coastingSpeed * .2);
});

test('changing direction does not instantly reverse the tail momentum', () => {
  const { flow, targets } = movingRibbon();
  targets.forEach(target => { target.x -= .02; });
  flow.step(targets, 1 / 120, .85, 0, 1);
  assert.ok(flow.velocities.at(-1).x > 0);
  for (let frame = 0; frame < 90; frame++) {
    targets.forEach(target => { target.x -= 2 / 120; });
    flow.step(targets, 1 / 120, .85, 0, 1);
  }
  assert.ok(flow.velocities.at(-1).x < 0);
});

test('coasting stays consistent across 60 Hz and 120 Hz displays', () => {
  const a = movingRibbon(60), b = movingRibbon(120);
  for (let i = 1; i <= 60; i++) a.flow.step(a.targets, 1 / 60, .85, i / 60, 1);
  for (let i = 1; i <= 120; i++) b.flow.step(b.targets, 1 / 120, .85, i / 120, 1);
  assert.ok(a.flow.points.at(-1).distanceTo(b.flow.points.at(-1)) < .05);
});

test('a fresh gesture starts without momentum from the previous stroke', () => {
  const { flow, targets } = movingRibbon();
  flow.reset();
  targets.forEach(target => target.set(-3, 2, 0));
  flow.step(targets, 0, .85, 0, 1);
  assert.deepEqual(flow.points[0].toArray(), [-3, 2, 0]);
  assert.equal(flow.velocities.at(-1).length(), 0);
});
