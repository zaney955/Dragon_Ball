import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export const KAMI_LAYOUT = Object.freeze({ radius: 28, templeZ: -18, bounds: { x: 13.5, z: 6 } });

// Clip paving at the true circular edge; no square slab extends into the sky.
function clipTile(points, radius) {
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * TAU,
      nx = Math.cos(a),
      nz = Math.sin(a);
    const input = points;
    points = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length];
      const dp = p[0] * nx + p[1] * nz - radius,
        dq = q[0] * nx + q[1] * nz - radius;
      if (dp <= 0) points.push(p);
      if (dp <= 0 !== dq <= 0) {
        const t = dp / (dp - dq);
        points.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    if (!points.length) break;
  }
  return points;
}

// Keep indices and spatial buckets: the distant sky is neither a shadow caster
// nor a camera obstacle. Separate breakable ornaments survive static batching.
function batch(root, name, shadows = true) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map(),
    originals = new Set();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    if (!geo.index)
      geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, i) => i));
    if (!buckets.has(mesh.material)) buckets.set(mesh.material, []);
    buckets.get(mesh.material).push(geo);
    originals.add(mesh.geometry);
  });
  root.clear();
  for (const [material, pieces] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(pieces), material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = shadows;
    mesh.userData.cameraBlocker = shadows;
    root.add(mesh);
    pieces.forEach((geo) => geo.dispose());
  }
  originals.forEach((geo) => geo.dispose());
}

export function createKamiStage({ characters, world, render, lightPreset = 'day' }) {
  const group = new THREE.Group(),
    masonry = new THREE.Group(),
    palace = new THREE.Group(),
    garden = new THREE.Group();
  group.add(masonry, palace, garden);
  masonry.name = 'kami-platform';
  palace.name = 'kami-palace';
  garden.name = 'kami-gardens';
  const mat = (color) => characters.M(color);
  const stone = mat(0xe8e5df),
    trim = mat(0xfff5df),
    shade = mat(0xb0bbce),
    mortar = mat(0xb8b7b3);
  const gold = mat(0xe5ac37),
    goldLight = mat(0xffd779),
    goldShade = mat(0xa76a20),
    dark = mat(0x24374e);
  const red = mat(0x971e35),
    soil = mat(0x455a35),
    bark = mat(0x71604c);
  const leaves = [0x234e3c, 0x346948, 0x49805a].map(mat);
  const texture = world.surfaceTexture('stone');
  texture.repeat.set(3, 3);
  stone.map = texture;
  const pavers = [0xe5e2dc, 0xeee9e2, 0xe0dfe2, 0xebe5dc, 0xe7e7e6].map((color) => {
    const m = mat(color);
    m.map = texture;
    return m;
  });
  const mesh = (g, geometry, material, x = 0, y = 0, z = 0) =>
    characters.meshTo(g, geometry, material, x, y, z);
  const box = (g, m, x, y, z, w, h, d) => characters.box(g, m, x, y, z, w, h, d);
  const cylinder = (g, m, r, h, y, x = 0, z = 0, bottom = r, segments = 96) =>
    mesh(g, new THREE.CylinderGeometry(r, bottom, h, segments), m, x, y, z);
  const lathe = (g, m, profile, x = 0, y = 0, z = 0, segments = 96) =>
    mesh(
      g,
      new THREE.LatheGeometry(
        profile.map(([r, h]) => new THREE.Vector2(r, h)),
        segments,
      ),
      m,
      x,
      y,
      z,
    );
  const ring = (g, m, r, tube, y, x = 0, z = 0, segments = 128) => {
    const o = mesh(g, new THREE.TorusGeometry(r, tube, 6, segments), m, x, y, z);
    o.rotation.x = -Math.PI / 2;
    return o;
  };
  const tube = (g, m, points, radius = 0.035, segments = 32) =>
    mesh(
      g,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        segments,
        radius,
        5,
        false,
      ),
      m,
    );
  function archShape(w, h) {
    const s = new THREE.Shape(),
      r = w / 2,
      spring = h - r;
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, spring);
    s.absarc(0, spring, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    return s;
  }
  function arch(g, w, h, thickness, material, depth = 0.12) {
    const s = new THREE.Shape(),
      inner = w / 2,
      outer = inner + thickness;
    const spring = h - inner;
    s.moveTo(-outer, 0);
    s.lineTo(-outer, spring);
    s.absarc(0, spring, outer, Math.PI, 0, true);
    s.lineTo(outer, 0);
    s.lineTo(inner, 0);
    s.lineTo(inner, spring);
    s.absarc(0, spring, inner, 0, Math.PI, false);
    s.lineTo(-inner, 0);
    s.closePath();
    return mesh(
      g,
      new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 }),
      material,
    );
  }
  function window(g, x, y, z, w, h) {
    mesh(g, new THREE.ShapeGeometry(archShape(w, h), 16), dark, x, y, z);
    const frame = arch(g, w, h, 0.09, trim, 0.07);
    frame.position.set(x, y, z + 0.015);
    box(g, goldShade, x, y + 0.025, z + 0.1, w + 0.2, 0.07, 0.17);
  }
  function column(g, x, y, z, h, r = 0.18) {
    lathe(
      g,
      stone,
      [
        [r * 1.6, 0],
        [r * 1.6, 0.12],
        [r * 1.25, 0.18],
        [r, 0.3],
        [r * 0.85, h - 0.35],
        [r * 1.25, h - 0.23],
        [r * 1.6, h - 0.19],
        [r * 1.6, h],
      ],
      x,
      y,
      z,
      20,
    );
    ring(g, gold, r * 1.05, 0.035, y + 0.24, x, z, 20);
    ring(g, gold, r * 1.28, 0.035, y + h - 0.24, x, z, 20);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      cylinder(
        g,
        trim,
        0.018,
        h - 0.7,
        y + h / 2,
        x + Math.cos(a) * r * 0.93,
        z + Math.sin(a) * r * 0.93,
        0.018,
        5,
      );
    }
  }
  function finial(g, x, y, z, size = 1) {
    lathe(
      g,
      goldLight,
      [
        [0.21, 0],
        [0.22, 0.09],
        [0.1, 0.16],
        [0.06, 0.38],
        [0.15, 0.56],
        [0.2, 0.7],
        [0.12, 0.85],
        [0.035, 0.96],
        [0.018, 1.33],
        [0, 1.45],
      ].map(([r, h]) => [r * size, h * size]),
      x,
      y,
      z,
      24,
    );
  }
  function dome(g, x, y, z, r, h, ribs = 32, detail = true) {
    const profile = [];
    for (let i = 0; i <= 32; i++) {
      const t = ((i / 32) * Math.PI) / 2;
      profile.push([r * Math.cos(t), h * Math.sin(t)]);
    }
    lathe(g, gold, profile, x, y, z, detail ? 96 : 32);
    ring(g, goldShade, r, 0.075, y, x, z, detail ? 128 : 32);
    ring(g, goldLight, r * 1.005, 0.038, y + 0.1, x, z, detail ? 128 : 32);
    if (detail)
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * TAU,
          points = [];
        for (let j = 0; j <= 16; j++) {
          const t = (j / 16) * 1.52,
            rr = r * Math.cos(t) + 0.022;
          points.push([x + Math.sin(a) * rr, y + h * Math.sin(t) + 0.015, z + Math.cos(a) * rr]);
        }
        tube(g, i % 2 ? goldLight : goldShade, points, r > 3 ? 0.025 : 0.015, 24);
      }
    finial(g, x, y + h, z, Math.max(0.45, r * 0.23));
  }
  // True open radial arcades, with extruded voussoirs and recessed inner rooms.
  function arcade(g, x, z, r, base, height, count, enclosed = false, detail = true) {
    const w = 2 * r * Math.tan(Math.PI / count),
      opening = w * 0.64;
    cylinder(g, shade, r * 0.83, 0.12, base, x, z);
    cylinder(g, stone, r + 0.2, 0.16, base + height, x, z);
    ring(g, gold, r + 0.18, 0.035, base + height + 0.1, x, z);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU,
        panel = new THREE.Group();
      panel.position.set(x + Math.sin(a) * r, base, z + Math.cos(a) * r);
      panel.rotation.y = a;
      g.add(panel);
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(-opening / 2, 0);
      shape.lineTo(-opening / 2, height - opening / 2 - 0.25);
      shape.absarc(0, height - opening / 2 - 0.25, opening / 2, Math.PI, 0, true);
      shape.lineTo(opening / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(w / 2, height);
      shape.lineTo(-w / 2, height);
      shape.closePath();
      mesh(
        panel,
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.26,
          bevelEnabled: false,
          curveSegments: detail ? 20 : 8,
        }),
        stone,
      );
      const rim = arch(panel, opening, height - 0.25, 0.1, trim);
      rim.position.z = 0.27;
      if (detail) column(panel, -w / 2 + 0.12, 0, 0.38, height, 0.13);
      if (enclosed) {
        window(panel, 0, 0.12, -0.32, opening * 0.92, height - 0.5);
        box(panel, shade, 0, height / 2, -0.5, w, height, 0.1);
      }
    }
    if (!enclosed) cylinder(g, dark, r * 0.64, height * 0.96, base + height * 0.48, x, z);
    for (const [offset, rr, hh] of [
      [-0.06, 0.34, 0.1],
      [0.08, 0.26, 0.14],
      [0.22, 0.12, 0.08],
    ])
      cylinder(g, trim, r + rr, hh, base + height + offset, x, z);
  }
  function pavilion(g, x, z, r = 2.1, height = 4.4, base = 0.6, detail = true) {
    cylinder(g, trim, r + 0.45, 0.25, base - 0.12, x, z);
    arcade(g, x, z, r, base, height, detail ? 12 : 8, false, detail);
    dome(g, x, base + height + 0.28, z, r + 0.08, r * 0.56, 24, detail);
    if (detail) {
      arcade(g, x, z, r * 0.58, base + height + r * 0.6 + 0.15, 1.5, 10);
      dome(g, x, base + height + r * 0.6 + 1.9, z, r * 0.68, r * 0.48, 20);
    }
  }
  function cypress(g, x, z, h = 7.4, base = 0) {
    cylinder(g, trim, 1.26, 0.46, base + 0.23, x, z);
    ring(g, stone, 1.22, 0.09, base + 0.5, x, z, 48);
    cylinder(g, soil, 1.07, 0.03, base + 0.47, x, z);
    cylinder(g, bark, 0.12, h * 0.6, base + h * 0.3, x, z, 0.2, 10);
    // Continuous, irregular foliage envelope, with overlapping twig sprays.
    const profile = [
      [0, 0.65],
      [0.62, 0.9],
      [0.86, 1.5],
      [0.81, 2.7],
      [0.65, 4.2],
      [0.42, 5.6],
      [0.22, 6.6],
      [0, 7.4],
    ].map(([r, y]) => [(r * h) / 7.4, (y * h) / 7.4]);
    lathe(g, leaves[0], profile, x, base, z, 18);
    for (let i = 0; i < 65; i++) {
      const t = i / 65,
        a = i * 2.399,
        rr = (Math.sin(t * Math.PI) * 0.69 * h) / 7.4;
      const twig = mesh(
        g,
        new THREE.SphereGeometry(1, 6, 5),
        leaves[i % 3],
        x + Math.cos(a) * rr,
        base + 1 + t * (h - 1.4),
        z + Math.sin(a) * rr,
      );
      twig.scale.set(
        ((0.17 + (1 - t) * 0.16) * h) / 7.4,
        ((0.45 + (1 - t) * 0.15) * h) / 7.4,
        (0.23 * h) / 7.4,
      );
      twig.rotation.z = Math.cos(a) * 0.2;
    }
  }
  // Substantial floating bowl, stepped cornices and a full ring of recessed windows.
  lathe(
    masonry,
    stone,
    [
      [0, -7.5],
      [9, -6.8],
      [20, -5.3],
      [26.7, -3.9],
      [27.5, -3.2],
      [27.8, -1.4],
      [28, -0.2],
      [28, -0.08],
    ],
    0,
    0,
    0,
    192,
  );
  cylinder(masonry, mortar, 27.8, 0.13, -0.09, 0, 0, 27.8, 192);
  for (const [r, y, h, m] of [
    [27.9, -0.18, 0.2, trim],
    [27.9, -0.55, 0.12, trim],
    [27.83, -1.15, 0.09, gold],
    [27.65, -3.2, 0.15, trim],
    [26.95, -3.95, 0.13, shade],
  ])
    cylinder(masonry, m, r, h, y, 0, 0, r, 192);
  for (let i = 0; i < 88; i++) {
    const a = (i / 88) * TAU,
      g = new THREE.Group();
    g.position.set(Math.sin(a) * 27.68, -2.92, Math.cos(a) * 27.68);
    g.rotation.y = a;
    masonry.add(g);
    window(g, 0, 0, 0.12, 0.56, 1.46);
    const relief = arch(g, 1.69, 0.57, 0.055, trim, 0.06);
    relief.position.set(0, 1.81, 0.17);
    box(g, shade, 0.97, 0.75, 0.1, 0.025, 1.65, 0.02);
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU,
      points = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8,
        r = 26.7 * (1 - t) + 9 * t;
      points.push([Math.sin(a) * r, -3.95 - 2.85 * Math.sin((t * Math.PI) / 2), Math.cos(a) * r]);
    }
    tube(masonry, shade, points, 0.026, 12);
  }
  // Fine individually coloured marble pavers. A subset remains independently breakable.
  const tiles = [];
  for (let ix = -20; ix < 20; ix++)
    for (let iz = -20; iz < 20; iz++) {
      const x = ix * 1.4,
        z = iz * 1.4,
        gap = 0.018;
      if (Math.hypot(x + 0.7, z + 0.7) > 28.8) continue;
      const points = clipTile(
        [
          [x + gap, z + gap],
          [x + 1.4 - gap, z + gap],
          [x + 1.4 - gap, z + 1.4 - gap],
          [x + gap, z + 1.4 - gap],
        ],
        27.74,
      );
      if (points.length < 3) continue;
      const shape = new THREE.Shape(points.map(([xx, zz]) => new THREE.Vector2(xx, -zz)));
      const tile = mesh(
        masonry,
        new THREE.ShapeGeometry(shape),
        pavers[Math.abs(ix * 7 + iz * 13) % 5],
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.y = 0.002;
      if (
        Math.abs(x + 0.7) < 13.5 &&
        Math.abs(z + 0.7) < 6 &&
        (ix + iz) % 4 === 0 &&
        Math.hypot(x, z) > 5.5
      ) {
        tile.geometry.translate(-x - 0.7, z + 0.7, 0);
        tile.position.set(x + 0.7, 0.002, z + 0.7);
        group.add(tile);
        tiles.push(tile);
        tile.name = 'breakable-kami-slab';
        tile.userData.cameraBlocker = false;
      }
    }
  for (const r of [5.2, 5.48, 16.6, 16.83, 26.95]) {
    const o = mesh(masonry, new THREE.RingGeometry(r, r + (r < 6 ? 0.1 : 0.055), 192), gold);
    o.rotation.x = -Math.PI / 2;
    o.position.y = 0.016;
  }
  cylinder(masonry, trim, 5.17, 0.01, 0.008, 0, 0, 5.17, 128);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU,
      petal = new THREE.Shape();
    petal.moveTo(0, 0.75);
    petal.quadraticCurveTo(-1.1, 2.5, 0, 4.6);
    petal.quadraticCurveTo(1.1, 2.5, 0, 0.75);
    const p = mesh(masonry, new THREE.ShapeGeometry(petal, 20), i % 2 ? pavers[1] : goldLight);
    p.rotation.set(-Math.PI / 2, 0, a);
    p.position.y = 0.02;
    const ray = new THREE.Shape([
      new THREE.Vector2(-0.16, 1),
      new THREE.Vector2(0, 4.9),
      new THREE.Vector2(0.16, 1),
    ]);
    const line = mesh(masonry, new THREE.ShapeGeometry(ray), gold);
    line.rotation.set(-Math.PI / 2, 0, a + Math.PI / 12);
    line.position.y = 0.022;
  }
  cylinder(masonry, gold, 0.93, 0.012, 0.025, 0, 0, 0.93, 64);
  // Low curved parapets leave the playable rectangle and its camera apron open.
  for (const [r, y, h, m] of [
    [27.45, 0.42, 0.64, stone],
    [27.49, 0.81, 0.15, trim],
    [27.25, 0.23, 0.07, gold],
  ]) {
    const wall = lathe(
      masonry,
      m,
      [
        [r - 0.14, y - h / 2],
        [r + 0.14, y - h / 2],
        [r + 0.14, y + h / 2],
        [r - 0.14, y + h / 2],
        [r - 0.14, y - h / 2],
      ],
      0,
      0,
      0,
      192,
    );
    wall.userData.cameraBlocker = false;
  }
  const ornaments = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU,
      x = Math.sin(a) * 27.35,
      z = Math.cos(a) * 27.35;
    const pillar = new THREE.Group();
    pillar.position.set(x, 0, z);
    group.add(pillar);
    lathe(
      pillar,
      stone,
      [
        [0.62, -0.8],
        [0.72, -0.4],
        [0.6, 0],
        [0.53, 0.3],
        [0.53, 2.6],
        [0.65, 2.7],
        [0.65, 2.86],
      ],
      0,
      0,
      0,
      32,
    );
    for (const yy of [0.15, 2.64, 2.86]) ring(pillar, trim, 0.6, 0.055, yy, 0, 0, 32);
    dome(pillar, 0, 2.92, 0, 0.55, 0.39, 12);
    for (let k = 0; k < 4; k++) {
      const face = new THREE.Group(),
        t = (k / 4) * TAU;
      face.rotation.y = t;
      pillar.add(face);
      window(face, 0, 1.25, 0.535, 0.09, 0.48);
    }
    batch(pillar, 'kami-crowned-pillar');
    // Only the gold cap can chip, keeping the floating platform structurally intact.
    const cap = pillar.children.find((o) => o.material === gold);
    if (cap) {
      cap.userData.buildingPart = {
        building: 'kami-crown-' + i,
        column: 0,
        kind: 'roof',
        hp: 12,
        debrisColor: 0xe5ac37,
        debrisKind: 'stone',
      };
      ornaments.push(cap);
    }
  }
  // Main stacked palace: wide lower dome, lantern drum, and a tall upper dome.
  const z = KAMI_LAYOUT.templeZ;
  cylinder(palace, trim, 5.85, 0.55, 0.3, 0, z);
  arcade(palace, 0, z, 5.35, 0.6, 4.55, 20, true);
  // Carved entablature: alternating palmettes, rosettes and projecting dentils.
  cylinder(palace, shade, 5.48, 0.3, 5.13, 0, z);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU,
      relief = new THREE.Group();
    relief.position.set(Math.sin(a) * 5.49, 4.99, z + Math.cos(a) * 5.49);
    relief.rotation.y = a;
    palace.add(relief);
    const floral = new THREE.Shape();
    floral.moveTo(0, 0.04);
    floral.bezierCurveTo(-0.3, 0.08, -0.27, 0.24, -0.09, 0.2);
    floral.quadraticCurveTo(0, 0.36, 0.09, 0.2);
    floral.bezierCurveTo(0.27, 0.24, 0.3, 0.08, 0, 0.04);
    mesh(
      relief,
      new THREE.ExtrudeGeometry(floral, { depth: 0.035, bevelEnabled: false, curveSegments: 8 }),
      trim,
    );
    box(relief, trim, 0, 0.42, 0.015, 0.16, 0.1, 0.22);
  }
  dome(palace, 0, 5.45, z, 5.57, 2.65, 48);
  arcade(palace, 0, z, 3.38, 7.65, 1.7, 20, true);
  cylinder(palace, trim, 3.63, 0.18, 9.55, 0, z);
  dome(palace, 0, 9.65, z, 3.47, 2.68, 40);
  // Entrance projects forward into a carved pediment and double column portico.
  const entrance = new THREE.Group();
  entrance.position.set(0, 0.58, z + 5.23);
  palace.add(entrance);
  box(entrance, dark, 0, 1.55, -0.04, 2.5, 3.1, 0.18);
  const portal = arch(entrance, 2.35, 3.48, 0.23, trim, 0.65);
  portal.position.set(0, 0, 0.12);
  const doorTrim = arch(entrance, 2.09, 3.24, 0.065, gold, 0.06);
  doorTrim.position.z = 0.8;
  for (const side of [-1, 1]) {
    column(entrance, side * 1.65, 0, 0.78, 3.95, 0.2);
    column(entrance, side * 2.05, 0, 0.4, 3.95, 0.16);
  }
  const pediment = new THREE.Shape();
  pediment.moveTo(-2.45, 3.95);
  pediment.lineTo(0, 5.15);
  pediment.lineTo(2.45, 3.95);
  pediment.closePath();
  mesh(
    entrance,
    new THREE.ExtrudeGeometry(pediment, {
      depth: 0.46,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.05,
      bevelSegments: 2,
    }),
    trim,
    0,
    0,
    0.55,
  );
  tube(
    entrance,
    goldLight,
    [
      [-2.35, 4.01, 1.06],
      [0, 5.09, 1.06],
      [2.35, 4.01, 1.06],
    ],
    0.037,
  );
  const rosette = mesh(entrance, new THREE.TorusGeometry(0.3, 0.045, 8, 24), gold, 0, 4.53, 1.08);
  rosette.scale.set(1, 0.85, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const flower = mesh(
      entrance,
      new THREE.SphereGeometry(0.07, 8, 6),
      goldLight,
      Math.cos(a) * 0.18,
      4.53 + Math.sin(a) * 0.16,
      1.09,
    );
    flower.scale.z = 0.3;
  }
  for (let i = 0; i < 7; i++) {
    const stepZ = z + 6.15 + i * 0.37,
      y = 0.54 - i * 0.077;
    box(palace, trim, 0, y / 2, stepZ, 7.5 + i * 0.2, y, 0.4);
    box(palace, red, 0, y + 0.014, stepZ, 2.55, 0.024, 0.4);
    for (const s of [-1, 1]) box(palace, gold, s * 1.27, y + 0.028, stepZ, 0.055, 0.012, 0.4);
  }
  for (const s of [-1, 1]) {
    pavilion(palace, s * 9.4, -17.1, 2.25, 3.55);
    pavilion(palace, s * 6.6, -22.1, 1.45, 3.3);
    // Rear watch towers with open upper galleries and slender, moulded shafts.
    const x = s * 7.15,
      zz = -22.1;
    lathe(
      palace,
      stone,
      [
        [0.6, 0.5],
        [0.6, 0.75],
        [0.4, 1],
        [0.35, 11.4],
        [0.65, 11.8],
        [1.03, 12.25],
        [1.17, 12.45],
      ],
      x,
      0,
      zz,
      32,
    );
    for (const yy of [3, 7, 10.3]) ring(palace, goldLight, 0.365, 0.045, yy, x, zz, 32);
    arcade(palace, x, zz, 1.14, 12.5, 1.15, 12);
    dome(palace, x, 13.9, zz, 1.3, 0.73, 20);
    // Low connective arcades, mirrored either side of the main entrance.
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.set(s * (5.8 + i * 1.15), 0.6, -15.65);
      palace.add(g);
      const a = arch(g, 0.78, 2.7, 0.15, trim, 0.45);
      a.position.z = 0.1;
      box(g, shade, 0, 1.3, -0.12, 1.12, 2.6, 0.1);
      box(g, trim, 0, 2.83, 0.08, 1.2, 0.2, 0.75);
    }
    for (const [x, zz, h] of [
      [4.4, -11.9, 7],
      [8.05, -11.1, 6.5],
      [12.7, -14, 7.1],
      [22.8, 10.2, 7.6],
      [23.3, -6.2, 6.5],
    ])
      cypress(garden, s * x, zz, h);
  }
  batch(masonry, 'kami-marble-platform');
  // The platform is below the camera; expensive ray tests only target palace/gardens/pillars.
  masonry.traverse((o) => {
    o.userData.cameraBlocker = false;
  });
  batch(palace, 'kami-palace-masonry');
  batch(garden, 'kami-cypress-gardens');
  // LOD islands: real bowl, open white colonnade, gold dome and trees at each site.
  const islands = new THREE.Group();
  islands.name = 'kami-distant-islands';
  group.add(islands);
  for (const [x, y, zz, size] of [
    [-55, 4, -52, 0.7],
    [48, 0, -64, 0.85],
    [-83, -3, -31, 0.45],
    [77, -4, -24, 0.52],
    [-34, 13, -88, 0.5],
    [27, 9, -102, 0.46],
    [98, 4, -90, 0.7],
  ]) {
    const island = new THREE.Group();
    island.position.set(x, y, zz);
    island.scale.setScalar(size);
    islands.add(island);
    lathe(
      island,
      shade,
      [
        [0, -7],
        [0.7, -5.4],
        [2.8, -3],
        [6.4, -0.5],
        [6.5, 0],
      ],
      0,
      0,
      0,
      48,
    );
    cylinder(island, trim, 6.6, 0.2, 0, 0, 0, 6.6, 48);
    ring(island, gold, 6.4, 0.05, 0.15, 0, 0, 48);
    pavilion(island, 0, 0, 2.35, 3.6, 0.25, false);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      // Smaller remote trees keep a smooth silhouette without near-field twig geometry.
      lathe(
        island,
        leaves[1],
        [
          [0, 0.15],
          [0.4, 0.3],
          [0.4, 1.4],
          [0.2, 2.4],
          [0, 3.2],
        ],
        Math.sin(a) * 4.9,
        0,
        Math.cos(a) * 4.9,
        10,
      );
    }
  }
  batch(islands, 'kami-island-lod', false);
  // Volumetric cloud banks use instancing with a softly undulating surface,
  // several height bands and no billboards, external textures or sky planes.
  const cloudMaterial = mat(0xffffff);
  const cloudRamp = new THREE.DataTexture(
    new Uint8Array([172, 189, 207, 222, 235, 244, 250, 255]),
    8,
    1,
    THREE.RedFormat,
  );
  cloudRamp.needsUpdate = true;
  cloudRamp.magFilter = cloudRamp.minFilter = THREE.LinearFilter;
  cloudMaterial.gradientMap = cloudRamp;
  const cloudGeometry = new THREE.SphereGeometry(1, 20, 14);
  const positions = cloudGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      zz = positions.getZ(i);
    const swell = 1 + 0.045 * Math.sin(x * 9 + zz * 7) * Math.sin(y * 8);
    positions.setXYZ(i, x * swell, y * swell, zz * swell);
  }
  cloudGeometry.computeVertexNormals();
  const clouds = [],
    dummy = new THREE.Object3D();
  for (let layer = 0; layer < 3; layer++) {
    const count = layer === 0 ? 70 : 100,
      cloud = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, count * 5);
    cloud.name = 'kami-cloud-bank-' + layer;
    cloud.userData.cameraBlocker = false;
    const rand = (i) => (((Math.sin(i * 78.233 + layer * 37.719) * 43758.5453) % 1) + 1) % 1;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399,
        r = 30 + Math.sqrt(rand(i + 1)) * (layer === 0 ? 70 : 145);
      for (let j = 0; j < 5; j++) {
        dummy.position.set(
          Math.cos(a) * r + (j - 2) * 3,
          -18 - layer * 9 + rand(i + 11) * 3 + Math.sin(j * 2) * 1.2,
          Math.sin(a) * r + Math.cos(j * 2) * 3,
        );
        const size = 3.4 + rand(i + j + 40) * 3.6;
        dummy.scale.set(size * 1.4, size * 0.9, size * 1.1);
        dummy.rotation.y = a;
        dummy.updateMatrix();
        cloud.setMatrixAt(i * 5 + j, dummy.matrix);
        cloud.setColorAt(
          i * 5 + j,
          new THREE.Color().setRGB(0.89 + rand(i + j) * 0.1, 0.93 + rand(i + j) * 0.06, 1),
        );
      }
    }
    cloud.computeBoundingSphere();
    group.add(cloud);
    clouds.push(cloud);
  }
  const skyGeometry = new THREE.SphereGeometry(290, 32, 20);
  const skyColors = new Float32Array(skyGeometry.attributes.position.count * 3);
  skyGeometry.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(
    skyGeometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.name = 'kami-atmosphere';
  sky.userData.cameraBlocker = false;
  sky.renderOrder = -10;
  group.add(sky);
  const map = {
    group,
    bounds: { ...KAMI_LAYOUT.bounds },
    preview: { distance: 86, center: [0, 0, -3] },
    update(dt) {
      clouds.forEach((c, i) => {
        c.rotation.y += dt * (i % 2 ? -1 : 1) * 0.0009;
      });
    },
    applyLighting(preset) {
      const moon = preset === 'moon',
        warm = preset === 'sunset';
      const zenith = new THREE.Color(moon ? 0x09162f : warm ? 0x657eae : 0x3184e4);
      const horizon = new THREE.Color(moon ? 0x405777 : warm ? 0xf5cba4 : 0x87c4ff);
      const color = new THREE.Color();
      for (let i = 0; i < skyGeometry.attributes.position.count; i++) {
        const height = skyGeometry.attributes.position.getY(i) / 290;
        color.copy(horizon).lerp(zenith, Math.max(0, Math.min(1, height * 1.3 + 0.55)));
        skyGeometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
      }
      skyGeometry.attributes.color.needsUpdate = true;
      cloudMaterial.color.set(moon ? 0x7f9fc7 : warm ? 0xffd9b8 : 0xf9fdff);
      if (render) {
        render.scene.fog = new THREE.Fog(moon ? 0x263e64 : warm ? 0xe9c6a5 : 0xc2dfff, 85, 245);
        render.hemi.groundColor.set(moon ? 0x394b72 : warm ? 0x93808b : 0x899fbb);
      }
    },
  };
  // A render hook is not serializable battle state; keep recovery snapshots data-only.
  Object.defineProperty(map, 'applyLighting', { enumerable: false });
  world.enrichDestruction(map, 'kami');
  for (const tile of tiles)
    map.destructibles.push({ mesh: tile, tile: true, kind: 'stone', hp: 1, broken: false });
  // Building bounds are collected by the shared destruction interface after transforms.
  map.applyLighting(lightPreset);
  group.userData.kami = {
    radius: 28,
    tiles: tiles.length,
    crowns: ornaments.length,
    cloudInstances: clouds.reduce((n, c) => n + c.count, 0),
    islands: 7,
  };
  return map;
}

export function register({ characters, match, render, world }) {
  world.buildKamiStage = () => {
    world.daylight();
    return createKamiStage({ characters, world, render, lightPreset: match.game.lightPreset });
  };
  return function initialize() {};
}
