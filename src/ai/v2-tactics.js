// Skills are chosen from the current roster and delayed observations.
export function selectYouthSkill(f, seen, availability) {
  const distance = Math.hypot(seen.x - f.pos.x, seen.z - f.pos.z);
  const recovering = seen.attack && seen.attack.phase >= seen.attack.hitT + seen.attack.active;
  const threat = seen.attack && !recovering;
  for (const variant of [1, 0]) {
    const info = availability(f, variant);
    if (!info.available || info.reverting) continue;
    const s = info.skill;
    let useful;
    switch (s.ability) {
      case 'heal':
        useful = f.hp / f.maxHp < 0.7 && distance > 3 && !threat;
        break;
      case 'muscle':
      case 'fourArms':
      case 'armor':
      case 'mode':
        useful = distance > 3 && !threat;
        break;
      case 'counter':
      case 'sidestep':
      case 'catStep':
      case 'floatRetreat':
        useful = !!threat && distance < Math.min(2.5, seen.attack.range + 0.2);
        break;
      case 'bat':
        useful = !!threat && distance < 2;
        break;
      case 'ogre':
        useful = distance < 3 && !seen.attack && !['block', 'blockstun'].includes(seen.state);
        break;
      case 'demon':
        useful = distance > 2 && distance < 6 && !threat;
        break;
      case 'capsule':
        useful = distance > 2 && distance < 8 && !threat;
        break;
      case 'weapon':
        useful = !threat && (f.youth.weapon === 'flame' ? distance > 3 : distance < 2.5);
        break;
      case 'solar': {
        const dx = f.pos.x - seen.x,
          dz = f.pos.z - seen.z;
        useful =
          distance <= s.range &&
          !['block', 'blockstun'].includes(seen.state) &&
          Math.sin(seen.facingAngle) * dx + Math.cos(seen.facingAngle) * dz > distance * 0.3;
        break;
      }
      default:
        useful =
          distance <= s.range &&
          (s.shape !== 'ground' || seen.y < 0.35) &&
          (!threat || recovering) &&
          (s.shape !== 'beam' || s.control > 0 || distance > 2);
    }
    if (useful) return { type: 'special', variant, down: variant === 1 };
  }
  return null;
}

export function register({ ai, combat, match }) {
  return function initialize() {
    ai.V2_TACTICS = {};
    const base = ai.aiThink;
    ai.aiThink = function (f, foe, dt) {
      const before = f.lastDecision?.decisionTime,
        input = base(f, foe, dt);
      if (!f.youth || match.game.difficulty === 'training') return input;
      const seen = (f.observations ?? [])
        .filter((o) => o.time <= f.brainTime - (match.game.difficulty === 'hard' ? 0.12 : 0.24))
        .at(-1);
      if (!seen) return input;
      if (combat.inYouthSmoke(f) || combat.inYouthSmoke(foe))
        f.v2.shotTarget = { x: seen.x, z: seen.z, time: f.brainTime };
      // Keep confirmed combos, punishes, throws and escape decisions intact.
      if (
        f.lastDecision?.decisionTime !== before &&
        !f.attack &&
        !input.block &&
        !input.charge &&
        !input.actions?.length &&
        !['hit', 'knockdown', 'grabbed', 'guardbreak', 'blockstun', 'landing', 'dead'].includes(
          f.state,
        )
      ) {
        const action = selectYouthSkill(f, seen, combat.skillAvailability);
        if (action && ai.combatRandom() < 0.45) input.actions = [action];
      }
      if (f.attack) {
        const followup =
          f.attack.ability === 'wolf' &&
          f.youth.wolfUntil > match.game.simTime &&
          match.game.simTime - (f.lastContactTime ?? Infinity) >= 0.065
            ? { type: 'special', down: false }
            : f.attack.ability === 'catStep' &&
                f.youth.catUntil > match.game.simTime &&
                f.stateTimer >= f.attack.hitT + 0.065
              ? { type: 'light' }
              : null;
        if (followup && !f.queue.some((q) => q.type === followup.type)) input.actions = [followup];
      }
      input.actions = (input.actions ?? []).filter((a) => {
        if (a.type === 'special')
          return combat.skillAvailability(f, a.variant ?? (a.down ? 1 : 0), { cancel: !!f.attack })
            .available;
        if (a.type === 'ult')
          return combat.ultimateAvailability(f, { cancel: !!f.attack }).available;
        if (
          (f.youth.form === 'bat' && ['light', 'heavy', 'blast', 'throw'].includes(a.type)) ||
          (['ape', 'combined'].includes(f.youth.form) && ['blast', 'throw'].includes(a.type))
        )
          return false;
        return a.type !== 'blast' || !['gyumao', 'oolong', 'korin'].includes(f.def.id);
      });
      return input;
    };
  };
}
