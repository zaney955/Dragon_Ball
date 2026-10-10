import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKamiStage, KAMI_LAYOUT } from '../../src/world/kami.js';
import { register as primitives } from '../../src/characters/model-primitives.js';
import { register as destruction } from '../../src/world/destruction.js';
import { command } from '../../workers/lobby.js';

function fixture() {
  const characters = { toonRamp: null },
    render = { scene: new THREE.Scene(), effects: [], spawnDust() {} },
    world = { surfaceTexture: () => new THREE.Texture() };
  primitives({ characters });
  destruction({ characters, render, world, input: {}, combat: {} });
  const map = createKamiStage({ characters, world });
  world.currentMap = map;
  return { map, world, render };
}

test('kami keeps the combat apron open and builds a complete indexed 3D temple', () => {
  const { map } = fixture();
  assert.deepEqual(map.bounds, { x: 13.5, z: 6 });
  assert.equal(Object.keys(map).includes('applyLighting'), false);
  assert.ok(Math.hypot(map.bounds.x + 7, map.bounds.z + 7) < KAMI_LAYOUT.radius);
  assert.equal(map.group.userData.kami.islands, 7);
  assert.equal(map.group.userData.kami.cloudInstances, 1350);
  assert.equal(map.destructibles.filter((p) => p.building).length, 16);
  assert.ok(map.destructibles.filter((p) => p.tile).length > 25);
  for (const ornament of map.destructibles.filter((p) => p.building)) {
    assert.ok(Math.hypot(ornament.mesh.parent.position.x, ornament.mesh.parent.position.z) > 26);
  }
  let bytes = 0,
    meshes = 0;
  map.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    for (const attr of Object.values(o.geometry.attributes)) bytes += attr.array.byteLength;
    bytes += o.geometry.index?.array.byteLength ?? 0;
    assert.ok(o.geometry.boundingSphere?.radius > 0 || o.geometry.attributes.position.count > 0);
    assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    if (o.isInstancedMesh) assert.equal(o.userData.cameraBlocker, false);
  });
  assert.ok(meshes < 200, `meshes: ${meshes}`);
  assert.ok(bytes < 64 * 1024 * 1024, `geometry: ${bytes}`);
});

test('kami impacts crack marble and projectile hits chip only outer gold ornaments', () => {
  const { map, world, render } = fixture();
  const tile = map.destructibles.find((p) => p.tile),
    original = tile.mesh.material;
  const f = {
    pos: tile.mesh.position.clone(),
    forward: () => new THREE.Vector3(1, 0, 0),
    def: { ultStyle: 'kamehameha' },
  };
  world.damageStage(f, { dmg: 25, landingImpact: true }, f.pos);
  assert.ok(map.brokenTiles > 0);
  assert.notEqual(tile.mesh.material, original);
  assert.equal(map.surface.id, 'kami');
  assert.ok(map.scars.length > 0);
  assert.ok(render.effects.length > 0);
  const crown = map.destructibles.find((p) => p.building),
    pos = crown.bounds.getCenter(new THREE.Vector3());
  assert.equal(
    world.damageStageProjectile(
      f,
      { dmg: 60 },
      pos.clone().add(new THREE.Vector3(0, 0, 3)),
      pos.clone().add(new THREE.Vector3(0, 0, -3)),
    ),
    true,
  );
  assert.ok(map.brokenBuildingParts > 0);
  assert.equal(map.group.getObjectByName('kami-palace').visible, true);
});

test('cloud motion and all light presets update in place without allocating geometry', () => {
  const { map } = fixture();
  const cloud = map.group.getObjectByName('kami-cloud-bank-0'),
    geometry = cloud.geometry;
  map.update(20);
  assert.ok(cloud.rotation.y > 0);
  for (const preset of ['day', 'sunset', 'moon']) {
    map.applyLighting(preset);
    assert.equal(cloud.geometry, geometry);
    assert.ok(map.group.getObjectByName('kami-atmosphere').geometry.attributes.color.version > 0);
  }
});

test('the shared online room accepts fourth-map settings and rejects unknown maps atomically', () => {
  const players = [
    { id: 'host', room: 1, seat: 0, ready: true, map: 0 },
    { id: 'guest', room: 1, seat: 1, ready: true, map: 0 },
  ];
  const host = players[0];
  assert.equal(command(players, host, { type: 'settings', map: 3 }, () => 'match').changed, true);
  assert.ok(players.every((p) => p.map === 3 && !p.ready));
  assert.ok(command(players, host, { type: 'settings', map: 4 }, () => 'match').error);
  assert.ok(players.every((p) => p.map === 3));
});
