import * as THREE from 'three';
import { batchScenery } from './scenery-batching.js';
import { sceneryKit, skyAndClouds, adventureHouse, TAU, seeded } from './adventure-scenery.js';

export const ADVENTURE_LAYOUT = Object.freeze({
  bounds: { x: 13.5, z: 6 },
  cameraApron: { x: 21, z: 14 },
  wild: { house: [13, -27], waterfall: [-8, -38] },
  kame: { house: [-4, -24], radius: [31, 27], centerZ: -7, dock: [27, -9] },
});

function terrain(kit, island, world) {
  const geometry = island
      ? islandGeometry()
      : new THREE.PlaneGeometry(180, 180, 140, 140).rotateX(-Math.PI / 2),
    p = geometry.attributes.position,
    colors = [],
    sand = new THREE.Color(island ? 0xf2d6a0 : 0xd9bb83),
    grass = new THREE.Color(island ? 0x8fa85a : 0x7eaa60),
    damp = new THREE.Color(0xc1b78b),
    c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      variation = Math.sin(x * 1.7 + z * 2.4) * 0.018 + Math.sin(x * 0.27 - z * 0.43) * 0.025;
    if (island) {
      const lawn = Math.sqrt(((x + 4) / 10) ** 2 + ((z + 24) / 6.8) ** 2);
      c.copy(sand).lerp(grass, 1 - THREE.MathUtils.smoothstep(lawn, 0.74, 1.3));
      if (p.getY(i) < -0.02) c.lerp(damp, 0.38);
    } else {
      const r = Math.sqrt((x / 18.7) ** 2 + (z / 10.5) ** 2);
      c.copy(sand).lerp(grass, THREE.MathUtils.smoothstep(r, 0.92, 1.33));
      // The full playable rectangle and shoulder-camera apron are exactly flat.
      const apron = Math.max(Math.abs(x) / 22, Math.abs(z) / 15);
      p.setY(i, Math.max(0, apron - 1) * (1.1 + Math.sin(x * 0.085) * Math.cos(z * 0.1) * 0.75));
      if (apron > 1) {
        const pool = Math.sqrt(((x + 8) / 8.9) ** 2 + ((z + 30) / 4.6) ** 2);
        const channel = [
          [-8, -29],
          [-13, -24],
          [-20, -19],
          [-26, -12],
          [-31, -5],
          [-39, 2],
        ];
        let distance = Infinity;
        for (let j = 0; j < channel.length - 1; j++) {
          const [ax, az] = channel[j],
            [bx, bz] = channel[j + 1],
            dx = bx - ax,
            dz = bz - az,
            t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
          distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
        }
        const cut = Math.max(
          1 - THREE.MathUtils.smoothstep(pool, 0.7, 1.06),
          1 - THREE.MathUtils.smoothstep(distance, 1.15, 2.15),
        );
        p.setY(i, THREE.MathUtils.lerp(p.getY(i), -0.18, cut));
      }
    }
    c.multiplyScalar(1 + variation);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = kit.mat(0xffffff).clone();
  material.vertexColors = true;
  material.map = world.surfaceTexture(island ? 'sand' : 'earth');
  material.map.repeat.set(island ? 10 : 24, island ? 10 : 24);
  const ground = new THREE.Mesh(geometry, material);
  ground.name = island ? 'kame-sculpted-island' : 'wild-valley-terrain';
  ground.receiveShadow = true;
  ground.userData.cameraBlocker = false;
  return ground;
}

function islandGeometry() {
  const positions = [0, 0.108, -7],
    uv = [0.5, 0.5],
    indices = [],
    n = 128;
  for (let ring = 1; ring <= 12; ring++) {
    const t = ring / 12;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU,
        edge = 1 + 0.032 * Math.sin(3 * a + 0.7) + 0.018 * Math.sin(7 * a),
        r = t * (1 + (edge - 1) * t ** 4);
      positions.push(
        Math.cos(a) * 31 * r,
        t < 0.84 ? 0.108 : 0.108 - ((t - 0.84) / 0.16) ** 1.5 * 0.9,
        -7 + Math.sin(a) * 27 * r,
      );
      uv.push(0.5 + (Math.cos(a) * r) / 2, 0.5 + (Math.sin(a) * r) / 2);
      if (ring === 1 && i < n) indices.push(0, 1 + i + 1, 1 + i);
      if (ring > 1 && i < n) {
        const k = 1 + (ring - 1) * (n + 1) + i,
          prev = k - n - 1;
        indices.push(prev, k + 1, k, prev, prev + 1, k + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

function massif(root, kit, x, z, height, radius, seed, cliffTexture) {
  const vertices = [],
    colors = [],
    uv = [],
    indices = [],
    n = 48,
    rows = 20,
    rock = new THREE.Color(0xb6bba2),
    shade = new THREE.Color(0x7d988e),
    light = new THREE.Color(0xdfd5b6),
    c = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    const t = j / rows,
      profile =
        t < 0.18 ? 1.18 - t : t > 0.86 ? 1 - (t - 0.86) * 2 : 0.83 + Math.sin(t * 5 + seed) * 0.085;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU,
        flute = 1 + Math.sin(a * 9 + seed) * 0.065 + Math.sin(a * 5 - t * 2) * 0.1,
        r = radius * profile * flute;
      vertices.push(
        x + Math.cos(a) * r + Math.sin(t * 3 + seed) * radius * 0.09,
        t * height + 1.1,
        z + Math.sin(a) * r * 0.8,
      );
      uv.push(i / n, t);
      const weather = Math.sin(a * 9 + seed) * 0.18 + Math.sin(a * 5 - t * 4) * 0.13;
      c.copy(rock).lerp(weather > 0 ? light : shade, Math.abs(weather) + (t < 0.2 ? 0.17 : 0));
      colors.push(c.r, c.g, c.b);
      if (j && i < n) {
        const k = j * (n + 1) + i;
        indices.push(k - n - 1, k, k + 1, k - n - 1, k + 1, k - n);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = kit.mat(0xffffff).clone();
  material.vertexColors = true;
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  material.map = cliffTexture;
  const peak = kit.mesh(root, geometry, material);
  peak.castShadow = peak.receiveShadow = false;
  peak.userData.cameraBlocker = false;
  kit.ball(root, kit.mat(0x658953), x, height + 1.1, z, radius * 0.58, [1.35, 0.17, 1.05]);
  for (let j = 0; j < 5; j++) {
    const a = j * 2.399 + seed,
      r = radius * 0.35;
    kit.tree(
      root,
      x + Math.cos(a) * r,
      z + Math.sin(a) * r * 0.75,
      radius * 0.55,
      seed + j,
      height + 1.05,
      true,
    );
  }
  // Broken horizontal ledges and vertical buttresses give readable rock layers,
  // without fine tubes wrapping every peak or expensive subdivision.
  for (let j = 0; j < 5; j++) {
    const a = seed + j * 1.7,
      t = 0.22 + seeded(j + seed) * 0.5;
    const o = kit.ball(
      root,
      kit.mat(j % 2 ? 0xc0bda2 : 0x96a98e),
      x + Math.cos(a) * radius * 0.79,
      t * height * 0.6,
      z + Math.sin(a) * radius * 0.66,
      radius * 0.3,
      [1, (height * 0.45) / (radius * 0.3), 0.7],
    );
    o.castShadow = false;
  }
}

function plants(root, kit, island) {
  const leaf = [0x557e47, 0x71924a, 0x8da957].map((c) => kit.mat(c, true)),
    petals = kit.mat(0xffebc3),
    wood = kit.mat(0x816442);
  for (let i = 0; i < (island ? 70 : 140); i++) {
    const a = i * 2.399,
      r = island ? 25 + seeded(i) * 3 : 24 + seeded(i) * 12,
      x = Math.cos(a) * r,
      z = (island ? -7 : 0) + Math.sin(a) * r * (island ? 0.8 : 0.73);
    if (Math.abs(x) < 21 && z > -14 && z < 14) continue;
    for (let j = 0; j < 4; j++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.34, 0.22, 0.2, 0.68 + 0.08 * j);
      shape.quadraticCurveTo(-0.02, 0.2, 0, 0);
      const blade = kit.mesh(root, new THREE.ShapeGeometry(shape, 3), leaf[j % 3], x, 0.14, z);
      blade.rotation.y = a + j * 1.5;
    }
    if (i % 4 === 0) {
      kit.post(root, wood, x, 0.32, z, 0.014, 0.4);
      for (let j = 0; j < 4; j++)
        kit.ball(
          root,
          petals,
          x + Math.cos((j * Math.PI) / 2) * 0.065,
          0.54,
          z + Math.sin((j * Math.PI) / 2) * 0.065,
          0.066,
          [1, 0.45, 1],
        );
    }
  }
  batchScenery(root, 'adventure-ground-plants', false, false, true);
}

function animatedWater(root, island) {
  const uniforms = {
    time: { value: 0 },
    deep: { value: new THREE.Color(island ? 0x147bbd : 0x52bac9) },
    shallow: { value: new THREE.Color(0x57cfc8) },
    foam: { value: new THREE.Color(0xdaf8ee) },
    center: { value: new THREE.Vector2(0, -7) },
    island: { value: island ? 1 : 0 },
    brightness: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    fog: true,
    vertexShader: `varying vec2 waterPos;
      #include <fog_pars_vertex>
      void main() { waterPos = (modelMatrix * vec4(position, 1.0)).xz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform float island; uniform float brightness;
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform vec2 center;
      varying vec2 waterPos;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = waterPos - center;
        float coast = length(p / vec2(31.0,27.0));
        float a = atan(p.y, p.x);
        coast /= 1.0 + .032 * sin(3.0*a+.7) + .018 * sin(7.0*a);
        float shoal = island * (1.0-smoothstep(.96,1.65,coast));
        float w = sin(p.x*.78 + sin(p.y*.91 + time*.3)) * sin(p.y*.87 - time*.27 + sin(p.x*.5));
        float glint = pow(max(0.0, w), 8.0);
        vec3 color = mix(deep, shallow, shoal*.9);
        color += glint * mix(.045,.15,shoal);
        float ripple = sin(p.x*.27+p.y*.48-time*.7)*.5+.5;
        float rim = island * (1.0-smoothstep(.012,.026,abs(coast-.965 - ripple*.004)));
        color = mix(color,foam,rim*.64) * brightness;
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const water = new THREE.Mesh(
    island ? new THREE.PlaneGeometry(600, 600) : new THREE.CircleGeometry(1, 80),
    material,
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(island ? 1 : 9, island ? 1 : 4.6, 1);
  water.position.set(island ? 0 : -8, island ? -0.38 : 0.15, island ? 0 : -30);
  water.name = island ? 'kame-ocean' : 'wild-waterfall-pool';
  water.userData.cameraBlocker = false;
  root.add(water);
  return material.uniforms;
}

function finishStage(group, id, world, render, sky, water, waterfall, preset) {
  const map = {
    group,
    bounds: { ...ADVENTURE_LAYOUT.bounds },
    preview: {
      distance: 90,
      thumbnail: {
        position: id === 'wild' ? [34, 29, 57] : [29, 25, 44],
        target: id === 'wild' ? [0, 8, -20] : [0, 2, -11],
      },
      center: [0, 5, -15],
      menuRadius: id === 'wild' ? 53 : 50,
      menuHeight: 25,
      menuTarget: [0, 3, -13],
    },
    update(dt) {
      time += dt;
      sky.update(time);
      water.time.value = time;
      if (waterfall) waterfall.offset.y = -time * 0.24;
    },
    applyLighting(preset) {
      sky.applyLighting(preset);
      water.brightness.value = preset === 'moon' ? 0.34 : preset === 'sunset' ? 0.78 : 1;
      if (render?.hemi) {
        render.scene.fog = new THREE.Fog(
          preset === 'moon' ? 0x384f6c : preset === 'sunset' ? 0xe5c49d : 0xb8dfdf,
          id === 'wild' ? 65 : 110,
          240,
        );
        render.hemi.groundColor.set(id === 'wild' ? 0x82956c : 0xc1ac7a);
      }
    },
  };
  let time = 0;
  Object.defineProperty(map, 'applyLighting', { enumerable: false });
  world.enrichDestruction(map, id);
  // Small breakable props sit in the perimeter service lane, never among fighters.
  map.destructibles
    .filter((p) => !p.building && !p.tile)
    .forEach((p, i) => {
      p.mesh.position.set(
        (i % 2 ? 1 : -1) * (19.8 + (i % 3) * 0.35),
        id === 'kame' ? 0.14 : 0.02,
        -10 + Math.floor(i / 2) * 4,
      );
      p.mesh.userData.cameraBlocker = false;
    });
  map.applyLighting(preset);
  group.userData.adventure = {
    id,
    version: 3,
    combatApron: { ...ADVENTURE_LAYOUT.cameraApron },
    lightweightWater: true,
  };
  return map;
}

export function createWildStage({ characters, world, render, lightPreset = 'day' }) {
  const kit = sceneryKit(characters),
    group = new THREE.Group(),
    far = new THREE.Group(),
    rocks = new THREE.Group(),
    vegetation = new THREE.Group(),
    stone = new THREE.Group();
  group.add(terrain(kit, false, world), far, rocks, vegetation, stone);
  far.name = 'wild-layered-mountains';
  stone.name = 'wild-home-terrace';
  const peaks = [
    [-67, -83, 39, 7.5],
    [-44, -70, 48, 8],
    [-19, -90, 52, 9],
    [4, -77, 46, 9],
    [28, -75, 55, 10],
    [56, -86, 42, 9],
    [-31, -47, 27, 7],
    [37, -48, 29, 8],
    [-8, -42, 24, 8],
  ];
  const cliffTexture = world.surfaceTexture('cliff');
  cliffTexture.repeat.set(1, 1);
  peaks.forEach(([x, z, h, r], i) => massif(far, kit, x, z, h, r, i + 7, cliffTexture));
  // Broad foothills connect the column peaks to the forest floor.
  for (let i = 0; i < 10; i++)
    kit.ball(
      far,
      kit.mat(i % 2 ? 0x8eaa74 : 0x789a6c),
      -70 + i * 15,
      1.2,
      -59 + (i % 3) * 5,
      12,
      [1.4, 0.42, 0.9],
    );
  batchScenery(far, 'wild-rock-and-forest-horizon', false, false, true);
  for (let i = 0; i < 30; i++) {
    const x = -57 + (i % 15) * 8,
      z = -36 - Math.floor(i / 15) * 17 - seeded(i) * 4;
    if (x > -18 && x < 2 && z > -42) continue;
    kit.tree(group, x, z, 6.5 + seeded(i + 24) * 4, i, 1.2, true);
  }
  for (const [x, z, h] of [
    [-27, 6, 10],
    [28, 8, 11],
    [-29, -15, 9],
    [29, -15, 10],
    [-24, 19, 8],
    [26, 20, 8],
  ])
    kit.tree(group, x, z, h, Math.abs(x));
  for (let i = 0; i < 44; i++) {
    const a = i * 2.399,
      r = 23 + seeded(i) * 8,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.7;
    if (Math.abs(x) < 21 && z > -14 && z < 14) continue;
    kit.rock(rocks, x, 0.12 + seeded(i) * 0.4, z, 0.7 + seeded(i + 13) * 1.1, i);
  }
  // Stone edging is low and irregular; it cannot obstruct a shoulder camera.
  for (let i = 0; i < 76; i++) {
    const a = (i / 76) * TAU;
    const o = kit.rock(
      rocks,
      Math.cos(a) * (19 + seeded(i) * 0.9),
      -0.13,
      Math.sin(a) * (10.9 + seeded(i) * 0.5),
      0.42 + seeded(i + 36) * 0.24,
      i,
    );
    o.scale.y *= 0.25;
  }
  const [hx, hz] = ADVENTURE_LAYOUT.wild.house;
  kit.ball(stone, kit.mat(0x9d9e86), hx, 0.3, hz, 8, [1.05, 0.16, 0.76]);
  for (let i = 0; i < 6; i++)
    kit.box(stone, kit.mat(0xbcb59a), hx, 0.96 - i * 0.16, hz + 7 + i * 0.48, 2.8, 0.24, 0.57);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++)
      kit.post(
        stone,
        kit.mat(0x886845),
        hx + side * (5 + i * 0.35),
        0.93,
        hz + 5 - i * 1.6,
        0.1,
        1.25,
      );
    kit.rod(
      stone,
      kit.mat(0xb19365),
      [hx + side * 5, 1.36, hz + 5],
      [hx + side * 7.1, 1.36, hz - 4.6],
      0.065,
    );
  }
  adventureHouse(group, kit, world, 'wild', hx, hz);
  kit.ribbon(
    stone,
    kit.mat(0xc9b588),
    [
      [hx, hz + 10],
      [8, -16],
      [4, -13],
    ],
    1.05,
    0.03,
  );
  // The cascade lands on a broken rock shelf, rather than a flattened oval.
  for (let i = 0; i < 3; i++) {
    const ledge = kit.rock(rocks, -12 + i * 4, 4.7 + i * 0.15, -35.2, 3.5, i + 12);
    ledge.scale.y *= 0.55;
    ledge.scale.z *= 0.85;
  }
  const water = animatedWater(group, false),
    waterfall = world.surfaceTexture('water');
  const falling = new THREE.MeshBasicMaterial({
    map: waterfall,
    color: 0xa6e5f2,
    side: THREE.DoubleSide,
  });
  for (const [x, y, z, w, h] of [
    [-8, 15, -34.8, 4.2, 17.5],
    [-8, 3.8, -29.8, 5.8, 6.1],
  ]) {
    const fall = kit.mesh(group, new THREE.PlaneGeometry(w, h, 4, 2), falling, x, y, z);
    fall.name = 'wild-cascading-waterfall';
    fall.castShadow = fall.receiveShadow = false;
    fall.userData.cameraBlocker = false;
    for (let i = 0; i < 6; i++)
      kit.ball(
        rocks,
        kit.mat(0xe2f5e8),
        x - w / 2 + (i * w) / 5,
        y - h / 2 + 0.17,
        z + 0.2,
        0.45,
        [1.5, 0.22, 0.6],
      );
  }
  kit.ribbon(
    stone,
    kit.mat(0x64bdc9),
    [
      [-8, -29],
      [-13, -24],
      [-20, -19],
      [-26, -12],
      [-31, -5],
      [-39, 2],
    ],
    1.65,
    0.14,
  );
  kit.ribbon(
    stone,
    kit.mat(0xb0dbe0),
    [
      [-8.5, -29],
      [-13.5, -24],
      [-20.5, -19],
      [-26.5, -12],
      [-31.5, -5],
      [-39.5, 2],
    ],
    0.12,
    0.15,
  );
  // Split log and stump on the forest verge, outside the central sightlines.
  kit.rod(stone, kit.mat(0x836044), [-24, 0.9, 10], [-29, 1.1, 7], 0.62);
  kit.post(stone, kit.mat(0xb9905a), -24, 0.48, -10, 0.6, 0.9);
  plants(vegetation, kit, false);
  batchScenery(rocks, 'wild-rocks-and-cascade-foam', false, false, true);
  batchScenery(stone, 'wild-terrace-path-and-stream', true, false, true);
  const atmosphere = new THREE.Group();
  atmosphere.name = 'stage-atmosphere-wild';
  group.add(atmosphere);
  const sky = skyAndClouds(atmosphere, characters, 2);
  return finishStage(group, 'wild', world, render, sky, water, waterfall, lightPreset);
}

export function createKameStage({ characters, world, render, lightPreset = 'day' }) {
  const kit = sceneryKit(characters),
    group = new THREE.Group(),
    coast = new THREE.Group(),
    dock = new THREE.Group(),
    vegetation = new THREE.Group(),
    furniture = new THREE.Group();
  group.add(terrain(kit, true, world), coast, dock, vegetation, furniture);
  coast.name = 'kame-rocky-coast';
  dock.name = 'kame-wooden-pier';
  const water = animatedWater(group, true);
  adventureHouse(group, kit, world, 'kame', ...ADVENTURE_LAYOUT.kame.house);
  for (const [x, z, h] of [
    [-14, -25, 10],
    [5, -29, 12],
    [11, -22, 10],
    [-20, -19, 8],
    [19, -23, 9],
    [-25, -8, 9],
  ])
    kit.palm(group, x, z, h, x * 0.07);
  for (let i = 0; i < 27; i++) {
    const a = (i * TAU) / 27 + seeded(i + 201) * 0.09,
      edge = 1 + 0.032 * Math.sin(a * 3 + 0.7) + 0.018 * Math.sin(a * 7),
      x = Math.cos(a) * 29.5 * edge,
      z = -7 + Math.sin(a) * 25.7 * edge;
    if (x > 24 && z > -13 && z < -5) continue;
    const size = 0.5 + seeded(i + 37) * 1.7;
    kit.rock(coast, x, -0.12, z, size, i);
    if (i % 2 === 0) kit.rock(coast, x + 0.8, -0.2, z - 0.9, size * 0.5, i + 2);
    if (i % 3 === 0) kit.rock(coast, x * 1.08, -0.28, -7 + (z + 7) * 1.08, size * 0.65, i + 1);
  }
  const wood = kit.mat(0xae8654),
    dark = kit.mat(0x836440),
    trim = kit.mat(0xd4b480);
  for (let i = 0; i < 27; i++)
    kit.box(dock, i % 3 ? wood : trim, 23.6 + i * 0.52, 0.35, -9, 0.5, 0.19, 3.2);
  for (const z of [-10.1, -7.9]) {
    kit.box(dock, dark, 30.2, 0.08, z, 14.2, 0.24, 0.15);
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 3.2;
      kit.post(dock, dark, x, -0.1, z, 0.17, 2.8);
      kit.post(dock, trim, x, 1.3, z, 0.2, 0.13);
    }
  }
  // A low training bench, blue parasol and mailbox bring life to the house verge.
  kit.box(furniture, wood, -13, 0.64, -18, 2.9, 0.15, 0.8);
  for (const x of [-14.1, -11.9]) kit.box(furniture, dark, x, 0.32, -18, 0.12, 0.64, 0.65);
  kit.box(furniture, trim, -13, 1.1, -18.38, 2.9, 0.8, 0.1);
  kit.post(furniture, trim, -11, 1.5, -21, 0.045, 3);
  const parasol = kit.mesh(
    furniture,
    new THREE.ConeGeometry(1.65, 0.75, 24, 1, true),
    kit.mat(0x599eb9, true),
    -11,
    3.25,
    -21,
  );
  parasol.rotation.y = 0.13;
  kit.post(furniture, wood, 3, 0.9, -18.5, 0.085, 1.65);
  kit.box(furniture, kit.mat(0xc15948), 3, 1.7, -18.5, 0.7, 0.46, 0.6);
  for (let i = 0; i < 10; i++)
    kit.rock(furniture, -4 + Math.sin(i) * 0.2, 0.12, -18 + i * 0.45, 0.32, i);
  plants(vegetation, kit, true);
  batchScenery(coast, 'kame-shore-boulders', false, false, true);
  batchScenery(dock, 'kame-pier-planks', true, false, true);
  batchScenery(furniture, 'kame-house-life-details', true, false, true);
  const atmosphere = new THREE.Group();
  atmosphere.name = 'stage-atmosphere-kame';
  group.add(atmosphere);
  const sky = skyAndClouds(atmosphere, characters, 4);
  return finishStage(group, 'kame', world, render, sky, water, null, lightPreset);
}
