export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
}) {
  charactersModule.legacyDirectionMove = function legacyDirectionMove(f, a, input) {
    return combatModule.finalizeMove(
      input.up
        ? {
            ...a,
            id: 'launcher',
            motion: 'uppercut',
            anim: animationModule.ANIM.uppercut,
            dmg: 10,
            startup: 0.17,
            hitT: 0.17,
            active: 0.09,
            recovery: 0.31,
            dur: 0.57,
            launch: 6.8,
            range: f.def.id === 'tien' ? 2.1 : 1.4 * f.baseScale,
            level: 'mid',
            guardDamage: 22,
            kb: 1.2,
            stun: 0.66,
          }
        : {
            ...a,
            id: 'sweep',
            motion: 'sweep',
            anim: animationModule.ANIM.sweep,
            dmg: 11,
            startup: 0.18,
            hitT: 0.18,
            active: 0.09,
            recovery: 0.35,
            dur: 0.62,
            knockdown: true,
            level: 'low',
            range: 1.6 * f.baseScale,
            guardDamage: 18,
            kb: 2.4,
            stun: 0.6,
          },
    );
  };
  charactersModule.characterMoveData = function characterMoveData(c) {
    const scale =
        {
          goku: 0.95,
          roshi: 1.04,
          taopaipai: 1.16,
          piccolo: 1.48,
          tien: 1.28,
          krillin: 0.79,
          yamcha: 1,
        }[c.id] ?? 1,
      f = {
        def: c,
        baseScale: scale,
      };
    const dirs = [
      {
        up: true,
      },
      {
        down: true,
      },
    ].map((input) =>
      c.type === 'martial'
        ? charactersModule.legacyDirectionMove(f, c.combos.heavy[0], input)
        : combatModule.v2DirectionalMove(f, c.combos.heavy[0], input),
    );
    const t =
        c.type === 'martial'
          ? combatModule.finalizeMove({
              id: 'throw',
              name: '投技 / 拆投 O',
              isThrow: true,
              dmg: 12,
              startup: 0.15,
              active: 0.045,
              recovery: 0.505,
              stun: 0.65,
              kb: 5.8,
              range: 1.36,
              ki: 8,
            })
          : combatModule.v2ThrowMove(f),
      u = combatModule.finalizeMove({
        id: 'ult',
        name: c.ultName,
        kiCost: 100,
        motion: c.ultStyle,
        stun: 0.4,
        blockstun: 0.13,
        ...(c.ult ?? charactersModule.LEGACY_ULT_PROFILES[c.id]),
      });
    return [
      ...c.combos.light,
      ...c.combos.heavy,
      ...dirs.map((a, i) => ({
        ...a,
        name: i ? '下段 S+K' : '反空 W+K',
      })),
      t,
      combatModule.finalizeMove({
        id: 'special',
        kiCost: 30,
        ...combatModule.SPECIAL_MOVES[c.id],
      }),
      u,
    ];
  };
  return function initialize() {
    charactersModule.LEGACY_ULT_PROFILES = {
      goku: {
        startup: 0.72,
        active: 0.18,
        recovery: 0.62,
        range: 8.5,
        dmg: 32,
        shape: 'beam',
        width: 0.3,
      },
      roshi: {
        startup: 0.8,
        active: 0.22,
        recovery: 0.65,
        range: 6,
        dmg: 23,
        shape: 'beam',
        width: 0.5,
        stun: 1.2,
        kb: 1.5,
      },
      taopaipai: {
        startup: 0.4,
        active: 0.1,
        recovery: 0.7,
        range: 10,
        dmg: 30,
        shape: 'beam',
        width: 0.09,
      },
      piccolo: {
        startup: 0.95,
        active: 0.24,
        recovery: 0.75,
        range: 7,
        dmg: 39,
        shape: 'beam',
        width: 0.9,
        guardDamage: 58,
      },
      tien: {
        startup: 0.85,
        active: 0.2,
        recovery: 0.9,
        range: 7,
        dmg: 44,
        shape: 'beam',
        width: 0.65,
      },
      krillin: {
        startup: 1.02,
        active: 0.15,
        recovery: 0.5,
        range: 18,
        dmg: 36,
        shape: 'disc',
      },
      yamcha: {
        startup: 0.3,
        active: 0.48,
        recovery: 0.6,
        range: 1.8,
        dmg: 8,
        shape: 'wolf',
        hits: [0, 0.14, 0.28, 0.42],
        drive: 11,
        stun: 0.22,
        kb: 0.35,
      },
    };
  };
}
