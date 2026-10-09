import * as THREE from 'three';
export function register({
  animation: animationModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
}) {
  animationModule.v0AttackPose = function v0AttackPose(f) {
    if (!f.attack) return combatModule.neutralCombatPose(f);
    if (f.attack.isKiBlast) return combatModule.kiBlastPose(f);
    const a = f.attack,
      contact = a.isUlt ? 0.66 : (renderModule.CONTACT_PHASE[a.motion] ?? 0.45),
      ratio = f.stateTimer / a.hitT;
    const phase =
      f.stateTimer < a.hitT
        ? a.isUlt
          ? ratio <= 0.78
            ? (ratio / 0.78) * 0.44
            : 0.44 + ((ratio - 0.78) / 0.22) * (contact - 0.44)
          : ratio * contact
        : f.stateTimer < a.hitT + a.active
          ? contact + Math.min(0.12, ((f.stateTimer - a.hitT) / a.active) * 0.12)
          : contact +
            0.12 +
            (1 - contact - 0.12) * Math.min(1, (f.stateTimer - a.hitT - a.active) / a.recovery);
    const pose = {
        ...animationModule.samplePose(a.anim, phase),
      },
      reach = Math.exp(-Math.pow((f.stateTimer - a.hitT) / Math.max(0.085, a.active), 2));
    pose.eR = -1.1 + reach * 1.05;
    pose.eL =
      -1.05 + reach * (a.motion === 'cross' || a.motion === 'doublePalm' || a.isUlt ? 1.02 : 0.25);
    pose.kR = a.motion.toLowerCase().includes('kick') ? 0.55 * (1 - reach) : 0.17;
    pose.kL = 0.12;
    if (/^(jab|cross|palmStrike|heavyPunch|rushPalm)$/.test(a.motion)) {
      pose.aR = [...pose.aR];
      pose.aL = [...pose.aL];
      const k = Math.min(1, Math.max(0, ratio));
      if (a.motion === 'cross') pose.aL[2] = THREE.MathUtils.lerp(pose.aL[2], 0.64, k);
      else pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, k);
    }
    if (a.id === 'special' && /staff/i.test(a.motion)) {
      pose.aR = [
        THREE.MathUtils.lerp(pose.aR[0], -1.48, reach),
        0,
        THREE.MathUtils.lerp(pose.aR[2], -0.64, reach),
      ];
      pose.t = [
        THREE.MathUtils.lerp(pose.t[0], 0.08, reach),
        THREE.MathUtils.lerp(pose.t[1], 0, reach),
        0,
      ];
      pose.ry = 0;
    }
    if (a.motion === 'uppercut') {
      const rise = THREE.MathUtils.clamp((f.stateTimer - a.hitT) / a.active, 0, 1);
      pose.aR = [-1.8 - rise * 0.35, 0, -0.6];
      pose.t = [-0.08, pose.t[1] * 0.35, 0];
      pose.eR = -0.3;
    }
    // Shorter fighters remain visible targets for tall punchers: incline the authored arm.
    const foe = f === matchModule.player ? matchModule.enemy : matchModule.player;
    if (a.isUlt && a.shape === 'wolf') {
      const local = Math.max(0, f.stateTimer - a.hitT),
        hitIndex = Math.min(3, Math.floor(local / 0.14)),
        t = local - hitIndex * 0.14,
        k =
          f.stateTimer < a.hitT ? Math.min(1, f.stateTimer / a.hitT) : Math.max(0.2, 1 - t / 0.14),
        tilt = THREE.MathUtils.clamp(
          (f.baseScale - (foe?.baseScale ?? f.baseScale)) * 0.9,
          -0.45,
          0.6,
        );
      pose.aR = [-1.3 + tilt, 0, -0.62];
      pose.aL = [-1.3 + tilt, 0, 0.62];
      pose.eR = hitIndex % 2 ? -0.7 : -0.05;
      pose.eL = hitIndex % 2 ? -0.05 : -0.7;
      pose.t = [0.12, (hitIndex % 2 ? -0.12 : 0.12) * k, 0];
      pose.y = -0.06;
      pose.ry = 0;
      if (f.stateTimer < a.hitT) {
        pose.aR[0] = THREE.MathUtils.lerp(-0.5, pose.aR[0], k);
        pose.aL[0] = THREE.MathUtils.lerp(-0.5, pose.aL[0], k);
      }
    }
    if (!a.isUlt && !/kick|sweep|staff|uppercut/i.test(a.motion)) {
      // Fix contact direction before fitting height. Snapshot stature when the move
      // starts: no tracking of jumps, crouches or movement during its active frames.
      const fit = reach,
        scale = a.targetScale ?? f.baseScale;
      const tilt =
        THREE.MathUtils.clamp(
          Math.atan2((f.baseScale - scale) * 1.71, 0.66 * f.baseScale),
          -0.4,
          0.85,
        ) * fit;
      pose.aR = [pose.aR[0] + tilt, pose.aR[1], pose.aR[2]];
      pose.aL = [pose.aL[0] + tilt, pose.aL[1], pose.aL[2]];
      if (a.motion === 'doublePalm') {
        pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, fit);
        pose.aL[2] = THREE.MathUtils.lerp(pose.aL[2], 0.64, fit);
      } else if (a.motion === 'claw') {
        pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, fit);
        pose.t = [pose.t[0], THREE.MathUtils.lerp(pose.t[1], 0.16, fit), pose.t[2]];
      }
    }
    return pose;
  };
  return function initialize() {};
}
