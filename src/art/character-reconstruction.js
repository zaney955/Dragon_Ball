import * as THREE from 'three';
export function register({ art: artModule, characters: charactersModule }) {
  let ART_PALETTE, artOriginalOolong;
  artModule.artMat = function artMat(c) {
    return charactersModule.M(c);
  };
  artModule.artLoft = function artLoft(parent, mat, rings, segments = 32, fold = 0) {
    const v = [],
      uv = [],
      idx = [];
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, z = 0] = rings[j];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2,
          f = 1 + fold * Math.sin(a * 7 + j * 0.65) * Math.sin((j / (rings.length - 1)) * Math.PI);
        v.push(Math.cos(a) * rx * f, y, Math.sin(a) * rz * f + z);
        uv.push(i / segments, j / (rings.length - 1));
        if (j < rings.length - 1 && i < segments) {
          const n = j * (segments + 1) + i;
          idx.push(n, n + segments + 1, n + 1, n + 1, n + segments + 1, n + segments + 2);
        }
      }
    }
    if (rings.at(-1)[0] < rings[0][0])
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = t;
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return charactersModule.meshTo(parent, geo, mat);
  };
  artModule.artLine = function artLine(g, m, pts, r = 0.006) {
    return charactersModule.tube(g, m, pts, r);
  };
  artModule.artPatch = function artPatch(g, m, pts, depth = 0.014) {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return charactersModule.meshTo(
      g,
      new THREE.ExtrudeGeometry(s, {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.008,
        bevelThickness: 0.005,
      }),
      m,
    );
  };
  artModule.artDecal = function artDecal(g, text, x, y, z, w, h, color = '#20232d', bg = null) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 256);
    }
    ctx.fillStyle = color;
    ctx.font = '900 135px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 133, 475);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.artText = text;
    const m = new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return charactersModule.meshTo(g, new THREE.PlaneGeometry(w, h), m, x, y, z);
  };
  function artKeepRig(b) {
    const p = b.parts,
      keys = [
        'torsoGroup',
        'head',
        'armL',
        'armR',
        'elbowL',
        'elbowR',
        'foreL',
        'foreR',
        'handL',
        'handR',
        'legL',
        'legR',
        'kneeL',
        'kneeR',
        'footL',
        'footR',
      ];
    const removed = new THREE.Group(),
      replaced = [];
    const keep = new Set([b.root]),
      weapons = new Set();
    for (const k of ['staff', 'axe', 'cane', 'blade', 'wingL', 'wingR', 'cockpit', 'damagePanel'])
      if (p[k]) weapons.add(p[k]);
    for (const k of keys) {
      let o = p[k];
      while (o) {
        keep.add(o);
        o = o.parent;
      }
    }
    for (const w of weapons) {
      let o = w;
      while (o) {
        keep.add(o);
        o = o.parent;
      }
    }
    function clean(o) {
      if (weapons.has(o)) return;
      for (const c of [...o.children]) {
        if (keep.has(c)) clean(c);
        else removed.add(c);
      }
      if (o.isMesh) {
        replaced.push(o.geometry);
        o.geometry = new THREE.BufferGeometry();
      }
    }
    clean(b.root);
    const live = artModule.artResources(b.root);
    artModule.artDisposeResources(artModule.artResources(removed), live);
    for (const geo of replaced) if (!live.geometries.has(geo)) geo.dispose();
    removed.clear();
    p.tail = null;
    p.brows = [];
    p.nose = null;
    p.core = null;
    p.pelvis = null;
    return b;
  }
  function artFaceTexture(id) {
    if (artModule.ART_FACE_TEXTURES.has(id)) return artModule.ART_FACE_TEXTURES.get(id);
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 768;
    const k = c.getContext('2d'),
      child = ['goku', 'krillin', 'chichi', 'chiaotzu', 'oolong', 'pilaf'].includes(id),
      female = ['chichi', 'bulma'].includes(id);
    k.lineCap = 'round';
    k.lineJoin = 'round';
    const path = (pts, fill, stroke = '#242634', lw = 13) => {
      k.beginPath();
      k.moveTo(...pts[0]);
      for (let i = 1; i < pts.length; i++) k.lineTo(...pts[i]);
      k.closePath();
      if (fill) {
        k.fillStyle = fill;
        k.fill();
      }
      if (stroke) {
        k.strokeStyle = stroke;
        k.lineWidth = lw;
        k.stroke();
      }
    };
    if (id === 'korin') {
      for (const s of [-1, 1]) {
        k.strokeStyle = '#544b43';
        k.lineWidth = 13;
        k.beginPath();
        k.moveTo(384 + s * 72, 340);
        k.quadraticCurveTo(384 + s * 154, 380, 384 + s * 235, 330);
        k.stroke();
      }
      k.fillStyle = '#967062';
      k.beginPath();
      k.ellipse(384, 449, 34, 23, 0, 0, 7);
      k.fill();
      k.strokeStyle = '#655345';
      k.lineWidth = 8;
      k.beginPath();
      k.moveTo(384, 470);
      k.lineTo(384, 514);
      k.quadraticCurveTo(330, 550, 295, 509);
      k.moveTo(384, 514);
      k.quadraticCurveTo(440, 550, 472, 509);
      k.stroke();
    } else {
      for (const s of [-1, 1]) {
        k.save();
        k.translate(384, 0);
        k.scale(s, 1);
        const fierce = ['piccolo', 'taopaipai', 'tien', 'yamcha'].includes(id),
          top = child ? 261 : fierce ? 304 : 286,
          bot = child ? 413 : fierce ? 376 : 387;
        path(
          [
            [47, top + 26],
            [94, top + (fierce ? 14 : 0)],
            [228, top + (fierce ? -13 : 10)],
            [238, bot - 8],
            [113, bot],
            [61, bot - 18],
          ],
          '#fffaf0',
          '#302932',
          female ? 11 : 8,
        );
        k.fillStyle = female ? '#286b86' : '#202530';
        k.beginPath();
        k.ellipse(132, child ? 340 : 340, female ? 40 : child ? 35 : 27, child ? 66 : 45, 0, 0, 7);
        k.fill();
        if (female) {
          k.fillStyle = '#151f2a';
          k.beginPath();
          k.ellipse(132, 335, 22, 39, 0, 0, 7);
          k.fill();
        }
        k.fillStyle = '#ffffff';
        k.beginPath();
        k.ellipse(121, 315, 10, 15, 0, 0, 7);
        k.fill();
        path(
          [
            [42, top - 12],
            [100, top - 49],
            [232, top - 27],
            [236, top - 8],
            [113, top - 24],
            [51, top + 3],
          ],
          id === 'roshi' ? '#fff4db' : '#292b32',
          null,
        );
        if (female) {
          k.strokeStyle = '#242732';
          k.lineWidth = 11;
          k.beginPath();
          k.moveTo(223, top + 11);
          k.lineTo(248, top - 7);
          k.moveTo(216, top + 7);
          k.lineTo(232, top - 18);
          k.stroke();
        }
        if (id === 'chiaotzu') {
          k.fillStyle = '#bd4244';
          k.beginPath();
          k.ellipse(224, 465, 62, 63, 0, 0, 7);
          k.fill();
        }
        k.restore();
      }
      k.strokeStyle = '#895442';
      k.lineWidth = 6;
      k.beginPath();
      if (!['krillin', 'chiaotzu', 'oolong'].includes(id)) {
        k.moveTo(392, 388);
        k.lineTo(375, 453);
        k.lineTo(403, 456);
      }
      k.stroke();
      k.strokeStyle = '#5e3934';
      k.lineWidth = 8;
      k.beginPath();
      k.moveTo(319, 548);
      k.quadraticCurveTo(379, ['piccolo', 'taopaipai', 'tien'].includes(id) ? 541 : 565, 444, 539);
      k.stroke();
      if (id === 'piccolo') {
        for (const s of [-1, 1]) {
          k.beginPath();
          k.moveTo(384 + s * 91, 420);
          k.lineTo(384 + s * 190, 445);
          k.moveTo(384 + s * 118, 454);
          k.lineTo(384 + s * 211, 478);
          k.stroke();
        }
        path(
          [
            [323, 546],
            [342, 549],
            [331, 570],
          ],
          '#fff9df',
          null,
        );
        path(
          [
            [414, 544],
            [431, 540],
            [423, 565],
          ],
          '#fff9df',
          null,
        );
      }
      if (id === 'krillin') {
        k.fillStyle = '#764d37';
        for (let y = 0; y < 3; y++)
          for (const s of [-1, 1]) {
            k.beginPath();
            k.ellipse(384 + s * 39, 126 + y * 43, 12, 14, 0, 0, 7);
            k.fill();
          }
      }
      if (id === 'tien') {
        k.fillStyle = '#fff9e4';
        k.strokeStyle = '#44352f';
        k.lineWidth = 7;
        k.beginPath();
        k.ellipse(384, 153, 35, 65, 0, 0, 7);
        k.fill();
        k.stroke();
        k.fillStyle = '#202832';
        k.beginPath();
        k.ellipse(384, 159, 18, 36, 0, 0, 7);
        k.fill();
      }
      if (id === 'roshi') {
        k.strokeStyle = '#bc9070';
        k.lineWidth = 6;
        for (let j = 0; j < 3; j++) {
          k.beginPath();
          k.moveTo(294, 135 + j * 26);
          k.quadraticCurveTo(384, 114 + j * 25, 476, 134 + j * 26);
          k.stroke();
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.artShared = true;
    artModule.ART_FACE_TEXTURES.set(id, t);
    return t;
  }
  artModule.artHead = function artHead(p, id, r, skin) {
    const child = ['goku', 'krillin', 'chiaotzu', 'oolong'].includes(id),
      cat = id === 'korin';
    const skullGeo = new THREE.SphereGeometry(r, 48, 32),
      pos = skullGeo.attributes.position;
    function sculpt(x, y, z) {
      const n = y / r;
      const jaw = n < -0.12 ? 1 - (child ? 0.12 : 0.24) * Math.min(1, (-n - 0.12) / 0.7) : 1;
      return [
        x * jaw * (cat ? 1.12 : 1),
        y * (child ? 1 : 1.12),
        z * (cat ? 0.88 : 0.9) + (z > 0 ? 0.028 * r * (1 - n * n) : 0),
      ];
    }
    for (let i = 0; i < pos.count; i++)
      pos.setXYZ(i, ...sculpt(pos.getX(i), pos.getY(i), pos.getZ(i)));
    skullGeo.computeVertexNormals();
    p.skull = charactersModule.meshTo(p.head, skullGeo, skin);
    p.skull.name = id + '-sculpted-jaw-cheeks';
    const v = [],
      uv = [],
      idx = [],
      nu = 32,
      nv = 32;
    for (let j = 0; j <= nv; j++)
      for (let i = 0; i <= nu; i++) {
        const a = (i / nu - 0.5) * 2.04,
          b = (j / nv - 0.5) * 1.96,
          x = Math.sin(a) * Math.cos(b) * r,
          y = Math.sin(b) * r,
          z = Math.cos(a) * Math.cos(b) * r;
        const pt = sculpt(x, y, z);
        pt[2] += 0.0025;
        v.push(...pt);
        uv.push(i / nu, j / nv);
        if (i < nu && j < nv) {
          const n = j * (nu + 1) + i;
          idx.push(n, n + 1, n + nu + 1, n + 1, n + nu + 2, n + nu + 1);
        }
      }
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    faceGeo.setIndex(idx);
    faceGeo.computeVertexNormals();
    charactersModule.meshTo(
      p.head,
      faceGeo,
      new THREE.MeshBasicMaterial({
        map: artFaceTexture(id),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    ).name = id + '-drawn-expression';
    if (!['korin', 'oolong', 'piccolo'].includes(id))
      for (const s of [-1, 1]) {
        charactersModule.ball(p.head, skin, s * r * 0.97, -r * 0.05, 0, r * 0.22, [0.5, 1, 0.62]);
        artModule.artLine(
          p.head,
          artModule.artMat(0xb0785e),
          [
            [s * r * 1.02, r * 0.06, r * 0.03],
            [s * r * 1.08, -r * 0.035, r * 0.07],
            [s * r * 1.02, -r * 0.15, r * 0.04],
          ],
          r * 0.025,
        );
      }
    if (!['krillin', 'chiaotzu', 'korin', 'oolong'].includes(id))
      p.nose = charactersModule.ball(
        p.head,
        skin,
        0,
        -r * 0.14,
        r * 0.915,
        r * 0.1,
        [0.68, 1.05, 1.35],
      );
    return r;
  };
  function artHair(g, id, r) {
    const ink = artModule.artMat(0x1c2330),
      shine = artModule.artMat(0x354052),
      scale = r / 0.3;
    const h = new THREE.Group();
    g.add(h);
    h.scale.setScalar(scale);
    h.name = id + '-sculpted-hair';
    if (id === 'goku') {
      charactersModule.ball(h, ink, 0, 0.13, -0.06, 0.305, [1, 0.78, 0.95]);
      const locks = [
        [-0.18, 0.13, 0.015, -0.56, 0.33, 0.015, 0.15],
        [-0.15, 0.23, -0.04, -0.4, 0.65, -0.045, 0.165],
        [-0.015, 0.27, -0.06, -0.03, 0.64, -0.21, 0.16],
        [0.13, 0.21, -0.08, 0.43, 0.52, -0.1, 0.175],
        [0.22, 0.065, -0.1, 0.58, 0.22, -0.12, 0.155],
        [0.16, -0.03, -0.19, 0.43, -0.13, -0.27, 0.14],
        [-0.06, 0.08, -0.22, -0.23, 0.28, -0.53, 0.18],
        [0.06, 0.01, -0.23, 0.16, 0.0, -0.53, 0.16],
        [-0.12, 0.24, 0.16, -0.21, 0.065, 0.27, 0.085],
        [0.025, 0.27, 0.2, -0.07, 0.09, 0.3, 0.08],
        [0.15, 0.22, 0.15, 0.21, 0.09, 0.25, 0.08],
      ];
      for (const a of locks) artModule.hairLock(h, ink, a.slice(0, 3), a.slice(3, 6), a[6]);
      artModule.artLine(
        h,
        shine,
        [
          [-0.19, 0.25, 0.1],
          [-0.3, 0.39, 0.085],
          [-0.36, 0.51, 0.055],
        ],
        0.007,
      );
    } else if (id === 'yamcha') {
      charactersModule.ball(h, ink, 0, 0.12, -0.04, 0.3, [1.08, 0.8, 1]);
      for (const s of [-1, 1])
        for (let i = 0; i < 5; i++)
          artModule.hairLock(
            h,
            ink,
            [s * (0.08 + i * 0.025), 0.24 - i * 0.045, -0.03 - i * 0.037],
            [s * (0.26 + i * 0.014), 0.34 - i * 0.19, -0.08 - i * 0.033],
            0.11,
          );
      for (let i = 0; i < 6; i++)
        artModule.hairLock(
          h,
          ink,
          [(i - 2.5) * 0.068, 0.02, -0.23],
          [(i - 2.5) * 0.083, -0.53 + Math.abs(i - 2.5) * 0.075, -0.24],
          0.115,
        );
      for (const s of [-1, 1])
        artModule.hairLock(h, ink, [s * 0.075, 0.24, 0.2], [s * 0.22, 0.03, 0.23], 0.1);
    } else if (id === 'bulma') {
      const turquoise = artModule.artMat(0x42a8ab),
        shade = artModule.artMat(0x25808d);
      charactersModule.ball(h, turquoise, 0, 0.12, -0.065, 0.302, [1.06, 0.85, 1]);
      for (let i = 0; i < 6; i++)
        artModule.hairLock(
          h,
          turquoise,
          [-0.19 + i * 0.073, 0.22, 0.13],
          [-0.14 + i * 0.068, 0.045 + (i % 2) * 0.03, 0.285],
          0.075,
        );
      for (const s of [-1, 1])
        artModule.hairLock(h, turquoise, [s * 0.24, 0.14, -0.045], [s * 0.29, -0.26, -0.02], 0.12);
      const backcap = charactersModule.meshTo(
        h,
        new THREE.SphereGeometry(0.3, 32, 24, Math.PI, Math.PI, 0, Math.PI * 0.76),
        turquoise,
        0,
        0.03,
        -0.055,
      );
      backcap.name = 'full-back-hair-cap';
      for (let i = 0; i < 9; i++) {
        charactersModule.ball(
          h,
          i % 2 ? turquoise : shade,
          0.235 + Math.sin(i * 2.7) * 0.014,
          -0.17 - i * 0.05,
          -0.19,
          0.06,
          [1, 1, 0.85],
        );
      }
      charactersModule.ball(h, artModule.artMat(0xc13b55), 0.235, -0.59, -0.19, 0.058, [1, 0.5, 1]);
      const bow = artModule.artMat(0xc83e55);
      for (const s of [-1, 1]) {
        const l = charactersModule.ball(
          h,
          bow,
          0.15 + s * 0.077,
          0.32,
          0.02,
          0.085,
          [1, 0.75, 0.3],
        );
        l.rotation.z = s * 0.35;
      }
      charactersModule.ball(h, bow, 0.15, 0.31, 0.04, 0.037);
    } else if (id === 'taopaipai') {
      charactersModule.ball(h, ink, 0, 0.12, -0.1, 0.278, [1, 0.78, 0.87]);
      artModule.artLine(
        h,
        ink,
        [
          [-0.25, 0.055, 0.03],
          [-0.19, 0.08, 0.18],
          [0, 0.19, 0.22],
          [0.19, 0.08, 0.18],
          [0.25, 0.055, 0.03],
        ],
        0.025,
      );
      for (let strand = 0; strand < 3; strand++) {
        const pts = [];
        for (let i = 0; i <= 36; i++) {
          const t = i / 36,
            a = t * 38 + strand * 2.094;
          pts.push([0.04 + Math.sin(a) * 0.024, 0.035 - t * 1.3, -0.285 + Math.cos(a) * 0.024]);
        }
        artModule.artLine(h, ink, pts, 0.019);
      }
      charactersModule.ball(h, artModule.artMat(0xce5d7c), 0.04, -1.23, -0.285, 0.045, [1, 0.7, 1]);
    }
    return h;
  }
  function artClothes(p, id, d, pal) {
    const skin = artModule.artMat(pal[0]),
      cloth = artModule.artMat(pal[1]),
      accent = artModule.artMat(pal[2]),
      shoe = artModule.artMat(pal[3]),
      ink = artModule.artMat(0x493d36),
      old = !p.anatomy;
    const w = d.torsoR,
      top = d.armY + 0.04,
      base = old ? -0.16 : -0.19,
      h = top - base;
    const bare = ['tien', 'gyumao'].includes(id),
      robe = id === 'taopaipai',
      cat = id === 'korin',
      mech = id === 'pilaf';
    if (mech) return;
    const rings = [
      [base, 0, 0],
      [base + 0.015, w * 0.78, w * 0.6],
      [base + h * 0.2, w * 0.85, w * 0.64],
      [base + h * 0.45, w * 0.94, w * 0.7],
      [base + h * 0.7, w * 1.08, w * 0.73],
      [top - 0.02, w * 0.99, w * 0.65],
      [top + 0.055, w * 0.55, w * 0.43],
      [top + 0.06, 0, 0],
    ];
    if (cat || id === 'oolong' || id === 'gyumao') {
      const fat = id === 'gyumao' ? 1.2 : 1.24;
      for (const j of [2, 3, 4]) {
        rings[j][1] *= fat;
        rings[j][2] *= 1.25;
      }
      rings[3][3] = w * 0.1;
    }
    artModule.artLoft(p.torsoGroup, cloth, rings, 40, bare ? 0 : 0.026).name =
      id + '-tailored-torso';
    p.pelvis = charactersModule.ball(
      p.torsoGroup,
      ['roshi', 'tien', 'taopaipai', 'chiaotzu', 'gyumao'].includes(id) ? accent : cloth,
      0,
      old ? -0.285 : -0.19,
      0,
      w * 0.88,
      [1, 0.65, 0.78],
    );
    charactersModule.ball(
      p.torsoGroup,
      skin,
      0,
      d.neck - d.headR * 0.92,
      0,
      d.headR * 0.27,
      [1, 1.6, 1],
    );
    if (bare) {
      for (const s of [-1, 1]) {
        charactersModule.ball(
          p.torsoGroup,
          skin,
          s * w * 0.45,
          top - 0.1,
          w * 0.44,
          w * 0.51,
          [1, 0.7, 0.48],
        );
        artModule.artLine(
          p.torsoGroup,
          artModule.artMat(id === 'tien' ? 0xc78d6b : 0xc1895b),
          [
            [s * w * 0.14, top - 0.2, w * 0.69],
            [s * w * 0.63, top - 0.24, w * 0.68],
            [s * w * 0.82, top - 0.2, w * 0.55],
          ],
          0.007,
        );
      }
      if (id === 'tien')
        for (let j = 0; j < 2; j++)
          for (const s of [-1, 1])
            charactersModule.ball(
              p.torsoGroup,
              skin,
              s * 0.075,
              0.1 - j * 0.1,
              0.198,
              0.085,
              [1, 0.7, 0.4],
            );
    }
    const gi = ['goku', 'krillin', 'yamcha'].includes(id);
    if (gi) {
      for (const s of [-1, 1]) {
        const panel = artModule.artPatch(
          p.torsoGroup,
          cloth,
          [
            [s * 0.035, top - 0.25],
            [s * w * 0.7, top + 0.015],
            [s * w * 0.38, top + 0.07],
            [0, top - 0.2],
          ],
          0.018,
        );
        panel.position.z = w * 0.73;
        artModule.artLine(
          p.torsoGroup,
          accent,
          [
            [s * w * 0.45, top + 0.035, w * 0.61],
            [s * w * 0.25, top - 0.09, w * 0.79],
            [s * 0.025, top - 0.21, w * 0.78],
          ],
          0.017,
        );
      }
      charactersModule.badge(
        p.torsoGroup,
        id === 'yamcha' ? '樂' : '亀',
        gi && id !== 'yamcha' ? -w * 0.48 : 0,
        top - 0.19,
        w * 0.75 + 0.02,
        id === 'yamcha' ? 0.13 : 0.073,
        false,
        '#ffebc7',
      );
      if (id !== 'yamcha')
        charactersModule.badge(p.torsoGroup, '亀', 0, top - 0.2, -w * 0.74, 0.175, true);
    }
    if (!cat) {
      const beltY = base + 0.08;
      const b = artModule.artLoft(
        p.torsoGroup,
        accent,
        [
          [beltY - 0.055, w * 0.83, w * 0.66],
          [beltY + 0.055, w * 0.84, w * 0.67],
        ],
        32,
        0,
      );
      b.name = 'woven-waistband';
      if (gi || id === 'tien' || id === 'piccolo') {
        charactersModule.ball(p.torsoGroup, accent, 0.05, beltY, w * 0.7, 0.06, [1.25, 0.8, 0.55]);
        for (const s of [-1, 1])
          artModule.artLine(
            p.torsoGroup,
            accent,
            [
              [0.04, beltY - 0.015, w * 0.72],
              [s * 0.1, beltY - 0.16, w * 0.77],
              [s * 0.13, beltY - 0.31, w * 0.68],
            ],
            0.025,
          );
      }
    }
    for (const side of ['L', 'R']) {
      const sign = side === 'L' ? -1 : 1,
        upper = d.upper,
        fore = d.fore,
        arm = p['arm' + side],
        elbow = p['elbow' + side],
        hand = p['hand' + side],
        leg = p['leg' + side],
        knee = p['knee' + side],
        ar = d.armR;
      const sleeves = ['roshi', 'taopaipai', 'bulma', 'chiaotzu', 'oolong'].includes(id),
        r = ar * (bare ? 1.08 : 1);
      artModule.artLoft(
        arm,
        sleeves ? cloth : skin,
        [
          [0.03, 0, 0],
          [0.01, r * 0.83, r * 0.9],
          [-upper * 0.2, r * 1.18, r * 1.12],
          [-upper * 0.52, r * 1.1, r],
          [-upper * 0.88, r * 0.83, r * 0.87],
          [-upper, r * 0.75, r * 0.78],
        ],
        24,
        sleeves ? 0.035 : 0,
      );
      artModule.artLoft(
        elbow,
        id === 'taopaipai' ? cloth : skin,
        [
          [0.015, ar * 0.76, ar * 0.76],
          [-fore * 0.2, ar * 0.93, ar * 0.91],
          [-fore * 0.53, ar * 0.84, ar * 0.76],
          [-fore * 0.91, ar * 0.65, ar * 0.6],
          [-fore, ar * 0.55, ar * 0.54],
        ],
        24,
        0,
      );
      if (sleeves && id !== 'taopaipai') {
        const cuff = charactersModule.meshTo(
          arm,
          new THREE.CylinderGeometry(ar * 1.12, ar * 1.06, 0.045, 24),
          accent,
          0,
          -upper * 0.73,
          0,
        );
        cuff.name = 'turned-sleeve-hem';
      }
      if (gi || ['tien', 'piccolo', 'taopaipai', 'chichi'].includes(id)) {
        charactersModule.meshTo(
          elbow,
          new THREE.CylinderGeometry(ar * 0.82, ar * 0.76, fore * 0.27, 24),
          id === 'tien' ? artModule.artMat(0xf5e8cc) : accent,
          0,
          -fore * 0.79,
          0,
        );
      }
      const hr = d.handR;
      charactersModule.ball(hand, skin, 0, -hr * 0.12, 0, hr, [0.88, 0.95, 0.62]);
      for (let j = 0; j < 4; j++) {
        const x = (j - 1.5) * hr * 0.38;
        charactersModule.ball(hand, skin, x, -hr * 0.7, 0.018, hr * 0.29, [0.7, 1.15, 1]);
        artModule.artLine(
          hand,
          ink,
          [
            [x - hr * 0.11, -hr * 0.6, hr * 0.28],
            [x + hr * 0.11, -hr * 0.6, hr * 0.31],
          ],
          0.0028,
        );
      }
      charactersModule.ball(
        hand,
        skin,
        sign * hr * 0.79,
        -hr * 0.03,
        hr * 0.17,
        hr * 0.36,
        [0.6, 1.3, 0.8],
      );
      const lr = d.legR,
        tr = d.thigh,
        sr = d.shin,
        legmat = ['bulma', 'chichi'].includes(id)
          ? skin
          : cat
            ? skin
            : id === 'piccolo'
              ? cloth
              : gi
                ? cloth
                : [
                      'roshi',
                      'taopaipai',
                      'chiaotzu',
                      'tien',
                      'piccolo',
                      'gyumao',
                      'oolong',
                    ].includes(id)
                  ? accent
                  : cloth;
      artModule.artLoft(
        leg,
        legmat,
        [
          [0.045, 0, 0],
          [0.01, lr * 0.98, lr * 0.91],
          [-tr * 0.2, lr * 1.1, lr],
          [-tr * 0.5, lr * 1.05, lr * 0.96],
          [-tr * 0.8, lr * 0.8, lr * 0.76],
          [-tr, lr * 0.72, lr * 0.68],
        ],
        28,
        0.04,
      );
      artModule.artLoft(
        knee,
        legmat,
        [
          [0.035, lr * 0.72, lr * 0.69],
          [-sr * 0.2, lr * 0.82, lr * 0.79],
          [-sr * 0.45, lr * 0.8, lr * 0.72],
          [-sr * 0.75, lr * 0.61, lr * 0.59],
          [-sr * 0.9, lr * 0.59, lr * 0.57],
        ],
        28,
        0.035,
      );
      const fy = old ? -0.395 : -sr,
        bootH = ['bulma', 'chichi'].includes(id) ? sr * 0.72 : 0.13;
      charactersModule.meshTo(
        knee,
        new THREE.CylinderGeometry(lr * 0.76, lr * 0.78, bootH, 24),
        shoe,
        0,
        fy + bootH * 0.49,
        0,
      );
      charactersModule.ball(knee, shoe, 0, fy, 0.055, lr, [1, 0.44, 1.65]);
      charactersModule.ball(
        knee,
        artModule.artMat(cat ? 0xcfc9b9 : 0x292c32),
        0,
        fy - lr * 0.27,
        0.06,
        lr,
        [1.03, 0.1, 1.68],
      );
      if (!cat)
        for (let j = 0; j < 3; j++)
          artModule.artLine(
            knee,
            artModule.artMat(0xe4d4ae),
            [
              [-lr * 0.47, fy + bootH * 0.4 + j * 0.028, lr * 0.74],
              [0, fy + bootH * 0.48 + j * 0.028, lr * 0.84],
              [lr * 0.47, fy + bootH * 0.4 + j * 0.028, lr * 0.74],
            ],
            0.005,
          );
      if (gi || id === 'tien' || robe) {
        for (let j = 0; j < 3; j++)
          artModule.artLine(
            leg,
            artModule.artMat(id === 'tien' ? 0x286746 : 0xa65537),
            [
              [sign * lr * 0.36, -tr * (0.16 + j * 0.17), lr * 0.93],
              [sign * lr * 0.58, -tr * (0.2 + j * 0.17), lr * 0.85],
              [sign * lr * 0.64, -tr * (0.26 + j * 0.17), lr * 0.74],
            ],
            0.004,
          );
      }
    }
    if (robe) {
      const hem = artModule.artLoft(
        p.torsoGroup,
        cloth,
        [
          [-0.48, w * 0.94, w * 0.72],
          [-0.35, w * 0.95, w * 0.71],
          [-0.16, w * 0.88, w * 0.68],
          [0.02, w * 0.87, w * 0.67],
        ],
        36,
        0.025,
      );
      hem.name = 'split-mandarin-tunic';
      artModule.artLine(
        p.torsoGroup,
        accent,
        [
          [0, -0.46, w * 0.735],
          [0, 0.36, w * 0.74],
        ],
        0.007,
      );
      for (let j = 0; j < 4; j++) {
        const y = 0.1 + j * 0.09;
        artModule.artLine(
          p.torsoGroup,
          accent,
          [
            [-0.08, y, w * 0.74],
            [-0.04, y + 0.015, w * 0.76],
            [0.06, y, w * 0.75],
          ],
          0.008,
        );
        charactersModule.ball(p.torsoGroup, accent, 0.035, y, w * 0.78, 0.014);
      }
      charactersModule.badge(p.torsoGroup, '殺', 0, 0.21, -w * 0.76, 0.17, true, '#e77d9d');
    }
    if (id === 'bulma') {
      artModule.artLoft(
        p.torsoGroup,
        cloth,
        [
          [-0.43, 0.36, 0.26],
          [-0.35, 0.34, 0.25],
          [-0.1, 0.255, 0.2],
          [0.02, 0.23, 0.185],
        ],
        40,
        0.035,
      );
      artModule.artDecal(p.torsoGroup, 'BULMA', 0, 0.25, 0.216, 0.39, 0.15, '#623445');
      for (const s of [-1, 1]) {
        charactersModule.box(p.torsoGroup, cloth, s * 0.135, -0.25, 0.246, 0.14, 0.13, 0.018);
        artModule.artLine(
          p.torsoGroup,
          accent,
          [
            [s * 0.135 - 0.07, -0.2, 0.261],
            [s * 0.135 + 0.07, -0.2, 0.261],
          ],
          0.005,
        );
      }
      charactersModule.box(
        p.torsoGroup,
        artModule.artMat(0xb08346),
        0.18,
        -0.08,
        0.24,
        0.12,
        0.2,
        0.07,
      );
      for (let i = 0; i < 3; i++)
        charactersModule.meshTo(
          p.torsoGroup,
          new THREE.CapsuleGeometry(0.018, 0.08, 3, 8),
          artModule.artMat(0xeee8da),
          0.14 + i * 0.038,
          -0.09,
          0.285,
        );
    }
    if (id === 'chichi') {
      for (const s of [-1, 1]) {
        const shoulder = charactersModule.ball(
          p['arm' + (s < 0 ? 'L' : 'R')],
          cloth,
          0,
          0.01,
          0,
          0.11,
          [1, 0.75, 1],
        );
        shoulder.name = 'helmet-set-pauldron';
      }
      artModule.artLoft(
        p.torsoGroup,
        accent,
        [
          [-0.26, 0.26, 0.18],
          [-0.1, 0.22, 0.16],
          [0.0, 0.21, 0.15],
        ],
        32,
        0.025,
      );
    }
    if (id === 'chiaotzu') {
      charactersModule.box(
        p.torsoGroup,
        artModule.artMat(0xf0e3c6),
        0,
        0.16,
        0.165,
        0.14,
        0.32,
        0.021,
      );
      for (let i = 0; i < 3; i++)
        charactersModule.ball(p.torsoGroup, ink, 0, 0.07 + i * 0.09, 0.19, 0.012);
    }
    if (id === 'oolong') {
      for (let j = 0; j < 3; j++)
        charactersModule.ball(
          p.torsoGroup,
          artModule.artMat(0x504b36),
          0,
          0.13 + j * 0.09,
          0.24,
          0.015,
        );
      for (const s of [-1, 1]) {
        charactersModule.box(p.torsoGroup, cloth, s * 0.16, 0.19, 0.23, 0.115, 0.13, 0.015);
        artModule.artLine(
          p.torsoGroup,
          accent,
          [
            [s * 0.16 - 0.055, 0.23, 0.247],
            [s * 0.16 + 0.055, 0.23, 0.247],
          ],
          0.004,
        );
      }
      p.tail = artModule.artLine(
        p.torsoGroup,
        skin,
        [
          [0, -0.08, -0.23],
          [0.1, -0.08, -0.37],
          [0.17, 0.0, -0.4],
          [0.12, 0.07, -0.4],
          [0.055, 0.035, -0.4],
          [0.09, -0.02, -0.4],
        ],
        0.019,
      );
    }
  }
  function artAccessories(p, id, r) {
    const ink = artModule.artMat(0x252c35),
      white = artModule.artMat(0xf6efda),
      red = artModule.artMat(0xbd423b),
      skin = p.skull.material;
    if (['goku', 'yamcha', 'bulma', 'taopaipai'].includes(id)) artHair(p.head, id, r);
    if (id === 'goku') {
      p.tail = artModule.artLine(
        p.torsoGroup,
        artModule.artMat(0x91613e),
        [
          [0, -0.1, -0.22],
          [-0.16, -0.18, -0.37],
          [-0.44, -0.22, -0.43],
          [-0.61, -0.07, -0.4],
          [-0.57, 0.14, -0.3],
        ],
        0.054,
      );
      for (let i = 0; i < 6; i++)
        artModule.artLine(
          p.tail,
          artModule.artMat(0x68452e),
          [
            [-0.43 - i * 0.02, -0.23 + i * 0.025, -0.44],
            [-0.46 - i * 0.018, -0.2 + i * 0.025, -0.45],
          ],
          0.004,
        );
      artModule.artLine(
        p.torsoGroup,
        artModule.artMat(0x713f24),
        [
          [-0.21, 0.42, -0.15],
          [0, 0.2, 0.25],
          [0.24, -0.06, 0.15],
        ],
        0.018,
      );
    }
    if (id === 'yamcha') {
      const scarf = artModule.artMat(0xb43c35);
      artModule.artLine(
        p.torsoGroup,
        scarf,
        [
          [-0.24, 0.44, 0.05],
          [-0.15, 0.44, 0.2],
          [0, 0.42, 0.23],
          [0.18, 0.44, 0.17],
          [0.25, 0.44, 0.01],
        ],
        0.04,
      );
      for (const s of [-1, 1]) {
        const tail = artModule.artPatch(
          p.torsoGroup,
          scarf,
          [
            [0.13, 0.43],
            [0.41, 0.3 + s * 0.03],
            [0.63, 0.37],
            [0.43, 0.4],
            [0.22, 0.47],
          ],
          0.012,
        );
        tail.position.z = -0.18 - s * 0.03;
      }
    }
    if (id === 'taopaipai') {
      for (const s of [-1, 1])
        artModule.artLine(
          p.head,
          ink,
          [
            [s * 0.025, -r * 0.3, r * 0.86],
            [s * 0.105, -r * 0.27, r * 0.86],
            [s * 0.16, -r * 0.4, r * 0.65],
          ],
          0.013,
        );
    }
    if (id === 'roshi') {
      for (const s of [-1, 1]) {
        charactersModule.meshTo(
          p.head,
          new THREE.CircleGeometry(0.088, 32),
          ink,
          s * 0.105,
          0.025,
          0.245,
        );
        charactersModule.meshTo(
          p.head,
          new THREE.TorusGeometry(0.091, 0.011, 8, 32),
          red,
          s * 0.105,
          0.025,
          0.248,
        );
        artModule.artLine(
          p.head,
          red,
          [
            [s * 0.193, 0.025, 0.247],
            [s * 0.24, 0.025, 0.11],
            [s * 0.25, 0.01, -0.04],
          ],
          0.011,
        );
        artModule.artLine(
          p.head,
          white,
          [
            [s * 0.04, 0.12, 0.21],
            [s * 0.1, 0.14, 0.22],
            [s * 0.18, 0.105, 0.19],
          ],
          0.018,
        );
        artModule.hairLock(p.head, white, [s * 0.02, -0.1, 0.24], [s * 0.19, -0.17, 0.22], 0.047);
      }
      charactersModule.box(p.head, red, 0, 0.025, 0.25, 0.044, 0.021, 0.021);
      for (let j = 0; j < 7; j++)
        artModule.hairLock(
          p.head,
          white,
          [(j - 3) * 0.032, -0.15, 0.21],
          [(j - 3) * 0.018, -0.42 + Math.abs(j - 3) * 0.025, 0.13],
          0.041,
        );
      const shell = artModule.artMat(0xac8351),
        edge = artModule.artMat(0x634e33);
      charactersModule.ball(p.torsoGroup, shell, 0, 0.17, -0.37, 0.44, [1, 1.18, 0.5]);
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.TorusGeometry(0.435, 0.025, 8, 48),
        edge,
        0,
        0.17,
        -0.385,
      ).scale.y = 1.18;
      const hex = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 3;
        hex.push([Math.cos(a) * 0.2, 0.17 + Math.sin(a) * 0.25, -0.589]);
      }
      artModule.artLine(p.torsoGroup, edge, hex, 0.012);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        artModule.artLine(
          p.torsoGroup,
          edge,
          [
            [Math.cos(a) * 0.2, 0.17 + Math.sin(a) * 0.25, -0.582],
            [Math.cos(a) * 0.36, 0.17 + Math.sin(a) * 0.43, -0.48],
          ],
          0.01,
        );
      }
      for (const s of [-1, 1])
        artModule.artLine(
          p.torsoGroup,
          artModule.artMat(0x65472e),
          [
            [s * 0.2, 0.46, -0.24],
            [s * 0.28, 0.35, 0.12],
            [s * 0.2, -0.07, 0.2],
          ],
          0.031,
        );
      for (let i = 0; i < 4; i++)
        charactersModule.ball(p.torsoGroup, white, 0, 0.08 + i * 0.09, 0.227, 0.012);
      for (const s of [-1, 1]) {
        const collar = artModule.artPatch(
          p.torsoGroup,
          artModule.artMat(0xf2a67a),
          [
            [s * 0.03, 0.47],
            [s * 0.16, 0.43],
            [s * 0.14, 0.31],
            [s * 0.02, 0.39],
          ],
          0.012,
        );
        collar.position.z = 0.21;
      }
    }
    if (id === 'piccolo') {
      for (const s of [-1, 1]) {
        const ear = artModule.artPatch(
          p.head,
          skin,
          [
            [s * 0.18, 0.05],
            [s * 0.43, 0.13],
            [s * 0.3, -0.07],
            [s * 0.21, -0.07],
          ],
          0.035,
        );
        ear.position.z = -0.025;
        artModule.artLine(
          p.head,
          artModule.artMat(0x476d30),
          [
            [s * 0.23, 0.015, 0.03],
            [s * 0.35, 0.08, 0.035],
            [s * 0.275, -0.025, 0.035],
          ],
          0.009,
        );
        artModule.artLine(
          p.head,
          skin,
          [
            [s * 0.095, 0.205, 0.08],
            [s * 0.14, 0.34, 0.12],
            [s * 0.1, 0.4, 0.21],
          ],
          0.022,
        );
        for (const joint of [p['arm' + (s < 0 ? 'L' : 'R')], p['elbow' + (s < 0 ? 'L' : 'R')]]) {
          charactersModule.ball(
            joint,
            artModule.artMat(0xb97068),
            0,
            -0.13,
            0.08,
            0.064,
            [1, 1.5, 0.32],
          );
          for (let i = 0; i < 4; i++)
            artModule.artLine(
              joint,
              artModule.artMat(0x7c4947),
              [
                [-0.048, -0.065 - i * 0.036, 0.104],
                [0, -0.059 - i * 0.036, 0.112],
                [0.048, -0.065 - i * 0.036, 0.104],
              ],
              0.004,
            );
        }
      }
      charactersModule.badge(p.torsoGroup, '魔', 0, 0.24, 0.267, 0.18, false, '#f2e4c5');
    }
    if (id === 'tien') {
      const sash = artModule.artMat(0xb84335);
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.CylinderGeometry(0.275, 0.275, 0.11, 32),
        sash,
        0,
        -0.08,
        0,
      ).scale.z = 0.75;
      artModule.artLine(
        p.torsoGroup,
        sash,
        [
          [0.1, -0.1, 0.22],
          [0.13, -0.27, 0.25],
          [0.08, -0.43, 0.24],
        ],
        0.027,
      );
    }
    if (id === 'gyumao') {
      const steel = artModule.artMat(0x536884),
        gold = artModule.artMat(0xccac57),
        horn = artModule.artMat(0xebe0bd),
        beard = artModule.artMat(0x282c35);
      charactersModule.meshTo(
        p.head,
        new THREE.SphereGeometry(r * 1.055, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.48),
        steel,
        0,
        0.02,
        -0.03,
      );
      artModule.artLine(
        p.head,
        gold,
        [
          [-0.45, 0.04, 0.15],
          [-0.32, 0.06, 0.37],
          [0, 0.07, 0.45],
          [0.32, 0.06, 0.37],
          [0.45, 0.04, 0.15],
        ],
        0.035,
      );
      for (const s of [-1, 1]) {
        artModule.artLine(
          p.head,
          horn,
          [
            [s * 0.36, 0.35, -0.06],
            [s * 0.56, 0.54, -0.04],
            [s * 0.67, 0.79, -0.04],
            [s * 0.6, 1.03, -0.04],
          ],
          0.081,
        );
        artModule.hairLock(p.head, horn, [s * 0.62, 0.87, -0.04], [s * 0.6, 1.1, -0.03], 0.055);
        artModule.hairLock(p.head, beard, [s * 0.05, -0.19, 0.4], [s * 0.36, -0.21, 0.3], 0.065);
        for (let j = 0; j < 3; j++)
          artModule.hairLock(
            p.head,
            beard,
            [s * (0.05 + j * 0.09), -0.26, 0.33],
            [s * (0.04 + j * 0.075), -0.56 + j * 0.025, 0.22],
            0.083,
          );
        charactersModule.ball(p.head, beard, s * 0.18, 0.015, 0.405, 0.095, [1.1, 0.5, 0.22]);
        charactersModule.meshTo(
          p.head,
          new THREE.TorusGeometry(0.095, 0.013, 8, 24),
          gold,
          s * 0.18,
          0.015,
          0.415,
        ).scale.y = 0.6;
        charactersModule.ball(
          p['arm' + (s < 0 ? 'L' : 'R')],
          steel,
          0,
          0.035,
          0,
          0.28,
          [1.35, 0.6, 1.2],
        );
        for (let i = 0; i < 3; i++)
          charactersModule.ball(
            p['arm' + (s < 0 ? 'L' : 'R')],
            gold,
            (i - 1) * 0.13,
            0.06,
            0.25,
            0.026,
          );
      }
      charactersModule.box(p.head, gold, 0, 0.018, 0.435, 0.16, 0.026, 0.025);
      charactersModule.badge(p.head, '牛', 0, 0.26, 0.421, 0.135, false, '#526782');
      for (const s of [-1, 1])
        artModule.artLine(
          p.torsoGroup,
          steel,
          [
            [s * 0.51, 0.87, -0.03],
            [s * 0.41, 0.63, 0.47],
            [s * 0.32, 0.28, 0.52],
            [s * 0.28, -0.06, 0.43],
          ],
          0.055,
        );
      if (p.axe) {
        const bladeMat = artModule.artMat(0xe0e5e1);
        for (const s of [-1, 1])
          artModule.artLine(
            p.axe,
            bladeMat,
            [
              [s * 0.56, 0.52, 0.068],
              [s * 0.68, 0.9, 0.068],
              [s * 0.67, 1.3, 0.068],
              [s * 0.56, 1.7, 0.068],
            ],
            0.018,
          );
        for (let i = 0; i < 11; i++)
          charactersModule.meshTo(
            p.axe,
            new THREE.TorusGeometry(0.053, 0.008, 5, 12),
            artModule.artMat(0x97724a),
            0,
            -0.38 + i * 0.071,
            0,
          ).rotation.x = Math.PI / 2;
      }
    }
    if (id === 'chichi') {
      const helmet = artModule.artMat(0x4669a9),
        trim = artModule.artMat(0xc36392);
      charactersModule.meshTo(
        p.head,
        new THREE.SphereGeometry(r * 1.08, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.42),
        helmet,
        0,
        0.025,
        -0.028,
      );
      artModule.artLine(
        p.head,
        trim,
        [
          [-0.265, 0.015, 0.03],
          [-0.22, 0.08, 0.16],
          [-0.11, 0.1, 0.244],
          [0, 0.105, 0.263],
          [0.11, 0.1, 0.244],
          [0.22, 0.08, 0.16],
          [0.265, 0.015, 0.03],
        ],
        0.023,
      );
      for (const s of [-1, 1]) {
        charactersModule.ball(p.head, helmet, s * 0.258, -0.065, -0.01, 0.112, [0.38, 1.5, 1]);
        charactersModule.meshTo(
          p.head,
          new THREE.CircleGeometry(0.065, 24),
          trim,
          s * 0.274,
          -0.035,
          0.035,
        ).rotation.y = (s * Math.PI) / 2;
      }
      charactersModule.ball(p.head, artModule.artMat(0xf8d586), 0, 0.17, 0.252, 0.039, [1, 1, 0.6]);
      artModule.artLine(
        p.head,
        trim,
        [
          [-0.17, -0.19, 0.1],
          [0, -0.27, 0.11],
          [0.17, -0.19, 0.1],
        ],
        0.015,
      );
      const cape = artModule.artPatch(
        p.torsoGroup,
        trim,
        [
          [-0.18, 0.4],
          [-0.28, -0.28],
          [0, -0.4],
          [0.28, -0.28],
          [0.18, 0.4],
        ],
        0.015,
      );
      cape.position.z = -0.18;
    }
    if (id === 'bulma') {
      const gun = p.handR;
      charactersModule.box(gun, ink, 0, -0.005, 0.105, 0.1, 0.13, 0.15);
      charactersModule.box(gun, artModule.artMat(0x6e8288), 0, 0.065, 0.22, 0.08, 0.075, 0.2);
      charactersModule.meshTo(
        gun,
        new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12),
        ink,
        0,
        0.064,
        0.35,
      ).rotation.x = Math.PI / 2;
    }
    if (id === 'chiaotzu') {
      charactersModule.meshTo(
        p.head,
        new THREE.SphereGeometry(r * 1.03, 36, 16, 0, Math.PI * 2, 0, Math.PI * 0.35),
        ink,
        0,
        0.025,
        -0.018,
      );
      artModule.artLine(
        p.head,
        red,
        [
          [-0.22, 0.14, 0.02],
          [-0.14, 0.14, 0.17],
          [0, 0.14, 0.22],
          [0.14, 0.14, 0.17],
          [0.22, 0.14, 0.02],
        ],
        0.014,
      );
      charactersModule.ball(p.head, red, 0, 0.279, 0, 0.034);
    }
    if (id === 'oolong') {
      charactersModule.ball(p.head, skin, 0, -0.072, 0.263, 0.1, [1.45, 0.76, 0.73]);
      for (const s of [-1, 1]) {
        charactersModule.ball(p.head, artModule.artMat(0x865547), s * 0.046, -0.07, 0.327, 0.012);
        const ear = artModule.artPatch(
          p.head,
          skin,
          [
            [s * 0.17, 0.13],
            [s * 0.3, 0.3],
            [s * 0.32, 0.12],
            [s * 0.23, 0.075],
          ],
          0.025,
        );
        ear.position.z = -0.01;
        const inner = artModule.artPatch(
          p.head,
          artModule.artMat(0xcf8c78),
          [
            [s * 0.215, 0.14],
            [s * 0.285, 0.245],
            [s * 0.287, 0.13],
          ],
          0.005,
        );
        inner.position.z = 0.025;
      }
      const cap = artModule.artMat(0x6d7b51);
      artModule.artLoft(
        p.head,
        cap,
        [
          [0.215, 0.255, 0.19],
          [0.255, 0.24, 0.18],
          [0.3, 0.19, 0.15],
          [0.31, 0, 0],
        ],
        32,
        0.015,
      );
      charactersModule.box(p.head, cap, 0, 0.22, 0.18, 0.39, 0.023, 0.15);
      charactersModule.badge(p.head, '★', 0, 0.267, 0.169, 0.044, false, '#6d7b51');
    }
    if (id === 'korin') {
      for (const s of [-1, 1]) {
        const ear = artModule.artPatch(
          p.head,
          skin,
          [
            [s * 0.11, 0.15],
            [s * 0.23, 0.39],
            [s * 0.32, 0.15],
          ],
          0.045,
        );
        ear.position.z = -0.03;
        const inner = artModule.artPatch(
          p.head,
          artModule.artMat(0xd8afa0),
          [
            [s * 0.175, 0.2],
            [s * 0.23, 0.32],
            [s * 0.277, 0.2],
          ],
          0.012,
        );
        inner.position.z = 0.029;
        charactersModule.ball(p.head, skin, s * 0.074, -0.093, 0.235, 0.08, [1.2, 0.75, 0.5]);
        for (let i = 0; i < 3; i++)
          artModule.artLine(
            p.head,
            artModule.artMat(0x5b554b),
            [
              [s * 0.12, -0.07 + i * 0.032, 0.249],
              [s * 0.3, -0.065 + i * 0.053, 0.23],
              [s * 0.41, -0.09 + i * 0.075, 0.2],
            ],
            0.0038,
          );
      }
      p.tail = artModule.artLine(
        p.torsoGroup,
        skin,
        [
          [0, -0.06, -0.22],
          [0.19, -0.06, -0.43],
          [0.35, 0.12, -0.47],
          [0.36, 0.34, -0.42],
          [0.29, 0.41, -0.4],
        ],
        0.045,
      );
      if (p.cane)
        for (let j = 0; j < 6; j++)
          artModule.artLine(
            p.cane,
            artModule.artMat(0x614b32),
            [
              [-0.019, -0.6 + j * 0.16, 0.085],
              [0.012, -0.55 + j * 0.16, 0.092],
            ],
            0.004,
          );
    }
  }
  function artMech(p, d) {
    const steel = artModule.artMat(0x547e99),
      edge = artModule.artMat(0x304454),
      gold = artModule.artMat(0xc6aa67),
      light = artModule.artMat(0x8cb3c0);
    artModule.artLoft(
      p.torsoGroup,
      steel,
      [
        [-0.24, 0.38, 0.31],
        [-0.17, 0.58, 0.39],
        [0.25, 0.65, 0.44],
        [0.64, 0.53, 0.37],
        [0.81, 0.33, 0.28],
      ],
      32,
      0,
    );
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'L' : 'R';
      const arm = p['arm' + side],
        elbow = p['elbow' + side],
        hand = p['hand' + side],
        leg = p['leg' + side],
        knee = p['knee' + side];
      charactersModule.ball(arm, edge, 0, 0, 0, 0.2);
      artModule.artLoft(
        arm,
        steel,
        [
          [0.03, 0.25, 0.24],
          [-0.12, 0.29, 0.27],
          [-0.39, 0.21, 0.21],
          [-d.upper, 0.18, 0.17],
        ],
        20,
        0,
      );
      charactersModule.ball(elbow, edge, 0, 0, 0, 0.2);
      artModule.artLoft(
        elbow,
        steel,
        [
          [0, 0.19, 0.18],
          [-0.12, 0.25, 0.23],
          [-d.fore * 0.85, 0.23, 0.21],
          [-d.fore, 0.18, 0.17],
        ],
        20,
        0,
      );
      charactersModule.box(hand, edge, 0, -0.03, 0.02, 0.42, 0.32, 0.36);
      for (let j = 0; j < 4; j++)
        charactersModule.box(hand, light, (j - 1.5) * 0.085, -0.1, 0.18, 0.07, 0.18, 0.08);
      artModule.artLoft(
        leg,
        steel,
        [
          [0.06, 0.23, 0.23],
          [-0.16, 0.26, 0.25],
          [-d.thigh, 0.19, 0.19],
        ],
        20,
      );
      charactersModule.ball(knee, edge, 0, 0, 0, 0.23);
      artModule.artLoft(
        knee,
        steel,
        [
          [0, 0.21, 0.21],
          [-0.1, 0.28, 0.25],
          [-d.shin * 0.85, 0.25, 0.26],
        ],
        20,
      );
      charactersModule.box(knee, edge, 0, -d.shin, 0.14, 0.57, 0.18, 0.83);
      charactersModule.box(knee, steel, 0, -d.shin + 0.1, 0.15, 0.52, 0.14, 0.65);
      for (const part of [arm, elbow, knee]) {
        for (let i = 0; i < 3; i++)
          charactersModule.box(part, edge, 0, -0.15 - i * 0.055, 0.252, 0.25, 0.022, 0.013);
        for (const x of [-0.16, 0.16])
          charactersModule.ball(part, gold, x, -0.085, 0.244, 0.02, [1, 1, 0.5]);
      }
      const cannon = charactersModule.meshTo(
        p.torsoGroup,
        new THREE.CylinderGeometry(0.12, 0.14, 0.36, 24),
        edge,
        s * 0.46,
        0.38,
        0.48,
      );
      cannon.rotation.x = Math.PI / 2;
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.TorusGeometry(0.12, 0.025, 8, 24),
        light,
        s * 0.46,
        0.38,
        0.67,
      );
    }
    charactersModule.meshTo(
      p.head,
      new THREE.SphereGeometry(0.53, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.51),
      steel,
      0,
      -0.02,
      -0.05,
    );
    charactersModule.box(p.head, edge, 0, -0.02, 0.32, 0.85, 0.48, 0.15);
    const pilot = new THREE.Group();
    pilot.name = 'pilaf-pilot';
    pilot.position.set(0, -0.02, 0.44);
    p.head.add(pilot);
    const pp = {
      head: pilot,
    };
    artModule.artHead(pp, 'pilaf', 0.147, artModule.artMat(0x66bbb0));
    p.skull = pp.skull;
    charactersModule.ball(pilot, artModule.artMat(0x263f61), 0, 0.12, -0.02, 0.155, [1, 0.55, 1]);
    charactersModule.ball(pilot, redPilot(), 0, 0.225, -0.02, 0.027);
    charactersModule.box(pilot, artModule.artMat(0x344d70), 0, -0.2, -0.01, 0.26, 0.2, 0.17);
    charactersModule.badge(pilot, '炒', 0, -0.19, 0.091, 0.051, false, '#344d70');
    for (const s of [-1, 1]) {
      const ear = artModule.artPatch(
        pilot,
        artModule.artMat(0x66bbb0),
        [
          [s * 0.12, 0.02],
          [s * 0.24, 0.07],
          [s * 0.17, -0.05],
        ],
        0.018,
      );
      ear.position.z = -0.01;
      charactersModule.box(p.head, gold, s * 0.435, -0.025, 0.465, 0.044, 0.48, 0.055);
    }
    charactersModule.box(p.head, light, 0, 0.23, 0.44, 0.91, 0.06, 0.08);
    charactersModule.box(p.head, edge, 0, -0.28, 0.47, 0.91, 0.09, 0.14);
    artModule.artDecal(p.torsoGroup, 'PILAF', 0, 0.28, 0.456, 0.49, 0.15, '#e4dcb5');
    for (let j = 0; j < 5; j++)
      charactersModule.box(p.torsoGroup, edge, 0, -0.08 + j * 0.041, 0.409, 0.36, 0.019, 0.016);
    charactersModule.box(p.torsoGroup, edge, 0, 0.27, -0.43, 0.74, 0.57, 0.13);
    for (let i = 0; i < 5; i++)
      charactersModule.box(p.torsoGroup, light, 0, 0.11 + i * 0.08, -0.505, 0.47, 0.025, 0.016);
    for (const s of [-1, 1]) {
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.CylinderGeometry(0.12, 0.14, 0.67, 20),
        edge,
        s * 0.45,
        0.3,
        -0.38,
      );
      charactersModule.meshTo(
        p.torsoGroup,
        new THREE.TorusGeometry(0.118, 0.018, 6, 20),
        gold,
        s * 0.45,
        0.64,
        -0.38,
      ).rotation.x = Math.PI / 2;
      for (const y of [0.01, 0.54])
        charactersModule.ball(p.torsoGroup, gold, s * 0.29, y, -0.5, 0.022);
    }
    if (p.cockpit) {
      p.cockpit.clear();
      p.cockpit.material.opacity = 0.12;
      p.cockpit.material.depthWrite = false;
    }
  }
  function redPilot() {
    return artModule.artMat(0xb54340);
  }
  function artOutline(root) {
    const ink = new THREE.MeshBasicMaterial({
      color: 0x27313b,
      side: THREE.BackSide,
    });
    const items = [];
    root.traverse((o) => {
      if (
        o.isMesh &&
        o.material?.isMeshToonMaterial &&
        o.geometry.attributes?.position?.count > 120 &&
        !o.material.transparent &&
        !['TubeGeometry', 'TorusGeometry'].includes(o.geometry.type)
      )
        items.push(o);
    });
    for (const o of items) {
      const geo = o.geometry.clone(),
        p = geo.attributes.position,
        n = geo.attributes.normal;
      if (!n) continue;
      for (let i = 0; i < p.count; i++)
        p.setXYZ(
          i,
          p.getX(i) + n.getX(i) * 0.003,
          p.getY(i) + n.getY(i) * 0.003,
          p.getZ(i) + n.getZ(i) * 0.003,
        );
      const line = new THREE.Mesh(geo, ink);
      line.name = 'ink-contour';
      o.add(line);
    }
  }
  function rebuildArtCharacter(b, id) {
    if (b.root.userData.artVersion === artModule.DB_ART_VERSION) return b;
    artKeepRig(b);
    const p = b.parts,
      pal = ART_PALETTE[id],
      child = ['goku', 'krillin'].includes(id),
      d = p.anatomy ?? {
        hip: 1.28,
        neck: child ? 0.81 : 0.82,
        armY: 0.43,
        upper: 0.34,
        fore: 0.32,
        thigh: 0.46,
        shin: 0.395,
        armR: 0.092,
        handR: 0.096,
        legR: 0.142,
        torsoR: id === 'tien' || id === 'piccolo' ? 0.3 : 0.28,
        headR: child ? 0.315 : 0.254,
      };
    if (id === 'pilaf') artMech(p, d);
    else {
      artClothes(p, id, d, pal);
      artModule.artHead(p, id, d.headR, artModule.artMat(pal[0]));
      artAccessories(p, id, d.headR);
    }
    artOutline(b.root);
    artModule.artBatchCharacter(b);
    b.root.name = 'reconstructed-' + id;
    b.root.userData.artVersion = artModule.DB_ART_VERSION;
    b.root.userData.artProfile = artModule.ART_PROFILES[id];
    return b;
  }
  return function initialize() {
    artModule.DB_ART_VERSION = '3.0-reconstruction';
    artModule.ART_FACE_TEXTURES = new Map();
    artModule.ART_BODY_TEMPLATES = new Map();
    ART_PALETTE = {
      goku: [0xf3b789, 0xec602d, 0x223b68, 0x182338],
      roshi: [0xe8b889, 0xee9163, 0xe4ddbb, 0x603e2a],
      taopaipai: [0xe9b68e, 0xe77d9d, 0x242635, 0x292c36],
      piccolo: [0x72a445, 0x474462, 0x902f40, 0x946e34],
      tien: [0xe8b38b, 0xe8b38b, 0x338d61, 0x25313a],
      krillin: [0xf2ba8c, 0xed6030, 0x233d71, 0x1d293b],
      yamcha: [0xe8b085, 0x438159, 0xb7332d, 0x4e3929],
      gyumao: [0xe9b080, 0xe9b080, 0x475c78, 0x523c2c],
      chichi: [0xf3c19f, 0x4669a9, 0xc26394, 0xb55186],
      bulma: [0xf2be9d, 0xe49cac, 0x785293, 0x765394],
      chiaotzu: [0xfff2d9, 0x438768, 0x272936, 0x222e38],
      oolong: [0xe9ae8e, 0xb7b37b, 0x735d39, 0x343b32],
      korin: [0xf4efda, 0xf4efda, 0xd5c6a7, 0xf4efda],
      pilaf: [0x66bbb0, 0x487692, 0x304555, 0x233943],
    };
    artModule.ART_SOURCE_BUILDERS = new Map();
    for (const def of charactersModule.CHARACTERS) {
      const original = def.buildBody;
      artModule.ART_SOURCE_BUILDERS.set(def.id, original);
      def.buildBody = () =>
        artModule.artCachedBody(def.id, () => rebuildArtCharacter(original(), def.id));
    }
    // Transformation silhouettes retain their distinct quadruped/wing/robot bones.
    artOriginalOolong = charactersModule.buildOolong;
    charactersModule.buildOolong = function (form = 'pig') {
      const b = artOriginalOolong(form);
      if (form === 'pig') return rebuildArtCharacter(b, 'oolong');
      const p = b.parts;
      if (form === 'bull') {
        const dark = artModule.artMat(0x533827),
          horn = artModule.artMat(0xe5d4ae);
        for (const s of [-1, 1]) {
          artModule.hairLock(p.head, dark, [s * 0.08, 0.26, 0.03], [s * 0.12, 0.35, 0.13], 0.09);
          artModule.artLine(
            p.head,
            dark,
            [
              [s * 0.08, 0.08, 0.27],
              [s * 0.19, 0.065, 0.245],
            ],
            0.013,
          );
          charactersModule.ball(p.head, dark, s * 0.075, -0.06, 0.432, 0.025, [1, 0.6, 0.3]);
          for (const limb of [p['elbow' + (s < 0 ? 'L' : 'R')], p['knee' + (s < 0 ? 'L' : 'R')]]) {
            charactersModule.box(limb, dark, 0, -0.24, 0.04, 0.24, 0.13, 0.28);
            artModule.artLine(
              limb,
              horn,
              [
                [0, -0.2, 0.182],
                [0, -0.28, 0.182],
              ],
              0.006,
            );
          }
        }
      }
      if (form === 'bat') {
        for (const s of [-1, 1]) {
          const wing = p['wing' + (s < 0 ? 'L' : 'R')];
          for (const end of [
            [s * 0.92, -0.2, 0],
            [s * 0.62, -0.56, 0],
            [s * 0.2, -0.59, 0],
          ])
            artModule.artLine(wing, artModule.artMat(0xb494ae), [[0, 0, 0.005], end], 0.009);
          artModule.hairLock(
            p.head,
            artModule.artMat(0xede1ce),
            [s * 0.055, -0.13, 0.19],
            [s * 0.055, -0.19, 0.19],
            0.013,
          );
        }
      }
      if (form === 'robot') {
        for (const s of [-1, 1]) {
          for (let i = 0; i < 3; i++)
            charactersModule.box(
              p.torsoGroup,
              artModule.artMat(0x344b55),
              s * 0.21,
              0.3 - i * 0.1,
              0.263,
              0.22,
              0.038,
              0.012,
            );
          for (const joint of [p['arm' + (s < 0 ? 'L' : 'R')], p['knee' + (s < 0 ? 'L' : 'R')]])
            for (let j = 0; j < 3; j++)
              charactersModule.meshTo(
                joint,
                new THREE.TorusGeometry(0.165, 0.012, 6, 20),
                artModule.artMat(0xc4b99a),
                0,
                -0.1 - j * 0.09,
                0,
              ).rotation.x = Math.PI / 2;
        }
      }
      b.root.userData.artVersion = artModule.DB_ART_VERSION;
      return b;
    };
  };
}
