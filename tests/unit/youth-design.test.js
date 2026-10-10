import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YOUTH_PROFILES } from '../../src/characters/youth-profiles.js';
import { VICTORY_LINES, RELATION_LINES, selectVictoryLine } from '../../src/match/victory.js';
import music from '../../src/assets/music/manifest.js';
import * as THREE from 'three';
import { register as registerPrimitives } from '../../src/characters/model-primitives.js';
import { register as registerDestruction } from '../../src/world/destruction.js';
import { register as registerEffects } from '../../src/render/effects.js';
import { register as registerStages } from '../../src/world/stages.js';
test('fourteen independent childhood profiles and fixed skill costs', () => {
  assert.equal(Object.keys(YOUTH_PROFILES).length, 14);
  for (const [id, p] of Object.entries(YOUTH_PROFILES)) {
    assert.ok(p.light.length >= 2);
    assert.ok(p.heavy.length >= 2);
    assert.equal(p.skills.length, 2);
    assert.equal(p.ult.kiCost, 100);
    assert.ok(VICTORY_LINES[id]);
    assert.ok(Object.keys(RELATION_LINES).some((k) => k.startsWith(id + ':')));
    for (const s of p.skills) {
      assert.ok(s.kiCost >= 30);
      assert.ok(s.startup > 0);
      assert.ok(s.cooldown >= 0);
    }
  }
  assert.equal(YOUTH_PROFILES.krillin.ult.motion, 'kamehameha');
  assert.equal(YOUTH_PROFILES.oolong.skills[0].ability, 'ogre');
  assert.equal(YOUTH_PROFILES.oolong.skills[1].ability, 'bat');
  assert.equal(YOUTH_PROFILES.tien.ult.lifeCost, 0.06);
});
test('victory dialogue direction and special shape precedence', () => {
  assert.equal(selectVictoryLine('goku', 'krillin', null), RELATION_LINES['goku:krillin']);
  assert.equal(selectVictoryLine('krillin', 'goku', null), RELATION_LINES['krillin:goku']);
  assert.equal(selectVictoryLine('goku', 'krillin', 'ape'), '咦？刚才发生什么事了？');
  assert.equal(selectVictoryLine('roshi', 'goku', 'muscle'), RELATION_LINES['roshi:goku']);
  assert.equal(selectVictoryLine('piccolo', 'korin'), VICTORY_LINES.piccolo);
});
test('eight original tracks have exact timing and structural length', () => {
  assert.equal(music.length, 8);
  for (const t of music) {
    assert.ok(t.duration > 0);
    if (t.loop) assert.ok(Math.abs(t.duration - (t.bars * 4 * 60) / t.bpm) < 1e-7);
  }
  assert.deepEqual(
    music.filter((t) => !t.loop).map((t) => t.duration),
    [4.5, 3, 3],
  );
});

function destructionFixture(id) {
  const characters = {},
    render = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() },
    disposed = [],
    world = {
      disposeGroup(group) {
        disposed.push(group);
        group.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      },
    };
  registerPrimitives({ characters })();
  registerEffects({ render })();
  registerStages({ characters, render, world, art: {} })();
  render.spawnDust = () => {};
  registerDestruction({ characters, render, world, combat: {}, input: {} });
  const group = new THREE.Group();
  if (id === 'budokai') {
    const tile = characters.box(group, characters.M(0xe4d9bd), 0, -0.035, 0, 1.96, 0.07, 1.96);
    tile.name = 'breakable-arena-slab';
  }
  const building = new THREE.Group(),
    buildingMaterial = characters.M(id === 'kame' ? 0xe6a6a2 : 0xc8c3ad);
  building.position.set(0, 0, -9);
  characters.box(building, buildingMaterial, 0, 1.5, 0, 5, 3, 1.5);
  characters.box(building, characters.M(0x8c5542), 0, 3.2, 0, 5.4, 0.35, 1.9);
  world.prepareBuilding(building, id + '-fixture-house', { roofY: 3 });
  group.add(building);
  world.currentMap = world.enrichDestruction({ group, bounds: { x: 13.5, z: 6 } }, id);
  render.scene.add(group);
  const fighter = { pos: new THREE.Vector3(), forward: () => new THREE.Vector3(1, 0, 0), def: {} };
  return { world, render, fighter, disposed };
}

for (const id of ['budokai', 'wild', 'kame'])
  test(`${id} has material-specific props, impact scars and bounded debris`, () => {
    const { world, render, fighter, disposed } = destructionFixture(id),
      map = world.currentMap,
      prop = map.destructibles.find((item) => !item.tile);
    assert.ok(map.destructibles.filter((item) => !item.tile).length >= 8);
    assert.ok(map.destructibles.some((item) => item.kind === 'wood'));
    assert.ok(map.destructibles.some((item) => item.kind === 'stone' || item.tile));
    assert.ok(map.buildings.length >= 1);
    assert.ok(map.destructibles.filter((item) => item.building).length >= 2);
    const impact = prop.mesh.position.clone();
    world.damageStage(fighter, { dmg: 20, landingImpact: true }, impact);
    assert.equal(prop.broken, true);
    assert.equal(prop.mesh.visible, false);
    assert.ok(map.destroyedProps > 0);
    assert.equal(map.scars[0].userData.surface, id);
    assert.ok(map.scars[0].children.length >= 3);
    assert.ok(render.effects.some((e) => e.type === 'debris' && e.stageEffect));
    for (let i = 0; i < 35; i++)
      world.damageStage(fighter, { dmg: 20, landingImpact: true }, impact);
    assert.equal(map.scars.length, 24);
    assert.ok(disposed.length >= 12);
    assert.ok(render.effects.length <= 180);
    render.updateEffects(5);
    assert.equal(render.effects.length, 0);
  });

test('beam destruction leaves a bounded trail and damaged slabs retain independent materials', () => {
  const { world, fighter } = destructionFixture('budokai'),
    map = world.currentMap,
    tile = map.destructibles.find((item) => item.tile),
    originalMaterial = tile.mesh.material;
  world.damageStage(fighter, { dmg: 120, isUlt: true, range: 10, shape: 'beam' });
  assert.ok(map.scars.length >= 3);
  assert.ok(map.scars.every((mark) => Math.abs(mark.position.z) < 0.001));
  world.damageStage(fighter, { dmg: 20, landingImpact: true }, new THREE.Vector3());
  assert.equal(map.brokenTiles, 1);
  assert.notEqual(tile.mesh.material, originalMaterial);
  assert.ok(tile.mesh.material.color.getHex() !== originalMaterial.color.getHex());
});

test('building sections take directional skill damage and roofs collapse after losing support', () => {
  const { world, render, fighter } = destructionFixture('wild'),
    map = world.currentMap,
    house = new THREE.Group(),
    stone = new THREE.MeshToonMaterial({ color: 0xc8c3ad });
  house.position.set(0, 0, -9);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), stone),
    roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 2.5), stone);
  wall.position.y = 1.5;
  roof.position.y = 3.2;
  house.add(wall, roof);
  world.prepareBuilding(house, 'test-house', { roofY: 3, cellSize: 3 });
  map.group.add(house);
  world.enrichDestruction(map, 'wild');
  fighter.forward = () => new THREE.Vector3(0, 0, -1);
  const parts = map.destructibles.filter((item) => item.building);
  assert.ok(parts.length >= 4);
  assert.ok(parts.some((item) => item.kind === 'roof'));
  const hp = parts.map((item) => item.hp);
  world.damageStage(fighter, { id: 'special', shape: 'beam', dmg: 14, range: 12, width: 0.2 });
  assert.ok(parts.some((item, i) => item.hp < hp[i]));
  for (let i = 0; i < 5; i++)
    world.damageStage(fighter, { id: 'special', shape: 'beam', dmg: 30, range: 12, width: 0.2 });
  assert.ok(map.brokenBuildingParts > 0);
  assert.ok(parts.some((item) => item.kind === 'roof' && item.broken));
  assert.ok(parts.some((item) => !item.broken));
  assert.ok(render.effects.length <= 180);
});

test('projectiles damage the closest building along their swept path, not buildings behind the shooter', () => {
  const { world, fighter } = destructionFixture('kame'),
    map = world.currentMap;
  for (const z of [-9, 9]) {
    const house = new THREE.Group(),
      mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshToonMaterial());
    house.position.set(0, 1.5, z);
    house.add(mesh);
    world.prepareBuilding(house, 'house-' + z, { roofY: 4 });
    map.group.add(house);
  }
  world.enrichDestruction(map, 'kame');
  const behind = map.destructibles.filter((item) => item.building && item.bounds.min.z > 0),
    hp = behind.map((item) => item.hp);
  assert.equal(
    world.damageStageProjectile(
      fighter,
      { dmg: 30 },
      new THREE.Vector3(0, 1, -7),
      new THREE.Vector3(0, 1, -10),
      0.15,
    ),
    true,
  );
  assert.ok(map.brokenBuildingParts > 0);
  assert.deepEqual(
    behind.map((item) => item.hp),
    hp,
  );
});

test('switching maps removes stage particles without clearing unrelated combat effects', () => {
  const { world, render, fighter } = destructionFixture('wild');
  world.damageStage(fighter, { dmg: 20, landingImpact: true }, new THREE.Vector3());
  const unrelated = { mesh: new THREE.Mesh(), life: 1, type: 'orb' };
  render.effects.push(unrelated);
  render.scene.add(unrelated.mesh);
  assert.ok(render.effects.some((effect) => effect.stageEffect));
  world.clearMap();
  assert.equal(world.currentMap, null);
  assert.deepEqual(render.effects, [unrelated]);
  assert.deepEqual(render.scene.children, [unrelated.mesh]);
});
