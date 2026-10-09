import * as THREE from 'three';
export function register({ art: artModule, characters: charactersModule }) {
  // New skeletons are authored in metres; common names are an interface, not a scaled human model.
  function anatomyRig(d) {
    const root = new THREE.Group(),
      p = {
        anatomy: d,
        restTorsoY: d.hip,
      };
    root.name = 'v2-' + d.kind;
    const joint = (name, parent, x, y, z) => {
      const j = new THREE.Group();
      j.name = name;
      j.position.set(x, y, z);
      parent.add(j);
      p[name] = j;
      return j;
    };
    const torso = joint('torsoGroup', root, 0, d.hip, 0);
    joint('head', torso, 0, d.neck, 0);
    for (const sign of [-1, 1]) {
      const side = sign < 0 ? 'L' : 'R',
        arm = joint('arm' + side, torso, sign * d.shoulder, d.armY, 0),
        elbow = joint('elbow' + side, arm, 0, -d.upper, 0);
      joint('hand' + side, elbow, 0, -d.fore, 0);
      const leg = joint('leg' + side, root, sign * d.legX, d.legY, 0),
        knee = joint('knee' + side, leg, 0, -d.thigh, 0);
      joint('foot' + side, knee, 0, -d.shin, 0.08);
      p['fore' + side] = elbow;
    }
    return {
      root,
      parts: p,
    };
  }
  function limbGeometry(p, mat, skin, d, mechanical = false) {
    for (const side of ['L', 'R']) {
      const a = p['arm' + side],
        e = p['elbow' + side],
        h = p['hand' + side],
        l = p['leg' + side],
        k = p['knee' + side],
        foot = p['foot' + side];
      if (mechanical) {
        charactersModule.box(a, mat, 0, -d.upper / 2, 0, d.armR * 2, d.upper, d.armR * 2);
        charactersModule.box(e, mat, 0, -d.fore / 2, 0, d.armR * 1.8, d.fore, d.armR * 1.8);
        charactersModule.ball(e, charactersModule.M(0x3a4147), 0, 0, 0, d.armR * 1.1);
        charactersModule.box(h, mat, 0, -0.04, 0.04, d.handR * 2, d.handR * 1.7, d.handR * 2);
        charactersModule.box(l, mat, 0, -d.thigh / 2, 0, d.legR * 2, d.thigh, d.legR * 2);
        charactersModule.ball(k, charactersModule.M(0x30383e), 0, 0, 0, d.legR);
        charactersModule.box(k, mat, 0, -d.shin / 2, 0, d.legR * 1.8, d.shin, d.legR * 1.8);
        charactersModule.box(
          foot,
          charactersModule.M(0x35434f),
          0,
          0,
          0.12,
          d.legR * 2.5,
          0.15,
          d.legR * 3.2,
        );
      } else {
        charactersModule.meshTo(
          a,
          new THREE.CapsuleGeometry(d.armR, Math.max(0.02, d.upper - d.armR * 2), 4, 12),
          skin,
          0,
          -d.upper / 2,
          0,
        );
        charactersModule.meshTo(
          e,
          new THREE.CapsuleGeometry(d.armR * 0.85, Math.max(0.02, d.fore - d.armR * 1.7), 4, 12),
          skin,
          0,
          -d.fore / 2,
          0,
        );
        charactersModule.ball(h, skin, 0, 0, 0, d.handR, [1, 0.9, 0.85]);
        charactersModule.meshTo(
          l,
          new THREE.CapsuleGeometry(d.legR, Math.max(0.02, d.thigh - d.legR * 2), 4, 12),
          mat,
          0,
          -d.thigh / 2,
          0,
        );
        charactersModule.meshTo(
          k,
          new THREE.CapsuleGeometry(d.legR * 0.75, Math.max(0.02, d.shin - d.legR * 1.5), 4, 12),
          mat,
          0,
          -d.shin / 2,
          0,
        );
        charactersModule.ball(
          foot,
          charactersModule.M(d.boot ?? 0x353748),
          0,
          0,
          0.07,
          d.legR,
          [1, 0.45, 1.7],
        );
      }
    }
  }
  function simpleFace(head, skin, r, opts = {}) {
    const skull = charactersModule.ball(head, skin, 0, 0, 0, r, opts.scale ?? [1, 1, 0.9]);
    for (const s of [-1, 1]) {
      charactersModule.ball(
        head,
        charactersModule.M(0xfff9e9),
        s * r * 0.35,
        0.02,
        r * 0.84,
        r * 0.22,
        [1, 1.15, 0.2],
      );
      charactersModule.ball(
        head,
        charactersModule.M(0x202c32),
        s * r * 0.34,
        0.02,
        r * 0.89,
        r * 0.09,
        [0.75, 1.2, 0.2],
      );
      charactersModule.tube(
        head,
        charactersModule.M(0x453327),
        [
          [s * r * 0.15, r * 0.3, r * 0.8],
          [s * r * 0.52, r * 0.28, r * 0.75],
        ],
        r * 0.025,
      );
      if (!opts.noEars)
        charactersModule.ball(head, skin, s * r * 0.95, 0, 0, r * 0.19, [0.5, 1, 0.5]);
    }
    charactersModule.tube(
      head,
      charactersModule.M(0x67463b),
      [
        [-r * 0.15, -r * 0.45, r * 0.75],
        [0, -r * 0.48, r * 0.85],
        [r * 0.15, -r * 0.45, r * 0.75],
      ],
      0.008,
    );
    return skull;
  }
  function outlinedBody(b) {
    const ink = new THREE.MeshBasicMaterial({
      color: 0x253039,
      side: THREE.BackSide,
    });
    const list = [];
    b.root.traverse((o) => {
      if (
        o.isMesh &&
        ['SphereGeometry', 'BoxGeometry', 'CapsuleGeometry', 'ConeGeometry'].includes(
          o.geometry?.type,
        )
      )
        list.push(o);
    });
    for (const o of list) {
      const g = o.geometry.clone(),
        a = g.attributes.position,
        n = g.attributes.normal;
      for (let i = 0; i < a.count; i++)
        a.setXYZ(
          i,
          a.getX(i) + n.getX(i) * 0.005,
          a.getY(i) + n.getY(i) * 0.005,
          a.getZ(i) + n.getZ(i) * 0.005,
        );
      o.add(new THREE.Mesh(g, ink));
    }
    return b;
  }
  charactersModule.buildGyumao = function buildGyumao() {
    const d = {
        kind: 'giant',
        hip: 1.65,
        neck: 1.34,
        shoulder: 0.75,
        armY: 0.87,
        upper: 0.69,
        fore: 0.63,
        legX: 0.42,
        legY: 1.42,
        thigh: 0.68,
        shin: 0.65,
        armR: 0.23,
        handR: 0.28,
        legR: 0.32,
        torsoR: 0.69,
        headR: 0.46,
        boot: 0x423829,
      },
      b = anatomyRig(d),
      p = b.parts,
      s = charactersModule.M(0xf3bb83),
      armor = charactersModule.M(0x41658c),
      brown = charactersModule.M(0x59432d),
      white = charactersModule.M(0xe8e0c7);
    charactersModule.ball(p.torsoGroup, s, 0, 0.29, 0, 0.75, [1, 1.12, 0.65]);
    charactersModule.ball(p.torsoGroup, armor, 0, -0.08, 0, 0.65, [1, 0.35, 0.7]);
    limbGeometry(p, brown, s, d);
    p.skull = simpleFace(p.head, s, 0.46);
    charactersModule.ball(p.head, armor, 0, 0.19, -0.01, 0.49, [1, 0.85, 0.93]);
    charactersModule.box(p.head, armor, 0, 0.19, 0.4, 0.8, 0.13, 0.1);
    for (const sign of [-1, 1]) {
      charactersModule.tube(
        p.head,
        white,
        [
          [sign * 0.35, 0.42, 0],
          [sign * 0.58, 0.57, 0],
          [sign * 0.65, 0.93, 0],
          [sign * 0.59, 1.1, 0],
        ],
        0.095,
      );
      charactersModule.ball(
        p.head,
        charactersModule.M(0x222e39),
        sign * 0.18,
        0.01,
        0.43,
        0.075,
        [1, 0.55, 0.2],
      );
      charactersModule.tube(
        p.head,
        brown,
        [
          [sign * 0.02, -0.19, 0.39],
          [sign * 0.29, -0.14, 0.4],
          [sign * 0.36, -0.27, 0.3],
        ],
        0.045,
      );
      charactersModule.box(p.torsoGroup, armor, sign * 0.56, 0.81, 0, 0.43, 0.13, 0.48);
    }
    const axe = new THREE.Group();
    p.handR.add(axe);
    p.axe = axe;
    axe.position.set(0, -0.12, 0.08);
    charactersModule.meshTo(
      axe,
      new THREE.CylinderGeometry(0.048, 0.055, 2.75, 10),
      brown,
      0,
      0.68,
      0,
    );
    const shape = new THREE.Shape();
    shape.moveTo(-0.07, 0.8);
    shape.lineTo(-0.54, 0.5);
    shape.quadraticCurveTo(-0.82, 1.1, -0.56, 1.72);
    shape.lineTo(-0.07, 1.45);
    shape.lineTo(0.07, 1.45);
    shape.lineTo(0.55, 1.72);
    shape.quadraticCurveTo(0.85, 1.1, 0.54, 0.5);
    shape.lineTo(0.07, 0.8);
    charactersModule.meshTo(
      axe,
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.11,
        bevelEnabled: false,
      }),
      charactersModule.M(0xbcc6ca),
      0,
      0,
      -0.05,
    );
    charactersModule.box(p.torsoGroup, white, 0, 0.03, 0.52, 0.21, 0.16, 0.06);
    return outlinedBody(b);
  };
  charactersModule.buildChichi = function buildChichi() {
    const d = {
        kind: 'girl',
        hip: 0.88,
        neck: 0.6,
        shoulder: 0.235,
        armY: 0.31,
        upper: 0.29,
        fore: 0.28,
        legX: 0.14,
        legY: 0.77,
        thigh: 0.36,
        shin: 0.33,
        armR: 0.074,
        handR: 0.073,
        legR: 0.1,
        torsoR: 0.21,
        headR: 0.26,
        boot: 0xb95465,
      },
      b = anatomyRig(d),
      p = b.parts,
      s = charactersModule.M(0xf4c5a0),
      pink = charactersModule.M(0xd87ea4),
      blue = charactersModule.M(0x4965a0);
    charactersModule.ball(p.torsoGroup, blue, 0, 0.11, 0, 0.245, [1, 1.35, 0.72]);
    limbGeometry(p, pink, s, d);
    p.skull = simpleFace(p.head, s, 0.26);
    charactersModule.ball(p.head, blue, 0, 0.09, -0.01, 0.283, [1, 1.08, 0.96]);
    charactersModule.box(p.head, blue, 0, 0.03, 0.24, 0.51, 0.1, 0.06);
    charactersModule.ball(p.head, s, 0, -0.1, 0.21, 0.22, [0.83, 0.6, 0.15]);
    for (const sign of [-1, 1]) {
      charactersModule.ball(
        p.head,
        charactersModule.M(0x111e34),
        sign * 0.083,
        -0.025,
        0.269,
        0.023,
        [1, 1.2, 0.3],
      );
      charactersModule.box(p.head, pink, sign * 0.265, -0.04, 0, 0.06, 0.22, 0.25);
    }
    const blade = new THREE.Group();
    p.head.add(blade);
    p.blade = blade;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(-0.06, 0.25);
    sh.lineTo(0.02, 0.43);
    sh.lineTo(0.07, 0.22);
    charactersModule.meshTo(
      blade,
      new THREE.ExtrudeGeometry(sh, {
        depth: 0.022,
        bevelEnabled: false,
      }),
      charactersModule.M(0xdce4d7),
      0,
      0.33,
      -0.04,
    );
    charactersModule.ball(p.head, charactersModule.M(0xffdec2), 0, 0.09, 0.295, 0.025);
    charactersModule.box(p.torsoGroup, pink, 0, -0.12, 0, 0.39, 0.1, 0.29);
    return outlinedBody(b);
  };
  charactersModule.buildBulma = function buildBulma() {
    const d = {
        kind: 'technology',
        hip: 1.05,
        neck: 0.78,
        shoulder: 0.28,
        armY: 0.39,
        upper: 0.35,
        fore: 0.32,
        legX: 0.15,
        legY: 0.94,
        thigh: 0.46,
        shin: 0.4,
        armR: 0.073,
        handR: 0.074,
        legR: 0.105,
        torsoR: 0.24,
        headR: 0.255,
        boot: 0x734696,
      },
      b = anatomyRig(d),
      p = b.parts,
      s = charactersModule.M(0xf7c9a9),
      dress = charactersModule.M(0xda86a4),
      hair = charactersModule.M(0x4aafae);
    charactersModule.ball(p.torsoGroup, dress, 0, 0.17, 0, 0.275, [0.9, 1.2, 0.73]);
    charactersModule.meshTo(
      p.torsoGroup,
      new THREE.CylinderGeometry(0.22, 0.36, 0.58, 20),
      dress,
      0,
      -0.12,
      0,
    );
    limbGeometry(p, s, s, d);
    for (const side of ['L', 'R']) {
      charactersModule.meshTo(
        p['knee' + side],
        new THREE.CylinderGeometry(0.113, 0.12, 0.24, 12),
        charactersModule.M(0x724194),
        0,
        -0.29,
        0,
      );
    }
    p.skull = simpleFace(p.head, s, 0.255);
    charactersModule.ball(p.head, hair, 0, 0.12, -0.045, 0.27, [1, 1.02, 1]);
    for (const sign of [-1, 1]) {
      artModule.hairLock(p.head, hair, [sign * 0.09, 0.25, 0.12], [sign * 0.2, 0.07, 0.21], 0.1);
      artModule.hairLock(
        p.head,
        hair,
        [sign * 0.22, 0.12, -0.03],
        [sign * 0.29, -0.24, -0.04],
        0.095,
      );
    }
    const braid = new THREE.Group();
    p.head.add(braid);
    for (let i = 0; i < 7; i++)
      charactersModule.ball(braid, hair, 0.23, -0.13 - i * 0.052, -0.14, 0.055, [0.9, 1.1, 0.8]);
    charactersModule.box(p.head, charactersModule.M(0xb74759), 0.12, 0.3, 0.05, 0.22, 0.1, 0.09);
    charactersModule.badge(p.torsoGroup, 'B', 0, 0.18, 0.227, 0.11, false, '#da86a4');
    charactersModule.box(
      p.torsoGroup,
      charactersModule.M(0x7c503b),
      0,
      -0.02,
      0.24,
      0.48,
      0.08,
      0.05,
    );
    p.gun = new THREE.Group();
    p.handR.add(p.gun);
    charactersModule.box(p.gun, charactersModule.M(0x627780), 0, 0.015, 0.09, 0.13, 0.16, 0.16);
    charactersModule.box(p.gun, charactersModule.M(0x2e3943), 0, 0.06, 0.2, 0.05, 0.055, 0.18);
    p.bag = new THREE.Group();
    p.handR.add(p.bag);
    charactersModule.box(p.bag, charactersModule.M(0x95634a), 0, -0.27, 0.04, 0.28, 0.28, 0.14);
    charactersModule.tube(
      p.bag,
      charactersModule.M(0xe8c5a0),
      [
        [-0.1, -0.14, 0.04],
        [0, 0, 0.04],
        [0.1, -0.14, 0.04],
      ],
      0.025,
    );
    p.bag.visible = false;
    return outlinedBody(b);
  };
  charactersModule.buildChiaotzu = function buildChiaotzu() {
    const d = {
        kind: 'psychic',
        hip: 0.63,
        neck: 0.48,
        shoulder: 0.18,
        armY: 0.24,
        upper: 0.21,
        fore: 0.2,
        legX: 0.11,
        legY: 0.53,
        thigh: 0.24,
        shin: 0.23,
        armR: 0.06,
        handR: 0.062,
        legR: 0.08,
        torsoR: 0.18,
        headR: 0.24,
        boot: 0x252b36,
      },
      b = anatomyRig(d),
      p = b.parts,
      s = charactersModule.M(0xfff3dd),
      green = charactersModule.M(0x568562),
      black = charactersModule.M(0x202f35);
    charactersModule.ball(p.torsoGroup, green, 0, 0.1, 0, 0.21, [1, 1.27, 0.8]);
    limbGeometry(p, black, s, d);
    p.skull = simpleFace(p.head, s, 0.24);
    charactersModule.ball(p.head, black, 0, 0.15, -0.01, 0.242, [1, 0.55, 1]);
    charactersModule.ball(p.head, charactersModule.M(0xb73a3f), 0, 0.28, 0, 0.042);
    for (const sign of [-1, 1])
      charactersModule.ball(
        p.head,
        charactersModule.M(0xc94042),
        sign * 0.13,
        -0.057,
        0.196,
        0.046,
        [1, 1, 0.18],
      );
    charactersModule.box(
      p.torsoGroup,
      charactersModule.M(0xeae6d3),
      0,
      0.16,
      0.18,
      0.13,
      0.24,
      0.02,
    );
    charactersModule.box(
      p.torsoGroup,
      charactersModule.M(0xc84538),
      0,
      -0.055,
      0,
      0.34,
      0.055,
      0.26,
    );
    return outlinedBody(b);
  };
  charactersModule.buildOolong = function buildOolong(form = 'pig') {
    const d =
      form === 'bull'
        ? {
            kind: 'quadruped',
            hip: 0.7,
            neck: 0.48,
            shoulder: 0.33,
            armY: 0.18,
            upper: 0.33,
            fore: 0.28,
            legX: 0.3,
            legY: 0.63,
            thigh: 0.28,
            shin: 0.28,
            armR: 0.12,
            handR: 0.13,
            legR: 0.15,
            torsoR: 0.49,
            headR: 0.3,
          }
        : form === 'bat'
          ? {
              kind: 'winged',
              hip: 0.62,
              neck: 0.48,
              shoulder: 0.19,
              armY: 0.26,
              upper: 0.4,
              fore: 0.34,
              legX: 0.12,
              legY: 0.48,
              thigh: 0.21,
              shin: 0.18,
              armR: 0.04,
              handR: 0.06,
              legR: 0.07,
              torsoR: 0.2,
              headR: 0.24,
            }
          : {
              kind: 'pig',
              hip: 0.74,
              neck: 0.62,
              shoulder: 0.25,
              armY: 0.33,
              upper: 0.24,
              fore: 0.24,
              legX: 0.16,
              legY: 0.63,
              thigh: 0.28,
              shin: 0.28,
              armR: 0.085,
              handR: 0.09,
              legR: 0.13,
              torsoR: 0.28,
              headR: 0.29,
            };
    const b = anatomyRig(d),
      p = b.parts,
      s = charactersModule.M(form === 'bat' ? 0x7f748e : form === 'bull' ? 0x8e5935 : 0xefb38f),
      cloth = charactersModule.M(0xb5aa68),
      black = charactersModule.M(0x333b42);
    limbGeometry(p, cloth, s, d, false);
    p.skull = simpleFace(p.head, s, d.headR, {
      noEars: true,
    });
    if (form === 'pig') {
      charactersModule.ball(p.torsoGroup, cloth, 0, 0.16, 0, 0.31, [1, 1.15, 0.81]);
      charactersModule.ball(p.head, s, 0, -0.08, 0.265, 0.1, [1.4, 0.72, 0.65]);
      for (const sign of [-1, 1]) {
        charactersModule.ball(p.head, black, sign * 0.048, -0.075, 0.323, 0.013);
        const ear = charactersModule.meshTo(
          p.head,
          new THREE.ConeGeometry(0.1, 0.22, 3),
          s,
          sign * 0.23,
          0.23,
          0,
        );
        ear.rotation.z = -sign * 0.45;
      }
      charactersModule.box(p.head, charactersModule.M(0x5b7458), 0, 0.28, -0.02, 0.49, 0.08, 0.37);
      charactersModule.box(
        p.torsoGroup,
        charactersModule.M(0xa05e47),
        0,
        -0.03,
        0.22,
        0.13,
        0.14,
        0.05,
      );
      charactersModule.tube(
        p.torsoGroup,
        s,
        [
          [0, 0.02, -0.24],
          [0.08, -0.01, -0.38],
          [0.13, 0.07, -0.42],
          [0.05, 0.1, -0.4],
        ],
        0.023,
      );
    }
    if (form === 'bull') {
      charactersModule.ball(p.torsoGroup, s, 0, 0.12, -0.13, 0.54, [1, 0.66, 1.45]);
      p.head.position.z = 0.39;
      charactersModule.ball(p.head, s, 0, -0.09, 0.27, 0.17, [1.25, 0.8, 1]);
      for (const sign of [-1, 1])
        charactersModule.tube(
          p.head,
          charactersModule.M(0xf0e3bd),
          [
            [sign * 0.19, 0.17, 0],
            [sign * 0.32, 0.34, 0],
            [sign * 0.27, 0.53, 0.04],
          ],
          0.065,
        );
      p.armL.position.z = p.armR.position.z = 0.39;
      p.legL.position.z = p.legR.position.z = -0.45;
      charactersModule.tube(
        p.torsoGroup,
        s,
        [
          [0, 0.17, -0.69],
          [0, 0.03, -0.92],
          [0, -0.13, -0.95],
        ],
        0.035,
      );
    }
    if (form === 'bat') {
      charactersModule.ball(p.torsoGroup, s, 0, 0.1, 0, 0.24, [0.9, 1.2, 0.8]);
      for (const sign of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.lineTo(sign * 0.93, -0.2);
        sh.quadraticCurveTo(sign * 0.58, -0.15, sign * 0.63, -0.57);
        sh.quadraticCurveTo(sign * 0.4, -0.29, sign * 0.2, -0.6);
        sh.lineTo(0, -0.2);
        p['wing' + (sign < 0 ? 'L' : 'R')] = charactersModule.meshTo(
          p['arm' + (sign < 0 ? 'L' : 'R')],
          new THREE.ShapeGeometry(sh),
          charactersModule.M(0x635477, {
            side: THREE.DoubleSide,
          }),
        );
        charactersModule.meshTo(
          p.head,
          new THREE.ConeGeometry(0.075, 0.25, 3),
          s,
          sign * 0.16,
          0.25,
          0,
        );
      }
    }
    return outlinedBody(b);
  };
  charactersModule.buildKorin = function buildKorin() {
    const d = {
        kind: 'cat',
        hip: 0.59,
        neck: 0.63,
        shoulder: 0.21,
        armY: 0.24,
        upper: 0.19,
        fore: 0.19,
        legX: 0.12,
        legY: 0.5,
        thigh: 0.22,
        shin: 0.2,
        armR: 0.07,
        handR: 0.075,
        legR: 0.085,
        torsoR: 0.23,
        headR: 0.27,
        boot: 0xfff4df,
      },
      b = anatomyRig(d),
      p = b.parts,
      white = charactersModule.M(0xfff5df),
      ink = charactersModule.M(0x473d36);
    charactersModule.ball(p.torsoGroup, white, 0, 0.17, 0, 0.29, [1, 1.15, 0.8]);
    limbGeometry(p, white, white, d);
    p.skull = charactersModule.ball(p.head, white, 0, 0, 0, 0.28, [1.1, 1, 0.83]);
    for (const sign of [-1, 1]) {
      charactersModule.meshTo(
        p.head,
        new THREE.ConeGeometry(0.12, 0.26, 3),
        white,
        sign * 0.2,
        0.23,
        0,
      );
      charactersModule.meshTo(
        p.head,
        new THREE.ConeGeometry(0.068, 0.14, 3),
        charactersModule.M(0xe3b5ab),
        sign * 0.2,
        0.25,
        0.055,
      );
      charactersModule.tube(
        p.head,
        ink,
        [
          [sign * 0.05, 0.01, 0.239],
          [sign * 0.11, -0.005, 0.25],
          [sign * 0.17, 0.016, 0.222],
        ],
        0.009,
      );
      for (let i = 0; i < 3; i++)
        charactersModule.tube(
          p.head,
          ink,
          [
            [sign * 0.14, -0.075 + i * 0.035, 0.236],
            [sign * 0.39, -0.12 + i * 0.07, 0.2],
          ],
          0.006,
        );
      charactersModule.ball(p.head, white, sign * 0.074, -0.09, 0.244, 0.077, [1, 0.7, 0.6]);
    }
    charactersModule.ball(p.head, charactersModule.M(0x99735f), 0, -0.044, 0.294, 0.032);
    charactersModule.tube(
      p.head,
      ink,
      [
        [0, -0.07, 0.28],
        [0, -0.12, 0.27],
      ],
      0.007,
    );
    p.tail = new THREE.Group();
    p.torsoGroup.add(p.tail);
    charactersModule.tube(
      p.tail,
      white,
      [
        [0, -0.05, -0.21],
        [0.18, -0.02, -0.48],
        [0.34, 0.2, -0.5],
        [0.35, 0.4, -0.48],
      ],
      0.05,
    );
    p.cane = new THREE.Group();
    p.handR.add(p.cane);
    charactersModule.tube(
      p.cane,
      charactersModule.M(0x8c6845),
      [
        [0, -0.7, 0.08],
        [0, 0, 0.08],
        [0, 0.42, 0.08],
        [0.07, 0.5, 0.08],
        [0.15, 0.47, 0.08],
      ],
      0.024,
    );
    return outlinedBody(b);
  };
  charactersModule.buildPilaf = function buildPilaf() {
    const d = {
        kind: 'mech',
        hip: 1.44,
        neck: 1.02,
        shoulder: 0.63,
        armY: 0.56,
        upper: 0.57,
        fore: 0.53,
        legX: 0.37,
        legY: 1.27,
        thigh: 0.56,
        shin: 0.6,
        armR: 0.21,
        handR: 0.26,
        legR: 0.24,
        torsoR: 0.59,
        headR: 0.48,
      },
      b = anatomyRig(d),
      p = b.parts,
      steel = charactersModule.M(0x597c9e),
      dark = charactersModule.M(0x334959),
      gold = charactersModule.M(0xd3ac52);
    limbGeometry(p, steel, steel, d, true);
    charactersModule.box(p.torsoGroup, steel, 0, 0.33, 0, 1.21, 1.02, 0.77);
    charactersModule.ball(p.head, steel, 0, -0.03, 0, 0.52, [1, 0.8, 1]);
    charactersModule.box(p.head, dark, 0, -0.01, 0.43, 0.84, 0.5, 0.12);
    const pilot = new THREE.Group();
    pilot.name = 'pilaf-pilot';
    p.head.add(pilot);
    pilot.position.set(0, -0.08, 0.44);
    charactersModule.ball(pilot, charactersModule.M(0x64bbb9), 0, 0, 0, 0.15, [1, 1.2, 0.85]);
    charactersModule.box(pilot, charactersModule.M(0x244d7b), 0, -0.2, 0, 0.25, 0.24, 0.18);
    charactersModule.ball(pilot, charactersModule.M(0x233650), 0, 0.13, 0, 0.17, [1, 0.5, 1]);
    charactersModule.ball(pilot, charactersModule.M(0xc7493d), 0, 0.25, 0, 0.035);
    for (const sign of [-1, 1]) {
      charactersModule.ball(
        pilot,
        charactersModule.M(0xffffff),
        sign * 0.054,
        0.018,
        0.123,
        0.045,
        [1, 0.6, 0.3],
      );
      charactersModule.ball(pilot, charactersModule.M(0x25363b), sign * 0.054, 0.018, 0.135, 0.019);
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.CylinderGeometry(0.1, 0.12, 0.55, 12),
        dark,
        sign * 0.47,
        0.44,
        0.45,
      ).rotation.x = Math.PI / 2;
      charactersModule.box(p.torsoGroup, gold, sign * 0.25, 0.02, 0.41, 0.15, 0.1, 0.03);
    }
    p.skull = pilot.children[0];
    charactersModule.badge(p.torsoGroup, 'P', 0, 0.31, 0.405, 0.16);
    p.cockpit = charactersModule.box(
      p.head,
      charactersModule.M(0x93d6df, {
        transparent: true,
        opacity: 0.22,
      }),
      0,
      -0.01,
      0.58,
      0.87,
      0.5,
      0.04,
    );
    p.damagePanel = charactersModule.box(
      p.torsoGroup,
      charactersModule.M(0xcb624b),
      0,
      0.67,
      0.4,
      0.12,
      0.06,
      0.025,
    );
    return outlinedBody(b);
  };
  return function initialize() {};
}
