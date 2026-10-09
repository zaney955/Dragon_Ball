export function register({ animation: animationModule }) {
  animationModule.pz = function pz(o = {}) {
    return {
      aR: o.aR || [0, 0, 0],
      aL: o.aL || [0, 0, 0],
      t: o.t || [0, 0, 0],
      h: o.h || [0, 0, 0],
      lL: o.lL || [0, 0, 0],
      lR: o.lR || [0, 0, 0],
      y: o.y || 0,
      ry: o.ry || 0,
      w: o.w || 0,
    };
  };
  animationModule.lerpPose = function lerpPose(a, b, u) {
    const L = (x, y) => x + (y - x) * u;
    const V = (x, y) => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
    return {
      aR: V(a.aR, b.aR),
      aL: V(a.aL, b.aL),
      t: V(a.t, b.t),
      h: V(a.h, b.h),
      lL: V(a.lL, b.lL),
      lR: V(a.lR, b.lR),
      y: L(a.y, b.y),
      ry: L(a.ry, b.ry),
      w: u > 0.5 ? b.w : a.w,
      eR: L(a.eR ?? -0.75, b.eR ?? -0.75),
      eL: L(a.eL ?? -0.75, b.eL ?? -0.75),
      kR: L(a.kR ?? 0.12, b.kR ?? 0.12),
      kL: L(a.kL ?? 0.12, b.kL ?? 0.12),
    };
  };
  animationModule.samplePose = function samplePose(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, pa] = keys[i],
        [tb, pb] = keys[i + 1];
      if (t >= ta && t <= tb) {
        const u = tb - ta < 0.0001 ? 1 : (t - ta) / (tb - ta);
        return animationModule.lerpPose(pa, pb, animationModule.smoothstep(u));
      }
    }
    return last[1];
  };
  return function initialize() {
    animationModule.smoothstep = (u) => u * u * (3 - 2 * u);
    animationModule.IDLE_POSE = animationModule.pz({
      aR: [-0.92, 0, 0.42],
      aL: [-0.92, 0, -0.42],
      t: [0.06, 0, 0],
      h: [0, 0, 0],
      lL: [0.06, 0, 0.05],
      lR: [-0.06, 0, -0.05],
    });
  };
}
