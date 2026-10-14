import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResinPlanes, resinRadius } from '../../src/resin.js';

test('the irregular solid stays closed and inside all of its cutting planes', () => {
  for (const seed of [1.7, 9.4, 18.2]) {
    const planes = createResinPlanes(seed);
    const radii = [];
    for (let i = 0; i < 300; i++) {
      const y = 1 - 2 * (i + .5) / 300;
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const ring = Math.sqrt(1 - y * y);
      const x = ring * Math.cos(angle), z = ring * Math.sin(angle);
      const radius = resinRadius(x, y, z, planes);
      radii.push(radius);
      assert.ok(Number.isFinite(radius) && radius > .75 && radius < 1.4);
      assert.ok(planes.every(p => radius * (x * p.x + y * p.y + z * p.z) <= p.w + 1e-8));
    }
    assert.ok(Math.max(...radii) - Math.min(...radii) > .12, 'the outline must visibly depart from a sphere');
  }
});

test('a facet layout is stable until a new shape is requested', () => {
  const serialize = seed => createResinPlanes(seed).map(p => p.toArray());
  assert.deepEqual(serialize(1.7), serialize(1.7));
  assert.notDeepEqual(serialize(1.7), serialize(9.4));
});
