export function register({
  ai: aiModule,
  match: matchModule,
  training: trainingModule,
  world: worldModule,
}) {
  aiModule.combatRandom = function combatRandom() {
    aiModule.tacticalSeed ^= aiModule.tacticalSeed << 13;
    aiModule.tacticalSeed ^= aiModule.tacticalSeed >>> 17;
    aiModule.tacticalSeed ^= aiModule.tacticalSeed << 5;
    return (aiModule.tacticalSeed >>> 0) / 4294967296;
  };
  aiModule.setCombatSeed = function setCombatSeed(seed) {
    aiModule.tacticalSeed = seed >>> 0 || 1;
  };
  aiModule.aiThink = function aiThink(ai, foe, dt) {
    const input = {};
    if (ai.hp <= 0) return input;
    if (ai.hp >= ai.maxHp - 0.1) ai.beanGoal = null;
    if (matchModule.game.difficulty === 'training') {
      const drill = trainingModule.drillInput(ai, foe);
      if (drill) return drill;
      const dummy = matchModule.game.trainingDummy;
      input.block =
        dummy === 'guard' ||
        dummy === 'lowguard' ||
        dummy === 'random' ||
        (dummy === 'after' && (ai.receivedCombo > 0 || ai.state === 'blockstun'));
      if (dummy === 'random') {
        ai.aiDecision -= dt;
        if (ai.aiDecision <= 0) {
          ai.aiDecision = 0.8;
          ai.aiCrouch = aiModule.combatRandom() < 0.5;
        }
      }
      input.crouch = dummy === 'lowguard' || (dummy === 'random' && ai.aiCrouch);
      if (dummy === 'tech' && ai.throwPending && ai.throwPending.timer < 0.1) input.throw = true;
      if (dummy === 'throws') {
        ai.aiDecision -= dt;
        if (ai.aiDecision <= 0) {
          ai.aiDecision = 1.3;
          input.throw = true;
        }
      }
      return input;
    }
    // Delayed, bounded observations. Difficulty changes choice quality, not these V0 delays.
    const hard = matchModule.game.difficulty === 'hard',
      reaction = hard ? 0.12 : 0.24;
    ai.brainTime = (ai.brainTime ?? 0) + dt;
    ai.observeTimer = (ai.observeTimer ?? 0) - dt;
    ai.observations ??= [];
    if (ai.observeTimer <= 0) {
      ai.observeTimer = 0.04;
      ai.observations.push({
        time: ai.brainTime,
        x: foe.pos.x,
        z: foe.pos.z,
        y: foe.pos.y,
        scale: foe.baseScale,
        state: foe.state,
        attack: foe.attack
          ? {
              serial: foe.attack.serial,
              motion: foe.attack.motion,
              range: foe.attack.range,
              level: foe.attack.level,
              phase: foe.stateTimer,
              hitT: foe.attack.hitT,
              active: foe.attack.active,
              dur: foe.attack.dur,
              result: foe.hitResult,
              isUlt: foe.attack.isUlt,
            }
          : null,
      });
      if (ai.observations.length > 24) ai.observations.shift();
    }
    let seen = ai.observations[0];
    for (const o of ai.observations) if (o.time <= ai.brainTime - reaction) seen = o;
    if (!seen || ai.brainTime < reaction) return input;
    const dx = seen.x - ai.pos.x,
      dz = seen.z - ai.pos.z,
      dist = Math.hypot(dx, dz),
      near = aiModule.cpuDistance(ai, seen),
      accuracy = hard ? 0.85 : 0.61;
    const remaining = seen.attack
      ? seen.attack.dur - seen.attack.phase - (ai.brainTime - seen.time)
      : 0;
    const recovering = !!seen.attack && seen.attack.phase > seen.attack.hitT + seen.attack.active;
    const finish = () => {
      const actions = [];
      for (const type of [
        'light',
        'heavy',
        'special',
        'ult',
        'throw',
        'dash',
        'evasion',
        'pursuit',
        'blast',
      ])
        if (input[type]) {
          actions.push({
            type,
            up: type === 'heavy' && !!input.wantLauncher,
            down: false,
          });
          delete input[type];
        }
      input.actions = actions;
      delete input.wantLauncher;
      return input;
    };
    // Own confirmed contact is allowed information. Give it a human-readable
    // confirmation delay, queue once, and never chain from a blocked or missed hit.
    if (
      ai.attack &&
      ai.hitResult === 'hit' &&
      ai.comboQueuedSerial !== ai.attack.serial &&
      matchModule.game.simTime - (ai.lastContactTime ?? matchModule.game.simTime) >=
        (hard ? 0.065 : 0.1)
    ) {
      ai.comboQueuedSerial = ai.attack.serial;
      const roll = aiModule.combatRandom();
      if (roll < accuracy) {
        if (ai.attack.id === 'launcher' && ai.ki >= 12 && ai.pursuitCooldown <= 0) {
          input.pursuit = true;
          ai.airFollowUntil = ai.brainTime + 0.65;
        } else if (ai.comboType === 'light' && !ai.attack.terminal) {
          if (
            ai.comboIdx === 0 &&
            ['goku', 'piccolo'].includes(ai.def.id) &&
            ai.ki >= 18 &&
            roll < 0.28
          ) {
            input.heavy = true;
            input.wantLauncher = true;
          } else if (ai.def.id === 'taopaipai' && ai.comboIdx === 0 && ai.ki >= 40 && roll < 0.3)
            input.special = true;
          else input.light = true;
        } else if (ai.attack.terminal && ai.ki >= 30 && ai.def.id === 'taopaipai')
          input.special = true;
      }
      ai.aiIntent = 'attack';
      return finish();
    }
    if (
      !ai.attack &&
      ai.dashTime <= 0 &&
      ai.pos.y > 0.15 &&
      ai.airFollowUntil > ai.brainTime &&
      dist < 1.7
    ) {
      input.light = true;
      ai.airFollowUntil = 0;
      ai.aiIntent = 'attack';
      return finish();
    }
    ai.aiDecision -= dt;
    ai.aiBlockTimer = Math.max(0, ai.aiBlockTimer - dt);
    input.block = ai.aiBlockTimer > 0;
    input.crouch = input.block && !!ai.aiCrouch;
    if (ai.aiDecision <= 0) {
      ai.aiDecision = 0.2 + aiModule.combatRandom() * 0.1;
      const roll = aiModule.combatRandom(),
        memory = aiModule.aiMemory(ai, seen);
      ai.beanGoal = null;
      ai.aiIntent = 'probe';
      if (
        matchModule.game.matchRule !== 'competitive' &&
        ai.hp / ai.maxHp < 0.64 &&
        !['hit', 'knockdown'].includes(ai.state) &&
        !ai.attack
      ) {
        let score = 0.15;
        for (const item of worldModule.currentMap?.senzus ?? []) {
          if (!item.active) continue;
          const d = Math.hypot(item.x - ai.pos.x, item.z - ai.pos.z),
            op = Math.hypot(item.x - seen.x, item.z - seen.z);
          if (
            (item.expiresAt ?? Infinity) - worldModule.currentMap.senzuTime <
            d / (6.8 * ai.def.speed) + 0.35
          )
            continue;
          const benefit =
            Math.min(worldModule.SENZU_RULES.healRatio, 1 - ai.hp / ai.maxHp) * 5 -
            d * 0.12 -
            (op < d ? 0.65 : 0) -
            (seen.attack && dist < 3 ? 0.8 : 0);
          if (benefit > score && d < 9) {
            score = benefit;
            ai.beanGoal = item;
          }
        }
      }
      if (ai.throwPending && ai.throwPending.timer < 0.1 && roll < accuracy * 0.75) {
        input.throw = true;
        ai.aiIntent = 'defend';
      } else if (
        ai.state === 'hit' &&
        ai.receivedCombo >= 3 &&
        ai.ki >= 35 &&
        ai.breakerCooldown <= 0 &&
        roll < accuracy * 0.4
      ) {
        input.block = true;
        input.dash = true;
        ai.aiIntent = 'defend';
      } else if (
        ai.state === 'hit' &&
        ai.receivedCombo >= 2 &&
        ai.ki >= 15 &&
        ai.escapeCharges > 0 &&
        roll < accuracy * 0.45
      ) {
        input.evasion = true;
        ai.aiIntent = 'defend';
      } else if (seen.attack?.isUlt && dist > 2 && roll < accuracy) {
        input.left = dz < 0;
        input.right = dz >= 0;
        input.up = dx >= 0;
        input.down = dx < 0;
        input.dash = ai.ki >= 5;
        ai.aiBlockTimer = 0;
        ai.aiIntent = 'defend';
      } else if (seen.attack && !recovering && dist < seen.attack.range + 0.25 && roll < accuracy) {
        ai.aiBlockTimer = 0.22;
        ai.aiCrouch = seen.attack.level === 'low';
        input.block = true;
        input.crouch = ai.aiCrouch;
        ai.aiIntent = 'defend';
      } else if (
        recovering &&
        remaining > ai.def.combos.light[0].startup + 0.025 &&
        dist < near + 0.43 &&
        roll < accuracy
      ) {
        input.light = true;
        ai.aiIntent = 'punish';
      } else if (
        recovering &&
        remaining > 0.28 &&
        ai.def.id === 'goku' &&
        ai.ki >= 30 &&
        dist > 1.3 &&
        dist < 2.65 &&
        roll < accuracy
      ) {
        input.special = true;
        ai.aiIntent = 'punish';
      } else if (
        ai.def.id === 'piccolo' &&
        ai.ki >= 40 &&
        dist < 1.15 &&
        (seen.state === 'block' || memory.guard > 0.2) &&
        roll < accuracy * 0.3
      ) {
        input.special = true;
        ai.aiIntent = 'pressure';
      } else if (
        (seen.state === 'block' || memory.guard > 0.45) &&
        dist < 1.12 &&
        roll < accuracy * 0.72
      ) {
        input.throw = true;
        ai.aiIntent = 'pressure';
      } else if (ai.ki >= 100 && dist > 2.7 && dist < 7 && !seen.attack && roll < accuracy * 0.28) {
        input.ult = true;
        ai.aiIntent = 'attack';
      } else if (seen.y > ai.pos.y + 0.8 && dist < 1.65 && roll < accuracy) {
        if (ai.def.id === 'tien' && ai.ki >= 30) input.special = true;
        else {
          input.heavy = true;
          input.wantLauncher = true;
        }
        ai.aiIntent = 'defend';
      } else if (
        !ai.attack &&
        ai.def.id === 'goku' &&
        ai.ki >= 40 &&
        dist > 1.45 &&
        dist < 2.6 &&
        !seen.attack &&
        roll < accuracy * 0.32
      ) {
        input.special = true;
        ai.aiIntent = 'probe';
      } else if (
        !ai.attack &&
        dist < near + 0.18 &&
        roll < accuracy * (ai.def.id === 'piccolo' ? 0.24 : 0.12)
      ) {
        input.heavy = true;
        ai.aiIntent = 'pressure';
      } else if (!ai.attack && dist < near + 0.2 && roll < accuracy) {
        input.light = true;
        ai.aiIntent = 'attack';
      } else if (
        !ai.attack &&
        ai.def.id === 'taopaipai' &&
        ai.ki >= 45 &&
        dist > 1.1 &&
        dist < 1.55 &&
        roll < accuracy * 0.24
      ) {
        input.special = true;
        ai.aiIntent = 'attack';
      } else if (dist > 4 && dist <= 7 && ai.ki >= 36 && roll < accuracy * 0.2) {
        input.pursuit = true;
        ai.aiIntent = 'attack';
      } else if (
        !ai.attack &&
        ai.ki >= 5 &&
        dist > 2.5 &&
        dist < 9 &&
        (seen.state === 'charge' || roll < accuracy * 0.15)
      ) {
        input.blast = true;
        ai.aiIntent = 'pressure';
      } else if (ai.ki < 55 && dist > 5.5 && seen.state !== 'ult') {
        ai.chargeUntil = ai.brainTime + 0.3;
        ai.aiIntent = 'recover';
      }
      if (aiModule.combatRandom() < 0.17) ai.aiStrafe *= -1;
      if (ai.beanGoal) ai.aiIntent = 'senzu';
      ai.lastDecision = {
        observedTime: seen.time,
        decisionTime: ai.brainTime,
        reactionDelay: reaction,
        intent: ai.aiIntent,
      };
    }
    if (input.dash || input.evasion) return finish();
    if (
      !input.block &&
      !ai.attack &&
      !['hit', 'knockdown', 'guardbreak', 'grabbed'].includes(ai.state)
    ) {
      let tx = 0,
        tz = 0;
      if (ai.beanGoal?.active) {
        tx = ai.beanGoal.x - ai.pos.x;
        tz = ai.beanGoal.z - ai.pos.z;
      } else if (
        dist >
        near + (ai.aiIntent === 'probe' && (ai.tacticalMemory?.miss ?? 0) > 0.25 ? 0.3 : 0.14)
      ) {
        tx = dx;
        tz = dz;
      } else if (
        dist <
        near + (ai.aiIntent === 'probe' && (ai.tacticalMemory?.miss ?? 0) > 0.25 ? 0.1 : -0.2)
      ) {
        tx = -dx;
        tz = -dz;
      } else if (hard && ai.aiIntent === 'probe') {
        tx = dz * ai.aiStrafe;
        tz = -dx * ai.aiStrafe;
      }
      input.right = tx > 0.1;
      input.left = tx < -0.1;
      input.down = tz > 0.1;
      input.up = tz < -0.1;
      if (ai.chargeUntil > ai.brainTime && dist > 4.5) {
        input.charge = true;
        input.right = input.left = input.up = input.down = false;
      }
    }
    return finish();
  };
  return function initialize() {
    aiModule.tacticalSeed = 0x31c9a27;
  };
}
