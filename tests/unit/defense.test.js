import test from 'node:test';
import assert from 'node:assert/strict';
import { updateDefense, canBlock, defenseStatus } from '../../src/combat/defense-rules.js';

const fighter = (props = {}) => ({
  hp: 100,
  guard: 100,
  guardHeld: 0,
  guardDelay: 0,
  guardBroken: false,
  state: 'idle',
  attack: null,
  ...props,
});

function ticks(f, count, holding = false) {
  for (let i = 0; i < count; i++) {
    f.guardDelay = Math.max(0, f.guardDelay - 1 / 120);
    f.guardHeld = holding ? f.guardHeld + 1 / 120 : 0;
    updateDefense(f, 1 / 120, holding);
  }
}

test('long idle defense becomes vulnerable without causing a spontaneous guard break', () => {
  const f = fighter({ state: 'block' });
  ticks(f, 60, true);
  assert.equal(f.guard, 100);
  ticks(f, 120 * 30, true);
  assert.equal(f.guard, 20);
  assert.equal(f.guardBroken, false);
  assert.equal(defenseStatus(f).state, 'low');
  f.state = 'idle';
  ticks(f, 60);
  assert.equal(f.guard, 20);
  ticks(f, 120 * 5);
  assert.equal(f.guard, 100);
});

test('broken defense unlocks only after safe recovery even if the block key remains held', () => {
  const f = fighter({ guard: 0, guardBroken: true, guardDelay: 1.5, state: 'guardbreak' });
  ticks(f, 120);
  assert.equal(f.guard, 0);
  assert.equal(canBlock(f), false);
  f.state = 'idle';
  ticks(f, 120, true);
  assert.ok(f.guard > 0 && f.guard < 30);
  assert.equal(canBlock(f), false);
  ticks(f, 120, true);
  assert.ok(f.guard >= 30);
  assert.equal(canBlock(f), true);
});

test('attacking, charging, hitstun and death cannot regenerate defense', () => {
  for (const state of [
    'attack',
    'charge',
    'blastCharge',
    'hit',
    'blockstun',
    'knockdown',
    'guardbreak',
    'grabbed',
    'dead',
  ]) {
    const f = fighter({ guard: 40, state });
    ticks(f, 120 * 3);
    assert.equal(f.guard, 40, state);
  }
  const dead = fighter({ hp: 0, guard: 40 });
  ticks(dead, 120 * 3);
  assert.equal(dead.guard, 40);
});
