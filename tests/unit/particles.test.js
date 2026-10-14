import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2, Vector3 } from 'three';
import { ParticleCloud } from '../../src/particles.js';

function setup() {
  const cloud = new ParticleCloud(128);
  const options = {
    centers: Array.from({ length: 12 }, (_, i) => new Vector3(3 - i * .2, Math.sin(i * .2), 0)),
    normals: Array.from({ length: 12 }, () => new Vector2(0, 1)),
    anchor: new Vector2(-.55, -.1), morph: 1, dispersion: .58, time: 0, dt: 1 / 60, mobile: false, energy: 1,
  };
  return { cloud, options };
}

test('changing the target shape never teleports the cloud or resets its momentum', () => {
  const { cloud, options } = setup();
  for (let i = 0; i < 30; i++) cloud.step(options);
  const before = cloud.geometry.attributes.position.array.slice();
  const velocities = cloud.velocities.slice();
  cloud.step({ ...options, morph: 0, dt: 0 });
  for (let i = 0; i < before.length; i++) assert.ok(Math.abs(cloud.geometry.attributes.position.array[i] - before[i]) < 1e-6);
  assert.deepEqual(cloud.velocities, velocities);
});

test('the same grains gather into a bounded body after a moving stroke', () => {
  const { cloud, options } = setup();
  for (let i = 0; i < 60; i++) cloud.step(options);
  for (let i = 0; i < 300; i++) cloud.step({ ...options, morph: 0 });
  const positions = cloud.geometry.attributes.position.array;
  for (let i = 0; i < cloud.count; i++) {
    const j = i * 3;
    const radius = Math.hypot(positions[j] - options.anchor.x, positions[j + 1] - options.anchor.y, positions[j + 2]);
    assert.ok(Number.isFinite(radius) && radius < 1.7);
    assert.ok(Math.abs(positions[j] - options.anchor.x - cloud.homes[j] * (1 + .018 * Math.sin(cloud.phases[i]))) < .005);
  }
});

test('reshuffling changes the destination without popping the visible grains', () => {
  const { cloud, options } = setup();
  cloud.step(options);
  const before = cloud.geometry.attributes.position.array.slice();
  const homes = cloud.homes.slice();
  cloud.setSeed(12.4);
  assert.deepEqual(cloud.geometry.attributes.position.array, before);
  assert.notDeepEqual(cloud.homes, homes);
});
