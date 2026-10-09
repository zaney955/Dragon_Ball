import * as THREE from 'three';
export function register({ animation: animationModule, combat: combatModule, match: matchModule }) {
  animationModule.cloneCombatPose = function cloneCombatPose(p) {
    const q = {
      ...p,
    };
    for (const k of ['aR', 'aL', 't', 'h', 'lL', 'lR']) q[k] = p[k].slice();
    return q;
  };
  animationModule.mixCombatPose = function mixCombatPose(a, b, u) {
    const p = animationModule.lerpPose(a, b, u);
    for (const [k, d] of [
      ['eR', -0.75],
      ['eL', -0.75],
      ['kL', 0.12],
      ['kR', 0.12],
    ])
      p[k] = THREE.MathUtils.lerp(a[k] ?? d, b[k] ?? d, u);
    return p;
  };
  animationModule.polishCombatPose = function polishCombatPose(f, p) {
    if (!['goku', 'taopaipai', 'piccolo'].includes(f.def.id)) return p;
    const a = f.attack,
      t = f.stateTimer;
    let q = animationModule.cloneCombatPose(p);
    // Both the visible and logical joints use this curve. The complete contact
    // interval and its preceding sweep samples retain the V0 authored trajectory.
    const entry = Math.min(0.045, a.startup * 0.45);
    if (f.poseEntry && t < entry)
      q = animationModule.mixCombatPose(
        f.poseEntry,
        q,
        animationModule.smoothstep(Math.max(0, t / entry)),
      );
    if (!a.isUlt && t > a.startup * 0.2 && t < a.startup * 0.72) {
      const k = Math.sin(((t / a.startup - 0.2) / 0.52) * Math.PI),
        weight = a.chainType === 'heavy' ? 1.4 : 1;
      q.t[1] +=
        k * (f.def.id === 'taopaipai' ? -0.07 : f.def.id === 'piccolo' ? -0.14 : -0.11) * weight;
      q.t[0] += k * (f.def.id === 'piccolo' ? 0.08 : 0.05) * weight;
      q.aL[1] -= k * 0.06;
      q.y -= k * (f.def.id === 'piccolo' ? 0.055 : 0.025) * weight;
      q.lL[0] = THREE.MathUtils.lerp(q.lL[0], 0.03, k * 0.45);
    }
    const end = a.hitT + a.active;
    if (t > end + 2 * matchModule.STEP && !a.isUlt) {
      const u = Math.min(1, (t - end) / a.recovery);
      q.t[1] += Math.sin(u * Math.PI) * 0.055 * (a.chainType === 'heavy' ? 1.5 : 1);
      const fade = Math.min(0.1, a.recovery * 0.4);
      if (t > a.dur - fade)
        q = animationModule.mixCombatPose(
          q,
          combatModule.neutralCombatPose(f, true),
          animationModule.smoothstep(Math.min(1, (t - a.dur + fade) / fade)),
        );
    }
    return q;
  };
  return function initialize() {};
}
