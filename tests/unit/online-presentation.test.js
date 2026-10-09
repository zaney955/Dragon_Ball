import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { GuestPresentation } from '../../src/online/presentation.js';

function setup() {
  const fighters = Array.from({ length: 2 }, () => ({
    pos: new Vector3(),
    vel: new Vector3(),
    state: 'idle',
    hp: 240,
    facingAngle: 0,
    stateTimer: 0,
    attack: null,
  }));
  const presentation = new GuestPresentation({
    fighters,
    mobility: () => 1,
    bounds: () => ({ x: 1, z: 1 }),
  });
  presentation.anchorAt = 1000;
  return { fighters, presentation };
}

test('guest predicts movement before host feedback without changing authoritative state', () => {
  const { fighters, presentation } = setup();
  presentation.record({ up: true, moveYaw: 0, actions: [] }, 1000);
  presentation.update(1050, 1 / 60, true);
  assert.ok(fighters[1].onlineVisualPosition.z > 0.02);
  assert.deepEqual(fighters[1].pos.toArray(), [0, 0, 0]);
  assert.deepEqual(fighters[1].vel.toArray(), [0, 0, 0]);
  assert.equal(fighters[1].state, 'idle');
  assert.equal(fighters[1].hp, 240);
  presentation.update(10000, 1, true);
  assert.ok(fighters[1].onlineVisualPosition.z <= 1);
  presentation.update(10020, 1 / 60, false);
  assert.deepEqual(fighters[1].onlineVisualPosition.toArray(), [0, 0, 0]);
  presentation.clear();
  assert.equal(fighters[1].onlineVisualPosition, undefined);
});

test('fresh input still responds when host feedback is older than the prediction horizon', () => {
  const { fighters, presentation } = setup();
  presentation.record({ up: true, moveYaw: 0, actions: [] }, 1500);
  presentation.update(1550, 1 / 60, true);
  assert.ok(fighters[1].onlineVisualPosition.z > 0.02);
  assert.deepEqual(fighters[1].pos.toArray(), [0, 0, 0]);
});

test('local attack anticipation stops when input is acknowledged and cannot predict through stun', () => {
  const { fighters, presentation } = setup();
  presentation.record({ actions: [{ type: 'light' }] }, 1000);
  presentation.update(1050, 1 / 60, true);
  assert.equal(fighters[1].onlineVisualAction.type, 'light');
  assert.equal(fighters[1].attack, null);
  fighters[1].state = 'hit';
  presentation.update(1060, 1 / 60, true);
  assert.equal(fighters[1].onlineVisualAction, null);
  fighters[1].state = 'idle';
  presentation.snapshot(1100, { at: 1000, processing: 20 });
  presentation.update(1100, 1 / 60, true);
  assert.equal(fighters[1].onlineVisualAction, null);
  assert.equal(presentation.delay, 0.04);
});
