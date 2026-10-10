import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  areaFor,
  insideArea,
  constrainArea,
  setupSpace,
  moveInSpace,
  segmentHit,
  positionFree,
  routeDirection,
} from '../../src/world/space.js';

for (const area of [
  { type: 'rectangle', x: 14.5, z: 7.5 },
  { type: 'circle', radius: 28 },
  { type: 'ellipse', x: 31, z: 27, cz: -7 },
  {
    type: 'polygon',
    points: [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ],
  },
]) {
  test(`${area.type} contains radius-adjusted edges without leaking at corners`, () => {
    for (let i = 0; i < 360; i += 3) {
      const p = { x: Math.cos(i) * 100, z: Math.sin(i) * 100 };
      constrainArea(area, p, 0.4);
      assert.ok(insideArea(area, p.x, p.z, 0.39));
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    }
  });
}
function fixture() {
  const group = new THREE.Group(),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 6), new THREE.MeshToonMaterial());
  mesh.position.set(0, 2, 0);
  group.add(mesh);
  const map = { group, surface: { id: 'wild' }, destructibles: [{ mesh, hp: 20, broken: false }] };
  setupSpace(map, 'wild');
  return map;
}
test('swept movement, dash and teleport cannot tunnel through a narrow wall; motion slides', () => {
  const map = fixture(),
    from = new THREE.Vector3(-5, 0, -1),
    to = new THREE.Vector3(5, 0, 2);
  assert.ok(moveInSpace(map, from, to).length);
  assert.ok(to.x <= -0.8 + 1e-5);
  assert.ok(to.z > 1.9);
  const air = new THREE.Vector3(5, 5, 0);
  moveInSpace(map, new THREE.Vector3(-5, 5, 0), air);
  assert.ok(Math.abs(air.x - 5) < 1e-5);
  const recover = new THREE.Vector3(0, 0, 0);
  moveInSpace(map, recover.clone(), recover);
  assert.ok(Math.abs(recover.x) >= 0.8);
});
test('movement, projectile, spawn and AI topology change together when a cover disappears', () => {
  const map = fixture(),
    from = new THREE.Vector3(-5, 1, 0),
    to = new THREE.Vector3(5, 1, 0);
  assert.ok(segmentHit(map, from, to));
  assert.equal(positionFree(map, 0, 0), false);
  const route = routeDirection(map, from, to);
  assert.ok(Math.abs(route.z) > 0);
  map.destructibles[0].broken = true;
  map.destructibles[0].mesh.visible = false;
  map.spaceRevision = 1;
  assert.equal(segmentHit(map, from, to), null);
  assert.equal(positionFree(map, 0, 0), true);
  const p = new THREE.Vector3(5, 0, 0);
  moveInSpace(map, new THREE.Vector3(-5, 0, 0), p);
  assert.ok(Math.abs(p.x - 5) < 1e-5);
});
test('all four maps expose the intended expanded space', () => {
  assert.ok(insideArea(areaFor('budokai'), 14, 7, 0.3));
  assert.ok(insideArea(areaFor('wild'), 25, 14, 0.3));
  assert.ok(insideArea(areaFor('kame'), -15, -20, 0.3));
  assert.ok(insideArea(areaFor('kami'), 0, 27, 0.3));
  assert.equal(insideArea(areaFor('kami'), 25, 25, 0.3), false);
});
