export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
}) {
  return function initialize() {
    charactersModule.kDef = charactersModule.CHARACTERS.find((c) => c.id === 'krillin');
    charactersModule.kDef.combos.light[1] = {
      ...charactersModule.kDef.combos.light[1],
      name: '小林反掌',
      motion: 'palmStrike',
      anim: animationModule.ANIM.palmStrike,
      drive: 4.5,
    };
    charactersModule.kDef.combos.light[2] = {
      ...charactersModule.kDef.combos.light[2],
      name: '小林连踢',
      motion: 'heavyKick',
      anim: animationModule.ANIM.heavyKick,
      drive: 5,
    };
    charactersModule.kDef.combos.heavy.push(
      combatModule.finalizeMove({
        ...charactersModule.kDef.combos.heavy[2],
        id: 'h4',
        name: '低身回旋踢',
        motion: 'spinKick',
        anim: animationModule.ANIM.spinKick,
        startup: 0.32,
        active: 0.1,
        recovery: 0.48,
        dmg: 20,
        kb: 5,
        range: 1.55,
        chainIndex: 3,
        terminal: true,
      }),
    );
    charactersModule.kDef.combos.heavy[2].terminal = false;
    charactersModule.kDef.combos.heavy[2].cancelRules = {
      hit: ['heavy', 'special', 'ult', 'dash'],
      block: [],
      whiff: [],
    };
    charactersModule.yDef = charactersModule.CHARACTERS.find((c) => c.id === 'yamcha');
    charactersModule.yDef.combos.heavy[1] = {
      ...charactersModule.yDef.combos.heavy[1],
      name: '狼牙交错爪',
      motion: 'backClaw',
      anim: animationModule.ANIM.backClaw,
      hits: [0, 0.07],
      dmg: 7,
      active: 0.17,
    };
    charactersModule.yDef.combos.heavy[1] = combatModule.finalizeMove(
      charactersModule.yDef.combos.heavy[1],
    );
    charactersModule.yDef.combos.heavy[2] = {
      ...charactersModule.yDef.combos.heavy[2],
      name: '狼牙压肘',
      motion: 'elbow',
      anim: animationModule.ANIM.elbow,
    };
  };
}
