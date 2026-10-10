import * as THREE from 'three';
import { configureStageDisplayShadows } from './display-lighting.js';
export function register({
  art: artModule,
  characters: charactersModule,
  render: renderModule,
  ui: uiModule,
  world: worldModule,
}) {
  artModule.artTexture = function artTexture(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const k = c.getContext('2d');
    k.fillStyle = '#fffdf7';
    k.fillRect(0, 0, 512, 512);
    let seed = 819;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (kind === 'fabric') {
      k.strokeStyle = 'rgba(74,61,48,.035)';
      k.lineWidth = 1;
      for (let i = 0; i < 512; i += 4) {
        k.beginPath();
        k.moveTo(i, 0);
        k.lineTo(i, 512);
        k.moveTo(0, i);
        k.lineTo(512, i);
        k.stroke();
      }
    } else {
      for (let i = 0; i < 2200; i++) {
        k.fillStyle = rnd() > 0.5 ? 'rgba(95,77,51,.05)' : 'rgba(255,255,255,.22)';
        k.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 2);
      }
      if (kind === 'wood') {
        k.strokeStyle = 'rgba(95,61,36,.12)';
        for (let i = 0; i < 35; i++) {
          let y = rnd() * 512;
          k.beginPath();
          k.moveTo(0, y);
          k.bezierCurveTo(140, y - 8, 310, y + 13, 512, y);
          k.stroke();
        }
      }
    }
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = Math.min(8, renderModule.renderer.capabilities.getMaxAnisotropy());
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    return tx;
  };
  artModule.hairLock = function hairLock(g, mat, from, to, width) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      axis = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(0, 0, 1).cross(axis).normalize();
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    const depth = axis.clone().cross(side).normalize(),
      vertices = [],
      indices = [],
      rings = 7,
      sides = 8;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings,
        center = a.clone().lerp(b, t);
      center.addScaledVector(depth, Math.sin(t * Math.PI) * width * 0.35);
      const radius = width * Math.pow(1 - t, 0.72) * (1 + 0.16 * Math.sin(t * Math.PI));
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const v = center
          .clone()
          .addScaledVector(side, Math.cos(angle) * radius)
          .addScaledVector(depth, Math.sin(angle) * radius * 0.6);
        vertices.push(...v.toArray());
      }
      if (j < rings)
        for (let i = 0; i < sides; i++) {
          const n = j * sides + i,
            next = j * sides + ((i + 1) % sides);
          indices.push(n, next, n + sides, next, next + sides, n + sides);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return charactersModule.meshTo(g, geo, mat);
  };
  artModule.stitch = function stitch(g, mat, points, r = 0.005) {
    return charactersModule.tube(g, mat, points, r);
  };
  function refineCharacter(b, id) {
    const p = b.parts;
    const ink = charactersModule.M(0x34302b),
      seam = charactersModule.M(0x785b45, {
        transparent: true,
        opacity: 0.42,
      }); // Cloth stays matte and graphic; the fine weave is only visible close up.
    const fabric = artModule.artTexture('fabric'),
      mats = new Set();
    b.root.traverse((o) => {
      if (o.material?.isMeshToonMaterial) mats.add(o.material);
    });
    const textileColors = new Set([
      0xe85128, 0x243b70, 0xf09f77, 0xe7e3d2, 0xe289a3, 0x383e54, 0x419f68, 0x448954, 0xc44235,
    ]);
    for (const m of mats)
      if (textileColors.has(m.color.getHex())) {
        m.map = fabric;
        m.needsUpdate = true;
      }
    // Collar, seams and a second belt tail follow their original animated joints.
    if (['goku', 'krillin', 'yamcha'].includes(id)) {
      const piping = charactersModule.M(id === 'yamcha' ? 0x284e35 : 0x963923);
      for (const s of [-1, 1])
        artModule.stitch(
          p.torsoGroup,
          piping,
          [
            [s * 0.12, 0.46, 0.145],
            [s * 0.105, 0.34, 0.235],
            [s * 0.045, 0.25, 0.243],
          ],
          0.012,
        );
      artModule.stitch(
        p.torsoGroup,
        seam,
        [
          [-0.21, 0.05, 0.168],
          [-0.09, 0.02, 0.195],
          [0.035, -0.01, 0.208],
        ],
        0.005,
      );
      const sash = charactersModule.M(id === 'yamcha' ? 0xc44235 : 0x243b70);
      const knot = charactersModule.ball(
        p.torsoGroup,
        sash,
        0.055,
        -0.08,
        0.228,
        0.052,
        [1.4, 0.9, 0.65],
      );
      knot.name = 'sash-knot';
      artModule.stitch(
        p.torsoGroup,
        sash,
        [
          [0.07, -0.12, 0.25],
          [-0.045, -0.25, 0.27],
          [-0.035, -0.35, 0.265],
        ],
        0.026,
      );
    }
    for (const [leg, knee] of [
      [p.legL, p.kneeL, p.footL],
      [p.legR, p.kneeR, p.footR],
    ]) {
      artModule.stitch(
        leg,
        seam,
        [
          [-0.11, -0.11, 0.08],
          [-0.137, -0.2, 0.1],
          [-0.105, -0.37, 0.08],
        ],
        0.004,
      );
      artModule.stitch(
        knee,
        seam,
        [
          [0.07, -0.07, 0.09],
          [0.091, -0.17, 0.095],
          [0.072, -0.29, 0.084],
        ],
        0.004,
      );
      const sole = charactersModule.ball(
        knee,
        charactersModule.M(0x292622),
        0,
        -0.438,
        0.065,
        0.125,
        [1.03, 0.15, 1.72],
      );
      sole.name = 'cloth-shoe-sole';
      if (id === 'goku' || id === 'krillin') {
        charactersModule.meshTo(
          knee,
          new THREE.CylinderGeometry(0.107, 0.108, 0.13, 20),
          charactersModule.M(0x243b70),
          0,
          -0.295,
          0,
        );
        artModule.stitch(
          knee,
          charactersModule.M(0xdcb797),
          [
            [-0.07, -0.32, 0.08],
            [0, -0.3, 0.115],
            [0.07, -0.32, 0.08],
          ],
          0.01,
        );
      }
    }
    // A finer eyelid prevents a generic round-eyed adult face.
    if (!['goku', 'krillin', 'roshi'].includes(id))
      for (const s of [-1, 1]) {
        artModule.stitch(
          p.head,
          ink,
          [
            [s * 0.026, 0.064, 0.235],
            [s * 0.082, 0.07, 0.25],
            [s * 0.145, 0.057, 0.222],
          ],
          0.007,
        );
        p.brows[s < 0 ? 0 : 1].rotation.z = s * 0.26;
      }
    if (id === 'goku') {
      const tail = p.tail;
      tail.name = 'monkey-tail';
      const cap = charactersModule.M(0x912422);
      for (const x of [-1.22, 1.22]) {
        const ring = charactersModule.meshTo(
          p.staff,
          new THREE.TorusGeometry(0.035, 0.007, 6, 16),
          cap,
          0,
          x,
          0,
        );
        ring.rotation.x = Math.PI / 2;
      }
    } else if (id === 'roshi') {
      const white = charactersModule.M(0xfff6e6),
        shell = charactersModule.M(0x71543b),
        shirt = charactersModule.M(0xf09f77);
      p.pelvis.material = charactersModule.M(0xe7e3d2);
      charactersModule
        .meshTo(p.torsoGroup, new THREE.TorusGeometry(0.43, 0.028, 8, 48), shell, 0, 0.14, -0.395)
        .scale.set(1, 1.2, 1);
      const vertices = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        vertices.push([Math.cos(a) * 0.2, 0.14 + Math.sin(a) * 0.25, -0.572]);
      }
      vertices.push(vertices[0]);
      artModule.stitch(p.torsoGroup, shell, vertices, 0.013);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        artModule.stitch(
          p.torsoGroup,
          shell,
          [
            [Math.cos(a) * 0.2, 0.14 + Math.sin(a) * 0.25, -0.57],
            [Math.cos(a) * 0.34, 0.14 + Math.sin(a) * 0.45, -0.5],
          ],
          0.011,
        );
      }
      artModule.stitch(
        p.torsoGroup,
        seam,
        [
          [0, 0.37, 0.245],
          [0, 0.2, 0.248],
          [0, 0.02, 0.2],
        ],
        0.005,
      );
      for (let i = 0; i < 4; i++)
        charactersModule.ball(
          p.torsoGroup,
          charactersModule.M(0xe9dcc0),
          0.014,
          0.33 - i * 0.087,
          0.25,
          0.014,
          [1, 1, 0.45],
        );
      for (const s of [-1, 1]) {
        const collar = charactersModule.box(
          p.torsoGroup,
          shirt,
          s * 0.105,
          0.405,
          0.19,
          0.16,
          0.15,
          0.04,
        );
        collar.rotation.z = s * 0.42;
        artModule.hairLock(p.head, white, [s * 0.085, -0.135, 0.25], [s * 0.2, -0.16, 0.24], 0.042);
        artModule.stitch(
          p.head,
          charactersModule.M(0xaf8e75),
          [
            [s * 0.04, 0.16, 0.21],
            [s * 0.11, 0.165, 0.2],
            [s * 0.16, 0.15, 0.18],
          ],
          0.004,
        );
        artModule.stitch(
          p.head,
          charactersModule.M(0xc54d3b),
          [
            [s * 0.195, 0.025, 0.235],
            [s * 0.244, 0.024, 0.12],
            [s * 0.25, 0.015, -0.04],
          ],
          0.013,
        );
      }
      for (let i = 0; i < 5; i++)
        artModule.hairLock(
          p.head,
          white,
          [(i - 2) * 0.041, -0.18, 0.21],
          [(i - 2) * 0.025, -0.415 + Math.abs(i - 2) * 0.035, 0.15],
          0.04,
        );
    } else if (id === 'taopaipai') {
      const black = charactersModule.M(0x20202b),
        pink = charactersModule.M(0xe289a3),
        gold = charactersModule.M(0xd1a255);
      for (const fore of [p.foreL, p.foreR]) {
        for (const o of fore.children) if (o.isMesh) o.material = pink;
        charactersModule.meshTo(
          fore,
          new THREE.CylinderGeometry(0.087, 0.087, 0.055, 16),
          black,
          0,
          -0.26,
          0,
        );
      }
      p.pelvis.visible = false;
      const hem = charactersModule.meshTo(
        p.torsoGroup,
        new THREE.CylinderGeometry(0.24, 0.29, 0.44, 24),
        pink,
        0,
        -0.285,
        0,
      );
      hem.scale.z = 0.77;
      artModule.stitch(
        p.torsoGroup,
        black,
        [
          [0, -0.08, 0.195],
          [0, -0.28, 0.214],
          [0, -0.5, 0.227],
        ],
        0.007,
      );
      for (const s of [-1, 1]) {
        const collar = charactersModule.box(
          p.torsoGroup,
          pink,
          s * 0.063,
          0.462,
          0.11,
          0.09,
          0.1,
          0.085,
        );
        collar.rotation.z = s * 0.1;
        artModule.stitch(
          p.torsoGroup,
          black,
          [
            [s * 0.055, 0.48, 0.159],
            [s * 0.057, 0.405, 0.231],
          ],
          0.01,
        );
      }
      for (let i = 0; i < 4; i++) {
        const y = 0.12 + i * 0.1;
        artModule.stitch(
          p.torsoGroup,
          black,
          [
            [-0.09, y, 0.242],
            [-0.05, y + 0.02, 0.247],
            [0.03, y, 0.25],
            [0.075, y + 0.015, 0.24],
          ],
          0.009,
        );
        charactersModule.ball(p.torsoGroup, gold, 0.025, y, 0.259, 0.012);
      }
      // Replace the single tube with an interwoven braid, behind the skull and back.
      const old = p.head.children.filter(
        (o) => o.geometry?.type === 'TubeGeometry' && o.geometry.parameters.radius === 0.042,
      );
      for (const o of old) {
        p.head.remove(o);
        o.geometry.dispose();
      }
      const braid = new THREE.Group();
      braid.name = 'taopaipai-braid';
      p.head.add(braid);
      for (let strand = 0; strand < 3; strand++) {
        const points = [];
        for (let j = 0; j <= 32; j++) {
          const t = j / 32,
            a = t * Math.PI * 12 + (strand * Math.PI * 2) / 3;
          points.push([0.035 + Math.sin(a) * 0.025, -0.04 - t * 1.15, -0.276 + Math.cos(a) * 0.02]);
        }
        artModule.stitch(braid, black, points, 0.018);
      }
      charactersModule.meshTo(
        braid,
        new THREE.CylinderGeometry(0.04, 0.042, 0.06, 12),
        pink,
        0.035,
        -1.18,
        -0.276,
      );
      for (const s of [-1, 1])
        artModule.stitch(
          p.head,
          black,
          [
            [s * 0.05, 0.09, 0.21],
            [s * 0.15, 0.1, 0.18],
            [s * 0.19, 0.06, 0.14],
          ],
          0.009,
        );
    } else if (id === 'piccolo') {
      const crease = charactersModule.M(0x425c36),
        pink = charactersModule.M(0xbc7c77);
      for (const s of [-1, 1]) {
        artModule.stitch(
          p.head,
          crease,
          [
            [s * 0.026, 0.135, 0.208],
            [s * 0.083, 0.14, 0.215],
            [s * 0.15, 0.116, 0.196],
          ],
          0.007,
        );
        artModule.stitch(
          p.head,
          crease,
          [
            [s * 0.055, -0.08, 0.211],
            [s * 0.145, -0.107, 0.196],
            [s * 0.183, -0.05, 0.16],
          ],
          0.005,
        );
        const inner = charactersModule.meshTo(
          p.head,
          new THREE.ConeGeometry(0.046, 0.22, 3),
          pink,
          s * 0.315,
          0.014,
          0.032,
        );
        inner.rotation.z = (-s * Math.PI) / 2;
        inner.scale.z = 0.28;
        for (const limb of [s < 0 ? p.armL : p.armR, s < 0 ? p.foreL : p.foreR])
          for (let i = 0; i < 5; i++)
            artModule.stitch(
              limb,
              crease,
              [
                [-0.045, -0.055 - i * 0.035, 0.085],
                [0, -0.06 - i * 0.035, 0.098],
                [0.045, -0.055 - i * 0.035, 0.085],
              ],
              0.004,
            );
        const hand = s < 0 ? p.handL : p.handR;
        for (let i = 0; i < 3; i++) {
          const nail = charactersModule.meshTo(
            hand,
            new THREE.ConeGeometry(0.012, 0.046, 6),
            charactersModule.M(0xf3e4c4),
            (i - 1) * 0.045,
            -0.046,
            0.087,
          );
          nail.rotation.x = Math.PI;
        }
      }
    } else if (id === 'tien') {
      const muscle = charactersModule.M(0xa97e60, {
        transparent: true,
        opacity: 0.5,
      });
      for (const s of [-1, 1]) {
        artModule.stitch(
          p.torsoGroup,
          muscle,
          [
            [s * 0.035, 0.38, 0.235],
            [s * 0.11, 0.405, 0.25],
            [s * 0.23, 0.36, 0.19],
          ],
          0.005,
        );
        artModule.stitch(
          p.torsoGroup,
          muscle,
          [
            [s * 0.025, 0.1, 0.212],
            [s * 0.11, 0.115, 0.22],
            [s * 0.19, 0.08, 0.188],
          ],
          0.004,
        );
        for (let i = 0; i < 3; i++)
          artModule.stitch(
            s < 0 ? p.foreL : p.foreR,
            charactersModule.M(0xc6c4b1),
            [
              [-0.075, -0.19 - i * 0.028, 0.042],
              [0, -0.19 - i * 0.028, 0.096],
              [0.075, -0.19 - i * 0.028, 0.042],
            ],
            0.003,
          );
      }
      artModule.stitch(
        p.head,
        ink,
        [
          [-0.037, 0.186, 0.219],
          [0, 0.203, 0.223],
          [0.037, 0.186, 0.219],
        ],
        0.006,
      );
    } else if (id === 'krillin') {
      for (const s of [-1, 1])
        artModule.stitch(
          p.head,
          charactersModule.M(0xc58b64, {
            transparent: true,
            opacity: 0.6,
          }),
          [
            [s * 0.15, -0.068, 0.232],
            [s * 0.18, -0.06, 0.211],
          ],
          0.004,
        );
    } else if (id === 'yamcha') {
      const black = charactersModule.M(0x1c2029),
        highlight = charactersModule.M(0x333839),
        red = charactersModule.M(0xc44235);
      for (const s of [-1, 1]) {
        artModule.hairLock(p.head, black, [s * 0.09, 0.21, 0.16], [s * 0.19, 0.08, 0.237], 0.065);
        for (let i = 0; i < 3; i++)
          artModule.hairLock(
            p.head,
            black,
            [s * 0.14, -0.03 - i * 0.045, -0.16],
            [s * (0.24 + i * 0.045), -0.33 - i * 0.07, -0.18],
            0.09,
          );
        artModule.stitch(
          p.head,
          highlight,
          [
            [s * 0.11, 0.22, -0.15],
            [s * 0.21, 0.11, -0.2],
            [s * 0.23, -0.14, -0.23],
          ],
          0.006,
        );
      }
      const scarf = new THREE.Shape();
      scarf.moveTo(0, 0);
      scarf.quadraticCurveTo(0.17, 0.1, 0.42, -0.08);
      scarf.lineTo(0.36, -0.23);
      scarf.quadraticCurveTo(0.16, -0.08, 0, -0.06);
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.ExtrudeGeometry(scarf, {
          depth: 0.027,
          bevelEnabled: true,
          bevelSize: 0.007,
          bevelThickness: 0.007,
          bevelSegments: 2,
          steps: 1,
        }),
        red,
        0.18,
        0.4,
        -0.22,
      );
    }
    b.root.name = 'art-' + id;
    b.root.userData.artProfile = artModule.ART_PROFILES[id];
    return b;
  }
  artModule.batchDecoration = function batchDecoration(g) {
    g.updateMatrixWorld(true);
    const buckets = new Map(),
      inverse = g.matrixWorld.clone().invert();
    g.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      let bucket = buckets.get(o.material);
      if (!bucket) {
        bucket = [];
        buckets.set(o.material, bucket);
      }
      const geo = o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      bucket.push(geo.index ? geo.toNonIndexed() : geo);
      if (geo.index) geo.dispose();
    });
    const originals = new Set();
    g.traverse((o) => {
      if (o.geometry) originals.add(o.geometry);
    });
    g.clear();
    for (const geo of originals) geo.dispose();
    for (const [material, geos] of buckets) {
      const merged = new THREE.BufferGeometry();
      for (const key of ['position', 'normal', 'uv']) {
        if (!geos.every((x) => x.attributes[key])) continue;
        const size = geos[0].attributes[key].itemSize,
          total = geos.reduce((n, x) => n + x.attributes[key].array.length, 0),
          data = new Float32Array(total);
        let at = 0;
        for (const geo of geos) {
          data.set(geo.attributes[key].array, at);
          at += geo.attributes[key].array.length;
        }
        merged.setAttribute(key, new THREE.BufferAttribute(data, size));
      }
      merged.computeBoundingSphere();
      charactersModule.meshTo(g, merged, material);
      for (const geo of geos) geo.dispose();
    }
  };
  artModule.refinedWindow = function refinedWindow(g, x, y, z, w, h) {
    const frame = charactersModule.M(0xf8e9cb),
      glass = charactersModule.M(0x6f9ea4),
      shade = charactersModule.M(0x365d64);
    charactersModule.box(g, shade, x, y, z, w + 0.2, h + 0.2, 0.08);
    charactersModule.box(g, glass, x, y, z + 0.07, w, h, 0.04);
    for (const s of [-1, 1]) {
      charactersModule.box(g, frame, x + (s * w) / 2, y, z + 0.1, 0.09, h + 0.16, 0.09);
      charactersModule.box(g, frame, x, y + (s * h) / 2, z + 0.1, w + 0.16, 0.09, 0.09);
    }
    charactersModule.box(g, frame, x, y, z + 0.12, 0.055, h, 0.05);
    charactersModule.box(g, frame, x, y, z + 0.12, w, 0.055, 0.05);
    charactersModule.box(g, frame, x, y - h / 2 - 0.08, z + 0.18, w + 0.28, 0.1, 0.35);
    const shine = charactersModule.M(0xc7e6df, {
      transparent: true,
      opacity: 0.38,
    });
    const line = charactersModule.box(
      g,
      shine,
      x - w * 0.22,
      y + h * 0.1,
      z + 0.13,
      w * 0.08,
      h * 0.67,
      0.008,
    );
    line.rotation.z = -0.32;
  };
  artModule.seaTurtle = function seaTurtle(g, x, z) {
    const t = new THREE.Group();
    t.name = 'umigame';
    t.position.set(x, 0.1, z);
    t.rotation.y = 0.7;
    g.add(t);
    const shell = charactersModule.M(0x926951),
      skin = charactersModule.M(0xc6ab78),
      edge = charactersModule.M(0x493c31);
    charactersModule.ball(t, shell, 0, 0.28, 0, 0.66, [1, 0.62, 1.22]);
    charactersModule.meshTo(
      t,
      new THREE.TorusGeometry(0.64, 0.035, 6, 40),
      edge,
      0,
      0.16,
      0,
    ).rotation.x = Math.PI / 2;
    charactersModule.ball(t, skin, 0, 0.21, 0.83, 0.22, [1, 0.75, 1.4]);
    for (const s of [-1, 1]) {
      charactersModule.ball(t, edge, s * 0.125, 0.25, 0.96, 0.026);
      charactersModule.ball(t, skin, s * 0.59, 0.07, 0.32, 0.27, [1.4, 0.2, 0.72]);
      charactersModule.ball(t, skin, s * 0.48, 0.06, -0.48, 0.22, [1.3, 0.2, 0.7]);
    }
    for (const s of [-1, 1])
      artModule.stitch(
        t,
        edge,
        [
          [s * 0.12, 0.68, -0.35],
          [s * 0.3, 0.64, 0],
          [s * 0.13, 0.67, 0.36],
        ],
        0.014,
      );
    artModule.stitch(
      t,
      edge,
      [
        [-0.45, 0.51, 0],
        [0, 0.69, 0],
        [0.45, 0.51, 0],
      ],
      0.014,
    );
    artModule.stitch(
      t,
      edge,
      [
        [-0.3, 0.58, -0.37],
        [0, 0.65, -0.39],
        [0.3, 0.58, -0.37],
      ],
      0.014,
    );
  };
  artModule.stageThumbnail = function stageThumbnail(def) {
    // Stage builders choose global daylight; restore it after the offscreen preview.
    const saved = {
      background: renderModule.scene.background,
      fog: renderModule.scene.fog,
      sun: renderModule.sun.color.clone(),
      hemi: renderModule.hemi.color.clone(),
      ground: renderModule.hemi.groundColor.clone(),
      rim: renderModule.rim.color.clone(),
      si: renderModule.sun.intensity,
      hi: renderModule.hemi.intensity,
      ri: renderModule.rim.intensity,
      pos: renderModule.sun.position.clone(),
    };
    const map = def.build(),
      sc = new THREE.Scene();
    sc.background = new THREE.Color(0xa7d5e4);
    sc.add(map.group, new THREE.HemisphereLight(0xfff8e8, 0x65736a, 1.2));
    const key = new THREE.DirectionalLight(0xffe8c6, 2.5);
    key.position.set(-12, 24, 12);
    sc.add(key);
    sc.add(key.target);
    const fill = new THREE.DirectionalLight(0xbadbe9, 0.55);
    fill.position.set(24, 14, -30);
    sc.add(fill);
    configureStageDisplayShadows(uiModule.portraitRenderer, key);
    const cam = new THREE.PerspectiveCamera(43, 2.5, 0.1, 350);
    cam.position.set(def.id === 'wild' ? 27 : 23, 18, def.id === 'wild' ? 30 : 27);
    cam.lookAt(0, 2, -6);
    uiModule.portraitRenderer.setSize(600, 240);
    uiModule.portraitRenderer.render(sc, cam);
    const url = uiModule.portraitRenderer.domElement.toDataURL();
    key.shadow.dispose();
    worldModule.disposeGroup(map.group);
    renderModule.scene.background = saved.background;
    renderModule.scene.fog = saved.fog;
    renderModule.sun.color.copy(saved.sun);
    renderModule.hemi.color.copy(saved.hemi);
    renderModule.hemi.groundColor.copy(saved.ground);
    renderModule.rim.color.copy(saved.rim);
    renderModule.sun.intensity = saved.si;
    renderModule.hemi.intensity = saved.hi;
    renderModule.rim.intensity = saved.ri;
    renderModule.sun.position.copy(saved.pos);
    return url;
  };
  return function initialize() {
    artModule.ART_PROFILES = {
      goku: {
        label: '龟仙流修行服',
        note: '少年比例、黑色放射发束、橙红无袖道服、蓝腰带、龟字徽章、棕色尾巴与红色如意棒。',
      },
      roshi: {
        label: '武天老师 · 日常装',
        note: '光头、白眉白须、红框墨镜、橙色短袖衬衫、浅色长裤与分块龟壳。',
      },
      taopaipai: {
        label: '桃白白 · 初登场造型',
        note: '粉色中式长衫、黑色盘扣、黑裤布鞋、细长胡须与分节长辫；背部保留「殺」字。',
      },
      piccolo: {
        label: '比克大魔王 · 年轻形态',
        note: '绿色皮肤、触角、尖耳、紫黑魔字服、红腰带与褐色鞋；区别于后来的白披风比克。',
      },
      tien: {
        label: '天津饭 · 大会战斗装',
        note: '光头与额头第三只眼、裸露上身、绿色武裤、红腰带及白色腕带。',
      },
      krillin: {
        label: '小林 · 少年龟仙流',
        note: '矮小体型、光头六点戒疤、无鼻轮廓与橙红龟仙流道服。',
      },
      yamcha: {
        label: '雅木茶 · 荒野盗贼装',
        note: '早期长发、绿色武服、红围巾与腰带、胸前「樂」字；保持少年篇无面部刀疤的造型。',
      },
    };
    for (const c of charactersModule.CHARACTERS) {
      const base = c.buildBody;
      c.buildBody = () => refineCharacter(base(), c.id);
    }

    // Merge only the new static decoration, by material. Animated joints stay separate.
  };
}
