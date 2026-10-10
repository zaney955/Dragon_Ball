import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export const BUDOKAI_LAYOUT = Object.freeze({
  bounds: { x: 13.5, z: 6 },
  arena: { x: 14.5, z: 7.5 },
  hallZ: -24,
  gateZ: -14.5,
  standsX: 21.5,
});
const random = (i) => (((Math.sin(i * 78.233 + 13.719) * 43758.5453) % 1) + 1) % 1;

// Indexed material buckets retain the small stone reliefs without one draw per carving.
// Breakable slabs and ornaments, moving cloth and instanced clouds stay outside these buckets.
function batch(root, name, shadows = true, blocker = true, instances = false) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map(),
    originals = new Set(),
    repeats = new Map(),
    meshes = [],
    materials = new Map();
  const colorable = (m) => m.isMeshToonMaterial && !m.map && !m.vertexColors && !m.transparent;
  const style = (m) => [m.type, m.side, m.gradientMap?.uuid, m.depthWrite].join(':');
  function pooled(m, vertexColors) {
    if (!colorable(m)) return m;
    const key = style(m) + ':' + vertexColors;
    if (!materials.has(key)) {
      const shared = m.clone();
      shared.color.set(0xffffff);
      shared.vertexColors = vertexColors;
      materials.set(key, shared);
    }
    return materials.get(key);
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const key =
      o.geometry.uuid + ':' + (colorable(o.material) ? style(o.material) : o.material.uuid);
    if (!repeats.has(key)) repeats.set(key, []);
    repeats.get(key).push(o);
    originals.add(o.geometry);
  });
  const output = [],
    skipped = new Set();
  if (instances)
    for (const pieces of repeats.values()) {
      if (pieces.length < 8) continue;
      const material = pooled(pieces[0].material, false);
      const o = new THREE.InstancedMesh(pieces[0].geometry.clone(), material, pieces.length);
      for (let i = 0; i < pieces.length; i++) {
        o.setMatrixAt(i, inverse.clone().multiply(pieces[i].matrixWorld));
        if (material !== pieces[i].material) o.setColorAt(i, pieces[i].material.color);
        skipped.add(pieces[i]);
      }
      o.computeBoundingSphere();
      output.push(o);
    }
  for (const o of meshes) {
    if (skipped.has(o)) continue;
    const matrix = inverse.clone().multiply(o.matrixWorld),
      geo = o.geometry.clone().applyMatrix4(matrix),
      material = pooled(o.material, true);
    if (!geo.index)
      geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, i) => i));
    if (matrix.determinant() < 0) {
      const indices = geo.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        const first = indices[i];
        indices[i] = indices[i + 1];
        indices[i + 1] = first;
      }
    }
    if (material !== o.material) {
      const colors = new Float32Array(geo.attributes.position.count * 3),
        c = o.material.color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.deleteAttribute('uv');
    }
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(geo);
  }
  root.clear();
  for (const [material, pieces] of buckets) {
    const geometry = mergeGeometries(pieces);
    geometry.computeBoundingSphere();
    output.push(new THREE.Mesh(geometry, material));
    for (const geo of pieces) geo.dispose();
  }
  for (const o of output) {
    o.name = name;
    o.castShadow = o.receiveShadow = shadows;
    o.userData.cameraBlocker = blocker;
    root.add(o);
  }
  for (const geo of originals) geo.dispose();
}

// A bounded CPU template avoids reconstructing thousands of details during the online handshake.
// Static arrays can be reused after GPU disposal; animated buffers and materials remain per match.
const templates = new WeakMap();
function cloneStage(source) {
  const group = source.clone(true),
    materials = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!materials.has(o.material)) materials.set(o.material, o.material.clone());
    o.material = materials.get(o.material);
    if (o.name === 'budokai-sky' || o.name === 'budokai-tournament-banner')
      o.geometry = o.geometry.clone();
  });
  return group;
}

export function createBudokaiStage({ characters, world, render, lightPreset = 'day' }) {
  const template = templates.get(characters);
  if (template) return finishStage(cloneStage(template), world, render, lightPreset);
  const group = new THREE.Group(),
    arena = new THREE.Group(),
    hall = new THREE.Group(),
    gate = new THREE.Group(),
    gardens = new THREE.Group(),
    stands = new THREE.Group(),
    distant = new THREE.Group(),
    atmosphere = new THREE.Group(),
    ornaments = new THREE.Group();
  group.add(arena, hall, gate, gardens, stands, distant, atmosphere, ornaments);
  arena.name = 'budokai-arena';
  hall.name = 'budokai-hall';
  gate.name = 'budokai-gate';
  gardens.name = 'budokai-gardens';
  stands.name = 'budokai-grandstands';
  distant.name = 'budokai-horizon';
  atmosphere.name = 'stage-atmosphere-budokai';
  ornaments.name = 'building-budokai-ornaments';
  ornaments.userData.building = 'budokai-hall';
  const M = (color, opts) => characters.M(color, opts);
  const stone = M(0xe7dbc1),
    ivory = M(0xf7ebd4),
    grey = M(0xa7a7a1),
    mortar = M(0xa9a08c),
    wall = M(0xe7c482),
    red = M(0xae4935),
    redLight = M(0xd36947),
    redDark = M(0x74372f),
    wood = M(0x6e4931),
    woodLight = M(0x986540),
    gold = M(0xdca939),
    goldLight = M(0xf4c862),
    goldDark = M(0x9e702d),
    charcoal = M(0x303c3d),
    black = M(0x202c30),
    grass = M(0x90b864);
  const foliage = [0x28614d, 0x3f7955, 0x578c57, 0x74a566].map((c) => M(c));
  const stoneTexture = world.surfaceTexture('stone');
  stoneTexture.repeat.set(2, 2);
  stone.map = stoneTexture;
  const paving = [0xe4d7bd, 0xe9dec8, 0xdfd4bd, 0xeee3cc, 0xe7dbc4].map((c) => {
    const m = M(c);
    m.map = stoneTexture;
    return m;
  });
  grass.map = world.surfaceTexture('grass');
  const mesh = (g, geometry, m, x = 0, y = 0, z = 0, scale) =>
    characters.meshTo(g, geometry, m, x, y, z, scale);
  const box = (g, m, x, y, z, w, h, d) => characters.box(g, m, x, y, z, w, h, d);
  const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
  const ball = (g, m, x, y, z, r, scale = [1, 1, 1]) =>
    mesh(
      g,
      sphereGeometry,
      m,
      x,
      y,
      z,
      scale.map((s) => s * r),
    );
  const tube = (g, m, points, r = 0.035, segments = 24) =>
    mesh(
      g,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        segments,
        r,
        6,
        false,
      ),
      m,
    );
  const cylinder = (g, m, x, y, z, r, h, rb = r, n = 32) =>
    mesh(g, new THREE.CylinderGeometry(r, rb, h, n), m, x, y, z);
  const lathe = (g, m, profile, x = 0, y = 0, z = 0, n = 48) =>
    mesh(
      g,
      new THREE.LatheGeometry(
        profile.map((p) => new THREE.Vector2(...p)),
        n,
      ),
      m,
      x,
      y,
      z,
    );
  const extrude = (g, m, shape, depth = 0.12, bevel = 0.025) =>
    mesh(
      g,
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: bevel > 0,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 2,
        curveSegments: 18,
      }),
      m,
    );
  function taper(g, m, points, r) {
    const geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      32,
      r,
      8,
      false,
    );
    const p = geometry.attributes.position;
    const curve = geometry.parameters.path;
    for (let i = 0; i <= 32; i++) {
      const center = curve.getPointAt(i / 32),
        radius = Math.pow(1 - i / 32, 0.65) * 0.94 + 0.025;
      for (let j = 0; j <= 8; j++) {
        const n = i * 9 + j;
        p.setXYZ(
          n,
          center.x + (p.getX(n) - center.x) * radius,
          center.y + (p.getY(n) - center.y) * radius,
          center.z + (p.getZ(n) - center.z) * radius,
        );
      }
    }
    geometry.computeVertexNormals();
    return mesh(g, geometry, m);
  }
  function arch(g, w, h, t, m, depth) {
    const s = new THREE.Shape(),
      r = w / 2,
      y = h - r;
    s.moveTo(-r - t, 0);
    s.lineTo(-r - t, y);
    s.absarc(0, y, r + t, Math.PI, 0, true);
    s.lineTo(r + t, 0);
    s.lineTo(r, 0);
    s.lineTo(r, y);
    s.absarc(0, y, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    s.closePath();
    return extrude(g, m, s, depth, 0.025);
  }
  function rosette(g, x, y, z, r, m = ivory) {
    const s = new THREE.Shape();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU,
        rr = r * (0.75 + 0.25 * Math.cos(a * 8));
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const o = extrude(g, m, s, 0.055, 0.015);
    o.position.set(x, y, z);
    ball(g, goldDark, x, y, z + 0.07, r * 0.18, [1, 1, 0.4]);
  }
  function scroll(g, x, y, z, s, m = ivory, mirror = 1) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 3,
        r = (1 - i / 24) * 0.55 + 0.06;
      points.push([x + mirror * Math.cos(a) * r * s, y + Math.sin(a) * r * s, z]);
    }
    taper(g, m, points, 0.07 * s);
    taper(
      g,
      m,
      [
        [x + mirror * 0.55 * s, y, z],
        [x + mirror * 0.9 * s, y + 0.5 * s, z],
        [x + mirror * 0.72 * s, y + 1.1 * s, z],
        [x + mirror * 0.25 * s, y + 1.4 * s, z],
      ],
      0.1 * s,
    );
  }
  // Sculpted guardian: curved horns, inset eyes and mouth, brows, teeth and scroll ears.
  // The same small relief is used in stone on the gate and in gilded form on the roof.
  function guardian(parent, x, y, z, size, m = ivory, trim = grey) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(size);
    parent.add(g);
    ball(g, m, 0, 0.08, 0, 0.65, [1, 1.08, 0.4]);
    ball(g, trim, 0, -0.4, 0.16, 0.43, [1.25, 0.67, 0.56]);
    ball(g, black, 0, -0.27, 0.38, 0.37, [1.15, 0.62, 0.25]);
    for (const side of [-1, 1]) {
      ball(g, m, side * 0.44, -0.15, 0.23, 0.24, [0.8, 1.3, 0.65]);
      ball(g, ivory, side * 0.25, 0.24, 0.26, 0.19, [1.1, 0.56, 0.6]);
      ball(g, black, side * 0.24, 0.23, 0.36, 0.075, [0.72, 1, 0.4]);
      taper(
        g,
        m,
        [
          [side * 0.05, 0.31, 0.36],
          [side * 0.25, 0.44, 0.39],
          [side * 0.5, 0.42, 0.24],
          [side * 0.61, 0.57, 0.05],
        ],
        0.16,
      );
      taper(
        g,
        m,
        [
          [side * 0.48, 0.47, -0.02],
          [side * 0.8, 0.73, -0.1],
          [side * 1.03, 1.12, -0.14],
          [side * 1.07, 1.48, -0.12],
        ],
        0.19,
      );
      scroll(g, side * 0.69, 0.04, 0.06, 0.55, m, side);
      taper(
        g,
        m,
        [
          [side * 0.13, -0.13, 0.46],
          [side * 0.27, -0.18, 0.45],
          [side * 0.36, -0.34, 0.43],
        ],
        0.08,
      );
      taper(
        g,
        trim,
        [
          [side * 0.35, -0.49, 0.34],
          [side * 0.57, -0.42, 0.21],
          [side * 0.67, -0.16, 0.1],
        ],
        0.07,
      );
    }
    ball(g, m, 0, 0.03, 0.34, 0.19, [1, 0.7, 0.75]);
    for (const side of [-1, 1]) ball(g, black, side * 0.075, -0.025, 0.46, 0.047, [1, 0.6, 0.35]);
    for (let i = 0; i < 6; i++) {
      const x = -0.27 + i * 0.108;
      cylinder(g, ivory, x, -0.19, 0.44, 0.045, 0.12, 0.07, 12);
      cylinder(g, ivory, x, -0.4, 0.435, 0.058, 0.095, 0.025, 12);
    }
    taper(
      g,
      m,
      [
        [-0.45, -0.13, 0.4],
        [-0.2, -0.08, 0.48],
        [0, -0.13, 0.49],
        [0.2, -0.08, 0.48],
        [0.45, -0.13, 0.4],
      ],
      0.055,
    );
    taper(
      g,
      m,
      [
        [-0.43, -0.41, 0.39],
        [0, -0.53, 0.47],
        [0.43, -0.41, 0.39],
      ],
      0.065,
    );
    rosette(g, 0, 0.66, 0.23, 0.19, trim);
    return g;
  }
  function roof(parent, w, d, y, h) {
    const lower = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ],
      upper = [
        [-w * 0.32, -d * 0.1],
        [w * 0.32, -d * 0.1],
        [w * 0.32, d * 0.1],
        [-w * 0.32, d * 0.1],
      ];
    const at = (face, u, v) => {
      const a = lower[face],
        b = lower[(face + 1) % 4],
        c = upper[face],
        e = upper[(face + 1) % 4];
      return new THREE.Vector3(
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(a[0], b[0], u),
          THREE.MathUtils.lerp(c[0], e[0], u),
          v,
        ),
        y +
          h * Math.pow(v, 0.88) +
          0.16 * Math.pow(1 - v, 8) +
          0.2 * Math.pow(Math.abs(u - 0.5) * 2, 8) * (1 - v),
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(a[1], b[1], u),
          THREE.MathUtils.lerp(c[1], e[1], u),
          v,
        ),
      );
    };
    for (let face = 0; face < 4; face++) {
      const nx = face % 2 ? 32 : 96,
        ny = 16,
        positions = [],
        uv = [],
        indices = [];
      for (let j = 0; j <= ny; j++)
        for (let i = 0; i <= nx; i++) {
          positions.push(...at(face, i / nx, j / ny).toArray());
          uv.push(i / nx, j / ny);
          if (i < nx && j < ny) {
            const n = j * (nx + 1) + i;
            indices.push(n, n + 1, n + nx + 1, n + 1, n + nx + 2, n + nx + 1);
          }
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      // Surface winding faces inward on this perimeter; invert once for the exposed golden slope.
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i];
        idx[i] = idx[i + 1];
        idx[i + 1] = t;
      }
      geo.computeVertexNormals();
      mesh(parent, geo, gold);
      const underside = geo.clone();
      underside.translate(0, -0.14, 0);
      mesh(parent, underside, goldDark);
      const strips = face % 2 ? 38 : 132;
      for (let i = 0; i <= strips; i++) {
        const points = [];
        for (let j = 0; j <= 12; j++) {
          const p = at(face, i / strips, j / 12);
          p.y += 0.025;
          points.push(p.toArray());
        }
        tube(
          parent,
          i % 4 === 0 ? goldDark : i % 3 ? goldLight : gold,
          points,
          0.016 + (i % 4 === 0 ? 0.006 : 0),
          12,
        );
      }
      for (const v of [0, 0.02, 0.98, 1]) {
        const points = [];
        for (let i = 0; i <= 32; i++) {
          const p = at(face, i / 32, v);
          p.y += 0.04;
          points.push(p.toArray());
        }
        tube(parent, v === 0 ? wood : goldLight, points, v === 0 ? 0.095 : 0.028, 32);
      }
      const corner = [];
      for (let i = 0; i <= 20; i++) {
        const p = at(face, 0, i / 20);
        p.y += 0.09;
        corner.push(p.toArray());
      }
      tube(parent, goldLight, corner, 0.09, 20);
    }
    box(parent, goldDark, 0, y + h - 0.035, 0, w * 0.64, 0.12, d * 0.2);
    box(parent, goldLight, 0, y + h + 0.07, 0, w * 0.66, 0.14, d * 0.22);
    box(parent, wood, 0, y - 0.03, 0, w - 0.2, 0.28, d - 0.2);
    for (const side of [-1, 1])
      for (let i = 0; i < Math.floor(w / 1.1); i++) {
        const x = -w / 2 + 0.65 + i * 1.1;
        box(parent, redDark, x, y - 0.3, side * (d / 2 - 0.35), 0.16, 0.46, 0.42);
        tube(
          parent,
          woodLight,
          [
            [x, y - 0.48, side * (d / 2 - 0.85)],
            [x, y - 0.25, side * (d / 2 - 0.55)],
            [x, y - 0.16, side * (d / 2 - 0.15)],
          ],
          0.07,
          8,
        );
      }
  }
  function finial(parent, x, y, z, s = 1) {
    lathe(
      parent,
      goldLight,
      [
        [0, 0],
        [0.35, 0],
        [0.35, 0.12],
        [0.24, 0.18],
        [0.22, 0.38],
        [0.13, 0.54],
        [0.18, 0.65],
        [0.04, 1.15],
        [0, 1.4],
      ],
      x,
      y,
      z,
    );
    const o = parent.children[parent.children.length - 1];
    o.scale.setScalar(s);
  }
  function breakable(g, id, hp = 12) {
    const debrisColor = g.children.find((o) => o.isMesh)?.material.color.getHex() ?? 0xdca939;
    batch(g, id, true, true);
    for (const o of g.children)
      o.userData.buildingPart = {
        building: 'budokai-hall',
        column: id,
        kind: 'roof',
        hp,
        debrisColor,
        debrisKind: 'stone',
      };
  }
  // Ground sits below the raised competition platform; no decorative line crosses its top.
  box(arena, grass, 0, -1.5, -20, 320, 0.3, 300);
  box(arena, mortar, 0, -0.72, 0, 29, 1.4, 15);
  box(arena, grey, 0, -1.26, 0, 29.8, 0.25, 15.8);
  box(arena, stone, 0, -1.4, 0, 30.4, 0.14, 16.4);
  for (const side of [-1, 1]) {
    box(arena, ivory, side * 14.4, -0.13, 0, 0.2, 0.25, 15);
    box(arena, ivory, 0, -0.13, side * 7.4, 28.8, 0.25, 0.2);
    for (let i = 0; i < 28; i++)
      box(arena, stone, -13.5 + i, -0.64, side * 7.505, 0.96, 1.0, 0.055);
    for (let i = 0; i < 14; i++)
      box(arena, stone, side * 14.505, -0.64, -6.5 + i, 0.055, 1.0, 0.96);
  }
  for (let j = 0; j < 4; j++) {
    box(arena, stone, 0, -0.21 - j * 0.3, 7.7 + j * 0.48, 5.4, 0.27, 0.56);
    box(arena, ivory, 0, -0.065 - j * 0.3, 7.95 + j * 0.48, 5.45, 0.055, 0.08);
  }
  // Small branching cracks belong to the vertical base, not the readable fighting surface.
  for (let i = 0; i < 19; i++) {
    const x = -13.8 + i * 1.48,
      z = i % 2 ? 7.54 : -7.54,
      y = -0.15 - random(i) * 0.2;
    tube(
      arena,
      grey,
      [
        [x, y, z],
        [x + 0.09, y - 0.23, z],
        [x - 0.07, y - 0.52, z],
        [x + 0.04, -1.14, z],
      ],
      0.012,
      9,
    );
    tube(
      arena,
      grey,
      [
        [x - 0.07, y - 0.52, z],
        [x - 0.3, y - 0.6, z],
        [x - 0.35, y - 0.73, z],
      ],
      0.009,
      5,
    );
  }
  const tileShape = new THREE.Shape();
  tileShape.moveTo(-0.979, -0.979);
  tileShape.lineTo(0.979, -0.979);
  tileShape.lineTo(0.979, 0.979);
  tileShape.lineTo(-0.979, 0.979);
  tileShape.closePath();
  const tileGeometry = new THREE.ExtrudeGeometry(tileShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSize: 0.011,
    bevelThickness: 0.006,
    bevelSegments: 1,
  });
  tileGeometry.rotateX(-Math.PI / 2);
  const tiles = [];
  for (let x = -13; x <= 13; x += 2)
    for (let z = -6; z <= 6; z += 2) {
      const o = mesh(group, tileGeometry, paving[(x * 7 + z * 3 + 199) % 5], x, -0.066, z);
      o.name = 'breakable-arena-slab';
      o.userData.cameraBlocker = false;
      tiles.push(o);
    }
  for (let x = -2; x <= 2; x += 1.0)
    for (let i = 0; i < 6; i++)
      box(arena, paving[(i + x + 7) % 5], x, -1.32, -8.25 - i * 1.05, 0.98, 0.06, 1.03);
  for (const side of [-1, 1]) {
    const desk = new THREE.Group();
    desk.position.set(side * 13.3, -1.3, -11.3);
    gardens.add(desk);
    box(desk, wood, 0, 0.48, 0, 1.7, 0.96, 1.0);
    box(desk, woodLight, 0, 1.0, 0, 1.86, 0.12, 1.13);
    for (const x of [-0.75, 0.75]) box(desk, goldDark, x, 0.51, 0.51, 0.045, 0.86, 0.04);
    for (const y of [0.13, 0.85]) box(desk, goldDark, 0, y, 0.51, 1.5, 0.045, 0.04);
    cylinder(desk, goldLight, 0, 1.52, -0.12, 0.45, 0.09, 0.45, 32).rotation.x = Math.PI / 2;
    const badge = M(0xffffff);
    badge.map = world.makeTextTexture('武', {
      w: 256,
      h: 256,
      fontSize: 174,
      bg: '#f7ebd4',
      fg: '#a23d32',
      border: '#f7ebd4',
    });
    mesh(desk, new THREE.CircleGeometry(0.4, 32), badge, 0, 1.52, -0.06);
  }
  // Main hall: structural red timber, pale plaster, recessed lattice windows and double hip roofs.
  hall.position.z = BUDOKAI_LAYOUT.hallZ;
  box(hall, stone, 0, -1.04, 0, 30.8, 0.65, 10.8);
  box(hall, wall, 0, 1.83, 0, 29, 5.3, 9);
  for (const y of [-0.55, 3.9, 4.6]) box(hall, ivory, 0, y, 4.58, 29.3, 0.24, 0.23);
  for (const x of [-14, -10.5, -7, -3.5, 3.5, 7, 10.5, 14]) {
    box(hall, redDark, x, 1.85, 4.63, 0.44, 5.7, 0.55);
    box(hall, redLight, x, 1.85, 4.94, 0.15, 5.55, 0.04);
    box(hall, stone, x, -0.58, 4.7, 0.66, 0.5, 0.72);
    for (const y of [3.65, 4.2]) box(hall, goldDark, x, y, 4.97, 0.55, 0.1, 0.12);
  }
  box(hall, wood, 0, 3.82, 4.78, 29.4, 0.26, 0.35);
  box(hall, red, 0, 4.45, 4.75, 29.6, 0.32, 0.36);
  for (const x of [-12.1, -8.6, -5.1, 5.1, 8.6, 12.1]) {
    box(hall, wood, x, 1.68, 4.58, 2.75, 2.25, 0.17);
    box(hall, charcoal, x, 1.68, 4.69, 2.47, 1.94, 0.06);
    for (let i = 0; i < 7; i++)
      box(hall, woodLight, x - 1.18 + i * 0.39, 1.68, 4.75, 0.06, 1.94, 0.08);
    for (const y of [0.96, 1.44, 1.92, 2.4]) box(hall, ivory, x, y, 4.79, 2.47, 0.055, 0.07);
    box(hall, ivory, x, 0.55, 4.78, 2.94, 0.22, 0.32);
  }
  box(hall, black, 0, 1.1, 4.63, 4.9, 4.2, 0.1);
  arch(hall, 4.5, 4.4, 0.25, ivory, 0.3).position.set(0, -1, 4.73);
  for (let i = 0; i < 8; i++) box(hall, woodLight, -1.85 + i * 0.53, 0.65, 4.71, 0.045, 3.1, 0.08);
  roof(hall, 35, 13, 4.9, 3.75);
  box(hall, redDark, 0, 9.4, 0, 13, 1.65, 6.4);
  for (const y of [8.9, 9.65]) box(hall, ivory, 0, y, 3.26, 12.4, 0.28, 0.19);
  for (const x of [-6.3, 6.3]) box(hall, red, x, 9.5, 3.4, 0.43, 2.1, 0.4);
  roof(hall, 15.9, 8.1, 10.2, 2.45);
  const crest = new THREE.Group();
  crest.position.set(0, 12.95, -24);
  ornaments.add(crest);
  guardian(crest, 0, 0.75, 0, 1.22, goldLight, goldDark);
  for (const side of [-1, 1]) scroll(crest, side * 1.3, 0.1, -0.04, 1.3, gold, side);
  finial(crest, 0, 2.15, -0.12, 1.0);
  breakable(crest, 'budokai-roof-guardian', 18);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 22, -0.05, 1.5);
    hall.add(wing);
    box(wing, wall, 0, 1.1, 0, 10, 3.3, 6.5);
    roof(wing, 11.7, 8, 2.9, 2.1);
    for (const x of [-3, 0, 3]) {
      box(wing, wood, x, 1.3, 3.3, 2.4, 1.6, 0.17);
      box(wing, charcoal, x, 1.3, 3.4, 2.1, 1.3, 0.04);
    }
    const g = new THREE.Group();
    g.position.set(side * 11.1, 8.7, -24);
    ornaments.add(g);
    finial(g, 0, 0, 0, 0.8);
    scroll(g, side * 0.4, 0.05, 0.1, 0.65, goldLight, side);
    breakable(g, 'budokai-ridge-' + side);
  }
  // The sign is a thick carved board with three stepped red mouldings and solid corner fittings.
  const sign = new THREE.Group();
  sign.position.set(0, 7.5, -16.85);
  hall.add(sign);
  sign.position.z -= hall.position.z;
  box(sign, wood, 0, 0, 0, 15, 3.14, 0.58);
  box(sign, redDark, 0, 0, 0.31, 14.88, 3.08, 0.18);
  box(sign, red, 0, 0, 0.43, 14.55, 2.8, 0.15);
  box(sign, goldDark, 0, 0, 0.515, 14.13, 2.4, 0.07);
  box(sign, ivory, 0, 0, 0.565, 13.94, 2.22, 0.055);
  for (const side of [-1, 1])
    for (const y of [-1.22, 1.22]) {
      box(sign, redLight, side * 7.12, y, 0.53, 0.32, 0.2, 0.14);
      cylinder(sign, goldLight, side * 7.12, y, 0.63, 0.055, 0.045, 0.055, 12).rotation.x =
        Math.PI / 2;
    }
  const signTexture = world.makeTextTexture('天下一武道会', {
    w: 2048,
    h: 384,
    fontSize: 248,
    bg: '#f7eacf',
    fg: '#20252a',
    border: '#f7eacf',
  });
  const ink = signTexture.image?.getContext?.('2d');
  if (ink) {
    ink.clearRect(0, 0, 2048, 384);
    ink.fillStyle = '#f7eacf';
    ink.fillRect(0, 0, 2048, 384);
    ink.font = '900 296px "Songti SC", "Noto Serif CJK SC", serif';
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.shadowBlur = 0;
    ink.strokeStyle = '#b84637';
    ink.lineWidth = 13;
    ink.lineJoin = 'round';
    ink.strokeText('天下一武道会', 1024, 205);
    ink.fillStyle = '#182329';
    ink.fillText('天下一武道会', 1024, 205);
    signTexture.needsUpdate = true;
  }
  const labelMaterial = M(0xffffff);
  labelMaterial.map = signTexture;
  mesh(sign, new THREE.PlaneGeometry(13.66, 2.0), labelMaterial, 0, 0, 0.603);
  for (const x of [-4.6, 4.6]) box(sign, stone, x, -1.74, -0.25, 0.5, 0.55, 0.8);
  // Entrance court and ornamental gate. Its closest solid geometry stays behind z=-13.9.
  gate.position.set(0, -1.3, BUDOKAI_LAYOUT.gateZ);
  for (let j = 0; j < 6; j++) box(gate, stone, 0, 0.12 + j * 0.17, -j * 0.4, 4.8, 0.2, 0.48);
  box(gate, black, 0, 2.9, -2, 4.6, 3.6, 0.13);
  arch(gate, 4.25, 5.1, 0.3, ivory, 1.15).position.set(0, 0, -1.3);
  arch(gate, 4.13, 5.02, 0.065, goldDark, 0.05).position.set(0, 0, -0.1);
  for (const side of [-1, 1]) {
    // Terraced stone pylons with raised red panels and a curled, tapering outer silhouette.
    const s = new THREE.Shape();
    s.moveTo(2.55, 0);
    s.lineTo(6.1, 0);
    s.lineTo(6.1, 2.0);
    s.lineTo(5.1, 2.0);
    s.lineTo(5.1, 3.2);
    s.lineTo(4.4, 3.2);
    s.lineTo(4.4, 4.5);
    s.lineTo(3.75, 4.5);
    s.lineTo(3.75, 6.15);
    s.bezierCurveTo(3.64, 7.0, 3.34, 7.7, 3.05, 8.25);
    s.bezierCurveTo(2.98, 7.88, 2.81, 7.52, 2.9, 7.1);
    s.lineTo(2.55, 0);
    const p = extrude(gate, ivory, s, 0.82, 0.055);
    p.scale.x = side;
    p.position.z = -0.93;
    for (const [x, y, w, h] of [
      [3.24, 1.0, 1.0, 1.45],
      [3.24, 3.0, 1.0, 1.35],
      [3.24, 5.0, 1.0, 1.35],
      [4.38, 1.08, 1.0, 1.6],
      [4.38, 2.67, 0.92, 0.7],
      [5.46, 1.0, 0.72, 1.4],
    ]) {
      box(gate, mortar, side * x, y, -0.045, w + 0.16, h + 0.14, 0.09);
      box(gate, redLight, side * x, y, 0.01, w, h, 0.11);
      rosette(gate, side * x, y, 0.08, Math.min(w, h) * 0.3, redDark);
      for (const dy of [-h / 2, h / 2])
        box(gate, stone, side * x, y + dy, 0.13, w + 0.18, 0.08, 0.1);
    }
    guardian(gate, side * 3.25, 3.1, 0.1, 0.64, grey, ivory);
    for (const y of [2.05, 4.1, 6.0]) {
      rosette(gate, side * 3.18, y, 0.08, 0.18, ivory);
      for (const dx of [-0.55, 0.55]) scroll(gate, side * (3.18 + dx), y, 0.03, 0.25, ivory, side);
    }
    taper(
      gate,
      ivory,
      [
        [side * 3.42, 6.17, 0.03],
        [side * 3.25, 7.22, 0.03],
        [side * 3.03, 8.15, 0.03],
      ],
      0.065,
    );
    for (let j = 0; j < 7; j++)
      scroll(gate, side * (5.85 - j * 0.38), 1.4 + j * 0.69, -0.05, 0.45, ivory, side);
    tube(
      gate,
      goldDark,
      [
        [side * 2.78, 0.1, 0.19],
        [side * 2.78, 3.3, 0.19],
        [side * 2.99, 6.8, 0.19],
        [side * 3.32, 7.75, 0.19],
      ],
      0.045,
      28,
    );
    box(gate, ivory, side * 9, 1.56, -1.0, 5.9, 3.1, 0.8);
    box(gate, redDark, side * 9, 1.51, -0.54, 5.35, 2.55, 0.11);
    box(gate, red, side * 9, 1.51, -0.46, 5.12, 2.35, 0.075);
    // Staggered brick courses give the red relief panels a real surface depth.
    for (let row = 0; row < 7; row++)
      for (let i = 0; i < 10; i++) {
        const x = side * 9 - 2.35 + i * 0.49 + (row % 2) * 0.21;
        if (x < side * 9 + 2.51)
          box(gate, row % 3 ? redLight : red, x, 0.46 + row * 0.3, -0.39, 0.46, 0.27, 0.06);
      }
    guardian(gate, side * 9, 1.62, -0.18, 1.38, grey, ivory);
    for (const x of [side * 6.35, side * 12.15]) {
      box(gate, stone, x, 1.65, -0.92, 0.62, 3.3, 1.16);
      box(gate, ivory, x, 3.37, -0.92, 0.9, 0.17, 1.4);
      finial(gate, x, 3.48, -0.92, 0.65);
    }
    const o = new THREE.Group();
    o.position.set(side * 12.15, 2.2, -15.4);
    ornaments.add(o);
    box(o, ivory, 0, 0, 0, 0.74, 0.36, 0.74);
    rosette(o, 0, 0, 0.4, 0.19, goldDark);
    breakable(o, 'budokai-gate-cap-' + side);
  }
  // Physically pleated entrance curtain: no flat picture of architecture or spectators.
  const curtainGeometry = new THREE.PlaneGeometry(4.04, 2.44, 64, 12),
    cp = curtainGeometry.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      y = cp.getY(i);
    cp.setZ(i, 0.09 * Math.cos(x * 14));
    if (y < -0.95) cp.setY(i, y + 0.06 * Math.cos(x * 14));
  }
  curtainGeometry.computeVertexNormals();
  const cloth = M(0xfff4df, { side: THREE.DoubleSide });
  const curtain = mesh(atmosphere, curtainGeometry, cloth, 0, 2.34, -14.65);
  curtain.name = 'budokai-entrance-curtain';
  curtain.userData.cameraBlocker = false;
  const sealTexture = world.makeTextTexture('武', {
      w: 512,
      h: 512,
      fontSize: 330,
      bg: '#fff4df',
      fg: '#a32e31',
      border: '#fff4df',
    }),
    seal = M(0xffffff);
  seal.map = sealTexture;
  const sealMesh = mesh(atmosphere, new THREE.PlaneGeometry(1.45, 1.45), seal, 0, 2.32, -14.5);
  sealMesh.name = 'budokai-entrance-seal';
  tube(
    gate,
    red,
    Array.from({ length: 65 }, (_, i) => [
      Math.cos((i / 64) * TAU) * 0.81,
      3.62 + Math.sin((i / 64) * TAU) * 0.81,
      0.1,
    ]),
    0.035,
    64,
  );
  // Perimeter walls and front-row balustrades, placed beyond the shoulder-camera apron.
  for (const side of [-1, 1]) {
    box(gardens, wall, side * 30, 1.0, -12, 1.0, 4.5, 36);
    box(gardens, ivory, side * 30, 3.32, -12, 1.4, 0.2, 36.2);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      g.position.set(side * 19.8, -1.3, -11.5 + i * 2.8);
      g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      stands.add(g);
      box(g, stone, 0, 0.83, 0, 2.75, 1.66, 0.3);
      box(g, redDark, 0, 0.83, 0.19, 2.48, 1.37, 0.05);
      box(g, redLight, 0, 0.83, 0.23, 2.32, 1.21, 0.05);
      rosette(g, 0, 0.83, 0.29, 0.42, red);
      for (const x of [-1.33, 1.33]) box(g, ivory, x, 0.85, 0.03, 0.18, 1.85, 0.44);
      box(g, woodLight, 0, 1.73, 0.03, 2.84, 0.16, 0.5);
    }
    for (let row = 0; row < 4; row++) {
      const x = side * (21.25 + row * 1.55),
        y = -1.06 + row * 0.56;
      box(stands, stone, x, y - 0.18, 0.7, 1.55, 0.36, 26);
      box(stands, woodLight, x, y + 0.24, 0.7, 0.55, 0.12, 25.8);
      box(stands, redDark, x + side * 0.5, y + 0.35, 0.7, 0.13, 0.66, 25.8);
    }
  }
  const shirts = [
      0x546f97, 0xb35b46, 0xe0b14f, 0x4d8f84, 0xa185ab, 0xebdfc4, 0x887958, 0x4c555c,
    ].map((c) => M(c)),
    skins = [0xe4b992, 0xcb936d, 0xf1cbb0].map((c) => M(c)),
    hair = [M(0x313431), M(0x695344), M(0xb99048)];
  const torsoGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.52, 12),
    headGeo = new THREE.SphereGeometry(0.19, 16, 12),
    hairGeo = new THREE.SphereGeometry(0.196, 16, 10, 0, TAU, 0, Math.PI * 0.58);
  let spectators = 0;
  for (const side of [-1, 1])
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 24; i++) {
        const n = i + row * 24 + (side > 0 ? 96 : 0),
          g = new THREE.Group();
        g.position.set(side * (21.2 + row * 1.55), -0.8 + row * 0.56, -11.2 + i * 1.04);
        g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        stands.add(g);
        const shirt = shirts[n % shirts.length],
          skin = skins[n % 3];
        mesh(g, torsoGeo, shirt, 0, 0.65, 0);
        mesh(g, headGeo, skin, 0, 1.1, 0, [0.95, 1.1, 0.95]);
        mesh(g, hairGeo, hair[n % 3], 0, 1.11, -0.015);
        for (const s of [-1, 1]) {
          tube(
            g,
            charcoal,
            [
              [s * 0.1, 0.42, 0],
              [s * 0.12, 0.28, 0.28],
              [s * 0.12, 0.04, 0.32],
            ],
            0.074,
            6,
          );
          const raised = n % 7 === 0;
          tube(
            g,
            shirt,
            [
              [s * 0.17, 0.87, 0],
              [s * 0.31, raised ? 1.04 : 0.6, 0.03],
              [s * 0.33, raised ? 1.33 : 0.47, 0.2],
            ],
            0.065,
            6,
          );
          ball(g, skin, s * 0.33, raised ? 1.35 : 0.47, 0.2, 0.069);
        }
        if (n % 5 === 0) {
          cylinder(g, ivory, 0, 1.27, 0, 0.3, 0.05, 0.3, 20);
          ball(g, ivory, 0, 1.31, 0, 0.22, [1, 0.5, 1]);
        }
        spectators++;
      }
  // Sculpted front fence reads as the classic ring enclosure; it is low enough for fight cameras.
  for (let i = 0; i < 11; i++) {
    const x = -16.8 + i * 3.36;
    box(stands, stone, x, -0.58, 14.8, 3.32, 1.5, 0.42);
    box(stands, red, x, -0.58, 15.04, 2.92, 1.15, 0.06);
    if (i % 2 === 1) guardian(stands, x, -0.6, 15.13, 0.58, grey, ivory);
    else rosette(stands, x, -0.58, 15.12, 0.42, redDark);
    box(stands, ivory, x, 0.24, 14.8, 3.38, 0.16, 0.58);
  }
  const bannerMeshes = [];
  for (const side of [-1, 1])
    for (let j = 0; j < 2; j++) {
      const x = side * (17 + j * 2.5),
        z = -13.9 - j * 1.6;
      cylinder(gardens, wood, x, 4.75, z, 0.07, 12.1, 0.09, 20);
      ball(gardens, goldLight, x, 10.88, z, 0.14);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(-side * 0.3, -1.4, -side * 0.95, -5.0, -side * 1.8, -8.4);
      shape.bezierCurveTo(-side * 0.5, -6.5, side * 0.7, -2.2, 0, 0);
      const geometry = new THREE.ShapeGeometry(shape, 24);
      geometry.computeVertexNormals();
      const o = mesh(
        atmosphere,
        geometry,
        M(j ? 0x3e9ed2 : 0xda4d58, { side: THREE.DoubleSide }),
        x,
        10.5,
        z + 0.03,
      );
      o.name = 'budokai-tournament-banner';
      o.userData.cameraBlocker = false;
      bannerMeshes.push(o);
      tube(
        gardens,
        ivory,
        [
          [x, 10.7, z],
          [x - side * 0.4, 10.2, z],
          [x - side * 0.8, 9.5, z],
        ],
        0.027,
        8,
      );
    }
  const blue = M(0x357bc1),
    blueLight = M(0x5896d1),
    fringe = M(0xaf4335);
  function umbrella(x, z) {
    const g = new THREE.Group();
    g.position.set(x, -1.3, z);
    gardens.add(g);
    cylinder(g, charcoal, 0, 2.05, 0, 0.075, 4.1, 0.095, 24);
    cylinder(g, charcoal, 0, 0.08, 0, 0.45, 0.16, 0.5, 32);
    const profile = [];
    for (let i = 0; i <= 24; i++) {
      const a = ((i / 24) * Math.PI) / 2;
      profile.push([Math.sin(a) * 2.05, 4.15 + Math.cos(a) * 1.0]);
    }
    lathe(g, blue, profile.reverse());
    finial(g, 0, 5.15, 0, 0.2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU,
        pts = [];
      for (let j = 0; j <= 18; j++) {
        const t = ((j / 18) * Math.PI) / 2;
        pts.push([
          Math.sin(t) * 2.07 * Math.cos(a),
          4.15 + Math.cos(t),
          Math.sin(t) * 2.07 * Math.sin(a),
        ]);
      }
      tube(g, blueLight, pts, 0.025, 18);
    }
    lathe(g, goldLight, [
      [2.03, 4.16],
      [2.07, 4.16],
      [2.07, 4.03],
      [2.03, 4.03],
    ]);
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU;
      cylinder(g, fringe, Math.cos(a) * 2.04, 3.86, Math.sin(a) * 2.04, 0.026, 0.32, 0.028, 6);
    }
  }
  for (const side of [-1, 1]) {
    umbrella(side * 16.8, -9.8);
    umbrella(side * 27.8, 4.0);
  }
  function cypress(x, z, h) {
    const g = new THREE.Group();
    g.position.set(x, -1.35, z);
    gardens.add(g);
    cylinder(g, wood, 0, h * 0.4, 0, 0.13, h * 0.8, 0.21, 16);
    const profile = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      profile.push([Math.sin(Math.PI * t) * 1.15 * (1 - t * 0.35) + 0.02, h * 0.16 + t * h * 0.84]);
    }
    lathe(g, foliage[0], profile, 0, 0, 0, 32);
    for (let i = 0; i < 52; i++) {
      const t = i / 52,
        a = i * 2.399,
        r = Math.sin(Math.PI * t) * 0.86;
      ball(
        g,
        foliage[i % 3],
        Math.cos(a) * r,
        h * 0.16 + t * h * 0.8,
        Math.sin(a) * r,
        0.27 + 0.22 * Math.sin(Math.PI * t),
        [0.86, 1.45, 0.86],
      );
    }
  }
  function palm(parent, x, z, h) {
    const g = new THREE.Group();
    g.position.set(x, -1.35, z);
    parent.add(g);
    const points = [
      [0, 0, 0],
      [0.12, h * 0.35, 0],
      [0.5, h * 0.7, 0],
      [0.75, h, 0],
    ];
    taper(g, woodLight, points, 0.28);
    for (let i = 0; i < Math.floor(h * 2.6); i++) {
      const y = i / 2.6,
        o = mesh(
          g,
          new THREE.TorusGeometry(0.24 * (1 - (y / h) * 0.7), 0.015, 5, 12),
          wood,
          0.75 * (y / h) ** 1.5,
          y,
          0,
        );
      o.rotation.x = Math.PI / 2;
    }
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * TAU,
        pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push([
          0.75 + Math.cos(a) * t * 4.25,
          h + Math.sin(t * Math.PI) * 0.65 - t * t * 1.75,
          Math.sin(a) * t * 4.25,
        ]);
      }
      tube(g, foliage[1], pts, 0.033, 16);
      for (let j = 1; j < 15; j++)
        for (const s of [-1, 1]) {
          const base = pts[j],
            next = pts[j + 1],
            length = Math.sin((j / 16) * Math.PI) * 0.8;
          const vertices = [
            ...base,
            base[0] + Math.cos(a) * 0.45 + Math.cos(a + s * 1.57) * length,
            base[1] - 0.22,
            base[2] + Math.sin(a) * 0.45 + Math.sin(a + s * 1.57) * length,
            ...next,
          ];
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0], 2));
          geo.computeVertexNormals();
          const m = foliage[k % 3];
          m.side = THREE.DoubleSide;
          mesh(g, geo, m);
        }
    }
    for (let i = 0; i < 3; i++) ball(g, wood, 0.6 + i * 0.13, h - 0.22, 0.1 * (i % 2), 0.16);
  }
  for (const side of [-1, 1]) {
    for (const [x, z, h] of [
      [13.8, -17.9, 7.7],
      [18, -22, 9],
      [9, -30, 9],
      [27, -18, 8],
      [30, -30, 10],
    ])
      cypress(side * x, z, h);
    for (const [x, z, h] of [
      [26, -16, 12],
      [34, -28, 14],
      [29, 9, 12],
      [40, -43, 15],
    ])
      palm(gardens, side * x, z, h);
    for (let i = 0; i < 35; i++) {
      const x = side * (15.8 + random(i + side * 71) * 3.1),
        z = -17 + random(i + 211) * 29;
      if (z > -12 && z < -7) continue;
      ball(gardens, foliage[i % 4], x, -0.94, z, 0.35 + random(i) * 0.42, [1.3, 0.8, 1.1]);
    }
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.set(side * (33 + i * 5.4), -1.35, -6 - i * 7);
      gardens.add(g);
      box(g, wood, 0, 0.7, 0, 3, 0.12, 2);
      box(g, redDark, 0, 0.38, 0, 2.8, 0.7, 1.7);
      for (const x of [-1.35, 1.35]) cylinder(g, wood, x, 1.45, 0, 0.06, 2.9, 0.06, 12);
      roof(g, 3.7, 2.8, 2.85, 0.75);
      for (let j = 0; j < 5; j++) ball(g, redLight, -1 + j * 0.5, 0.94, 0.15, 0.17, [1, 0.7, 1]);
    }
  }
  // Fluted limestone massifs are closed volume geometry, with atmospheric color and foliage caps.
  const rockMaterials = [M(0xfffaf0), M(0xf5f0e5), M(0xe3ebdf)];
  function mountain(x, z, h, r, seed) {
    const pos = [],
      colors = [],
      uv = [],
      indices = [],
      n = 72,
      rows = 28,
      color = new THREE.Color();
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= n; i++) {
        const t = j / rows,
          a = (i / n) * TAU,
          flute =
            0.12 * Math.sin(a * 11 + seed) +
            0.055 * Math.sin(a * 21 + seed) +
            0.09 * Math.sin(a * 4 + seed),
          radius = r * (1 - 0.27 * t) * (0.95 + flute + 0.035 * Math.sin(t * 9 + a * 5)),
          y =
            -1.4 + t * h + Math.pow(t, 4) * (Math.sin(a * 3 + seed) * 1.5 + Math.sin(a * 7) * 0.8);
        pos.push(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius * 0.77);
        color.set(0xe1cf9e).lerp(new THREE.Color(0xadb8a2), 0.2 + 0.2 * Math.sin(a * 11 + seed));
        colors.push(color.r, color.g, color.b);
        uv.push(i / n, t);
        if (j < rows && i < n) {
          const k = j * (n + 1) + i;
          indices.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Color strata are baked into geometry so distant rock remains a single material bucket.
    const rock = rockMaterials[seed % 3];
    rock.vertexColors = true;
    mesh(distant, geo, rock);
    for (let i = 0; i < 30; i++) {
      const a = i * 2.399,
        rr = Math.sqrt(random(i + seed)) * r * 0.67;
      ball(
        distant,
        foliage[2],
        x + Math.cos(a) * rr,
        h - 1.55 + random(i) * 1.6,
        z + Math.sin(a) * rr * 0.77,
        1.5,
        [1, 0.8, 1],
      );
    }
    ball(distant, foliage[2], x, h - 2.1, z, r * 0.74, [1, 0.2, 0.77]);
  }
  // Keep color attributes consistent inside mountain-only buckets.
  const mountains = new THREE.Group();
  distant.add(mountains);
  // Mountains use their own batching below because foliage and buildings have no vertex colors.
  mountain(-47, -64, 26, 9, 1);
  mountain(-59, -73, 17, 7, 2);
  mountain(47, -70, 32, 10, 3);
  mountain(61, -78, 20, 9, 4);
  // Move rock meshes to their own group before merging attributes.
  for (const o of [...distant.children])
    if (o.isMesh && o.material.vertexColors) {
      if (!o.geometry.attributes.color) {
        const values = new Float32Array(o.geometry.attributes.position.count * 3).fill(1);
        o.geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
      }
      mountains.attach(o);
    }
  batch(mountains, 'budokai-rock-massifs', false, false);
  const foothill = M(0x91ac79);
  for (let i = 0; i < 8; i++)
    ball(distant, foothill, -70 + i * 20, -1.1, -71 - (i % 3) * 5, 12, [1.6, 0.18, 0.9]);
  const city = M(0xb2cbd5),
    cityLight = M(0xcddcdb),
    cityWindow = M(0x7197ab);
  for (let i = 0; i < 12; i++) {
    const x = -67 + i * 12.1,
      z = -91 - random(i + 92) * 12,
      h = 5 + random(i + 34) * 10,
      w = 2.1 + random(i + 91) * 2;
    if (Math.abs(x) < 16) continue;
    if (i % 3 === 0) cylinder(distant, city, x, h / 2 - 1.3, z, w / 2, h, w / 2, 32);
    else box(distant, cityLight, x, h / 2 - 1.3, z, w, h, w * 1.2);
    for (let j = 0; j < Math.floor(h / 1.4); j++)
      for (let k = 0; k < 3; k++)
        box(
          distant,
          cityWindow,
          x + (k - 1) * w * 0.22,
          0.2 + j * 1.3,
          z + w * 0.61,
          0.16,
          0.43,
          0.025,
        );
    cylinder(distant, cityLight, x, h - 1.05, z, w * 0.58, 0.25, w * 0.58, 32);
  }
  cylinder(distant, cityLight, 32, 8, -86, 0.48, 18, 0.7, 32);
  lathe(
    distant,
    city,
    [
      [0, 17],
      [2.4, 17],
      [3, 18],
      [3.1, 19],
      [2.6, 20.1],
      [0, 20.4],
    ],
    32,
    -1.3,
    -86,
  );
  for (const y of [16.7, 18.1]) cylinder(distant, cityWindow, 32, y, -86, 3.08, 0.22, 3.08, 48);
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++)
      palm(distant, side * (36 + i * 7), -52 - (i % 3) * 13, 9 + (i % 4) * 2);
  // Static spatial buckets distinguish camera obstacles from scenery too distant to intersect combat.
  batch(arena, 'budokai-arena-masonry', true, false);
  batch(hall, 'budokai-hall-detail');
  batch(gate, 'budokai-gate-relief');
  batch(gardens, 'budokai-garden-detail', true, true, true);
  batch(stands, 'budokai-spectator-detail', true, false, true);
  // mountains already have an indexed vertex-color bucket; temporarily detach for the other horizon materials.
  distant.remove(mountains);
  batch(distant, 'budokai-city-and-palms', false, false, true);
  distant.add(mountains);
  const skyGeo = new THREE.SphereGeometry(290, 32, 20);
  skyGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3),
  );
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sky.name = 'budokai-sky';
  sky.renderOrder = -10;
  sky.userData.cameraBlocker = false;
  group.add(sky);
  const ramp = new THREE.DataTexture(
    new Uint8Array([180, 206, 227, 243, 252, 255]),
    6,
    1,
    THREE.RedFormat,
  );
  ramp.needsUpdate = true;
  ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
  const cloudMaterial = M(0xffffff);
  cloudMaterial.gradientMap = ramp;
  const cloudGeometry = new THREE.SphereGeometry(1, 20, 14),
    clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 180),
    dummy = new THREE.Object3D();
  clouds.name = 'budokai-clouds';
  clouds.userData.cameraBlocker = false;
  clouds.castShadow = false;
  for (let i = 0; i < 30; i++)
    for (let j = 0; j < 6; j++) {
      const a = i * 2.399,
        r = 85 + random(i) * 75,
        size = 2 + random(i + 13) * 2.2,
        puff = size * (0.65 + random(i * 6 + j + 17) * 0.8);
      dummy.position.set(
        Math.cos(a) * r + (j - 2.5) * size * 0.9,
        24 + random(i + 21) * 13 + Math.sin(j * 2) * size * 0.8,
        Math.sin(a) * r + Math.cos(j * 2.2) * size,
      );
      dummy.scale.set(puff * 1.3, puff * 0.95, puff);
      dummy.updateMatrix();
      clouds.setMatrixAt(i * 6 + j, dummy.matrix);
    }
  clouds.computeBoundingSphere();
  atmosphere.add(clouds);
  group.userData.budokai = {
    tiles: tiles.length,
    spectators,
    roofs: 4,
    flags: bannerMeshes.length,
    cloudInstances: clouds.count,
    gateZ: BUDOKAI_LAYOUT.gateZ,
  };
  templates.set(characters, cloneStage(group));
  return finishStage(group, world, render, lightPreset);
}

function finishStage(group, world, render, lightPreset) {
  const skyGeo = group.getObjectByName('budokai-sky').geometry,
    clouds = group.getObjectByName('budokai-clouds'),
    cloudMaterial = clouds.material,
    curtain = group.getObjectByName('budokai-entrance-curtain'),
    sealMesh = group.getObjectByName('budokai-entrance-seal'),
    bannerMeshes = [];
  group.traverse((o) => {
    if (o.name === 'budokai-tournament-banner') bannerMeshes.push(o);
  });
  let time = 0;
  const map = {
    group,
    bounds: { ...BUDOKAI_LAYOUT.bounds },
    preview: {
      distance: 76,
      center: [0, 3, -12],
      menuRadius: 47,
      menuHeight: 24,
      menuTarget: [0, 3, -10],
    },
    update(dt) {
      time += dt;
      clouds.rotation.y = time * 0.0011;
      for (let i = 0; i < bannerMeshes.length; i++) {
        const o = bannerMeshes[i],
          p = o.geometry.attributes.position;
        // Deform in the flag's own space; the anchored top remains fixed.
        for (let j = 0; j < p.count; j++) {
          const y = p.getY(j);
          p.setZ(j, Math.sin(time * 2.6 + y * 0.9 + i) * Math.min(0.25, Math.abs(y) * 0.035));
        }
        p.needsUpdate = true;
        o.geometry.computeVertexNormals();
        o.rotation.y = Math.sin(time * 1.4 + i) * 0.06;
      }
      curtain.rotation.x = Math.sin(time * 1.8) * 0.025;
      sealMesh.rotation.x = curtain.rotation.x;
    },
    applyLighting(preset) {
      const night = preset === 'moon',
        warm = preset === 'sunset',
        zenith = new THREE.Color(night ? 0x102340 : warm ? 0x7399b6 : 0x2495ed),
        horizon = new THREE.Color(night ? 0x526981 : warm ? 0xf3d1a2 : 0xc5e7fa),
        c = new THREE.Color();
      for (let i = 0; i < skyGeo.attributes.position.count; i++) {
        const height = skyGeo.attributes.position.getY(i) / 290;
        c.copy(horizon).lerp(zenith, THREE.MathUtils.clamp(height * 1.65 + 0.36, 0, 1));
        skyGeo.attributes.color.setXYZ(i, c.r, c.g, c.b);
      }
      skyGeo.attributes.color.needsUpdate = true;
      cloudMaterial.color.set(night ? 0x86a2bb : warm ? 0xffe1b9 : 0xffffff);
      if (render?.hemi) {
        render.scene.fog = new THREE.Fog(night ? 0x384f6c : warm ? 0xe6c499 : 0xc0dfdf, 72, 205);
        render.hemi.groundColor.set(night ? 0x3e4f61 : warm ? 0x8c7a57 : 0x81956e);
      }
    },
  };
  Object.defineProperty(map, 'applyLighting', { enumerable: false });
  world.enrichDestruction(map, 'budokai');
  // Reuse the twelve existing breakable props, but set them in the ring-side service lane.
  // Their health, debris types and shared destruction behavior are unchanged.
  let propIndex = 0;
  for (const prop of map.destructibles.filter((p) => !p.tile && !p.building)) {
    const i = propIndex++;
    prop.mesh.position.set((i % 2 ? 1 : -1) * 16.2, -0.96, -5.3 + Math.floor(i / 2) * 2.05);
  }
  map.applyLighting(lightPreset);
  return map;
}

export function register({ characters, match, render, world }) {
  world.buildBudokaiStage = () => {
    world.daylight();
    return createBudokaiStage({ characters, world, render, lightPreset: match.game.lightPreset });
  };
  return function initialize() {};
}
