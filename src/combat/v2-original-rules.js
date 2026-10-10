export function register({ combat: combatModule, match: matchModule }) {
  let v2SpecialBase, v2TakeBase, v2IntersectsBase, v2EndBase;
  return function initialize() {
    v2SpecialBase = combatModule.Fighter.prototype.startSpecial;
    combatModule.Fighter.prototype.startSpecial = function (context = {}) {
      const result = v2SpecialBase.call(this, context);
      if (!this.anatomy && this.attack?.id === 'special') {
        if (this.def.id === 'goku' && context.up) {
          Object.assign(
            this.attack,
            combatModule.finalizeMove({
              ...this.attack,
              name: '如意挑空',
              launch: 5.7,
              stun: 0.55,
              startup: 0.26,
              recovery: 0.42,
              range: 2.65,
            }),
          );
        }
        if (this.def.id === 'taopaipai' && context.down) {
          this.attack.name = '杀手后撤掌';
          this.vel.copy(this.forward()).multiplyScalar(-7);
        }
      }
      return result;
    };
    v2TakeBase = combatModule.Fighter.prototype.takeHit;
    combatModule.Fighter.prototype.takeHit = function (attacker, a) {
      const old = this.attack,
        oldHp = this.hp;
      v2TakeBase.call(this, attacker, a);
      if (
        this.def.id === 'roshi' &&
        old?.id === 'special' &&
        this.attack === old &&
        this.hp < oldHp &&
        this.lastHitText === '霸体承伤'
      ) {
        old.dmg = 16;
        old.counterPalm = true;
      }
      if (attacker.def.id === 'yamcha' && a.chainType === 'heavy' && this.lastHitText === '格挡') {
        attacker.v2.pressureBroken = true;
      }
    };
    v2IntersectsBase = combatModule.combatIntersects;
    combatModule.combatIntersects = function (f, foe, a) {
      if (a.shape === 'ground' && (f.pos.y > 0.3 || foe.pos.y > 0.35)) return false;
      return v2IntersectsBase(f, foe, a);
    };
    v2EndBase = matchModule.endGame;
    matchModule.endGame = function (reason = null) {
      v2EndBase(reason);
      if (matchModule.game.over) {
        combatModule.cleanupAbilities();
        for (const f of [matchModule.player, matchModule.enemy])
          if (f) {
            if (f.def.id === 'oolong' && f.v2.form !== 'pig') combatModule.switchForm(f, 'pig');
            f.v2.controlTime = 0;
            f.v2.controlGrace = 0;
            f.v2.formSequence = null;
            f.v2.formTime = 0;
            f.v2.formCooldown = 0;
            f.v2.modeTime = 0;
            f.v2.mode = 'missile';
            f.v2.cooldown = 0;
            f.v2.bladeOut = false;
          }
      }
    };
  };
}
