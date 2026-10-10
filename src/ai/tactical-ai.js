import { routeDirection, segmentHit } from '../world/space.js';
import * as THREE from 'three';
export function register({
  ai: aiModule,
  combat: combatModule,
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
    if (
      ai.observeTimer <= 0 &&
      !combatModule.inYouthSmoke?.(ai) &&
      !combatModule.inYouthSmoke?.(foe)
    ) {
      ai.observeTimer = 0.04;
      ai.observations.push({
        time: ai.brainTime,
        x: foe.pos.x,
        z: foe.pos.z,
        y: foe.pos.y,
        scale: foe.baseScale,
        facingAngle: foe.facingAngle,
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
      // Low defense needs room to recover. Hit escape still uses block + dash.
      if ((ai.guardBroken || ai.guard <= 25) && ai.state !== 'hit') {
        ai.aiBlockTimer = 0;
        input.block = false;
        input.crouch = false;
        if (!ai.attack && seen.attack && !recovering) {
          input.down = true;
          input.light = input.heavy = input.special = input.ult = false;
          ai.aiIntent = 'defend';
        }
      }
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
        } else {
          const routes = ai.attack.cancelRules.hit;
          if (ai.comboType && routes.includes(ai.comboType)) input[ai.comboType] = true;
          else if (routes.includes('heavy')) input.heavy = true;
          else if (
            routes.includes('special') &&
            combatModule.skillAvailability(ai, 0, { cancel: true }).available
          )
            input.special = true;
          else if (
            routes.includes('ult') &&
            combatModule.ultimateAvailability(ai, { cancel: true }).available
          )
            input.ult = true;
        }
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
            d / (6.8 * combatModule.mobilitySpeed(ai)) + 0.35
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
        input.heavy = true;
        input.wantLauncher = true;
        ai.aiIntent = 'defend';
      } else if (!ai.attack && dist < near + 0.18 && roll < accuracy * 0.12) {
        input.heavy = true;
        ai.aiIntent = 'pressure';
      } else if (!ai.attack && dist < near + 0.2 && roll < accuracy) {
        input.light = true;
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
      if ((tx || tz) && worldModule.currentMap?.playArea) {
        const map = worldModule.currentMap;
        if (
          !ai.navigation ||
          ai.navigation.at + 0.3 < ai.brainTime ||
          ai.navigation.revision !== map.spaceRevision
        ) {
          const goal = { x: ai.pos.x + tx, z: ai.pos.z + tz };
          ai.navigation = {
            ...routeDirection(map, ai.pos, goal, Math.max(0.4, 0.3 * ai.baseScale)),
            at: ai.brainTime,
            revision: map.spaceRevision,
          };
        }
        tx = ai.navigation.x;
        tz = ai.navigation.z;
        if (!ai.stageProgress || ai.stageProgress.at + 0.6 < ai.brainTime) {
          const moved = ai.stageProgress
            ? Math.hypot(ai.pos.x - ai.stageProgress.x, ai.pos.z - ai.stageProgress.z)
            : 1;
          ai.stageStuck = moved < 0.15 ? (ai.stageStuck ?? 0) + 0.6 : 0;
          ai.stageProgress = { x: ai.pos.x, z: ai.pos.z, at: ai.brainTime };
        }
        // A coarse navigation cell can miss a narrow opening. Reaching the
        // nearest cell must not leave the AI idle: approach and break the cover.
        if (dist > 3 && (Math.hypot(tx, tz) < 0.25 || ai.stageStuck > 1.2)) {
          tx = dx;
          tz = dz;
        }
        // Attack a nearby destructible cover when pursuit reaches its face.
        const from = ai.pos
          .clone()
          .setY(ai.pos.y + worldModule.groundHeight(ai.pos.x, ai.pos.z) + 1);
        const hit = segmentHit(map, from, new THREE.Vector3(seen.x, from.y, seen.z));
        if (hit && hit.distance < 1.6 && (ai.aiDecision < 0.02 || ai.stageStuck > 1.2))
          input.heavy = true;
      }
      input.right = tx > 0.1;
      input.left = tx < -0.1;
      input.down = tz > 0.1;
      input.up = tz < -0.1;
      // Expanded arenas need traversal between engagements. Keep the original
      // near-range decisions and resource reserve, and dash along the path.
      if (dist > 10 && ai.ki >= 35 && ai.dashCooldown <= 0 && (tx || tz)) input.dash = true;
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
