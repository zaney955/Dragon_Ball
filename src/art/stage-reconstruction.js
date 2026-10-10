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
  function stageRibbon(g, material, points, width, y) {
    const vertices = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x, z] = points[i],
        [nx, nz] = points[i + 1];
      vertices.push(x, y, z - width, x, y, z + width, nx, y, nz - width);
      vertices.push(nx, y, nz - width, x, y, z + width, nx, y, nz + width);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return charactersModule.meshTo(g, geometry, material);
  }
  function stageFlowers(decor, id) {
    const leaf = artModule.artMat(id === 'kame' ? 0x619569 : 0x648652),
      petals = [0xe6ca72, 0xebd7be, 0xc48b87].map((color) => artModule.artMat(color));
    for (let i = 0; i < 68; i++) {
      const angle = i * 2.399,
        radius = 16 + (i % 7) * 0.75,
        x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius * 0.68;
      if (id === 'kame' && z > -6) continue;
      for (let j = 0; j < 3; j++) {
        const blade = artModule.artPatch(
          decor,
          leaf,
          [
            [-0.06, 0],
            [0.11, 0.42 + j * 0.1],
            [0.09, 0],
          ],
          0.001,
        );
        blade.position.set(x + j * 0.1, 0.08, z);
        blade.rotation.y = angle + j;
      }
      if (i % 3 === 0) {
        charactersModule.ball(decor, petals[(i / 3) % 3], x, 0.39, z, 0.09, [1, 0.45, 1]);
        charactersModule.ball(
          decor,
          petals[(i / 3 + 1) % 3],
          x + 0.16,
          0.27,
          z + 0.08,
          0.07,
          [1, 0.45, 1],
        );
      }
    }
  }
  function stageAtmosphere(group, decor, id) {
    const atmosphere = new THREE.Group(),
      updates = [];
    atmosphere.name = 'stage-atmosphere-' + id;
    group.add(atmosphere);
    const wood = artModule.artMat(0x806246),
      stone = artModule.artMat(0xc4b796);
    if (id === 'budokai') {
      for (let x = -27; x <= 27; x += 3)
        for (let z = -9; z <= 12; z += 3) {
          if (Math.abs(x) < 15 && z < 8) continue;
          const paving = charactersModule.box(decor, stone, x, -1.26, z, 2.86, 0.04, 2.86);
          paving.rotation.y = (x + z) % 2 ? 0.012 : -0.012;
        }
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const stall = new THREE.Group();
          stall.position.set(side * (24 + i * 5.5), -1.2, -10 - i * 2);
          decor.add(stall);
          const cloth = artModule.artMat([0xc36c52, 0x5d8d88, 0xd3b465][i]);
          charactersModule.box(stall, wood, 0, 1.05, 0, 3.8, 0.15, 2.2);
          for (const x of [-1.7, 1.7]) charactersModule.box(stall, wood, x, 1.7, 0, 0.1, 3.4, 0.1);
          worldModule.roof(stall, 0, 3, 0, 4.5, 3, 0.65, cloth.color.getHex());
          for (let j = 0; j < 5; j++)
            charactersModule.ball(stall, cloth, -1.35 + j * 0.65, 1.28, 0.2, 0.2, [1, 0.6, 1]);
        }
        artModule.artLine(
          decor,
          wood,
          [
            [side * 12, 7.6, -11.6],
            [side * 6, 6.65, -10.9],
            [0, 6.4, -10.6],
          ],
          0.022,
        );
      }
      for (let i = 0; i < 12; i++) {
        const x = -11 + i * 2,
          flag = artModule.artPatch(
            atmosphere,
            artModule.artMat([0xb95a46, 0xe8c773, 0x648b9b][i % 3]),
            [
              [-0.38, 0],
              [0.38, 0],
              [0, -0.8],
            ],
            0.001,
          );
        flag.material.side = THREE.DoubleSide;
        flag.position.set(x, 6.4 + Math.abs(x) * 0.1, -10.65 - Math.abs(x) * 0.06);
        flag.castShadow = false;
        updates.push((time) => {
          flag.rotation.x = Math.sin(time * 1.7 + i) * 0.16;
        });
      }
      for (const x of [-10, 10]) {
        charactersModule.box(decor, wood, x, 0.8, -10, 2.6, 0.13, 0.85);
        for (const dx of [-1, 1])
          charactersModule.box(decor, wood, x + dx, 0.2, -10, 0.1, 1.1, 0.65);
      }
      const inlay = charactersModule.meshTo(
        decor,
        new THREE.RingGeometry(2.4, 2.43, 64),
        artModule.artMat(0xc4b28c),
        0,
        0.003,
        0,
      );
      inlay.rotation.x = -Math.PI / 2;
    } else if (id === 'wild') {
      stageFlowers(decor, id);
      for (let i = 0; i < 7; i++) {
        const hill = charactersModule.ball(
          decor,
          artModule.artMat(i % 2 ? 0x729b79 : 0x8cad87),
          -54 + i * 18,
          1,
          -55 - (i % 3) * 8,
          12 + (i % 3) * 3,
          [1.6, 0.6, 1],
        );
        hill.castShadow = false;
      }
      const streamMat = new THREE.MeshStandardMaterial({
          color: 0x71bab5,
          roughness: 0.23,
          metalness: 0.14,
          side: THREE.DoubleSide,
        }),
        bank = artModule.artMat(0x9aab86),
        points = Array.from({ length: 35 }, (_, i) => [-34 + i * 2, -18 + Math.sin(i * 0.33) * 2]);
      stageRibbon(decor, bank, points, 2.1, 0.007);
      stageRibbon(atmosphere, streamMat, points, 1.3, 0.025);
      const foam = new THREE.MeshBasicMaterial({
        color: 0xd8eee1,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 16; i++) {
        const ripple = charactersModule.meshTo(
          atmosphere,
          new THREE.PlaneGeometry(0.65 + (i % 3) * 0.22, 0.035),
          foam,
          -29 + i * 4,
          0.035,
          -18 + Math.sin((i * 2 + 2) * 0.33) * 2,
        );
        ripple.rotation.x = -Math.PI / 2;
        ripple.castShadow = false;
        updates.push((time) => {
          ripple.position.x = -29 + i * 4 + Math.sin(time * 0.6 + i) * 0.45;
        });
      }
      artRock(decor, 24, -26, 10, 4.8, 83);
      const falls = charactersModule.meshTo(
        atmosphere,
        new THREE.PlaneGeometry(2.3, 8),
        new THREE.MeshBasicMaterial({
          color: 0xb9e3de,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          side: THREE.DoubleSide,
          map: worldModule.surfaceTexture('water'),
        }),
        24,
        4.3,
        -21.9,
      );
      falls.castShadow = false;
      updates.push((time) => {
        falls.material.map.offset.y = -time * 0.27;
      });
      for (let i = 0; i < 5; i++)
        charactersModule.ball(
          decor,
          artModule.artMat(0xc0c8a8),
          21.8 + i * 0.8,
          0.12,
          -20.8,
          0.4,
          [1.4, 0.45, 1],
        );
      const motes = new Float32Array(48 * 3);
      for (let i = 0; i < 48; i++)
        motes.set([-24 + i * 1.03, 1 + (i % 5) * 0.7, -12 + ((i * 7) % 23)], i * 3);
      const moteGeo = new THREE.BufferGeometry();
      moteGeo.setAttribute('position', new THREE.BufferAttribute(motes, 3));
      const pollen = new THREE.Points(
        moteGeo,
        new THREE.PointsMaterial({
          color: 0xede3b1,
          size: 0.055,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        }),
      );
      atmosphere.add(pollen);
      updates.push((time) => {
        pollen.position.x = Math.sin(time * 0.12) * 1.4;
        pollen.position.y = Math.sin(time * 0.35) * 0.25;
      });
      for (const x of [-18, 18]) {
        charactersModule.box(decor, wood, x, 0.9, 3, 0.13, 1.8, 0.13);
        charactersModule.box(
          decor,
          artModule.artMat(0xc5ae79),
          x,
          1.5,
          3,
          1.2,
          0.45,
          0.12,
        ).rotation.z = x < 0 ? -0.1 : 0.1;
      }
    } else {
      stageFlowers(decor, id);
      const lagoon = charactersModule.meshTo(
        decor,
        new THREE.RingGeometry(25, 35, 96),
        new THREE.MeshBasicMaterial({
          color: 0x65cab9,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        0,
        -0.41,
        -2,
        [1, 0.65, 1],
      );
      lagoon.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const wave = charactersModule.meshTo(
          atmosphere,
          new THREE.RingGeometry(25.2, 25.35, 96),
          new THREE.MeshBasicMaterial({
            color: 0xe3f3e7,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
          0,
          -0.22 + i * 0.006,
          -2,
        );
        wave.rotation.x = -Math.PI / 2;
        wave.castShadow = false;
        updates.push((time) => {
          const phase = (time * 0.12 + i / 3) % 1;
          wave.scale.set(1 + phase * 0.035, 0.65 * (1 + phase * 0.035), 1);
          wave.material.opacity = Math.sin(phase * Math.PI) * 0.4;
        });
      }
      for (let i = 0; i < 22; i++) {
        const x = 16.5 + i * 0.55;
        charactersModule.box(decor, wood, x, 0.04, -6, 0.5, 0.13, 2.1);
        if (i % 5 === 0)
          for (const z of [-7, -5]) charactersModule.box(decor, wood, x, -0.4, z, 0.16, 1.15, 0.16);
      }
      const boat = new THREE.Group();
      boat.position.set(31, -0.1, -3);
      boat.rotation.y = 0.25;
      atmosphere.add(boat);
      charactersModule.meshTo(
        boat,
        new THREE.CylinderGeometry(1.2, 0.6, 0.65, 12),
        artModule.artMat(0x946a47),
        0,
        0,
        0,
        [1.8, 1, 0.65],
      );
      charactersModule.box(boat, wood, 0, 1.8, 0, 0.08, 3.5, 0.08);
      const sail = artModule.artPatch(
        boat,
        artModule.artMat(0xece4c9),
        [
          [0.04, 0.4],
          [0.04, 3.5],
          [1.55, 0.55],
        ],
        0.002,
      );
      sail.material.side = THREE.DoubleSide;
      updates.push((time) => {
        boat.position.y = -0.1 + Math.sin(time * 0.9) * 0.09;
        boat.rotation.z = Math.sin(time * 0.7) * 0.035;
      });
      for (let i = 0; i < 24; i++) {
        const angle = i * 2.399,
          x = Math.cos(angle) * (16 + (i % 5)),
          z = -2 + Math.sin(angle) * 11;
        const shell = charactersModule.meshTo(
          decor,
          new THREE.SphereGeometry(0.11, 8, 5),
          artModule.artMat(i % 2 ? 0xf2e6cd : 0xdca58b),
          x,
          0.1,
          z,
          [1, 0.3, 0.75],
        );
        shell.rotation.y = angle;
      }
      for (const x of [-9, -6]) charactersModule.box(decor, wood, x, 1.5, -12, 0.07, 3, 0.07);
      artModule.artLine(
        decor,
        wood,
        [
          [-9, 2.7, -12],
          [-7.5, 2.5, -12],
          [-6, 2.7, -12],
        ],
        0.014,
      );
      for (let i = 0; i < 3; i++)
        charactersModule.box(
          decor,
          artModule.artMat([0xc47161, 0x87b1ae, 0xe4c579][i]),
          -8.5 + i * 0.8,
          2.12,
          -12,
          0.6,
          0.9,
          0.018,
        );
    }
    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      bird.position.set(-30 + i * 12, 15 + (i % 3), -34 - i * 3);
      atmosphere.add(bird);
      for (const side of [-1, 1]) {
        const wing = artModule.artPatch(
          bird,
          artModule.artMat(0x566d70),
          [
            [0, 0],
            [side * 0.45, 0.08],
            [side * 0.2, -0.1],
          ],
          0.001,
        );
        wing.material.side = THREE.DoubleSide;
        wing.castShadow = false;
        updates.push((time) => {
          wing.rotation.z = side * Math.sin(time * 3.2 + i) * 0.3;
        });
      }
      updates.push((time) => {
        bird.position.x = -30 + i * 12 + Math.sin(time * 0.08 + i) * 8;
      });
    }
    let time = 0;
    return (dt) => {
      time += dt;
      for (const update of updates) update(time);
    };
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
    worldModule.prepareBuilding(temple, 'budokai-hall', { roofY: 6.3 });
    group.add(temple);
    const ambience = stageAtmosphere(group, decor, 'budokai');
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
        update: (dt) => {
          move(dt);
          ambience(dt);
        },
      },
      'budokai',
    );
  }
  function gokuMountainHome(group, decor) {
    const white = artModule.artMat(0xdce3d9),
      blue = artModule.artMat(0x719cb4),
      wood = artModule.artMat(0x827c63),
      timber = artModule.artMat(0x56534b),
      roofMat = artModule.artMat(0x9b9a82),
      red = artModule.artMat(0xa85347);
    const dome = new THREE.Group();
    dome.position.set(-6.7, 0.04, -12.2);
    group.add(dome);
    charactersModule.meshTo(dome, new THREE.CylinderGeometry(3.2, 3.25, 1, 32), white, 0, 0.5, 0);
    charactersModule.meshTo(
      dome,
      new THREE.SphereGeometry(3.25, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      white,
      0,
      1,
      0,
    );
    charactersModule.meshTo(
      dome,
      new THREE.SphereGeometry(3.28, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3.3),
      blue,
      0,
      1,
      0,
    );
    artModule.refinedWindow(dome, -0.9, 1.12, 3.11, 3.35, 0.68);
    const doorway = new THREE.Group();
    doorway.position.set(2.05, 0.04, 2.42);
    doorway.rotation.y = 0.35;
    dome.add(doorway);
    artModule.artPatch(
      doorway,
      blue,
      [
        [-0.68, 0],
        [0.68, 0],
        [0.68, 1.3],
        [0.45, 1.88],
        [0, 2.12],
        [-0.45, 1.88],
        [-0.68, 1.3],
      ],
      0.18,
    );
    const door = artModule.artPatch(
      doorway,
      wood,
      [
        [-0.48, 0],
        [0.48, 0],
        [0.48, 1.25],
        [0.32, 1.7],
        [0, 1.86],
        [-0.32, 1.7],
        [-0.48, 1.25],
      ],
      0.035,
    );
    door.position.z = 0.2;
    for (const x of [-0.25, 0, 0.25])
      charactersModule.box(doorway, timber, x, 0.78, 0.245, 0.018, 1.48, 0.015);
    charactersModule.ball(doorway, artModule.artMat(0xd5b568), 0.3, 0.77, 0.27, 0.045);
    charactersModule.meshTo(
      dome,
      new THREE.CylinderGeometry(0.38, 0.42, 0.6, 16),
      white,
      0.45,
      4.36,
      -0.4,
    );
    charactersModule.meshTo(
      dome,
      new THREE.CylinderGeometry(0.55, 0.55, 0.26, 16),
      blue,
      0.45,
      4.77,
      -0.4,
    );
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      charactersModule.box(
        dome,
        timber,
        0.45 + Math.cos(angle) * 0.5,
        4.77,
        -0.4 + Math.sin(angle) * 0.5,
        0.03,
        0.18,
        0.03,
      );
    }
    for (const side of [-1, 1]) {
      const label = artModule.artDecal(dome, '福', side * 1.4, 2.72, 2.63, 1.0, 1.0, '#ad5549');
      label.rotation.z = side * 0.25;
    }
    worldModule.prepareBuilding(dome, 'goku-dome', { roofY: 3, cellSize: 2.5 });
    for (const [id, x, z, width, height] of [
      ['goku-main-house', -12.3, -14.2, 5.3, 4.2],
      ['goku-side-house', -1.2, -13.4, 4.3, 3.0],
    ]) {
      const house = new THREE.Group();
      house.position.set(x, 0, z);
      group.add(house);
      charactersModule.box(house, white, 0, height / 2, 0, width, height, 4);
      worldModule.roof(house, 0, height, 0, width + 0.65, 4.8, 1.65, roofMat.color.getHex());
      const gable = artModule.artPatch(
        house,
        wood,
        [
          [-width / 2, 0],
          [0, 1.65],
          [width / 2, 0],
        ],
        0.08,
      );
      gable.position.set(0, height, 2.05);
      for (let i = 0; i < 9; i++) {
        const x = (i / 8 - 0.5) * width;
        charactersModule.box(
          house,
          timber,
          x,
          height + (1 - Math.abs(x) / (width / 2)) * 0.75,
          2.12,
          0.055,
          Math.max(0.08, (1 - Math.abs(x) / (width / 2)) * 1.55),
          0.035,
        );
      }
      for (const x of [-width / 2 + 0.12, width / 2 - 0.12])
        charactersModule.box(house, timber, x, height / 2, 2.08, 0.12, height, 0.13);
      artModule.refinedWindow(
        house,
        id === 'goku-main-house' ? -0.8 : 0.95,
        height * 0.55,
        2.12,
        1.35,
        1.4,
      );
      charactersModule.box(
        house,
        wood,
        id === 'goku-main-house' ? 1.1 : -0.9,
        1.1,
        2.08,
        1.15,
        2.2,
        0.12,
      );
      charactersModule.box(house, white, 0.8, height + 1.25, -0.6, 0.65, 1.35, 0.65);
      for (let j = 0; j < 8; j++) {
        const x = (j / 7 - 0.5) * (width + 0.65),
          y = height + 1.65 * (1 - Math.abs(x) / ((width + 0.65) / 2));
        charactersModule.box(house, timber, x, y + 0.04, 0, 0.045, 0.05, 4.9);
      }
      worldModule.prepareBuilding(house, id, { roofY: height, kind: 'wood', cellSize: 2.5 });
    }
    const shrine = new THREE.Group();
    shrine.position.set(-19, 0.03, -11.5);
    group.add(shrine);
    charactersModule.box(shrine, white, 0, 1.3, 0, 2.9, 2.6, 2.9);
    charactersModule.box(shrine, red, 0, 0.6, 0, 2.95, 1.2, 2.95);
    charactersModule.box(shrine, blue, 0, 1.02, 1.5, 1.2, 2.04, 0.08);
    for (const x of [-0.62, 0, 0.62])
      charactersModule.box(shrine, white, x, 1.07, 1.57, 0.05, 2.15, 0.04);
    for (let i = 0; i < 6; i++)
      charactersModule.box(shrine, white, -1.35 + i * 0.54, 0.4, 1.51, 0.025, 0.78, 0.025);
    const navy = artModule.artMat(0x34465f);
    charactersModule.meshTo(
      shrine,
      new THREE.LatheGeometry(
        [
          [2.08, 2.68],
          [1.68, 2.42],
          [1.17, 2.9],
          [0.62, 3.72],
          [0.18, 4.75],
          [0.05, 4.95],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        32,
      ),
      navy,
    );
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      artModule.artLine(
        shrine,
        blue,
        [
          [Math.cos(a) * 2, 2.67, Math.sin(a) * 2],
          [Math.cos(a) * 1.18, 2.95, Math.sin(a) * 1.18],
          [Math.cos(a) * 0.6, 3.8, Math.sin(a) * 0.6],
          [Math.cos(a) * 0.15, 4.77, Math.sin(a) * 0.15],
        ],
        0.02,
      );
    }
    charactersModule.meshTo(
      shrine,
      new THREE.CylinderGeometry(0.06, 0.1, 0.65, 12),
      navy,
      0,
      5.2,
      0,
    );
    charactersModule.ball(shrine, navy, 0, 5.53, 0, 0.13);
    worldModule.prepareBuilding(shrine, 'grandpa-gohan-shrine', { roofY: 2.5, cellSize: 2.5 });
    const well = charactersModule.meshTo(
      decor,
      new THREE.TorusGeometry(0.75, 0.18, 8, 24),
      artModule.artMat(0xb3b8a1),
      -15.5,
      0.2,
      -8.5,
    );
    well.rotation.x = -Math.PI / 2;
    charactersModule.box(decor, wood, -4.4, 0.65, -7.4, 0.08, 1.3, 0.08);
    charactersModule.box(decor, red, -4.4, 1.28, -7.4, 0.65, 0.35, 0.45);
    stageRibbon(
      decor,
      artModule.artMat(0xc9bd91),
      [
        [-0.5, -7],
        [-3, -8],
        [-6.5, -8.6],
        [-11, -9],
        [-16, -9.2],
      ],
      0.95,
      0.023,
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
    grass.map = worldModule.surfaceTexture('grass');
    earth.map = worldModule.surfaceTexture('earth');
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
    gokuMountainHome(group, decor);
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
    const ambience = stageAtmosphere(group, decor, 'wild'),
      move = worldModule.worldClouds(group);
    artModule.artShareMaterials(decor);
    artModule.batchDecoration(decor);
    return worldModule.enrichDestruction(
      {
        group,
        bounds: {
          x: 13.5,
          z: 6,
        },
        update: (dt) => {
          move(dt);
          ambience(dt);
        },
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
    const beachTexture = worldModule.surfaceTexture('sand');
    for (const [r, y, c] of [
      [25, -0.34, 0xd8c58c],
      [24, -0.11, 0xe7d099],
      [23, 0.0, 0xf1dda7],
    ])
      charactersModule.meshTo(
        decor,
        new THREE.CylinderGeometry(r, r + 0.65, 0.19, 96),
        Object.assign(artModule.artMat(c), { map: beachTexture }),
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
    const houseStart = decor.children.length;
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
    const house = new THREE.Group();
    group.add(house);
    for (const child of decor.children.slice(houseStart)) house.add(child);
    worldModule.prepareBuilding(house, 'kame-house', { roofY: 5.6, kind: 'wood' });
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
    const ambience = stageAtmosphere(group, decor, 'kame');
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
          ambience(dt);
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
