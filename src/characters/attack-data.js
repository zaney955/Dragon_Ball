export function register({ animation: animationModule, characters: charactersModule }) {
  charactersModule.mkAtk = function mkAtk(id, anim, dmg, range, dur, hitT, kb, stun, ki) {
    return {
      id,
      anim: animationModule.ANIM[anim],
      dmg,
      range,
      dur,
      hitT,
      kb,
      stun,
      ki,
    };
  };
  return function initialize() {};
}
