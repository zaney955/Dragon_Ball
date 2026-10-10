import * as THREE from 'three';
export function register({ art: artModule, characters: charactersModule }) {
  function belt(p, m) {
    const b = charactersModule.meshTo(
      p.torsoGroup,
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 18),
      m,
      0,
      -0.075,
      0,
    );
    b.scale.z = 0.74;
    charactersModule.box(p.torsoGroup, m, 0.08, -0.1, 0.22, 0.11, 0.1, 0.1);
    charactersModule.tube(
      p.torsoGroup,
      m,
      [
        [0.08, -0.1, 0.25],
        [0.14, -0.25, 0.26],
        [0.17, -0.4, 0.24],
      ],
      0.035,
    );
  }
  function cuffs(p, m) {
    for (const a of [p.foreL, p.foreR])
      charactersModule.meshTo(
        a,
        new THREE.CylinderGeometry(0.091, 0.096, 0.12, 16),
        m,
        0,
        -0.23,
        0,
      );
  }
  function hairSpike(h, m, f, t, w) {
    artModule.hairLock(h, m, f, t, w);
  }
  function gokuHair(h) {
    const m = charactersModule.M(0x171923);
    charactersModule.ball(h, m, 0, 0.11, -0.04, 0.31, [1, 0.85, 0.88]);
    for (const p of [
      [-0.18, 0.13, -0.03, -0.55, 0.38, -0.02, 0.16],
      [-0.12, 0.2, -0.05, -0.4, 0.64, -0.02, 0.17],
      [0.02, 0.24, -0.09, -0.04, 0.65, -0.23, 0.19],
      [0.13, 0.17, -0.08, 0.43, 0.5, -0.08, 0.18],
      [0.2, 0.05, -0.11, 0.56, 0.17, -0.12, 0.16],
      [0.05, 0.02, -0.22, 0.25, -0.05, -0.48, 0.16],
      [-0.12, 0.225, 0.18, -0.22, 0.115, 0.27, 0.07],
      [0.14, 0.21, 0.15, 0.24, 0.11, 0.2, 0.075],
      [0.02, 0.245, 0.2, -0.07, 0.12, 0.28, 0.075],
    ])
      hairSpike(h, m, p.slice(0, 3), p.slice(3, 6), p[6]);
    hairSpike(h, m, [0, 0.19, -0.14], [0, 0.42, -0.53], 0.18);
    hairSpike(h, m, [0, 0.09, -0.2], [0, 0.18, -0.58], 0.17);
  }
  charactersModule.buildGoku = function buildGoku() {
    const s = charactersModule.M(0xf8c6a0),
      gi = charactersModule.M(0xe85128),
      blue = charactersModule.M(0x243b70),
      b = charactersModule.makeSkeleton(s, gi, s, charactersModule.M(0x161b27), {
        child: true,
        glow: 0x8edbff,
      });
    belt(b.parts, blue);
    cuffs(b.parts, blue);
    gokuHair(b.parts.head);
    charactersModule.badge(b.parts.torsoGroup, '亀', -0.17, 0.27, 0.26, 0.085);
    charactersModule.badge(b.parts.torsoGroup, '亀', 0, 0.24, -0.243, 0.19, true);
    b.parts.tail = charactersModule.tube(
      b.parts.torsoGroup,
      charactersModule.M(0x875236),
      [
        [0, -0.1, -0.23],
        [-0.17, -0.2, -0.39],
        [-0.48, -0.25, -0.4],
        [-0.64, -0.05, -0.35],
        [-0.58, 0.11, -0.28],
      ],
      0.06,
    );
    const st = charactersModule.meshTo(
      b.parts.handR,
      new THREE.CylinderGeometry(0.05, 0.05, 2.5, 12),
      charactersModule.M(0xc72d2b),
      0,
      0,
      0.07,
    );
    const staffGold = charactersModule.M(0xe9ba43);
    for (const end of [-1, 1])
      charactersModule.meshTo(
        st,
        new THREE.CylinderGeometry(0.057, 0.057, 0.18, 12),
        staffGold,
        0,
        end * 1.16,
        0,
      );
    st.rotation.z = Math.PI / 2;
    st.visible = false;
    b.parts.staff = st;
    return b;
  };
  charactersModule.buildRoshi = function buildRoshi() {
    const s = charactersModule.M(0xf4c59a),
      shirt = charactersModule.M(0xf09f77),
      white = charactersModule.M(0xf9efd9),
      b = charactersModule.makeSkeleton(s, shirt, s, charactersModule.M(0x543d29), {
        sleeves: true,
        browColor: 0xfaf5e8,
      });
    b.root.scale.setScalar(1.04);
    for (const l of [b.parts.legL, b.parts.legR])
      for (const o of [l.children[0], l.children[1].children[0]])
        o.material = charactersModule.M(0xe7e3d2);
    charactersModule.ball(
      b.parts.torsoGroup,
      charactersModule.M(0xb99b53),
      0,
      0.14,
      -0.37,
      0.44,
      [1, 1.2, 0.48],
    );
    for (const t of [-1, 1])
      charactersModule.tube(
        b.parts.torsoGroup,
        charactersModule.M(0x593b23),
        [
          [t * 0.24, 0.48, -0.08],
          [t * 0.28, 0.3, 0.22],
          [t * 0.18, -0.07, 0.21],
        ],
        0.035,
      );
    for (let i = 0; i < 3; i++)
      charactersModule.tube(
        b.parts.torsoGroup,
        charactersModule.M(0x6f5830),
        [
          [-0.3, 0.38 - i * 0.2, -0.49],
          [0, 0.42 - i * 0.2, -0.57],
          [0.3, 0.38 - i * 0.2, -0.49],
        ],
        0.017,
      );
    for (const t of [-1, 1]) {
      charactersModule.meshTo(
        b.parts.head,
        new THREE.CircleGeometry(0.09, 24),
        charactersModule.M(0x191f28),
        t * 0.11,
        0.025,
        0.236,
      );
      charactersModule.meshTo(
        b.parts.head,
        new THREE.TorusGeometry(0.093, 0.012, 6, 20),
        charactersModule.M(0xcf4636),
        t * 0.11,
        0.025,
        0.237,
      );
      charactersModule.ball(b.parts.head, white, t * 0.09, -0.13, 0.22, 0.075, [1.5, 0.65, 0.5]);
    }
    charactersModule.box(
      b.parts.head,
      charactersModule.M(0xcf4636),
      0,
      0.025,
      0.24,
      0.06,
      0.024,
      0.025,
    );
    const beard = charactersModule.meshTo(
      b.parts.head,
      new THREE.ConeGeometry(0.135, 0.35, 16),
      white,
      0,
      -0.26,
      0.13,
    );
    beard.rotation.z = Math.PI;
    return b;
  };
  charactersModule.buildTaopaipai = function buildTaopaipai() {
    const s = charactersModule.M(0xf3c49e),
      pink = charactersModule.M(0xe289a3),
      black = charactersModule.M(0x20202b),
      b = charactersModule.makeSkeleton(s, pink, s, charactersModule.M(0x292c35), {
        sleeves: true,
      });
    belt(b.parts, black);
    for (const l of [b.parts.legL, b.parts.legR])
      for (const o of [l.children[0], l.children[1].children[0]]) o.material = black;
    charactersModule.badge(b.parts.torsoGroup, '殺', 0, 0.24, -0.244, 0.18, true, '#e289a3');
    for (let i = 0; i < 4; i++)
      charactersModule.box(b.parts.torsoGroup, black, 0, 0.12 + i * 0.1, 0.239, 0.09, 0.013, 0.018);
    charactersModule.ball(b.parts.head, black, 0, 0.075, -0.045, 0.25, [1, 0.8, 0.95]);
    for (const t of [-1, 1])
      charactersModule.tube(
        b.parts.head,
        black,
        [
          [t * 0.02, -0.08, 0.237],
          [t * 0.07, -0.07, 0.238],
          [t * 0.13, -0.1, 0.22],
        ],
        0.02,
      );
    charactersModule.tube(
      b.parts.head,
      black,
      [
        [0, 0.05, -0.24],
        [0.08, -0.2, -0.3],
        [0.04, -0.5, -0.3],
        [-0.04, -0.85, -0.29],
        [0.08, -1.2, -0.32],
      ],
      0.042,
    );
    charactersModule.box(b.parts.head, pink, 0.08, -1.15, -0.32, 0.095, 0.06, 0.085);
    return b;
  };
  charactersModule.buildPiccolo = function buildPiccolo() {
    const s = charactersModule.M(0x76a34f),
      dark = charactersModule.M(0x383e54),
      red = charactersModule.M(0xa85850),
      b = charactersModule.makeSkeleton(s, dark, s, charactersModule.M(0xb5915b), {
        upperScale: 1.2,
      });
    b.root.scale.setScalar(1.48);
    belt(b.parts, charactersModule.M(0xbc3939));
    charactersModule.badge(b.parts.torsoGroup, '魔', 0, 0.24, 0.265, 0.21, false, '#e8d3b5');
    for (const t of [-1, 1]) {
      const ear = charactersModule.meshTo(
        b.parts.head,
        new THREE.ConeGeometry(0.08, 0.34, 4),
        s,
        t * 0.28,
        0.015,
        -0.01,
      );
      ear.rotation.z = (-t * Math.PI) / 2;
      charactersModule.tube(
        b.parts.head,
        s,
        [
          [t * 0.12, 0.19, 0.04],
          [t * 0.15, 0.34, 0.14],
          [t * 0.1, 0.38, 0.2],
        ],
        0.025,
      );
      const a = t < 0 ? b.parts.armL : b.parts.armR;
      for (let i = 0; i < 2; i++)
        charactersModule.ball(a, red, 0, -0.11 - i * 0.14, 0.089, 0.063, [1, 0.72, 0.3]);
      const fore = t < 0 ? b.parts.foreL : b.parts.foreR;
      for (let i = 0; i < 2; i++)
        charactersModule.ball(fore, red, 0, -0.06 - i * 0.1, 0.076, 0.054, [1, 0.64, 0.3]);
    }
    return b;
  };
  charactersModule.buildTien = function buildTien() {
    const s = charactersModule.M(0xf1c6a5),
      green = charactersModule.M(0x419f68),
      b = charactersModule.makeSkeleton(s, green, s, charactersModule.M(0x292b32), {
        upperScale: 1.16,
      });
    b.root.scale.setScalar(1.28);
    b.parts.torsoGroup.children[0].material = s;
    b.parts.torsoGroup.children[1].material = s;
    b.parts.torsoGroup.children[2].visible = false;
    belt(b.parts, charactersModule.M(0xb94735));
    cuffs(b.parts, charactersModule.M(0xf3f0dd));
    charactersModule.ball(
      b.parts.head,
      charactersModule.M(0xffffff),
      0,
      0.145,
      0.194,
      0.062,
      [0.85, 1, 0.3],
    );
    charactersModule.ball(
      b.parts.head,
      charactersModule.M(0x1d1e27),
      0,
      0.147,
      0.217,
      0.028,
      [0.7, 1.3, 0.3],
    );
    return b;
  };
  charactersModule.buildKrillin = function buildKrillin() {
    const s = charactersModule.M(0xf3c39a),
      gi = charactersModule.M(0xe85128),
      blue = charactersModule.M(0x243b70),
      b = charactersModule.makeSkeleton(s, gi, s, charactersModule.M(0x202534), {
        child: true,
      });
    b.root.scale.setScalar(0.79);
    belt(b.parts, blue);
    cuffs(b.parts, blue);
    b.parts.nose.visible = false;
    for (let r = 0; r < 3; r++)
      for (const t of [-1, 1])
        charactersModule.ball(
          b.parts.head,
          charactersModule.M(0x713e28),
          t * 0.063,
          0.115 + r * 0.061,
          0.275 - r * 0.025,
          0.015,
          [1, 1, 0.35],
        );
    charactersModule.badge(b.parts.torsoGroup, '亀', -0.17, 0.27, 0.26, 0.085);
    charactersModule.badge(b.parts.torsoGroup, '亀', 0, 0.24, -0.243, 0.19, true);
    return b;
  };
  charactersModule.buildYamcha = function buildYamcha() {
    const s = charactersModule.M(0xf1be94),
      gi = charactersModule.M(0x448954),
      red = charactersModule.M(0xc44235),
      black = charactersModule.M(0x1c2029),
      b = charactersModule.makeSkeleton(s, gi, s, charactersModule.M(0x382a23));
    belt(b.parts, red);
    cuffs(b.parts, red);
    charactersModule.tube(
      b.parts.torsoGroup,
      red,
      [
        [-0.25, 0.44, 0.1],
        [0, 0.44, 0.24],
        [0.25, 0.44, 0.1],
      ],
      0.05,
    );
    charactersModule.tube(
      b.parts.torsoGroup,
      red,
      [
        [0.1, 0.42, -0.15],
        [0.38, 0.32, -0.27],
        [0.52, 0.22, -0.24],
      ],
      0.05,
    );
    charactersModule.ball(b.parts.head, black, 0, 0.1, -0.045, 0.26, [1.08, 0.85, 1]);
    for (const t of [-1, 1]) {
      hairSpike(b.parts.head, black, [t * 0.12, 0.18, 0.08], [t * 0.35, 0.36, 0], 0.13);
      hairSpike(b.parts.head, black, [t * 0.16, 0.05, -0.08], [t * 0.35, -0.31, -0.1], 0.15);
    }
    charactersModule.ball(b.parts.head, black, 0, -0.15, -0.14, 0.24, [1, 1.8, 0.6]);
    charactersModule.badge(b.parts.torsoGroup, '樂', 0, 0.25, 0.267, 0.15, false, '#e8dfc1');
    return b;
  };
  charactersModule.finishBody = function finishBody(b) {
    const p = b.parts;
    if (b.root.scale.x >= 1.27 && b.root.scale.x < 1.4) {
      const skin = p.skull.material;
      for (const sign of [-1, 1])
        charactersModule.ball(
          p.torsoGroup,
          skin,
          sign * 0.145,
          0.27,
          0.205,
          0.126,
          [1, 0.38, 0.22],
        );
      if (b.root.scale.x < 1.4) {
        const seam = charactersModule.M(0xa87558, {
          opacity: 0.48,
          transparent: true,
        });
        charactersModule.tube(
          p.torsoGroup,
          seam,
          [
            [0, 0.38, 0.217],
            [0, 0.21, 0.231],
            [0, 0.14, 0.22],
          ],
          0.005,
        );
        for (const sign of [-1, 1])
          charactersModule.tube(
            p.torsoGroup,
            seam,
            [
              [sign * 0.05, 0.21, 0.226],
              [sign * 0.13, 0.196, 0.237],
              [sign * 0.23, 0.22, 0.198],
            ],
            0.005,
          );
      }
    }
    const ink = new THREE.MeshBasicMaterial({
      color: 0x252b30,
      side: THREE.BackSide,
    });
    const meshes = [];
    b.root.traverse((o) => {
      const t = o.geometry?.type,
        pa = o.geometry?.parameters;
      if (
        o.isMesh &&
        (t === 'LatheGeometry' ||
          (t === 'SphereGeometry' && pa.radius >= 0.22) ||
          (t === 'ConeGeometry' && pa.height > 0.3) ||
          (t === 'CapsuleGeometry' && pa.radius >= 0.13))
      )
        meshes.push(o);
    });
    for (const o of meshes) {
      const geo = o.geometry.clone(),
        a = geo.attributes.position,
        n = geo.attributes.normal;
      for (let i = 0; i < a.count; i++) {
        a.setXYZ(
          i,
          a.getX(i) + n.getX(i) * 0.006,
          a.getY(i) + n.getY(i) * 0.006,
          a.getZ(i) + n.getZ(i) * 0.006,
        );
      }
      geo.computeBoundingSphere();
      const edge = new THREE.Mesh(geo, ink);
      o.add(edge);
    }
    const fold = charactersModule.M(0x492e25, {
      opacity: 0.32,
      transparent: true,
    });
    for (const leg of [p.legL, p.legR]) {
      charactersModule.tube(
        leg,
        fold,
        [
          [-0.1, -0.27, 0.12],
          [0, -0.32, 0.155],
          [0.09, -0.29, 0.12],
        ],
        0.007,
      );
      charactersModule.tube(
        leg.children[1],
        fold,
        [
          [-0.08, -0.21, 0.09],
          [0, -0.26, 0.12],
          [0.08, -0.23, 0.09],
        ],
        0.006,
      );
    }
    for (const hand of [p.handL, p.handR]) {
      const sk = hand.children[0].material;
      for (let i = 0; i < 3; i++)
        charactersModule.ball(hand, sk, (i - 1) * 0.045, -0.025, 0.067, 0.027, [0.75, 1, 0.8]);
    }
    return b;
  };
  return function initialize() {};
}
