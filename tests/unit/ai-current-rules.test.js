import test from 'node:test';
import assert from 'node:assert/strict';
import { register, selectYouthSkill } from '../../src/ai/v2-tactics.js';
import { YOUTH_PROFILES } from '../../src/characters/youth-profiles.js';

function fighter(id) {
  return {
    def: { id, skills: YOUTH_PROFILES[id].skills },
    pos: { x: 0, z: 0 },
    hp: 100,
    maxHp: 100,
  };
}
const seenAt = (x, attack = null) => ({
  x,
  z: 0,
  y: 0,
  state: 'idle',
  facingAngle: -Math.PI / 2,
  attack,
});
const ready = (f, variant) => ({ available: true, skill: f.def.skills[variant] });

test('current skill semantics choose damaging, defensive and healing variants at useful ranges', () => {
  const threat = { phase: 0.1, hitT: 0.3, active: 0.1, range: 2 };
  assert.equal(selectYouthSkill(fighter('roshi'), seenAt(1.5, threat), ready).variant, 0);
  assert.equal(selectYouthSkill(fighter('piccolo'), seenAt(1.5), ready).variant, 1);
  assert.equal(selectYouthSkill(fighter('piccolo'), seenAt(4), ready).variant, 0);
  const korin = fighter('korin');
  korin.hp = 50;
  assert.equal(selectYouthSkill(korin, seenAt(4), ready).variant, 1);
  assert.equal(selectYouthSkill(fighter('chiaotzu'), seenAt(2), ready).variant, 0);
  assert.equal(selectYouthSkill(fighter('chiaotzu'), seenAt(1.5, threat), ready).variant, 1);
  assert.equal(selectYouthSkill(fighter('chiaotzu'), seenAt(8), ready), null);
  assert.equal(
    selectYouthSkill(fighter('goku'), seenAt(1), () => ({ available: false })),
    null,
  );
});

test('weapon switching follows the useful range instead of toggling an already suitable weapon', () => {
  const f = { ...fighter('pilaf'), youth: { weapon: 'missile' } };
  const noArmor = (f, variant) => ({ ...ready(f, variant), available: variant === 0 });
  assert.equal(selectYouthSkill(f, seenAt(1), noArmor).variant, 0);
  assert.equal(selectYouthSkill(f, seenAt(4), noArmor), null);
  f.youth.weapon = 'flame';
  assert.equal(selectYouthSkill(f, seenAt(1), noArmor), null);
  assert.equal(selectYouthSkill(f, seenAt(4), noArmor).variant, 0);
});

test('skill augmentation preserves base escape, throw, punish and ultimate decisions', () => {
  for (const type of ['evasion', 'dash', 'throw', 'light', 'ult']) {
    const f = {
      ...fighter('goku'),
      state: 'idle',
      youth: {},
      v2: {},
      brainTime: 1,
      observations: [{ ...seenAt(1), time: 0.5 }],
      lastDecision: { decisionTime: 0 },
    };
    const ai = {
      aiThink() {
        f.lastDecision = { decisionTime: 1 };
        return { actions: [{ type }] };
      },
      combatRandom: () => 0,
    };
    const combat = {
      inYouthSmoke: () => false,
      skillAvailability: ready,
      ultimateAvailability: () => ({ available: true }),
    };
    register({ ai, combat, match: { game: { difficulty: 'hard' } } })();
    assert.deepEqual(ai.aiThink(f, {}, 1 / 120).actions, [{ type }]);
  }
});

test('hitstun and resource recovery never receive an unsolicited transform skill', () => {
  for (const state of ['hit', 'guardbreak', 'knockdown', 'grabbed', 'blockstun', 'dead', 'idle']) {
    const f = {
      ...fighter('roshi'),
      state,
      youth: {},
      v2: {},
      brainTime: 1,
      observations: [{ ...seenAt(4), time: 0.5 }],
      lastDecision: { decisionTime: 0 },
    };
    const ai = {
      aiThink() {
        f.lastDecision = { decisionTime: 1 };
        return { charge: state === 'idle', actions: [] };
      },
      combatRandom: () => 0,
    };
    register({
      ai,
      combat: { inYouthSmoke: () => false, skillAvailability: ready },
      match: { game: { difficulty: 'hard' } },
    })();
    assert.deepEqual(ai.aiThink(f, {}, 1 / 120).actions, []);
  }
});

test('confirmed authored heavy chains are available to every fighter, not only the old light routes', async () => {
  const { register: tactical } = await import('../../src/ai/tactical-ai.js');
  const f = {
    ...fighter('gyumao'),
    hp: 100,
    ki: 0,
    brainTime: 1,
    observeTimer: 1,
    observations: [{ ...seenAt(1), time: 0.5 }],
    attack: { serial: 8, id: 'h1', cancelRules: { hit: ['heavy'] } },
    hitResult: 'hit',
    comboType: 'heavy',
    lastContactTime: 0,
  };
  const ai = { cpuDistance: () => 1 };
  tactical({
    ai,
    combat: {},
    match: { game: { difficulty: 'hard', simTime: 1 } },
    training: {},
    world: {},
  })();
  ai.combatRandom = () => 0;
  assert.deepEqual(ai.aiThink(f, {}, 1 / 120).actions, [{ type: 'heavy', up: false, down: false }]);
});

test('training armor windows use current continuous and limited protection timing', async () => {
  const { register: memory } = await import('../../src/ai/memory.js');
  const ai = {};
  memory({ ai })();
  const f = { hp: 10, stateTimer: 0.45, attack: { hitT: 0.4, active: 0.2, superArmor: true } };
  assert.equal(ai.armorWindow(f), true);
  f.stateTimer = 0.61;
  assert.equal(ai.armorWindow(f), false);
  f.attack = { hitT: 0.4, active: 0.2, limitedArmor: 'light' };
  f.stateTimer = 0.2;
  assert.equal(ai.armorWindow(f), false);
  f.stateTimer = 0.45;
  assert.equal(ai.armorWindow(f), true);
  f.armorSpent = true;
  assert.equal(ai.armorWindow(f), false);
});
