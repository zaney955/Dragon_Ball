import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBudokaiStage, BUDOKAI_LAYOUT } from '../../src/world/budokai.js';
import { register as primitives } from '../../src/characters/model-primitives.js';
import { register as destruction } from '../../src/world/destruction.js';

function fixture() {
  const characters = { toonRamp: null },
    render = { scene: new THREE.Scene(), effects: [], spawnDust() {} },
    world = {
      surfaceTexture: () => new THREE.Texture(),
      makeTextTexture: () => new THREE.Texture(),
    };
  primitives({ characters });
  destruction({ characters, render, world, input: {}, combat: {} });
  const map = createBudokaiStage({ characters, world });
  world.currentMap = map;
  return { map, world, render, characters };
}

test('remade budokai preserves the arena and keeps scenery outside the camera apron', () => {
  const { map } = fixture();
  assert.deepEqual(map.bounds, { x: 13.5, z: 6 });
  assert.equal(map.destructibles.filter((p) => p.tile).length, 98);
  assert.equal(map.destructibles.filter((p) => !p.tile && !p.building).length, 12);
  assert.equal(map.group.userData.budokai.spectators, 192);
  assert.ok(BUDOKAI_LAYOUT.gateZ < -map.bounds.z - 7);
  for (const prop of map.destructibles.filter((p) => !p.tile && !p.building))
    assert.ok(Math.abs(prop.mesh.position.x) > map.bounds.x + 2);
  assert.ok(map.group.getObjectByName('budokai-hall'));
  assert.ok(map.group.getObjectByName('budokai-gate'));
  assert.equal(Object.keys(map).includes('applyLighting'), false);
  const geometries = new Set();
  let bytes = 0,
    meshes = 0;
  map.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    geometries.add(o.geometry);
  });
  for (const g of geometries) {
    for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
    bytes += g.index?.array.byteLength ?? 0;
  }
  assert.ok(meshes < 300, `meshes: ${meshes}`);
  assert.ok(bytes < 48 * 1024 * 1024, `geometry bytes: ${bytes}`);
});

test('budokai slabs crack and roof ornaments break through the existing destruction interface', () => {
  const { map, world, render } = fixture(),
    tile = map.destructibles.find((p) => p.tile),
    material = tile.mesh.material;
  const f = {
    pos: tile.mesh.position.clone(),
    forward: () => new THREE.Vector3(1, 0, 0),
    def: { ultStyle: 'kamehameha' },
  };
  world.damageStage(f, { dmg: 25, landingImpact: true }, f.pos);
  assert.ok(map.brokenTiles > 0);
  assert.notEqual(tile.mesh.material, material);
  assert.ok(map.scars.length > 0);
  assert.ok(render.effects.length > 0);
  const part = map.destructibles.find((p) => p.building),
    pos = part.bounds.getCenter(new THREE.Vector3());
  assert.equal(
    world.damageStageProjectile(
      f,
      { dmg: 80 },
      pos.clone().setZ(pos.z + 5),
      pos.clone().setZ(pos.z - 5),
    ),
    true,
  );
  assert.ok(map.brokenBuildingParts > 0);
  assert.equal(map.group.getObjectByName('budokai-hall').visible, true);
});

test('budokai cloth and clouds animate in place and light presets remain snapshot safe', () => {
  const { map } = fixture(),
    flag = map.group.getObjectByName('budokai-tournament-banner'),
    cloud = map.group.getObjectByName('budokai-clouds'),
    geometry = flag.geometry;
  const before = Array.from(flag.geometry.attributes.position.array);
  map.update(1);
  assert.notDeepEqual(Array.from(flag.geometry.attributes.position.array), before);
  assert.ok(cloud.rotation.y > 0);
  for (const preset of ['day', 'sunset', 'moon']) map.applyLighting(preset);
  assert.equal(flag.geometry, geometry);
  assert.ok(map.group.getObjectByName('budokai-sky').geometry.attributes.color.version > 0);
});

test('cached budokai keeps fight damage, flag buffers and lighting independent', () => {
  const { map, world, characters } = fixture(),
    oldFlag = map.group.getObjectByName('budokai-tournament-banner');
  const initial = Array.from(oldFlag.geometry.attributes.position.array);
  map.update(2);
  map.applyLighting('moon');
  const tile = map.destructibles.find((p) => p.tile);
  world.damageStage(
    { pos: tile.mesh.position.clone(), forward: () => new THREE.Vector3(1, 0, 0), def: {} },
    { dmg: 25, landingImpact: true },
    tile.mesh.position,
  );
  const fresh = createBudokaiStage({ characters, world });
  assert.equal(fresh.brokenTiles, 0);
  assert.ok(fresh.destructibles.every((p) => !p.broken));
  const flag = fresh.group.getObjectByName('budokai-tournament-banner');
  assert.notEqual(flag.geometry, oldFlag.geometry);
  assert.deepEqual(Array.from(flag.geometry.attributes.position.array), initial);
  assert.notEqual(
    fresh.group.getObjectByName('budokai-clouds').material,
    map.group.getObjectByName('budokai-clouds').material,
  );
  assert.equal(
    fresh.group.getObjectByName('budokai-hall').children[0].geometry,
    map.group.getObjectByName('budokai-hall').children[0].geometry,
  );
  assert.equal(fresh.destructibles.filter((p) => !p.tile && !p.building).length, 12);
});

test('instanced paving tracks independent cracked slab transforms and colors', () => {
  const { map, world } = fixture(),
    tile = map.destructibles.find((p) => p.tile),
    batch = map.group.getObjectByName('budokai-instanced-paving');
  assert.equal(batch.count, 98);
  assert.equal(tile.mesh.layers.mask, (1 << 31) >>> 0);
  world.damageStage(
    { pos: tile.mesh.position.clone(), forward: () => new THREE.Vector3(1, 0, 0), def: {} },
    { dmg: 25, landingImpact: true },
    tile.mesh.position,
  );
  map.update(1 / 60);
  const matrix = new THREE.Matrix4(),
    color = new THREE.Color();
  batch.getMatrixAt(0, matrix);
  batch.getColorAt(0, color);
  assert.ok(matrix.elements.every((n, i) => Math.abs(n - tile.mesh.matrix.elements[i]) < 1e-6));
  for (const component of ['r', 'g', 'b'])
    assert.ok(Math.abs(color[component] - tile.mesh.material.color[component]) < 1e-6);
  assert.ok(tile.broken);
});
