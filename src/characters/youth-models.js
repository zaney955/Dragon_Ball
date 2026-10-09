import * as THREE from 'three';
export function register({ characters, art }) {
  function rig(d, color) {
    const root = new THREE.Group(),
      p = { anatomy: d, restTorsoY: d.hip };
    root.name = 'youth-' + d.kind;
    const joint = (name, parent, x, y, z) => {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(x, y, z);
      parent.add(g);
      p[name] = g;
      return g;
    };
    const t = joint('torsoGroup', root, 0, d.hip, 0);
    joint('head', t, 0, d.neck, 0);
    const fur = characters.M(color),
      skin = characters.M(0xb28b63);
    characters.ball(t, fur, 0, 0.2, 0, d.torsoR, [1, 1.35, 0.75]);
    characters.ball(p.head, fur, 0, 0, 0, d.headR, [1, 1, 0.86]);
    characters.ball(p.head, skin, 0, -d.headR * 0.3, d.headR * 0.7, d.headR * 0.6, [1, 0.6, 0.6]);
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'L' : 'R';
      const a = joint('arm' + side, t, s * d.shoulder, d.armY, 0),
        e = joint('elbow' + side, a, 0, -d.upper, 0),
        h = joint('hand' + side, e, 0, -d.fore, 0),
        l = joint('leg' + side, root, s * d.legX, d.legY, 0),
        k = joint('knee' + side, l, 0, -d.thigh, 0),
        foot = joint('foot' + side, k, 0, -d.shin, 0.12);
      p['fore' + side] = e;
      characters.meshTo(
        a,
        new THREE.CapsuleGeometry(d.armR, Math.max(0.05, d.upper - d.armR * 2), 5, 14),
        fur,
        0,
        -d.upper / 2,
        0,
      );
      characters.meshTo(
        e,
        new THREE.CapsuleGeometry(d.armR * 0.85, Math.max(0.05, d.fore - d.armR * 1.7), 5, 14),
        fur,
        0,
        -d.fore / 2,
        0,
      );
      characters.ball(h, skin, 0, 0, 0, d.handR);
      characters.meshTo(
        l,
        new THREE.CapsuleGeometry(d.legR, Math.max(0.05, d.thigh - d.legR * 2), 5, 14),
        fur,
        0,
        -d.thigh / 2,
        0,
      );
      characters.meshTo(
        k,
        new THREE.CapsuleGeometry(d.legR * 0.8, Math.max(0.05, d.shin - d.legR * 1.6), 5, 14),
        fur,
        0,
        -d.shin / 2,
        0,
      );
      characters.ball(foot, skin, 0, 0, 0.08, d.legR, [1, 0.5, 1.8]);
      characters.ball(
        p.head,
        characters.M(0xf2d749),
        s * d.headR * 0.38,
        0.08,
        d.headR * 0.86,
        d.headR * 0.14,
        [1, 0.55, 0.25],
      );
      characters.ball(
        p.head,
        characters.M(0x251a15),
        s * d.headR * 0.38,
        0.08,
        d.headR * 0.9,
        d.headR * 0.07,
        [0.7, 1, 0.3],
      );
      for (let i = 0; i < 3; i++)
        characters.ball(
          h,
          skin,
          (i - 1) * d.handR * 0.45,
          -d.handR * 0.55,
          d.handR * 0.3,
          d.handR * 0.25,
          [0.8, 1.6, 0.8],
        );
    }
    return { root, parts: p };
  }
  characters.buildGreatApe = function () {
    const b = rig(
      {
        kind: 'ape',
        hip: 1.85,
        neck: 1.7,
        shoulder: 0.85,
        armY: 0.85,
        upper: 0.95,
        fore: 0.85,
        legX: 0.5,
        legY: 1.6,
        thigh: 0.8,
        shin: 0.68,
        armR: 0.3,
        handR: 0.35,
        legR: 0.34,
        torsoR: 0.85,
        headR: 0.64,
      },
      0x624535,
    );
    characters.ball(b.parts.head, characters.M(0x765341), 0, 0.35, -0.25, 0.6, [1, 1, 0.8]);
    characters.box(b.parts.head, characters.M(0x341814), 0, -0.35, 0.63, 0.55, 0.16, 0.15);
    for (const s of [-1, 1])
      characters.meshTo(
        b.parts.head,
        new THREE.ConeGeometry(0.08, 0.2, 6),
        characters.M(0xffebc8),
        s * 0.2,
        -0.32,
        0.72,
      );
    b.parts.tail = characters.tube(
      b.root,
      characters.M(0x624535),
      [
        [0, 1.65, -0.55],
        [0, 1.25, -1.2],
        [0.45, 1.1, -1.8],
        [0.9, 1.45, -2],
      ],
      0.15,
    );
    b.parts.tail.name = 'ape-tail';
    return b;
  };
  characters.buildOgre = function () {
    const b = rig(
      {
        kind: 'ogre',
        hip: 1.3,
        neck: 1.15,
        shoulder: 0.58,
        armY: 0.55,
        upper: 0.55,
        fore: 0.5,
        legX: 0.35,
        legY: 1.05,
        thigh: 0.5,
        shin: 0.44,
        armR: 0.22,
        handR: 0.25,
        legR: 0.23,
        torsoR: 0.65,
        headR: 0.48,
      },
      0x764c99,
    );
    for (const s of [-1, 1])
      characters.meshTo(
        b.parts.head,
        new THREE.ConeGeometry(0.1, 0.4, 8),
        characters.M(0xf3d9a4),
        s * 0.3,
        0.45,
        0,
      );
    return b;
  };
  characters.addYouthForm = function (body, form) {
    const p = body.parts;
    if (form === 'muscle') {
      p.torsoGroup.scale.set(1.5, 1.08, 1.25);
      p.armL.scale.setScalar(1.2);
      p.armR.scale.setScalar(1.2);
      body.root.name = 'muscle-roshi';
    }
    if (form === 'fourArms') {
      p.extraArms = [];
      for (const side of ['L', 'R']) {
        const arm = p['arm' + side].clone(true);
        arm.name = 'four-witches-' + side;
        arm.position.y -= 0.25;
        arm.position.z = -0.2;
        arm.traverse((o) => {
          if (o.isMesh) {
            o.geometry = o.geometry.clone();
            o.material = o.material.clone();
          }
        });
        p.torsoGroup.add(arm);
        p.extraArms.push(arm);
      }
      body.root.name = 'four-witches-tien';
    }
    if (form === 'combined') {
      p.combinedMechs = [];
      for (const [i, who] of ['修', '舞'].entries()) {
        const support = art.buildV2SupportMech(who);
        support.scale.setScalar(0.65);
        support.position.set(i ? 0.85 : -0.85, 0.6, -0.2);
        support.name = 'combined-' + who;
        p.torsoGroup.add(support);
        p.combinedMechs.push(support);
      }
      body.root.name = 'pilaf-three-machine-combination';
    }
    return body;
  };
  characters.buildDemon = function () {
    const b = rig(
      {
        kind: 'demon',
        hip: 0.8,
        neck: 0.65,
        shoulder: 0.35,
        armY: 0.35,
        upper: 0.4,
        fore: 0.35,
        legX: 0.2,
        legY: 0.7,
        thigh: 0.3,
        shin: 0.3,
        armR: 0.12,
        handR: 0.14,
        legR: 0.14,
        torsoR: 0.32,
        headR: 0.25,
      },
      0x688b49,
    );
    for (const s of [-1, 1]) {
      const wing = characters.meshTo(
        b.parts.torsoGroup,
        new THREE.ConeGeometry(0.6, 1, 3),
        characters.M(0x6b8060),
        s * 0.6,
        0.35,
        -0.3,
      );
      wing.rotation.z = s * 1.25;
      wing.scale.z = 0.08;
    }
    return b;
  };
  return function initialize() {};
}
