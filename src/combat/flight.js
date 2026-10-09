import * as THREE from 'three';
export function register({
  characters: charactersModule,
  combat: combatModule,
  render: renderModule,
}) {
  combatModule.makeFlyingNimbus = function makeFlyingNimbus() {
    const g = new THREE.Group(),
      gold = charactersModule.M(0xf4ca36),
      soft = charactersModule.M(0xffe77d);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.18,
        z = Math.sin(i * 2.3) * 0.12;
      charactersModule.ball(
        g,
        i % 2 ? gold : soft,
        x,
        0.01 + Math.sin(i) * 0.035,
        z,
        0.27,
        [1.25, 0.55, 1],
      );
    }
    charactersModule.tube(
      g,
      gold,
      [
        [-0.52, 0.02, 0],
        [-0.85, 0.04, 0],
        [-1.15, 0.07, 0.02],
        [-1.32, 0.18, 0.04],
      ],
      0.075,
    );
    g.visible = false;
    renderModule.scene.add(g);
    return g;
  };
  combatModule.flightPhysics = function flightPhysics(f, dt, input) {
    if (
      ['dead', 'hit', 'knockdown', 'guardbreak', 'grabbed', 'blockstun', 'landing'].includes(
        f.state,
      )
    ) {
      f.flightMode = false;
      return false;
    }
    if (f.pos.y <= 0.001) {
      f.airTime = 0;
      f.airLocked = false;
    }
    const cloud = f.def.id === 'goku',
      limit = cloud ? 4.3 : f.def.id === 'piccolo' || f.def.id === 'tien' ? 3.2 : 2.3,
      cost = cloud ? 7 : 15;
    if (
      input.flight &&
      f.state !== 'charge' &&
      f.state !== 'blastCharge' &&
      !(f.attack?.isUlt && !f.attack.costCommitted) &&
      !f.airLocked &&
      f.ki > cost * dt
    ) {
      f.flightMode = true;
      f.airTime = (f.airTime ?? 0) + dt;
      f.ki = Math.max(0, f.ki - cost * dt);
      f.jumpVel = THREE.MathUtils.lerp(f.jumpVel, cloud ? 3.3 : 2.9, 1 - Math.exp(-5 * dt));
      if (f.pull('jump')) f.jumpVel = Math.min(5, Math.max(3, f.jumpVel) + 1);
      f.pos.y = Math.max(0.015, f.pos.y);
      if (f.airTime >= limit || f.ki <= 0.1) f.airLocked = true;
    } else if (f.flightMode) f.airLocked = true;
    if (!f.flightMode) return false;
    if (f.airLocked) f.jumpVel = THREE.MathUtils.lerp(f.jumpVel, -3.8, 1 - Math.exp(-8 * dt));
    const max = cloud ? 4.5 : f.def.id === 'piccolo' || f.def.id === 'tien' ? 4 : 3;
    f.pos.y = THREE.MathUtils.clamp(f.pos.y + f.jumpVel * dt, 0, max);
    if (f.pos.y >= max) f.jumpVel = Math.min(0, f.jumpVel);
    if (f.pos.y <= 0) {
      f.jumpVel = 0;
      f.flightMode = false;
      f.airLocked = false;
      f.airTime = 0;
      if (!f.attack) {
        f.state = 'landing';
        f.stateTimer = 0;
        f.stunTime = 0.12;
      }
      combatModule.emitCombatEvent('landing', f, null, null);
      renderModule.spawnDust(f.pos, 4);
    }
    return true;
  };
  return function initialize() {};
}
