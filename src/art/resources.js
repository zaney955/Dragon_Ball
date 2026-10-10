import * as THREE from 'three';
export function register({
  animation: animationModule,
  art: artModule,
  characters: charactersModule,
  combat: combatModule,
  ui: uiModule,
  world: worldModule,
}) {
  let artCharacterOptions, artUncachedFormBuilder;
  artModule.artShareMaterials = function artShareMaterials(root) {
    const pool = new Map();
    root.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      const m = o.material;
      if (!m.isMeshToonMaterial && !m.isMeshBasicMaterial) return;
      const key = [
        m.type,
        m.color?.getHex(),
        m.side,
        m.opacity,
        m.transparent,
        m.map?.uuid,
        m.gradientMap?.uuid,
        m.depthWrite,
      ].join(':');
      if (pool.has(key)) o.material = pool.get(key);
      else pool.set(key, m);
    });
  };
  artModule.artBatchCharacter = function artBatchCharacter(b) {
    const p = b.parts,
      protectedObjects = new Set(Object.values(p).filter((v) => v?.isObject3D));
    protectedObjects.add(b.root);
    for (const o of [...protectedObjects]) {
      let a = o.parent;
      while (a) {
        protectedObjects.add(a);
        a = a.parent;
      }
    }
    // Batch only rigid visual children. Every animation bone and weapon socket stays a live object.
    const bones = [b.root];
    b.root.traverse((o) => {
      if (protectedObjects.has(o) && o !== b.root) bones.push(o);
    });
    for (const bone of bones) {
      const children = bone.children.filter((c) => !protectedObjects.has(c));
      if (children.length < 2) continue;
      const staticPart = new THREE.Group();
      staticPart.name = 'rigid-art-batch';
      bone.add(staticPart);
      for (const c of children) staticPart.add(c);
      artModule.artShareMaterials(staticPart);
      artModule.batchDecoration(staticPart);
    }
  };
  artModule.artResources = function artResources(root) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    root.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        materials.add(m);
        for (const k of ['map', 'normalMap', 'alphaMap', 'bumpMap', 'gradientMap'])
          if (m[k]) textures.add(m[k]);
      }
    });
    return {
      geometries,
      materials,
      textures,
    };
  };
  artModule.artDisposeResources = function artDisposeResources(
    resources,
    keep = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
    },
  ) {
    for (const t of resources.textures)
      if (
        !keep.textures.has(t) &&
        !t.userData.artShared &&
        t !== combatModule.contactShadowTexture &&
        t !== charactersModule.toonRamp &&
        t !== combatModule.skyBackdrop &&
        t !== worldModule.warmSkyBackdrop
      )
        t.dispose();
    for (const m of resources.materials) if (!keep.materials.has(m)) m.dispose();
    for (const g of resources.geometries) if (!keep.geometries.has(g)) g.dispose();
  };
  artModule.artCachedBody = function artCachedBody(key, build) {
    let template = artModule.ART_BODY_TEMPLATES.get(key);
    if (!template) {
      template = build();
      artModule.ART_BODY_TEMPLATES.set(key, template);
      for (const t of artModule.artResources(template.root).textures) t.userData.artShared = true;
    }
    const root = template.root.clone(true),
      sources = [],
      copies = [],
      objects = new Map(),
      geometries = new Map(),
      materials = new Map();
    template.root.traverse((o) => sources.push(o));
    root.traverse((o) => copies.push(o));
    for (let i = 0; i < sources.length; i++) {
      const a = sources[i],
        b = copies[i];
      objects.set(a, b);
      b.rotation.copy(a.rotation);
      if (a.geometry) {
        if (!geometries.has(a.geometry)) geometries.set(a.geometry, a.geometry.clone());
        b.geometry = geometries.get(a.geometry);
      }
      if (a.material) {
        const clone = (m) => {
          if (!materials.has(m)) materials.set(m, m.clone());
          return materials.get(m);
        };
        b.material = Array.isArray(a.material) ? a.material.map(clone) : clone(a.material);
      }
    }
    const parts = {};
    for (const [k, v] of Object.entries(template.parts))
      parts[k] = v?.isObject3D
        ? objects.get(v)
        : Array.isArray(v)
          ? v.map((o) => objects.get(o) ?? o)
          : v;
    return {
      root,
      parts,
    };
  };
  artModule.buildV2SupportMech = function buildV2SupportMech(who = 'shu') {
    const id = who === 1 || who === 'mai' || who === '舞' ? 'mai' : 'shu';
    const b = artModule.artCachedBody('support-' + id, () => {
      const model = charactersModule.CHARACTERS.find((c) => c.id === 'pilaf').buildBody(),
        p = model.parts,
        primary = id === 'shu' ? 0x82608e : 0x65835b,
        secondary = id === 'shu' ? 0x47374f : 0x344a3c,
        highlight = id === 'shu' ? 0xb5a0b7 : 0xa9b894;
      const remap = new Map([
          [0x547e99, primary],
          [0x304454, secondary],
          [0x8cb3c0, highlight],
        ]),
        seen = new Set();
      model.root.traverse((o) => {
        if (o.material && !seen.has(o.material)) {
          seen.add(o.material);
          const color = o.material.color?.getHex();
          if (remap.has(color)) o.material.color.setHex(remap.get(color));
        }
      });
      const pilot = p.head.getObjectByName('pilaf-pilot'),
        removed = new THREE.Group();
      for (const c of [...pilot.children]) removed.add(c);
      artModule.artDisposeResources(
        artModule.artResources(removed),
        artModule.artResources(model.root),
      );
      removed.clear();
      pilot.name = id + '-pilot';
      const pp = {
          head: pilot,
        },
        skin = artModule.artMat(id === 'shu' ? 0xc39563 : 0xeabc9d),
        dark = artModule.artMat(0x242b34),
        uniform = artModule.artMat(id === 'shu' ? 0x645273 : 0x596647);
      artModule.artHead(pp, id === 'shu' ? 'oolong' : 'bulma', 0.147, skin);
      p.skull = pp.skull;
      charactersModule.box(pilot, uniform, 0, -0.19, -0.015, 0.255, 0.22, 0.18);
      if (id === 'shu') {
        charactersModule.meshTo(
          pilot,
          new THREE.SphereGeometry(0.158, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.44),
          uniform,
          0,
          0.025,
          -0.015,
        );
        charactersModule.ball(pilot, skin, 0, -0.035, 0.14, 0.065, [1.25, 0.75, 1]);
        charactersModule.ball(pilot, dark, 0, -0.018, 0.195, 0.026, [1, 0.65, 0.65]);
        for (const sign of [-1, 1]) {
          const ear = artModule.artPatch(
            pilot,
            skin,
            [
              [sign * 0.1, 0.055],
              [sign * 0.2, 0.22],
              [sign * 0.19, 0.06],
            ],
            0.025,
          );
          ear.position.z = -0.02;
          artModule.artLine(
            pilot,
            uniform,
            [
              [sign * 0.13, -0.04, -0.02],
              [sign * 0.1, -0.13, 0.04],
              [0, -0.16, 0.08],
            ],
            0.018,
          );
        }
        artModule.artLine(
          pilot,
          uniform,
          [
            [0.02, -0.12, -0.12],
            [0.16, -0.19, -0.15],
            [0.26, -0.17, -0.16],
          ],
          0.035,
        );
      } else {
        charactersModule.ball(pilot, dark, 0, 0.055, -0.05, 0.159, [1.05, 0.94, 0.91]);
        for (const sign of [-1, 1])
          artModule.hairLock(
            pilot,
            dark,
            [sign * 0.115, 0.05, -0.018],
            [sign * 0.145, -0.2, -0.028],
            0.054,
          );
        for (let i = 0; i < 4; i++)
          artModule.hairLock(
            pilot,
            dark,
            [-0.085 + i * 0.055, 0.1, 0.08],
            [-0.08 + i * 0.048, 0.025, 0.144],
            0.037,
          );
        artModule.artLoft(
          pilot,
          uniform,
          [
            [0.105, 0.157, 0.13],
            [0.155, 0.143, 0.12],
            [0.173, 0.1, 0.08],
            [0.175, 0, 0],
          ],
          28,
        );
        charactersModule.box(pilot, uniform, 0, 0.105, 0.11, 0.25, 0.015, 0.12);
        charactersModule.badge(pilot, '★', 0, 0.14, 0.126, 0.021, false, '#596647');
      }
      model.root.traverse((o) => {
        if (o.material?.map?.userData.artText === 'PILAF') {
          const holder = new THREE.Group(),
            label = artModule.artDecal(holder, id.toUpperCase(), 0, 0, 0, 0.49, 0.15, '#e4dcb5');
          o.material.map = label.material.map;
          o.material.needsUpdate = true;
          label.geometry.dispose();
          label.material.dispose();
        }
      });
      charactersModule.applyPose(
        p,
        animationModule.pz({
          aR: [-0.28, 0, 0.08],
          aL: [-0.28, 0, -0.08],
        }),
        0,
        true,
      );
      artModule.artBatchCharacter(model);
      model.root.name = id + '-support-mech';
      model.root.userData.supportPilot = id;
      return model;
    });
    return b.root;
  };
  return function initialize() {
    artCharacterOptions = uiModule.assetSelect.querySelector('optgroup');
    artCharacterOptions.innerHTML = '';
    charactersModule.CHARACTERS.forEach((d, i) => {
      const op = document.createElement('option');
      op.value = 'character:' + i;
      op.textContent = d.name;
      artCharacterOptions.appendChild(op);
    });
    for (const c of charactersModule.CHARACTERS)
      artModule.ART_PROFILES[c.id].note +=
        ' 当前为重建模型：独立脸型、绘制表情、裁片服装、关节细节与背面配件。';
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          artVersion: artModule.DB_ART_VERSION,
          ART_SOURCE_BUILDERS: artModule.ART_SOURCE_BUILDERS,
          ART_BODY_TEMPLATES: artModule.ART_BODY_TEMPLATES,
          ART_FACE_TEXTURES: artModule.ART_FACE_TEXTURES,
          disposeGroup: worldModule.disposeGroup,
          fitArtCamera: uiModule.fitArtCamera,
          loadArtAsset: uiModule.loadArtAsset,
          buildOolong: charactersModule.buildOolong,
          artStageBuilders: artModule.artStageBuilders,
        });
    });
    worldModule.disposeGroup = function (root) {
      root.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
      });
      artModule.artDisposeResources(artModule.artResources(root));
    };
    artUncachedFormBuilder = charactersModule.buildOolong;
    charactersModule.buildOolong = function (form = 'pig') {
      return artModule.artCachedBody('oolong-form-' + form, () => artUncachedFormBuilder(form));
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          buildV2SupportMech: artModule.buildV2SupportMech,
        });
    });
  };
}
