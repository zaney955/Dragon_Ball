import * as THREE from 'three';
export function register({ characters: charactersModule }) {
  charactersModule.makeSkeleton = function makeSkeleton(skin, cloth, under, boot, o = {}) {
    const root = new THREE.Group(),
      parts = {},
      child = !!o.child,
      torso = new THREE.Group();
    torso.position.y = 1.28;
    root.add(torso);
    parts.torsoGroup = torso;
    const profile = [
      new THREE.Vector2(0, -0.13),
      new THREE.Vector2(0.22, -0.12),
      new THREE.Vector2(0.235, 0.02),
      new THREE.Vector2(0.29, 0.25),
      new THREE.Vector2(0.31, 0.38),
      new THREE.Vector2(0.225, 0.47),
      new THREE.Vector2(0.095, 0.49),
      new THREE.Vector2(0, 0.49),
    ];
    const chest = charactersModule.meshTo(torso, new THREE.LatheGeometry(profile, 24), cloth);
    chest.scale.set(o.upperScale ?? 1, 1, 0.76);
    parts.chest = chest;
    charactersModule.box(torso, cloth, 0, -0.04, 0, 0.38, 0.2, 0.26);
    const collar = charactersModule.meshTo(
      torso,
      new THREE.ConeGeometry(0.145, 0.23, 3),
      under,
      0,
      0.38,
      0.24,
    );
    collar.rotation.z = Math.PI;
    collar.scale.z = 0.13;
    parts.pelvis = charactersModule.ball(root, cloth, 0, 0.98, 0, 0.245, [1.05, 0.62, 0.78]);
    charactersModule.ball(torso, skin, 0, 0.55, 0, 0.075, [1, 1.4, 1]);
    const head = new THREE.Group();
    head.position.y = child ? 0.81 : 0.82;
    torso.add(head);
    parts.head = head;
    const hr = child ? 0.315 : 0.254;
    const headGeo = new THREE.SphereGeometry(hr, 32, 24),
      pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i),
        k = y < 0 ? 1 + Math.max(-0.24, (y / hr) * 0.2) : 1;
      pos.setX(i, pos.getX(i) * k);
      if (y < -0.1) pos.setZ(i, pos.getZ(i) * 0.86);
    }
    headGeo.computeVertexNormals();
    parts.skull = charactersModule.meshTo(head, headGeo, skin, 0, 0, 0, [1, 1.05, 0.91]);
    parts.brows = [];
    for (const sign of [-1, 1]) {
      charactersModule.ball(head, skin, sign * hr * 0.94, -0.02, 0, 0.065, [0.6, 1.15, 0.55]);
      charactersModule.tube(
        head,
        charactersModule.M(0xc78c70),
        [
          [sign * hr * 0.98, 0.014, 0.013],
          [sign * hr * 0.99, -0.025, 0.025],
          [sign * hr * 0.97, -0.055, 0.015],
        ],
        0.008,
      );
      const eyeShape = new THREE.Shape();
      eyeShape.moveTo(-0.065, -0.036);
      eyeShape.lineTo(-0.063, 0.043);
      eyeShape.quadraticCurveTo(0.01, 0.074, 0.075, 0.05);
      eyeShape.lineTo(0.072, -0.026);
      eyeShape.quadraticCurveTo(0, -0.047, -0.065, -0.036);
      const eye = charactersModule.meshTo(
        head,
        new THREE.ShapeGeometry(eyeShape),
        charactersModule.M(0xfff9eb),
        sign * hr * 0.34,
        0.023,
        hr * 0.875,
      );
      eye.scale.set(sign * (child ? 1.18 : 1), child ? 1.25 : 1, 1);
      charactersModule.ball(
        head,
        charactersModule.M(0x1c2228),
        sign * hr * 0.31,
        0.026,
        hr * 0.925,
        child ? 0.037 : 0.028,
        [0.8, 1.1, 0.26],
      );
      charactersModule.ball(
        head,
        charactersModule.M(0xfff9e9),
        sign * hr * 0.31 - 0.008,
        0.04,
        hr * 0.935,
        0.009,
        [1, 1, 0.35],
      );
      const brow = charactersModule.tube(
        head,
        charactersModule.M(o.browColor ?? 0x22272a),
        [
          [-0.07, 0.006, 0],
          [0, 0.019, 0.012],
          [0.075, -0.004, 0],
        ],
        0.012,
      );
      brow.position.set(sign * hr * 0.35, 0.111, hr * 0.87);
      brow.rotation.z = sign * 0.12;
      parts.brows.push(brow);
    }
    parts.nose = charactersModule.meshTo(
      head,
      new THREE.ConeGeometry(0.033, 0.084, 5),
      skin,
      0,
      -0.051,
      hr * 0.915,
    );
    parts.nose.rotation.x = -Math.PI / 2;
    charactersModule.tube(
      head,
      charactersModule.M(0x78452f),
      [
        [-0.039, -0.124, hr * 0.79],
        [0, -0.12, hr * 0.84],
        [0.039, -0.125, hr * 0.79],
      ],
      0.006,
    );
    function arm(sign) {
      const g = new THREE.Group();
      g.position.set(sign * 0.34, 0.43, 0);
      torso.add(g);
      charactersModule.ball(g, o.sleeves ? cloth : skin, 0, 0, 0, 0.115);
      charactersModule.meshTo(
        g,
        new THREE.CapsuleGeometry(0.092, 0.17, 6, 16),
        o.sleeves ? cloth : skin,
        0,
        -0.16,
        0,
      );
      const fore = new THREE.Group();
      fore.position.y = -0.34;
      g.add(fore);
      charactersModule.ball(fore, skin, 0, 0, 0, 0.087);
      charactersModule.meshTo(
        fore,
        new THREE.CapsuleGeometry(0.077, 0.17, 6, 16),
        skin,
        0,
        -0.14,
        0,
      );
      const hand = new THREE.Group();
      hand.position.y = -0.32;
      fore.add(hand);
      charactersModule.ball(hand, skin, 0, 0, 0, 0.096, [1, 1, 0.86]);
      charactersModule.ball(hand, skin, sign * 0.076, -0.005, 0.016, 0.037, [0.8, 1, 1]);
      parts[sign < 0 ? 'elbowL' : 'elbowR'] = fore;
      parts[sign < 0 ? 'foreL' : 'foreR'] = fore;
      parts[sign < 0 ? 'handL' : 'handR'] = hand;
      return g;
    }
    parts.armL = arm(-1);
    parts.armR = arm(1);
    function leg(sign) {
      const g = new THREE.Group();
      g.position.set(sign * 0.185, 0.96, 0);
      root.add(g);
      charactersModule.meshTo(g, new THREE.CapsuleGeometry(0.142, 0.2, 6, 16), cloth, 0, -0.22, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      g.add(knee);
      charactersModule.meshTo(
        knee,
        new THREE.CapsuleGeometry(0.105, 0.22, 6, 16),
        cloth,
        0,
        -0.165,
        0,
      );
      const foot = charactersModule.ball(knee, boot, 0, -0.395, 0.05, 0.13, [1, 0.54, 1.7]);
      parts[sign < 0 ? 'kneeL' : 'kneeR'] = knee;
      parts[sign < 0 ? 'footL' : 'footR'] = foot;
      return g;
    }
    parts.legL = leg(-1);
    parts.legR = leg(1);
    parts.core = charactersModule.ball(
      torso,
      new THREE.MeshBasicMaterial({
        color: o.glow ?? 0x80dfff,
      }),
      0,
      0.3,
      0.31,
      0.065,
    );
    parts.core.visible = false;
    parts.pose = null;
    root.scale.setScalar(child ? 0.95 : 1.19);
    return {
      root,
      parts,
    };
  };
  charactersModule.applyPose = function applyPose(p, pose, dt = 1 / 60, snap = false) {
    // Elbow and knee joints bend in local space while shoulder/hip rotations preserve the authored move.
    const alpha = snap ? 1 : 1 - Math.exp(-38 * dt);
    const rx = (g, a) => {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, a[0], alpha);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, a[1], alpha);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, a[2], alpha);
    };
    rx(p.armR, pose.aR);
    rx(p.armL, pose.aL);
    rx(p.torsoGroup, pose.t);
    rx(p.head, pose.h);
    rx(p.legL, pose.lL);
    rx(p.legR, pose.lR);
    p.torsoGroup.position.y = THREE.MathUtils.lerp(
      p.torsoGroup.position.y,
      (p.restTorsoY ?? 1.28) + pose.y,
      alpha,
    );
    const er = pose.eR ?? -0.75,
      el = pose.eL ?? -0.75,
      kl = pose.kL ?? 0.12,
      kr = pose.kR ?? 0.12;
    if (p.elbowR) p.elbowR.rotation.x = THREE.MathUtils.lerp(p.elbowR.rotation.x, er, alpha);
    if (p.elbowL) p.elbowL.rotation.x = THREE.MathUtils.lerp(p.elbowL.rotation.x, el, alpha);
    if (p.kneeL) p.kneeL.rotation.x = THREE.MathUtils.lerp(p.kneeL.rotation.x, kl, alpha);
    if (p.kneeR) p.kneeR.rotation.x = THREE.MathUtils.lerp(p.kneeR.rotation.x, kr, alpha);
    if (p.staff) p.staff.visible = pose.w > 0.5;
  };
  return function initialize() {};
}
