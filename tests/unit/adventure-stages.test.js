import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWildStage, createKameStage } from '../../src/world/adventure-stages.js';
import { register as primitives } from '../../src/characters/model-primitives.js';
import { register as destruction } from '../../src/world/destruction.js';

function fixture(builder) {
  const characters = { toonRamp: null },
    render = { scene: new THREE.Scene(), effects: [], spawnDust() {} },
    world = {
      surfaceTexture: () => new THREE.Texture(),
      makeTextTexture: () => new THREE.Texture(),
    };
  primitives({ characters });
  destruction({ characters, render, world, input: {}, combat: {} });
  const map = builder({ characters, world });
  world.currentMap = map;
  return { map, world };
}
for (const [id, builder] of [
  ['wild', createWildStage],
  ['kame', createKameStage],
]) {
  test(`${id} retains flat combat ground, bounded geometry and independent building damage`, () => {
    const { map, world } = fixture(builder);
    assert.equal(map.playArea.type, 'polygon');
    assert.ok(map.bounds.x >= 31);
    const ground = map.group.getObjectByName(
      id === 'wild' ? 'wild-valley-terrain' : 'kame-sculpted-island',
    );
    const p = ground.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      if (
        Math.abs(p.getX(i)) <= (id === 'wild' ? 21 : 13.5) &&
        Math.abs(p.getZ(i)) <= (id === 'wild' ? 14 : 6)
      )
        assert.ok(
          Math.abs(p.getY(i) - (id === 'wild' ? 0 : 0.108)) < 0.00001,
          `non-flat apron at vertex ${i}`,
        );
    let bytes = 0,
      meshes = 0,
      transparent = 0;
    const geometries = new Set();
    map.group.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.material.transparent) transparent++;
      assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
      geometries.add(o.geometry);
    });
    for (const g of geometries) {
      for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
      bytes += g.index?.array.byteLength ?? 0;
    }
    assert.ok(meshes < 280, `meshes: ${meshes}`);
    assert.ok(bytes < 12 * 1024 * 1024, `bytes: ${bytes}`);
    assert.equal(transparent, 0);
    const part = map.destructibles.find((p) => p.building),
      pos = part.bounds.getCenter(new THREE.Vector3());
    assert.ok(part);
    world.damageStageProjectile(
      { forward: () => new THREE.Vector3(0, 0, -1), def: {} },
      { dmg: 80 },
      pos.clone().setZ(pos.z + 5),
      pos.clone().setZ(pos.z - 5),
    );
    assert.ok(map.brokenBuildingParts > 0);
    assert.ok(
      map.group.getObjectByName(
        id === 'wild' ? 'building-goku-mountain-home' : 'building-kame-house',
      ).visible,
    );
    assert.ok(
      map.destructibles
        .filter((p) => !p.building && !p.tile && !p.mesh.userData.stageObject)
        .every((p) => Math.abs(p.mesh.position.x) >= 19.8),
    );
  });
  test(`${id} animation and lighting reuse resources and reset on a new match`, () => {
    const { map } = fixture(builder),
      cloud = map.group.getObjectByName('adventure-clouds'),
      water = map.group.getObjectByName(id === 'wild' ? 'wild-waterfall-pool' : 'kame-ocean'),
      geometry = water.geometry;
    map.update(1);
    assert.equal(water.material.uniforms.time.value, 1);
    assert.ok(cloud.rotation.y > 0);
    for (const preset of ['moon', 'sunset', 'day']) map.applyLighting(preset);
    assert.equal(water.geometry, geometry);
    assert.equal(water.material.uniforms.brightness.value, 1);
    assert.ok(water.material.uniforms.fogColor);
    assert.equal(Object.keys(map).includes('applyLighting'), false);
    const { map: fresh } = fixture(builder);
    assert.equal(fresh.brokenBuildingParts, 0);
    assert.equal(
      fresh.group.getObjectByName(id === 'wild' ? 'wild-waterfall-pool' : 'kame-ocean').material
        .uniforms.time.value,
      0,
    );
  });
}
