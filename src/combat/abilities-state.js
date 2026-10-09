export function register({ combat: combatModule }) {
  combatModule.initV2Fighter = function initV2Fighter(f) {
    f.v2 = {
      cooldown: 0,
      form: 'pig',
      formTime: 0,
      formCooldown: 0,
      mode: 'missile',
      modeTime: 0,
      modeCooldown: 0,
      bladeOut: false,
      heals: 1,
      intuition: 0,
      controlTime: 0,
      controlGrace: 0,
      controlChain: 0,
      healTotal: 0,
    };
    f.anatomy = f.parts.anatomy ?? null;
    f.baseDef = f.def;
  };
  combatModule.mobilitySpeed = function mobilitySpeed(f) {
    let s = f.def.speed;
    if (f.v2?.form !== 'pig' && f.def.id === 'oolong')
      s *=
        {
          bull: 0.6,
          bat: 1.55,
          robot: 0.85,
        }[f.v2.form] ?? 1;
    if (f.v2?.bladeOut && f.def.id === 'chichi') s *= 0.94;
    return s;
  };
  return function initialize() {
    combatModule.V2_VERSION = '十四角色完全进化版';
    combatModule.v2Projectiles = [];
    combatModule.v2Devices = [];
    combatModule.v2Supports = [];
  };
}
