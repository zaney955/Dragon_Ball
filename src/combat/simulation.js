export function register({ combat: combatModule, match: matchModule, world: worldModule }) {
  combatModule.resolveOverlap = function resolveOverlap() {
    if (
      !matchModule.player ||
      !matchModule.enemy ||
      matchModule.player.hp <= 0 ||
      matchModule.enemy.hp <= 0
    )
      return;
    const p = matchModule.player,
      e = matchModule.enemy,
      ph = 2.35 * p.baseScale,
      eh = 2.35 * e.baseScale;
    if (p.launchFlight || e.launchFlight || p.pos.y > e.pos.y + eh || e.pos.y > p.pos.y + ph)
      return;
    const min = 0.3 * p.baseScale + 0.3 * e.baseScale,
      dx = p.pos.x - e.pos.x,
      dz = p.pos.z - e.pos.z,
      d = Math.hypot(dx, dz);
    if (d >= min) return;
    const nx = d > 0.0001 ? dx / d : Math.sin(p.facingAngle),
      nz = d > 0.0001 ? dz / d : Math.cos(p.facingAngle),
      push = (min - d) / 2;
    p.pos.x += nx * push;
    p.pos.z += nz * push;
    e.pos.x -= nx * push;
    e.pos.z -= nz * push;
    p.clampPos();
    e.clampPos();
    // At the arena boundary, hand the unfulfilled displacement to the other pushbox.
    const remain = min - Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    if (remain > 0.001) {
      const b = worldModule.currentMap.bounds;
      if (Math.abs(p.pos.x) >= b.x - 0.001 || Math.abs(p.pos.z) >= b.z - 0.001) {
        e.pos.x -= nx * remain;
        e.pos.z -= nz * remain;
      } else {
        p.pos.x += nx * remain;
        p.pos.z += nz * remain;
      }
      p.clampPos();
      e.clampPos();
    }
  };
  return function initialize() {};
}
