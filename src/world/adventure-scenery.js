import * as THREE from 'three';
import { batchScenery } from './scenery-batching.js';

export const TAU = Math.PI * 2;
export const seeded = (i) => (((Math.sin(i * 78.233 + 13.719) * 43758.5453) % 1) + 1) % 1;

// Small shared primitives, indexed material buckets and spatially separate trees.
// No per-leaf motion, reflections, image downloads or extra lights are required.
export function sceneryKit(characters) {
  const sphere = new THREE.SphereGeometry(1, 20, 14),
    cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 12),
    palette = new Map();
  const distantSphere = new THREE.SphereGeometry(1, 12, 8);
  const boulder = new THREE.SphereGeometry(1, 20, 14);
  const bp = boulder.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i),
      y = bp.getY(i),
      z = bp.getZ(i);
    const r = 1 + Math.sin(x * 8 + y * 5 + z * 9) * 0.095 + Math.cos(x * 4 - z * 7) * 0.055;
    bp.setXYZ(i, x * r, y * r, z * r);
  }
  boulder.computeVertexNormals();
  const mat = (color, double = false) => {
    const key = `${color}:${double}`;
    if (!palette.has(key))
      palette.set(key, characters.M(color, { side: double ? THREE.DoubleSide : THREE.FrontSide }));
    return palette.get(key);
  };
  const mesh = (root, geometry, material, x = 0, y = 0, z = 0, scale) =>
    characters.meshTo(root, geometry, material, x, y, z, scale);
  const box = (g, m, x, y, z, w, h, d) => mesh(g, cube, m, x, y, z, [w, h, d]);
  const ball = (g, m, x, y, z, r, s = [1, 1, 1]) =>
    mesh(
      g,
      sphere,
      m,
      x,
      y,
      z,
      s.map((v) => v * r),
    );
  const post = (g, m, x, y, z, r, h) => mesh(g, cylinder, m, x, y, z, [r, h, r]);
  const rod = (g, m, a, b, r) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.sub(from);
    const o = mesh(g, cylinder, m, ...from.addScaledVector(delta, 0.5).toArray(), [
      r,
      delta.length(),
      r,
    ]);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return o;
  };
  const ribbon = (g, m, points, width, height) => {
    const vertices = [],
      indices = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const tangent = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
      vertices.push(
        p[0] - tangent.y * width,
        height,
        p[1] + tangent.x * width,
        p[0] + tangent.y * width,
        height,
        p[1] - tangent.x * width,
      );
      if (i) {
        const n = i * 2;
        indices.push(n - 2, n, n - 1, n - 1, n, n + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return mesh(g, geo, m);
  };
  function tree(root, x, z, height, seed, y = 0, distant = false) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    root.add(g);
    const bark = mat(0x775a3c),
      barkLight = mat(0x97734d),
      leaves = [0x32674a, 0x458052, 0x629452, 0x7ea757].map((c) => mat(c));
    const trunkH = height * 0.68;
    post(g, bark, 0, trunkH / 2, 0, height * 0.048, trunkH);
    for (let j = 0; j < 4; j++) {
      const a = j * 2.399 + seed;
      rod(
        g,
        barkLight,
        [0, trunkH * 0.57, 0],
        [Math.cos(a) * height * 0.2, trunkH * 0.97, Math.sin(a) * height * 0.2],
        height * 0.025,
      );
    }
    for (let j = 0; j < 7; j++) {
      const a = j * 2.399 + seed,
        r = j ? height * 0.22 : 0;
      mesh(
        g,
        distant ? distantSphere : sphere,
        leaves[j % 4],
        Math.cos(a) * r,
        height * 0.77 + seeded(j + seed) * height * 0.17,
        Math.sin(a) * r,
        [1.45, 0.91, 1.14].map((s) => s * height * 0.23),
      );
    }
    if (!distant)
      for (let j = 0; j < 5; j++) {
        const a = (j * TAU) / 5;
        rod(g, bark, [0, 0.65, 0], [Math.cos(a) * 0.9, 0.06, Math.sin(a) * 0.9], 0.09);
      }
    batchScenery(g, 'mountain-tree', !distant, false, true);
    return g;
  }
  function palm(root, x, z, height, seed) {
    const g = new THREE.Group();
    g.position.set(x, 0.1, z);
    root.add(g);
    const bark = mat(0x94734b),
      rim = mat(0xbe9863),
      green = [0x467a47, 0x64934b, 0x8eaf50].map((c) => mat(c, true));
    const top = [0.75, height, 0.2];
    for (let i = 0; i < 12; i++) {
      const u = i / 12,
        v = (i + 1) / 12;
      rod(
        g,
        i % 3 ? rim : bark,
        [0.75 * u * u, height * u, 0.2 * u],
        [0.75 * v * v, height * v, 0.2 * v],
        0.24 * (1 - u * 0.55),
      );
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + seed,
        vertices = [],
        indices = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10,
          length = 4.3 * t,
          y = height + Math.sin(t * Math.PI) * 0.75 - t * t * 2.1,
          width = Math.sin(t * Math.PI) * 0.13;
        const xx = top[0] + Math.cos(a) * length,
          zz = top[2] + Math.sin(a) * length;
        vertices.push(
          xx - Math.sin(a) * width,
          y - 0.14,
          zz + Math.cos(a) * width,
          xx,
          y,
          zz,
          xx + Math.sin(a) * width,
          y - 0.14,
          zz - Math.cos(a) * width,
        );
        if (i) {
          const n = i * 3;
          indices.push(n - 3, n - 2, n, n, n - 2, n + 1, n - 2, n - 1, n + 1, n + 1, n - 1, n + 2);
        }
      }
      // Separate paired leaflets preserve the feathery coconut silhouette.
      for (let i = 1; i < 10; i++)
        for (const side of [-1, 1]) {
          const t = i / 10,
            length = 4.3 * t,
            leafLength = Math.sin(t * Math.PI) * 0.95,
            xx = top[0] + Math.cos(a) * length,
            zz = top[2] + Math.sin(a) * length,
            yy = height + Math.sin(t * Math.PI) * 0.75 - t * t * 2.1,
            n = vertices.length / 3;
          vertices.push(
            xx,
            yy,
            zz,
            xx + Math.cos(a) * 0.26 - Math.sin(a) * leafLength * side,
            yy - 0.2,
            zz + Math.sin(a) * 0.26 + Math.cos(a) * leafLength * side,
            xx + Math.cos(a) * 0.65 - Math.sin(a) * leafLength * 0.75 * side,
            yy - 0.3,
            zz + Math.sin(a) * 0.65 + Math.cos(a) * leafLength * 0.75 * side,
            xx + Math.cos(a) * 0.3,
            yy - 0.1,
            zz + Math.sin(a) * 0.3,
          );
          indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      mesh(g, geo, green[k % 3]);
    }
    for (let i = 0; i < 3; i++) ball(g, bark, 0.5 + i * 0.22, height - 0.24, 0.1 + i * 0.11, 0.24);
    batchScenery(g, 'island-palm', true, false, true);
  }
  function rock(root, x, y, z, size, seed = 1) {
    const o = mesh(root, boulder, mat([0x8d9585, 0xaaa994, 0xc3bba3][seed % 3]), x, y, z, [
      size * 1.15,
      size * (0.8 + seeded(seed) * 0.35),
      size * 0.88,
    ]);
    o.rotation.set(seed * 0.13, seed * 1.7, seed * 0.05);
    return o;
  }
  return { mat, mesh, box, ball, post, rod, ribbon, tree, palm, rock };
}

export function skyAndClouds(root, characters, seed = 1) {
  const geo = new THREE.SphereGeometry(280, 28, 16);
  geo.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3),
  );
  const sky = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sky.name = 'adventure-sky';
  sky.renderOrder = -10;
  sky.userData.cameraBlocker = false;
  root.add(sky);
  const clouds = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      characters.M(0xffffff),
      96,
    ),
    dummy = new THREE.Object3D();
  clouds.name = 'adventure-clouds';
  clouds.userData.cameraBlocker = false;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 6; j++) {
      const angle = i * 2.399 + seed,
        radius = 90 + seeded(i + seed) * 70,
        size = 2 + seeded(i + 41) * 2;
      dummy.position.set(
        Math.cos(angle) * radius + (j - 2.5) * size,
        29 + seeded(i + 57) * 18 + Math.sin(j * 2) * size * 0.6,
        Math.sin(angle) * radius + Math.cos(j) * size,
      );
      dummy.scale.set(size * 1.5, size * 0.85, size);
      dummy.updateMatrix();
      clouds.setMatrixAt(i * 6 + j, dummy.matrix);
    }
  clouds.computeBoundingSphere();
  root.add(clouds);
  function applyLighting(preset) {
    const night = preset === 'moon',
      warm = preset === 'sunset',
      high = new THREE.Color(night ? 0x102440 : warm ? 0x6593bc : 0x2499f0),
      low = new THREE.Color(night ? 0x4b607a : warm ? 0xf5d5a7 : 0xc6e7ef),
      c = new THREE.Color();
    for (let i = 0; i < geo.attributes.position.count; i++) {
      c.copy(low).lerp(
        high,
        THREE.MathUtils.clamp((geo.attributes.position.getY(i) / 280) * 1.7 + 0.27, 0, 1),
      );
      geo.attributes.color.setXYZ(i, c.r, c.g, c.b);
    }
    geo.attributes.color.needsUpdate = true;
    clouds.material.color.set(night ? 0x849cb7 : warm ? 0xffddb1 : 0xffffff);
  }
  return {
    applyLighting,
    update: (time) => {
      clouds.rotation.y = time * 0.001;
    },
  };
}

export function adventureHouse(root, kit, world, id, x, z) {
  const { mat, mesh, box, ball, post, rod } = kit,
    island = id === 'kame',
    g = new THREE.Group(),
    w = island ? 8.6 : 9.4,
    d = 6.6,
    h = island ? 4.9 : 4.5,
    rise = 3.2;
  g.position.set(x, island ? 0.16 : 1, z);
  root.add(g);
  const wall = mat(island ? 0xeeaaa9 : 0xc69b65),
    seams = mat(island ? 0xd58a8e : 0xaa7e4e),
    trim = mat(0xffedcb),
    wood = mat(0x805e3e),
    roof = [0xb85342, 0xbf5c48, 0xaf4d3e].map((c) => mat(c)),
    glass = mat(0x477a82),
    dark = mat(0x294c54),
    green = mat(0x648769),
    stone = mat(0xbcb8a6);
  box(g, stone, 0, 0.17, 0, w + 0.35, 0.34, d + 0.35);
  box(g, wall, 0, h / 2 + 0.3, 0, w, h, d);
  const triangle = new THREE.Shape();
  triangle.moveTo(-w / 2, 0);
  triangle.lineTo(w / 2, 0);
  triangle.lineTo(0, rise);
  triangle.closePath();
  mesh(
    g,
    new THREE.ExtrudeGeometry(triangle, { depth: d, bevelEnabled: false }),
    wall,
    0,
    h + 0.3,
    -d / 2,
  );
  for (let y = 0.6; y < h + 0.3; y += 0.31) {
    box(g, seams, 0, y, d / 2 + 0.012, w, 0.017, 0.035);
    box(g, seams, 0, y, -d / 2 - 0.012, w, 0.017, 0.035);
    for (const side of [-1, 1]) box(g, seams, side * (w / 2 + 0.012), y, 0, 0.035, 0.017, d);
  }
  for (let y = 0.32; y < rise; y += 0.31)
    box(g, seams, 0, h + 0.3 + y, d / 2 + 0.02, w * (1 - y / rise), 0.017, 0.028);
  for (const side of [-1, 1])
    for (const zz of [-1, 1])
      box(g, trim, (side * w) / 2, h / 2 + 0.3, (zz * d) / 2, 0.14, h, 0.14);
  const half = w / 2 + 0.55,
    depth = d + 1.1,
    slope = Math.atan(rise / half);
  for (let j = 0; j < 13; j++)
    for (let i = 0; i < 20; i++) {
      const xx = -half + ((i + 0.5) * half) / 10,
        zz = -depth / 2 + ((j + 0.5) * depth) / 13,
        yy = h + 0.38 + rise * (1 - Math.abs(xx) / half);
      const tile = box(
        g,
        roof[(i + j * 7) % 3],
        xx,
        yy,
        zz,
        half / 10 / Math.cos(slope) + 0.015,
        0.075,
        depth / 13 - 0.018,
      );
      tile.rotation.z = xx < 0 ? slope : -slope;
    }
  for (const side of [-1, 1]) {
    box(g, trim, side * half, h + 0.27, 0, 0.13, 0.2, depth);
    for (const zz of [-depth / 2, depth / 2])
      rod(g, trim, [side * half, h + 0.31, zz], [0, h + rise + 0.38, zz], 0.065);
  }
  rod(
    g,
    roof[0],
    [0, h + rise + 0.4, -depth / 2 - 0.08],
    [0, h + rise + 0.4, depth / 2 + 0.08],
    0.13,
  );
  function window(g, xx, yy, zz, width, height) {
    box(g, dark, xx, yy, zz, width + 0.22, height + 0.2, 0.06);
    box(g, glass, xx, yy, zz + 0.045, width, height, 0.05);
    for (const side of [-1, 1]) {
      box(g, trim, xx + (side * width) / 2, yy, zz + 0.08, 0.085, height + 0.16, 0.09);
      box(g, trim, xx, yy + (side * height) / 2, zz + 0.08, width + 0.2, 0.085, 0.09);
      box(g, green, xx + side * (width / 2 + 0.36), yy, zz + 0.02, 0.52, height + 0.15, 0.09);
      for (let i = 0; i < 8; i++)
        box(
          g,
          wood,
          xx + side * (width / 2 + 0.36),
          yy - height / 2 + (i * height) / 8,
          zz + 0.08,
          0.48,
          0.022,
          0.03,
        );
    }
    box(g, trim, xx, yy, zz + 0.1, 0.055, height, 0.065);
    box(g, trim, xx, yy, zz + 0.1, width, 0.055, 0.065);
    box(g, trim, xx, yy - height / 2 - 0.14, zz + 0.17, width + 0.32, 0.1, 0.3);
  }
  for (const side of [-1, 1]) {
    window(g, side * 2.7, 2.85, d / 2 + 0.07, 1.6, 1.75);
    const sideWall = new THREE.Group();
    sideWall.position.set(side * (w / 2 + 0.04), 0, 0);
    sideWall.rotation.y = (side * Math.PI) / 2;
    g.add(sideWall);
    window(sideWall, 0, 2.85, 0, 1.7, 1.75);
  }
  box(g, island ? green : wood, 0, 1.8, d / 2 + 0.06, 1.35, 3, 0.1);
  for (const side of [-1, 1]) box(g, trim, side * 0.77, 1.82, d / 2 + 0.14, 0.12, 3.2, 0.14);
  box(g, trim, 0, 3.44, d / 2 + 0.14, 1.68, 0.12, 0.14);
  box(g, dark, 0, 2.5, d / 2 + 0.12, 0.75, 0.85, 0.06);
  ball(g, mat(0xe6ba4b), 0.45, 1.65, d / 2 + 0.2, 0.075);
  const porchDepth = island ? 1.6 : 2.7,
    porchWidth = island ? 4 : w + 1.4,
    deckZ = d / 2 + porchDepth / 2;
  box(g, island ? trim : wood, 0, 0.36, deckZ, porchWidth, 0.28, porchDepth);
  for (let i = 0; i < Math.floor(porchWidth / 0.42); i++)
    box(g, seams, -porchWidth / 2 + i * 0.42, 0.51, deckZ, 0.02, 0.012, porchDepth);
  for (const side of [-1, 1]) {
    post(g, trim, side * (porchWidth / 2 - 0.16), 1.78, d / 2 + porchDepth - 0.13, 0.08, 2.6);
    box(g, trim, side * (porchWidth / 2 - 0.16), 1.18, deckZ, 0.1, 0.1, porchDepth);
    for (let i = 0; i < 5; i++)
      box(
        g,
        trim,
        side * (porchWidth / 2 - 0.16),
        0.86,
        d / 2 + (i * porchDepth) / 5,
        0.055,
        0.62,
        0.055,
      );
  }
  const canopy = box(g, roof[1], 0, 3.17, deckZ, porchWidth + 0.6, 0.12, porchDepth + 0.4);
  canopy.rotation.x = 0.11;
  for (let i = 0; i < 4; i++)
    box(g, stone, 0, 0.24 - i * 0.1, d / 2 + porchDepth + 0.25 + i * 0.4, 2.2, 0.22, 0.46);
  box(g, stone, -2.35, h + rise - 0.2, -1.8, 0.7, 2.1, 0.75);
  box(g, trim, -2.35, h + rise + 0.87, -1.8, 0.9, 0.18, 0.95);
  for (let i = 0; i < 6; i++)
    box(g, seams, -2.35, h + rise - 1.06 + i * 0.3, -1.415, 0.68, 0.035, 0.025);
  if (island) {
    for (const [text, yy, width] of [
      ['KAME', h + 2.32, 2.8],
      ['HOUSE', h + 1.46, 3.8],
    ]) {
      const texture = world.makeTextTexture(text, {
        w: 512,
        h: 128,
        fontSize: 86,
        plain: true,
        bg: '#eeaaa9',
        border: '#eeaaa9',
        fg: '#9b3438',
      });
      const label = mesh(
        g,
        new THREE.PlaneGeometry(width, 0.74),
        new THREE.MeshToonMaterial({ map: texture, gradientMap: trim.gradientMap }),
        0,
        yy,
        d / 2 + 0.055,
      );
      label.castShadow = false;
      label.receiveShadow = true;
    }
  } else {
    const windowRing = mesh(
      g,
      new THREE.TorusGeometry(0.52, 0.06, 6, 24),
      trim,
      0,
      h + 1.45,
      d / 2 + 0.08,
    );
    mesh(g, new THREE.CircleGeometry(0.49, 24), dark, 0, h + 1.45, d / 2 + 0.055);
    box(g, trim, 0, h + 1.45, d / 2 + 0.14, 0.055, 1, 0.07);
    box(g, trim, 0, h + 1.45, d / 2 + 0.14, 1, 0.055, 0.07);
    windowRing.userData.cameraBlocker = false;
  }
  world.prepareBuilding(g, island ? 'kame-house' : 'goku-mountain-home', {
    roofY: h + 0.3,
    kind: 'wood',
    cellSize: 3.2,
  });
  // Building damage stays independent; the camera broad phase sees its true bounds.
  return g;
}
