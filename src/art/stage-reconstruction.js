import * as THREE from 'three';
export function register({ art: artModule, characters: charactersModule, world: worldModule }) {
  function artTempleRoof(g, w, d, y, h) {
    const clay = artModule.artMat(0x9b6345),
      edge = artModule.artMat(0x573f30),
      ridge = artModule.artMat(0xc08a5c);
    const v = [],
      uv = [],
      ind = [],
      nx = 48,
      nz = 12;
    for (let z = 0; z <= nz; z++)
      for (let x = 0; x <= nx; x++) {
        const u = (x / nx) * 2 - 1,
          zz = (z / nz - 0.5) * d,
          yy = y + h * Math.pow(1 - Math.abs(u), 0.85) + 0.55 * Math.pow(Math.abs(u), 10);
        v.push((u * w) / 2, yy, zz);
        uv.push(x / nx, z / nz);
        if (x < nx && z < nz) {
          const n = z * (nx + 1) + x;
          ind.push(n, n + nx + 1, n + 1, n + 1, n + nx + 1, n + nx + 2);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(ind);
    geo.computeVertexNormals();
    charactersModule.meshTo(g, geo, clay);
    const soffit = geo.clone();
    soffit.translate(0, -0.1, 0);
    const underside = artModule.artMat(0x78533b);
    underside.side = THREE.BackSide;
    charactersModule.meshTo(g, soffit, underside);
    for (let i = 0; i <= 36; i++) {
      const xx = (i / 36 - 0.5) * w,
        yy =
          y +
          h * Math.pow(1 - Math.abs(xx) / (w / 2), 0.85) +
          0.55 * Math.pow(Math.abs(xx) / (w / 2), 10);
      artModule.artLine(
        g,
        ridge,
        [
          [xx, yy + 0.025, -d / 2],
          [xx, yy + 0.025, d / 2],
        ],
        0.042,
      );
    }
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 32; i++) {
        const u = i / 16 - 1;
        pts.push([
          (u * w) / 2,
          y + h * Math.pow(1 - Math.abs(u), 0.85) + 0.55 * Math.pow(Math.abs(u), 10),
          (s * d) / 2,
        ]);
      }
      artModule.artLine(g, edge, pts, 0.1);
    }
    for (let j = 0; j < 20; j++)
      charactersModule.meshTo(
        g,
        new THREE.CylinderGeometry(0.14, 0.14, (d / 20) * 0.94, 12),
        ridge,
        0,
        y + h + 0.1,
        -d / 2 + ((j + 0.5) * d) / 20,
      ).rotation.x = Math.PI / 2;
  }
  function artPalm(g, x, z, h = 8) {
    const t = new THREE.Group();
    g.add(t);
    t.position.set(x, 0, z);
    const bark = artModule.artMat(0xa08053),
      shadow = artModule.artMat(0x70573c),
      green = artModule.artMat(0x3b8763),
      bright = artModule.artMat(0x65a26b);
    artModule.artLine(
      t,
      bark,
      [
        [0, 0, 0],
        [0.2, h * 0.25, 0],
        [0.58, h * 0.62, 0],
        [0.82, h, 0],
      ],
      0.18,
    );
    for (let i = 0; i < Math.floor(h * 3); i++) {
      const y = i / 3;
      const ring = charactersModule.meshTo(
        t,
        new THREE.TorusGeometry(0.181, 0.014, 5, 12),
        shadow,
        0.82 * Math.pow(y / h, 1.15),
        y,
        0,
      );
      ring.rotation.x = Math.PI / 2;
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push([
          0.82 + Math.cos(a) * u * 4.2,
          h + Math.sin(u * Math.PI) * 0.7 - u * u * 1.9,
          Math.sin(a) * u * 4.2,
        ]);
      }
      artModule.artLine(t, green, pts, 0.035);
      for (let j = 1; j < 10; j++) {
        const u = j / 10,
          base = pts[j];
        for (const s of [-1, 1]) {
          const length = Math.sin(u * Math.PI) * 0.76;
          const verts = [
            ...base,
            base[0] + Math.cos(a) * 0.5 + Math.cos(a + s * 1.57) * length,
            base[1] - 0.2,
            base[2] + Math.sin(a) * 0.5 + Math.sin(a + s * 1.57) * length,
            ...pts[j + 1],
          ];
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          geo.computeVertexNormals();
          const m = k % 2 ? green : bright;
          m.side = THREE.DoubleSide;
          charactersModule.meshTo(t, geo, m);
        }
      }
    }
    for (let i = 0; i < 3; i++)
      charactersModule.ball(t, shadow, 0.65 + i * 0.17, h - 0.24, (i % 2) * 0.17, 0.22);
    return t;
  }
  function artRock(g, x, z, h, r, seed) {
    const mat = artModule.artMat(seed % 2 ? 0xb7a17a : 0xc9b58c),
      strata = artModule.artMat(0x927c5f),
      moss = artModule.artMat(0x779565),
      rings = [];
    for (let j = 0; j <= 14; j++) {
      const u = j / 14,
        rr = r * (0.88 + 0.09 * Math.sin(j * 1.4 + seed)) * (1 - 0.16 * u);
      rings.push([u * h, rr, rr * 0.84]);
    }
    const peak = artModule.artLoft(g, mat, rings, 36, 0.027);
    peak.position.set(x, 0, z);
    charactersModule.ball(g, moss, x, h, z, r * 0.77, [1, 0.23, 0.87]);
    for (let j = 1; j < 8; j++) {
      const pts = [],
        y = (h * j) / 8;
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        pts.push([
          x + Math.cos(a) * r * 0.94,
          y + 0.04 * Math.sin(i * 2 + seed),
          z + Math.sin(a) * r * 0.8,
        ]);
      }
      artModule.artLine(g, strata, pts, 0.022);
    }
    for (let j = 0; j < 3; j++) {
      const a = seed + j * 1.7;
      artModule.artLine(
        g,
        strata,
        [
          [x + Math.sin(a) * r * 0.9, h * 0.24, z + Math.cos(a) * r * 0.81],
          [x + Math.sin(a + 0.12) * r * 0.9, h * 0.44, z + Math.cos(a + 0.12) * r * 0.81],
          [x + Math.sin(a + 0.03) * r * 0.9, h * 0.62, z + Math.cos(a + 0.03) * r * 0.81],
        ],
        0.027,
      );
    }
  }
  function artCrowd(g, x, z, index) {
    const shirt = artModule.artMat([0x677f94, 0xb26956, 0xd6a75c, 0x698d77, 0xc6b4a0][index % 5]),
      skin = artModule.artMat([0xd3a07d, 0xe5b994, 0xb88666][index % 3]),
      dark = artModule.artMat(0x3c3940);
    const a = new THREE.Group();
    a.position.set(x, 0, z);
    a.rotation.y = x > 0 ? -1.5 : 1.5;
    g.add(a);
    artModule.artLoft(
      a,
      shirt,
      [
        [0.55, 0.16, 0.12],
        [0.9, 0.23, 0.14],
        [1.1, 0.18, 0.12],
      ],
      12,
    );
    charactersModule.ball(a, skin, 0, 1.31, 0, 0.18, [0.9, 1.1, 0.9]);
    charactersModule.ball(a, dark, 0, 1.42, -0.02, 0.18, [1, 0.5, 1]);
    for (const s of [-1, 1]) {
      artModule.artLine(
        a,
        shirt,
        [
          [s * 0.18, 1.0, 0],
          [s * 0.26, 0.83, 0.07],
          [s * 0.15, 0.7, 0.15],
        ],
        0.067,
      );
      artModule.artLine(
        a,
        dark,
        [
          [s * 0.09, 0.56, 0],
          [s * 0.1, 0.25, 0.04],
          [s * 0.1, 0.05, 0.06],
        ],
        0.075,
      );
      charactersModule.ball(a, skin, s * 0.15, 0.7, 0.15, 0.065);
    }
  }
  function artStageBudokai() {
    worldModule.daylight();
    const group = new THREE.Group(),
      decor = new THREE.Group();
    group.add(decor);
    const stone = artModule.artMat(0xe4d9bd),
      base = artModule.artMat(0xb6a685),
      sand = artModule.artMat(0xbcbc87),
      cream = artModule.artMat(0xe9d4a3),
      red = artModule.artMat(0xa24e39),
      wood = artModule.artMat(0x684633);
    charactersModule.box(decor, sand, 0, -1.45, 0, 180, 0.3, 150);
    charactersModule.box(decor, base, 0, -0.71, 0, 29, 1.4, 15);
    stone.map = artModule.artTexture('stone');
    for (let x = -14; x < 14; x += 2)
      for (let z = -7; z < 7; z += 2) {
        const tile = charactersModule.box(group, stone, x + 1, -0.035, z + 1, 1.96, 0.07, 1.96);
        tile.name = 'breakable-arena-slab';
      }
    for (const x of [-14.3, 14.3]) charactersModule.box(decor, cream, x, -0.13, 0, 0.28, 0.28, 15);
    for (const z of [-7.3, 7.3]) charactersModule.box(decor, cream, 0, -0.13, z, 29, 0.28, 0.28);
    for (let j = 0; j < 4; j++)
      charactersModule.box(decor, base, 0, -0.21 - j * 0.3, 7.7 + j * 0.5, 5.2, 0.26, 0.53);
    for (const s of [-1, 1])
      for (let j = 0; j < 22; j++) {
        charactersModule.box(decor, wood, s * 14.52, -0.45, -7 + j * 0.66, 0.014, 0.018, 0.62);
        charactersModule.box(decor, wood, s * 14.52, -0.96, -6.7 + j * 0.66, 0.014, 0.018, 0.62);
      }
    const temple = new THREE.Group();
    temple.position.z = -16;
    decor.add(temple);
    charactersModule.box(temple, cream, 0, 2.8, 0, 19, 7, 4);
    charactersModule.box(temple, wood, 0, 1.65, 2.05, 3.2, 4.5, 0.13);
    for (const s of [-1, 1]) {
      for (const x of [3.8, 7.7]) {
        charactersModule.box(temple, red, s * x, 2.7, 2.2, 0.45, 6, 0.5);
        charactersModule.box(temple, wood, s * x, 2.85, 2.08, 2.65, 2.1, 0.1);
        for (let j = 0; j < 8; j++)
          charactersModule.box(
            temple,
            cream,
            s * x - 1.18 + j * 0.34,
            2.85,
            2.18,
            0.045,
            1.95,
            0.035,
          );
        for (let j = 0; j < 4; j++)
          charactersModule.box(temple, cream, s * x, 1.99 + j * 0.56, 2.2, 2.6, 0.045, 0.04);
        charactersModule.box(temple, cream, s * x, -0.1, 2.2, 0.68, 0.42, 0.7);
      }
      const wing = new THREE.Group();
      wing.position.set(s * 13.3, 0, 0.1);
      temple.add(wing);
      charactersModule.box(wing, cream, 0, 1.3, 0, 6, 3.8, 2.8);
      artTempleRoof(wing, 7.5, 4.6, 3.2, 1.5);
    }
    artTempleRoof(temple, 24, 8, 6.3, 3.15);
    charactersModule.box(temple, wood, 0, 5.65, 4.25, 10.9, 2.3, 0.22);
    const sign = worldModule.makeTextTexture('天下一武道会', {
      w: 1536,
      h: 320,
      fontSize: 170,
      bg: '#f3dfaa',
      fg: '#343129',
      border: '#7d4832',
    });
    charactersModule.meshTo(
      temple,
      new THREE.PlaneGeometry(10.4, 1.98),
      new THREE.MeshBasicMaterial({
        map: sign,
      }),
      0,
      5.65,
      4.38,
    );
    for (let j = 0; j < 12; j++)
      charactersModule.box(temple, cream, -1.45 + j * 0.265, 1.65, 2.15, 0.04, 4.3, 0.04);
    for (const s of [-1, 1]) {
      const wall = new THREE.Group();
      wall.position.set(s * 16, 0, -2);
      decor.add(wall);
      charactersModule.box(wall, cream, 0, 0.7, 0, 1.1, 3.4, 24);
      artTempleRoof(wall, 2.8, 25, 2.3, 0.7);
      for (let j = 0; j < 19; j++) {
        charactersModule.box(decor, wood, s * 18, -0.35, -11 + j * 1.25, 0.1, 1.6, 0.1);
        artCrowd(decor, s * (20 + (j % 2) * 0.6), -10 + j * 1.15, j + (s + 1) * 3);
      }
      for (const y of [-0.1, 0.4]) charactersModule.box(decor, wood, s * 18, y, 0, 0.11, 0.07, 24);
      artPalm(decor, s * 20, -22, 10);
      charactersModule.meshTo(
        decor,
        new THREE.CylinderGeometry(0.06, 0.06, 8.8, 12),
        wood,
        s * 12,
        3.2,
        -11.6,
      );
      const tx = worldModule.makeTextTexture('武', {
        w: 256,
        h: 512,
        fontSize: 160,
        bg: '#ede1b9',
        fg: '#263931',
        border: '#9b4935',
      });
      charactersModule.meshTo(
        decor,
        new THREE.PlaneGeometry(1.4, 2.8),
        new THREE.MeshBasicMaterial({
          map: tx,
          side: THREE.DoubleSide,
        }),
        s * 12 + 0.75,
        5.4,
        -11.6,
      );
    }
    for (const x of [-6, 6]) {
      const paper = artModule.artMat(0xe5b868);
      charactersModule.ball(decor, paper, x, 4.7, -12.2, 0.35, [1, 1.3, 1]);
      for (const y of [4.33, 5.07])
        charactersModule.meshTo(
          decor,
          new THREE.CylinderGeometry(0.23, 0.23, 0.07, 16),
          red,
          x,
          y,
          -12.2,
        );
    }
    artModule.artShareMaterials(decor);
    artModule.batchDecoration(decor);
    const move = worldModule.worldClouds(group);
    return worldModule.enrichDestruction(
      {
        group,
        bounds: {
          x: 13.5,
          z: 6,
        },
        update: move,
      },
      'budokai',
    );
  }
  function artStageWild() {
    worldModule.daylight();
    const group = new THREE.Group(),
      decor = new THREE.Group();
    group.add(decor);
    const grass = artModule.artMat(0x87a76e),
      earth = artModule.artMat(0xd0b785),
      leaf = artModule.artMat(0x557f4e),
      wood = artModule.artMat(0x7a6243);
    charactersModule.box(decor, grass, 0, -0.15, 0, 240, 0.2, 240);
    charactersModule.meshTo(
      decor,
      new THREE.CylinderGeometry(17.8, 18, 0.1, 96),
      earth,
      0,
      -0.035,
      0,
      [1, 1, 0.64],
    );
    for (let i = 0; i < 18; i++)
      artRock(decor, -76 + i * 9, -31 - (i % 4) * 11, 11 + ((i * 7) % 20), 3 + (i % 4), i);
    for (const s of [-1, 1])
      for (let j = 0; j < 3; j++)
        artRock(decor, s * (23 + j * 8), 6 + j * 6, 4 + j * 2, 2 + j * 0.3, j + 21);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399,
        r = 26 + (i % 6) * 4,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r * 0.7;
      if (z < -25) continue;
      artModule.artLine(
        decor,
        wood,
        [
          [x, 0, z],
          [x + 0.1, 2.7, z],
          [x - 0.6, 4.5, z],
        ],
        0.19,
      );
      for (let j = 0; j < 4; j++)
        charactersModule.ball(
          decor,
          leaf,
          x + Math.cos(j * 1.7) * 1.1,
          4.4 + Math.sin(j) * 0.55,
          z + Math.sin(j * 1.7),
          1.45,
          [1.3, 0.75, 1],
        );
    }
    for (let i = 0; i < 100; i++) {
      const a = i * 2.399,
        r = 18 + (i % 10) * 1.1,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r * 0.67;
      if (Math.abs(x) < 15 && Math.abs(z) < 7.5) continue;
      for (let j = 0; j < 3; j++) {
        const blade = artModule.artPatch(
          decor,
          j % 2 ? leaf : grass,
          [
            [-0.055, 0],
            [0.03 + j * 0.035, 0.45 + j * 0.09],
            [0.07, 0.08],
          ],
          0.001,
        );
        blade.position.set(x + (j - 1) * 0.11, 0, z);
        blade.rotation.y = a;
      }
    }
    // A small distant mountain dwelling grounds the scene in the early adventure setting.
    const cabin = new THREE.Group();
    cabin.position.set(-24, 0.1, -17);
    cabin.rotation.y = 0.4;
    decor.add(cabin);
    charactersModule.box(cabin, artModule.artMat(0xd7c096), 0, 1.4, 0, 4.4, 2.8, 3.5);
    const roofGroup = new THREE.Group();
    cabin.add(roofGroup);
    artTempleRoof(roofGroup, 5.8, 4.8, 2.75, 1.6);
    charactersModule.box(cabin, wood, 0, 1.05, 1.77, 1.0, 2.1, 0.08);
    artModule.refinedWindow(cabin, 1.35, 1.45, 1.78, 0.8, 0.85);
    for (let i = 0; i < 20; i++) {
      const x = -15 + i * 1.6;
      artModule.artLine(
        decor,
        artModule.artMat(0xb09a6c),
        [
          [x, 0.023, 6.1],
          [x + 0.3, 0.023, 5.98],
          [x + 0.52, 0.023, 6.06],
        ],
        0.007,
      );
    }
    artModule.artShareMaterials(decor);
    artModule.batchDecoration(decor);
    return worldModule.enrichDestruction(
      {
        group,
        bounds: {
          x: 13.5,
          z: 6,
        },
        update: worldModule.worldClouds(group),
      },
      'wild',
    );
  }
  function artStageKame() {
    worldModule.daylight();
    const group = new THREE.Group(),
      decor = new THREE.Group();
    group.add(decor);
    const water = charactersModule.meshTo(
      group,
      new THREE.PlaneGeometry(650, 650),
      new THREE.MeshStandardMaterial({
        color: 0x339eae,
        roughness: 0.4,
        metalness: 0.12,
        normalMap: worldModule.surfaceTexture('normal'),
        normalScale: new THREE.Vector2(0.19, 0.19),
      }),
      0,
      -0.43,
      0,
    );
    water.rotation.x = -Math.PI / 2;
    for (const [r, y, c] of [
      [25, -0.34, 0xd8c58c],
      [24, -0.11, 0xe7d099],
      [23, 0.0, 0xf1dda7],
    ])
      charactersModule.meshTo(
        decor,
        new THREE.CylinderGeometry(r, r + 0.65, 0.19, 96),
        artModule.artMat(c),
        0,
        y,
        -2,
        [1, 1, 0.65],
      );
    charactersModule.meshTo(
      decor,
      new THREE.CylinderGeometry(9, 10, 0.03, 64),
      artModule.artMat(0x9bad6d),
      0,
      0.04,
      -12,
      [1, 1, 0.65],
    );
    const pink = artModule.artMat(0xe6a6a2),
      shade = artModule.artMat(0xc9807e),
      cream = artModule.artMat(0xf6e4c5),
      wood = artModule.artMat(0x78573e),
      red = artModule.artMat(0xa64f3e);
    charactersModule.box(decor, pink, 0, 2.8, -11.5, 8, 5.6, 5);
    const attic = artModule.artPatch(
      decor,
      pink,
      [
        [-2.5, 0],
        [0, 2.8],
        [2.5, 0],
      ],
      8,
    );
    attic.position.set(-4, 5.6, -11.5);
    attic.rotation.y = Math.PI / 2;
    const rg = new THREE.Group();
    rg.position.set(0, 5.6, -11.5);
    rg.rotation.y = Math.PI / 2;
    decor.add(rg);
    worldModule.roof(rg, 0, 0, 0, 6.8, 9.5, 2.8, 0xa95240);
    for (let j = 0; j < 17; j++) {
      const z = -14.75 + j * 0.405,
        yy = 5.6 + 2.8 * (1 - Math.abs(z + 11.5) / 3.4);
      charactersModule.box(decor, red, 0, yy + 0.035, z, 9.45, 0.055, 0.075);
    }
    for (const s of [-1, 1]) {
      charactersModule.box(decor, cream, s * 3.94, 2.8, -8.96, 0.14, 5.6, 0.14);
      charactersModule.box(decor, cream, s * 3.94, 2.8, -14.02, 0.14, 5.6, 0.14);
      const side = new THREE.Group();
      side.position.set(s * 4.05, 0, -11.5);
      side.rotation.y = (s * Math.PI) / 2;
      decor.add(side);
      artModule.refinedWindow(side, 0, 2.8, 0, 1.7, 1.8);
      artModule.refinedWindow(side, 0, 6.58, 0, 0.98, 1.05);
      for (let y = 0.38; y < 5.6; y += 0.34)
        charactersModule.box(side, shade, 0, y, 0, 4.96, 0.012, 0.012);
    }
    for (let y = 0.38; y < 5.6; y += 0.34) {
      charactersModule.box(decor, shade, 0, y, -8.989, 7.9, 0.012, 0.012);
      charactersModule.box(decor, shade, 0, y, -14.011, 7.9, 0.012, 0.012);
    }
    artModule.refinedWindow(decor, -2.4, 2.75, -8.92, 1.65, 1.8);
    artModule.refinedWindow(decor, 2.4, 2.75, -8.92, 1.65, 1.8);
    charactersModule.box(decor, wood, 0, 1.62, -8.9, 1.5, 3.25, 0.1);
    for (const s of [-1, 1])
      charactersModule.box(decor, cream, s * 0.82, 1.67, -8.83, 0.12, 3.4, 0.14);
    charactersModule.box(decor, cream, 0, 3.38, -8.83, 1.77, 0.12, 0.14);
    for (let j = 0; j < 4; j++)
      charactersModule.box(decor, shade, 0, 0.46 + j * 0.75, -8.82, 1.34, 0.024, 0.016);
    charactersModule.ball(decor, artModule.artMat(0xd7bd6c), 0.49, 1.66, -8.78, 0.051);
    for (let j = 0; j < 3; j++)
      charactersModule.box(decor, cream, 0, 0.15 - j * 0.07, -8.6 + j * 0.43, 2.35, 0.17, 0.45);
    const sign = worldModule.makeTextTexture('KAME HOUSE', {
      w: 1024,
      h: 256,
      fontSize: 112,
      bg: '#a95240',
      border: '#a95240',
      fg: '#f9e9cf',
    });
    const label = charactersModule.meshTo(
      decor,
      new THREE.PlaneGeometry(6.2, 1.35),
      new THREE.MeshBasicMaterial({
        map: sign,
      }),
      0,
      6.86,
      -9.48,
    );
    label.rotation.x = -0.88;
    charactersModule.box(decor, cream, 1.35, 7.35, -12.8, 0.68, 1.8, 0.65);
    charactersModule.box(decor, wood, 1.35, 8.28, -12.8, 0.85, 0.16, 0.83);
    for (let j = 0; j < 6; j++)
      charactersModule.box(decor, shade, 1.35, 6.55 + j * 0.28, -12.467, 0.66, 0.018, 0.015);
    artPalm(decor, -6.2, -11, 9);
    artPalm(decor, 8, -12.3, 10);
    artPalm(decor, -13, -5.8, 7.5);
    artModule.seaTurtle(decor, -5.8, -7.8);
    const table = artModule.artMat(0xddd1ae);
    charactersModule.meshTo(
      decor,
      new THREE.CylinderGeometry(0.7, 0.7, 0.09, 32),
      table,
      6.5,
      0.85,
      -7.8,
    );
    charactersModule.meshTo(
      decor,
      new THREE.CylinderGeometry(0.06, 0.1, 0.8, 16),
      wood,
      6.5,
      0.4,
      -7.8,
    );
    for (const s of [-1, 1]) {
      charactersModule.box(decor, cream, 6.5 + s * 1.1, 0.43, -7.8, 0.6, 0.08, 0.62);
      charactersModule.box(decor, cream, 6.5 + s * 1.1, 0.75, -8.1, 0.6, 0.6, 0.06);
      for (const z of [-8.05, -7.56])
        charactersModule.box(decor, wood, 6.5 + s * 1.1, 0.2, z, 0.05, 0.42, 0.05);
    }
    charactersModule.box(decor, cream, 5.3, 0.75, -6, 0.12, 1.5, 0.12);
    charactersModule.box(decor, red, 5.3, 1.53, -6, 0.72, 0.48, 0.55);
    artModule.artDecal(decor, 'POST', 5.3, 1.54, -5.716, 0.55, 0.18, '#f9e9ce');
    const foam = artModule.artMat(0xd8efe2);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2,
        pts = [];
      for (let j = 0; j < 5; j++) {
        const t = a + j * 0.009;
        pts.push([Math.cos(t) * 25.1, -0.32, -2 + Math.sin(t) * 16.35]);
      }
      artModule.artLine(decor, foam, pts, 0.035);
    }
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399;
      charactersModule.ball(
        decor,
        artModule.artMat(i % 2 ? 0xddc694 : 0xe5d4ad),
        Math.cos(a) * (18 + (i % 3)),
        0.04,
        Math.sin(a) * 10,
        0.095,
        [1, 0.3, 0.8],
      );
    }
    artModule.artShareMaterials(decor);
    artModule.batchDecoration(decor);
    const move = worldModule.worldClouds(group);
    let time = 0;
    return worldModule.enrichDestruction(
      {
        group,
        bounds: {
          x: 13.5,
          z: 6,
        },
        update: (dt) => {
          time += dt;
          move(dt);
          water.material.normalMap.offset.set(time * 0.003, time * 0.0015);
        },
      },
      'kame',
    );
  }
  return function initialize() {
    artModule.artStageBuilders = {
      budokai: artStageBudokai,
      wild: artStageWild,
      kame: artStageKame,
    };
    for (const m of worldModule.MAPS) {
      m.build = () => {
        const map = artModule.artStageBuilders[m.id]();
        map.group.name = 'reconstructed-stage-' + m.id;
        map.group.userData.artVersion = artModule.DB_ART_VERSION;
        return map;
      };
    }
    // Art gallery and portraits use the same rebuilt meshes as combat, including all V2 characters.
  };
}
