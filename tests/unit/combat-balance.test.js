import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEUTRAL_BALANCE, neutralMove } from '../../src/characters/neutral-balance.js';
import { YOUTH_PROFILES } from '../../src/characters/youth-profiles.js';
import { superArmorActive } from '../../src/combat/attack-rules.js';
import { guardCost } from '../../src/combat/defense-rules.js';
import { cameraObstacle } from '../../src/render/fight-camera.js';
import {
  createCombatReview,
  observeCombatEvent,
  sampleControlTime,
  reviewAdvice,
} from '../../src/match/combat-review.js';
import {
  BATTLE_PROTOCOL,
  BATTLE_RULESET,
  compatibleBattle,
} from '../../src/online/battle-version.js';

test('every youth move has authored timing, guard costs and a punishable whiff', () => {
  for (const [id, profile] of Object.entries(YOUTH_PROFILES)) {
    const rows = [];
    for (const type of ['light', 'heavy']) {
      assert.equal(NEUTRAL_BALANCE[id][type].length, profile[type].length);
      for (let i = 0; i < profile[type].length; i++) {
        const move = neutralMove(id, type, i);
        assert.ok(move.startup > 0 && move.active > 0 && move.recovery > move.blockstun);
        assert.equal(guardCost({ ...move, chainType: type }), move.guardDamage);
        assert.deepEqual(move.cancelRules.whiff, []);
        rows.push([move.startup, move.recovery, move.dmg].join(':'));
      }
    }
    assert.ok(new Set(rows).size >= 8, id);
  }
});

test('super armor ends at the first recovery step and never protects a defeated fighter', () => {
  const fighter = { hp: 10, attack: { superArmor: true, hitT: 0.4, active: 0.2 }, stateTimer: 0 };
  assert.ok(superArmorActive(fighter));
  fighter.stateTimer = 0.599;
  assert.ok(superArmorActive(fighter));
  fighter.stateTimer = fighter.attack.hitT + fighter.attack.active;
  assert.equal(superArmorActive(fighter), false);
  fighter.stateTimer = 0;
  fighter.hp = 0;
  assert.equal(superArmorActive(fighter), false);
});

test('review uses actual contacts and continuous lost-control time, never winner-based advice', () => {
  const r = createCombatReview();
  assert.equal(reviewAdvice(r.sides[0]), null);
  for (let serial = 1; serial <= 3; serial++) {
    observeCombatEvent(r, {
      type: 'contact',
      side: 0,
      target: 1,
      chainType: 'light',
      chainIndex: 0,
      serial,
      time: serial,
      recovered: true,
      damage: 4,
    });
  }
  assert.equal(reviewAdvice(r.sides[0]).drill, 'confirm');
  observeCombatEvent(r, {
    type: 'contact',
    side: 0,
    target: 1,
    chainType: 'light',
    chainIndex: 1,
    serial: 4,
    time: 3.2,
    recovered: false,
    damage: 3,
  });
  assert.equal(r.sides[0].convertedOpeners, 1);
  assert.equal(reviewAdvice(r.sides[0]), null);
  for (let n = 0; n < 3; n++)
    observeCombatEvent(r, { type: 'contact', side: 0, target: 1, armored: true, damage: 2 });
  assert.equal(reviewAdvice(r.sides[0]).drill, 'whiff');
  sampleControlTime(r, [{ state: 'idle' }, { state: 'hit' }], 0.5);
  sampleControlTime(r, [{ state: 'idle' }, { state: 'guardbreak' }], 0.4);
  sampleControlTime(r, [{ state: 'idle' }, { state: 'idle' }], 0.1);
  sampleControlTime(r, [{ state: 'idle' }, { state: 'hit' }], 0.2);
  assert.equal(r.sides[1].longestLostControl, 0.9);
  assert.equal(r.sides[1].lostControlSeconds, 1.1);
});

test('battle handshake rejects old and mismatched simulation versions before replay', () => {
  assert.equal(compatibleBattle({ protocol: BATTLE_PROTOCOL, ruleset: BATTLE_RULESET }), true);
  assert.equal(compatibleBattle({}), false);
  assert.equal(compatibleBattle({ protocol: BATTLE_PROTOCOL - 1, ruleset: BATTLE_RULESET }), false);
  assert.equal(compatibleBattle({ protocol: BATTLE_PROTOCOL, ruleset: 'old' }), false);
});

test('camera blockers include scaled non-box geometry and tagged dynamic cover', () => {
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  sphere.updateMatrixWorld(true);
  assert.equal(cameraObstacle(sphere), true);
  sphere.scale.setScalar(0.1);
  sphere.updateMatrixWorld(true);
  assert.equal(cameraObstacle(sphere), false);
  sphere.userData.cameraBlocker = true;
  assert.equal(cameraObstacle(sphere), true);
  sphere.userData.cameraBlocker = false;
  assert.equal(cameraObstacle(sphere), false);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 }),
  );
  glass.updateMatrixWorld(true);
  assert.equal(cameraObstacle(glass), false);
});

test('missed punish advice requires real reachable windows and resource sampling includes charge', () => {
  const r = createCombatReview(),
    fighters = [
      { state: 'idle', ki: 45 },
      { state: 'idle', ki: 20 },
    ];
  observeCombatEvent(r, {
    type: 'whiff',
    side: 1,
    target: 0,
    time: 0,
    recoveryRemaining: 0.6,
    punishOpportunity: false,
  });
  sampleControlTime(r, fighters, 0.1, 1, [30, 30]);
  assert.equal(r.sides[0].missedPunishOpportunities, 0);
  assert.equal(r.sides[0].generatedKi, 15);
  assert.equal(r.sides[1].consumedKi, 10);
  for (let n = 0; n < 3; n++) {
    observeCombatEvent(r, {
      type: 'whiff',
      side: 1,
      target: 0,
      time: n + 1,
      recoveryRemaining: 0.6,
      punishOpportunity: true,
    });
    sampleControlTime(r, fighters, 0.1, n + 1.7);
  }
  assert.equal(reviewAdvice(r.sides[0]).drill, 'whiff');
  observeCombatEvent(r, {
    type: 'whiff',
    side: 1,
    target: 0,
    time: 5,
    recoveryRemaining: 0.6,
    punishOpportunity: true,
  });
  observeCombatEvent(r, {
    type: 'contact',
    side: 0,
    target: 1,
    time: 5.3,
    punish: true,
    damage: 5,
  });
  sampleControlTime(r, fighters, 0.1, 6);
  assert.equal(r.sides[0].missedPunishOpportunities, 3);
  assert.equal(r.sides[0].punishedOpportunities, 1);
});
