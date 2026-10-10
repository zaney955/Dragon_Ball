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
      if (f.lastDecision?.decisionTime !== before && !f.attack && !input.block) {
        const dist = Math.hypot(seen.x - f.pos.x, seen.z - f.pos.z),
          id = f.def.id;
        let variant = null;
        if (
          (id === 'goku' && dist < 1.8) ||
          (id === 'korin' && f.hp / f.maxHp < 0.7 && dist > 3 && !seen.attack) ||
          (['roshi', 'tien'].includes(id) && dist > 3 && !seen.attack)
        )
          variant = 1;
        else if (id === 'oolong') variant = seen.attack && dist < 2 ? 1 : 0;
        else if (id === 'bulma') variant = seen.attack && dist < 3 ? 1 : 0;
        else if (['yamcha', 'chiaotzu'].includes(id) && seen.attack && dist < 2) variant = 1;
        else if (id === 'pilaf') variant = seen.attack && dist < 2 ? 1 : 0;
        else if (id === 'piccolo') variant = dist < 2 ? 1 : 0;
        else if (id === 'krillin' && dist > 2 && dist < 6) variant = 1;
        else if (id === 'gyumao') variant = seen.y < 0.3 && dist > 2 ? 1 : 0;
        else if (dist < f.def.skills[0].range + 0.2) variant = 0;
        if (
          variant != null &&
          combat.skillAvailability(f, variant).available &&
          ai.combatRandom() < 0.45
        )
          input.actions = [{ type: 'special', variant, down: variant === 1 }];
      }
      input.actions = (input.actions ?? []).filter(
        (a) =>
          a.type !== 'special' ||
          combat.skillAvailability(f, a.variant ?? (a.down ? 1 : 0), { cancel: !!f.attack })
            .available,
      );
      input.actions = input.actions.filter((a) => {
        if (
          (f.youth.form === 'bat' && ['blast', 'ult', 'throw'].includes(a.type)) ||
          (f.youth.form === 'ape' && ['blast', 'throw'].includes(a.type))
        )
          return false;
        return a.type !== 'blast' || !['gyumao', 'oolong', 'korin'].includes(f.def.id);
      });
      return input;
    };
  };
}
