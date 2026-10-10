import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { querySpace, segmentHit, rebuildSpace, insideArea } from './space.js';
import { syncDestruction } from './destruction-batching.js';
export function register({
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  render: renderModule,
  world: worldModule,
  audio: audioModule,
}) {
  worldModule.stageCharacters = charactersModule;
  const surfaces = {
    budokai: { dust: 0xd2c7ac, rubble: 0xb6a68b, soil: 0x66594a, rim: 0xa28d6f, y: 0.012 },
    wild: { dust: 0xc0ac7d, rubble: 0x9e9878, soil: 0x716044, rim: 0x9c875e, y: 0.024 },
    kami: { dust: 0xe9e6dc, rubble: 0xcac9c8, soil: 0x656477, rim: 0xb5ac95, y: 0.03 },
    kame: { dust: 0xebd6a8, rubble: 0xc4b086, soil: 0xbba06c, rim: 0xe1c899, y: 0.108 },
  };
  worldModule.prepareBuilding = function prepareBuilding(root, id, options = {}) {
    root.name = 'building-' + id;
    root.userData.building = id;
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(),
      size = options.cellSize ?? 3.4,
      cells = new Map(),
      originals = new Set();
    root.traverse((mesh) => {
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const matrix = inverse.clone().multiply(mesh.matrixWorld);
      originals.add(mesh.geometry);
      const p = mesh.geometry.parameters;
      let geometry =
        mesh.geometry.type === 'BoxGeometry'
          ? new THREE.BoxGeometry(
              p.width,
              p.height,
              p.depth,
              Math.max(1, Math.ceil(p.width / size)),
              Math.max(1, Math.ceil(p.height / 3)),
              Math.max(1, Math.ceil(p.depth / size)),
            )
          : mesh.geometry.clone();
      geometry.applyMatrix4(matrix);
      if (geometry.index) {
        const indexed = geometry;
        geometry = indexed.toNonIndexed();
        indexed.dispose();
      }
      const positions = geometry.attributes.position,
        normals = geometry.attributes.normal,
        uv = geometry.attributes.uv,
        color = mesh.material.color ?? new THREE.Color(0xffffff);
      for (let i = 0; i < positions.count; i += 3) {
        const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3,
          y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3,
          depth = Math.floor(
            (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / (3 * size),
          ),
          column = Math.floor(x / size),
          row = Math.floor(y / 3),
          key =
            column + ':' + depth + ':' + row + (mesh.material.map ? ':' + mesh.material.uuid : '');
        if (!cells.has(key))
          cells.set(key, {
            positions: [],
            normals: [],
            colors: [],
            uv: [],
            material: mesh.material.map ? mesh.material : null,
            column,
            depth,
            row,
          });
        const cell = cells.get(key);
        for (let j = i; j < i + 3; j++) {
          cell.positions.push(positions.getX(j), positions.getY(j), positions.getZ(j));
          cell.normals.push(normals.getX(j), normals.getY(j), normals.getZ(j));
          cell.colors.push(color.r, color.g, color.b);
          if (cell.material) cell.uv.push(uv?.getX(j) ?? 0, uv?.getY(j) ?? 0);
        }
      }
      geometry.dispose();
    });
    root.clear();
    for (const geometry of originals) geometry.dispose();
    const material = charactersModule.M(0xffffff);
    material.vertexColors = true;
    material.side = THREE.DoubleSide;
    const parts = [];
    for (const [key, cell] of cells) {
      let geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(cell.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(cell.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(cell.colors, 3));
      if (cell.material) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(cell.uv, 2));
      const unwelded = geometry;
      geometry = mergeVertices(geometry, 0.00001);
      unwelded.dispose();
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3()),
        roof = cell.row * 3 >= (options.roofY ?? 3) - 0.5;
      geometry.translate(-center.x, -center.y, -center.z);
      const partMaterial = cell.material ? cell.material.clone() : material;
      if (cell.material) {
        partMaterial.vertexColors = true;
        partMaterial.color.set(0xffffff);
      }
      const mesh = charactersModule.meshTo(
          root,
          geometry,
          partMaterial,
          center.x,
          center.y,
          center.z,
        ),
        color = new THREE.Color(cell.colors[0], cell.colors[1], cell.colors[2]);
      mesh.name = id + '-section-' + key;
      mesh.userData.buildingPart = {
        building: id,
        column: cell.column,
        depth: cell.depth,
        kind: roof ? 'roof' : (options.kind ?? 'stone'),
        hp: roof ? 12 : 18,
        debrisColor: color.getHex(),
        debrisKind: options.kind === 'wood' ? 'wood' : 'stone',
      };
      parts.push(mesh);
    }
    return root;
  };
  worldModule.enrichDestruction = function enrichDestruction(map, id) {
    map.damageEvents = 0;
    map.spaceRevision = 0;
    map.brokenTiles = 0;
    map.destroyedProps = 0;
    map.brokenBuildingParts = 0;
    map.buildings = [];
    map.destructibles = [];
    map.scars = [];
    map.surface = { ...surfaces[id], id };
    if (id === 'budokai')
      map.group.traverse((o) => {
        if (o.name === 'breakable-arena-slab')
          map.destructibles.push({ mesh: o, tile: true, kind: 'stone', hp: 3, broken: false });
      });
    const materials = {
      stone: charactersModule.M(map.surface.rubble),
      wood: charactersModule.M(id === 'kame' ? 0xa17a4d : 0x806044),
      ceramic: charactersModule.M(id === 'budokai' ? 0xb66d51 : 0xa7875d),
      bands: charactersModule.M(0x544738),
      leaves: charactersModule.M(id === 'kame' ? 0x659363 : 0x728a53),
    };
    const positions = [
      [-10, -3],
      [10, 3],
      [-8, 5],
      [9, -5],
      [-12, 4.8],
      [12, -4.8],
      [-11.8, -5.2],
      [11.8, 5.2],
      [-5.5, -5.4],
      [5.5, 5.4],
      [-12.3, 0.5],
      [12.3, -0.5],
    ];
    for (let i = 0; i < (id === 'kami' ? 0 : positions.length); i++) {
      const [x, z] =
          id === 'budokai'
            ? [(i % 2 ? 1 : -1) * (11.8 + (i % 3) * 0.35), -5.3 + Math.floor(i / 2) * 2.05]
            : positions[i],
        kind = ['stone', 'wood', 'ceramic'][i % 3],
        geometry =
          kind === 'stone'
            ? new THREE.DodecahedronGeometry(0.48 + (i % 2) * 0.1, 0)
            : kind === 'wood'
              ? new THREE.BoxGeometry(0.72, 0.72, 0.66)
              : new THREE.CylinderGeometry(0.32, 0.4, 0.58, 10),
        prop = charactersModule.meshTo(
          map.group,
          geometry,
          materials[kind],
          x,
          map.surface.y + 0.32,
          z,
        );
      prop.name = 'breakable-' + kind;
      prop.rotation.y = i * 0.71;
      if (kind === 'stone') {
        prop.scale.set(1.1, 0.8, 1.2);
        if (id === 'wild')
          charactersModule.ball(prop, materials.leaves, 0.04, 0.3, 0, 0.29, [1, 0.18, 1]);
      } else if (kind === 'wood') {
        for (const y of [-0.22, 0.22])
          charactersModule.box(prop, materials.bands, 0, y, 0.337, 0.74, 0.055, 0.025);
        for (const x of [-0.18, 0.18])
          charactersModule.box(prop, materials.bands, x, 0, 0.337, 0.016, 0.7, 0.025);
      } else {
        const lip = charactersModule.meshTo(
          prop,
          new THREE.TorusGeometry(0.32, 0.035, 5, 12),
          materials.ceramic,
          0,
          0.28,
          0,
        );
        lip.rotation.x = Math.PI / 2;
        for (let j = 0; j < 3; j++)
          charactersModule.ball(
            prop,
            materials.leaves,
            (j - 1) * 0.16,
            0.37,
            0,
            0.17,
            [0.55, 1.1, 0.55],
          );
      }
      map.destructibles.push({ mesh: prop, kind, hp: kind === 'ceramic' ? 1 : 2, broken: false });
    }
    map.group.updateMatrixWorld(true);
    map.group.traverse((mesh) => {
      if (mesh.userData.building) map.buildings.push({ id: mesh.userData.building, root: mesh });
      const part = mesh.userData.buildingPart;
      if (part)
        map.destructibles.push({
          ...part,
          buildingId: part.building,
          building: true,
          mesh,
          bounds: new THREE.Box3().setFromObject(mesh),
          broken: false,
        });
    });
    map.group.traverse((mesh) => {
      const spec = mesh.userData.stageObject;
      if (!spec) return;
      const bounds = new THREE.Box3().setFromObject(mesh);
      if (spec.tree) {
        const at = mesh.getWorldPosition(new THREE.Vector3());
        bounds.set(
          new THREE.Vector3(at.x - spec.radius, at.y, at.z - spec.radius),
          new THREE.Vector3(at.x + spec.radius + 0.6, at.y + spec.height, at.z + spec.radius + 0.2),
        );
      }
      map.destructibles.push({ ...spec, mesh, bounds, hp: spec.hp ?? 24, broken: false });
    });
    map.destructibles.forEach((item, id) => {
      item.id = id;
      item.maxHp = item.hp;
      item.stage = 0;
    });
    return map;
  };
  function stageDebris(pos, color, count = 9, kind = 'stone', power = 1, direction = null) {
    count = Math.min(count, Math.max(0, 160 - renderModule.effects.length));
    for (let i = 0; i < count; i++) {
      const size = 0.07 + Math.random() * 0.12,
        geometry =
          kind === 'wood'
            ? new THREE.BoxGeometry(size * 0.7, size * 0.4, size * 3.6)
            : i % 3 === 0
              ? new THREE.BoxGeometry(size * 1.8, size * 0.6, size * 1.4)
              : new THREE.DodecahedronGeometry(size, 0),
        mesh = new THREE.Mesh(geometry, charactersModule.M(color)),
        angle = i * 2.399 + Math.random() * 0.6,
        speed = (1.8 + Math.random() * 3) * power,
        life = 1.4 + Math.random() * 0.5;
      mesh.position.copy(pos);
      mesh.rotation.set(Math.random() * 3, angle, Math.random() * 3);
      mesh.castShadow = true;
      renderModule.scene.add(mesh);
      renderModule.effects.push({
        mesh,
        type: 'debris',
        stageEffect: true,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          (2 + Math.random() * 3.5) * power,
          Math.sin(angle) * speed,
        ).addScaledVector(direction ?? new THREE.Vector3(), power * 1.5),
        spin: new THREE.Vector3(2 + Math.random() * 4, Math.random() * 3, 2 + Math.random() * 4),
        floor: (worldModule.currentMap?.surface.y ?? 0) + 0.04,
        bounces: 0,
        life,
        maxLife: life,
        delay: 0,
      });
    }
  }
  function groundScar(map, center, radius, heavy, beam, dir) {
    const mark = new THREE.Group(),
      surface = map.surface;
    mark.userData.surface = surface.id;
    mark.userData.radius = radius;
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.7, 24),
      new THREE.MeshBasicMaterial({
        color: beam ? 0x4d473d : surface.soil,
        transparent: true,
        opacity: beam ? 0.42 : 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    soil.rotation.x = -Math.PI / 2;
    soil.scale.y = beam ? 1.35 : 0.86;
    mark.add(soil);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.55, radius * 0.82, 18),
      new THREE.MeshBasicMaterial({
        color: surface.rim,
        transparent: true,
        opacity: heavy ? 0.5 : 0.27,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.003;
    rim.scale.y = beam ? 1.35 : 0.86;
    mark.add(rim);
    const cracks = [];
    for (let i = 0; i < (heavy ? 11 : 6); i++) {
      const angle = i * 2.399,
        reach = radius * (0.65 + Math.random() * 0.55),
        x = Math.cos(angle),
        z = Math.sin(angle),
        bend = angle + 0.13;
      cracks.push(
        x * reach * 0.24,
        0.008,
        z * reach * 0.24,
        x * reach * 0.65,
        0.008,
        z * reach * 0.65,
      );
      cracks.push(
        x * reach * 0.65,
        0.008,
        z * reach * 0.65,
        Math.cos(bend) * reach,
        0.008,
        Math.sin(bend) * reach,
      );
    }
    const crackGeo = new THREE.BufferGeometry();
    crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(cracks, 3));
    mark.add(
      new THREE.LineSegments(
        crackGeo,
        new THREE.LineBasicMaterial({
          color: surface.soil,
          transparent: true,
          opacity: surface.id === 'budokai' ? 0.8 : 0.45,
          depthWrite: false,
        }),
      ),
    );
    const rubble = [];
    for (let i = 0; i < (heavy ? 10 : 4); i++) {
      const angle = i * 2.399,
        distance = radius * (0.55 + Math.random() * 0.35),
        x = Math.cos(angle) * distance,
        z = Math.sin(angle) * distance,
        size = radius * (0.045 + Math.random() * 0.055),
        a = [x - size, 0, z - size],
        b = [x + size, 0, z - size],
        c = [x, 0, z + size],
        top = [x + size * 0.3, size * (heavy ? 1.2 : 0.7), z];
      rubble.push(...a, ...top, ...b, ...b, ...top, ...c, ...c, ...top, ...a);
    }
    const rubbleGeo = new THREE.BufferGeometry();
    rubbleGeo.setAttribute('position', new THREE.Float32BufferAttribute(rubble, 3));
    rubbleGeo.computeVertexNormals();
    const pile = new THREE.Mesh(rubbleGeo, charactersModule.M(surface.rubble));
    pile.receiveShadow = true;
    mark.add(pile);
    mark.position.copy(center);
    mark.position.y = (map.groundHeight?.(center.x, center.z) ?? map.surface.y) + 0.015;
    if (beam) mark.rotation.y = Math.atan2(dir.x, dir.z);
    map.group.add(mark);
    map.scars.push(mark);
    if (map.scars.length > 24) {
      const old = map.scars.shift();
      map.group.remove(old);
      worldModule.disposeGroup(old);
    }
  }
  function impactWave(center, surface, radius) {
    if (renderModule.effects.length >= 180) return;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.9, 36),
      new THREE.MeshBasicMaterial({
        color: surface.dust,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.copy(center).add(new THREE.Vector3(0, 0.03, 0));
    mesh.rotation.x = -Math.PI / 2;
    renderModule.scene.add(mesh);
    renderModule.effects.push({
      mesh,
      type: 'stageShock',
      stageEffect: true,
      life: 0.55,
      maxLife: 0.55,
      startScale: radius * 0.4,
      grow: radius * 2.6,
    });
  }
  function breakBuildingPart(map, item, dir) {
    if (item.broken) return;
    item.broken = true;
    item.mesh.visible = false;
    item.stage = 3;
    changed(map, item);
    map.brokenBuildingParts++;
    const pos = item.bounds.getCenter(new THREE.Vector3()),
      dimensions = item.bounds.getSize(new THREE.Vector3());
    stageDebris(pos, item.debrisColor, 10, item.debrisKind, 1.1, dir);
    worldModule.leaveStageRubble?.(map, pos, item.debrisColor);
    if (renderModule.effects.length < 175) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.min(1.4, dimensions.x * 0.45),
          Math.min(0.65, dimensions.y * 0.25),
          Math.min(1.2, dimensions.z * 0.3),
        ),
        charactersModule.M(item.debrisColor),
      );
      mesh.position.copy(pos);
      mesh.castShadow = true;
      renderModule.scene.add(mesh);
      renderModule.effects.push({
        mesh,
        type: 'debris',
        stageEffect: true,
        vel: dir.clone().multiplyScalar(1.8).setY(0.4),
        spin: new THREE.Vector3(1.2, 0.5, 0.7),
        floor: map.surface.y + 0.05,
        bounces: 0,
        life: 2.2,
        maxLife: 2.2,
      });
    }
    renderModule.spawnDust(pos, 8, {
      color: map.surface.dust,
      power: 1.4,
      radius: 0.5,
      stageEffect: true,
    });
    groundScar(
      map,
      pos.clone().setY(map.surface.y),
      Math.min(1.1, dimensions.x * 0.35),
      true,
      false,
      dir,
    );
  }
  function damageBuildingPart(map, item, a, dir) {
    if (item.broken || !(a.dmg > 0)) return;
    audioModule?.stageSound?.(item.debrisKind ?? 'stone', a.dmg >= 20 ? 1 : 0.5);
    map.reaction = Math.min(1, (map.reaction ?? 0) + 0.4);
    item.hp -= Math.max(2, Math.min(60, a.dmg * 0.7));
    if (item.hp <= item.maxHp * 0.45 && item.hp > 0 && item.stage < 2) {
      item.stage = 2;
      item.mesh.scale.multiplyScalar(0.72);
      item.mesh.updateMatrixWorld(true);
      item.bounds.copy(new THREE.Box3().setFromObject(item.mesh));
      changed(map, item);
    }
    if (item.hp > 0) {
      if (!item.damaged) {
        item.mesh.material = item.mesh.material.clone();
        item.mesh.material.color.multiplyScalar(0.82);
        item.damaged = true;
        item.stage = Math.max(1, item.stage);
        changed(map, item);
      }
      renderModule.spawnDust(item.bounds.getCenter(new THREE.Vector3()), 3, {
        color: map.surface.dust,
        stageEffect: true,
      });
      return;
    }
    breakBuildingPart(map, item, dir);
    if (item.kind !== 'roof')
      for (const above of map.destructibles)
        if (
          above.building &&
          !above.broken &&
          above.buildingId === item.buildingId &&
          above.column === item.column &&
          above.depth === item.depth &&
          above.bounds.min.y >= item.bounds.max.y - 0.05
        )
          breakBuildingPart(map, above, dir);
  }
  function changed(map, item) {
    map.spaceRevision = (map.spaceRevision ?? 0) + 1;
    syncDestruction(map, item);
    rebuildSpace(map);
  }
  worldModule.damageStageObject = function damageStageObject(
    item,
    a,
    dir = new THREE.Vector3(0, 0, 1),
  ) {
    const map = worldModule.currentMap;
    if (!map || item.broken || !(a.dmg > 0)) return;
    item.maxHp ??= item.hp;
    if (item.building) {
      damageBuildingPart(map, item, a, dir);
      return;
    }
    audioModule?.stageSound?.(item.kind === 'rock' ? 'stone' : item.kind, a.dmg >= 20 ? 1 : 0.5);
    const oldStage = item.stage;
    item.hp -= Math.max(1, a.dmg * 0.7);
    item.stage = item.hp <= 0 ? 3 : item.hp <= item.maxHp * 0.45 ? 2 : 1;
    const pos =
      item.bounds?.getCenter(new THREE.Vector3()) ??
      item.mesh.getWorldPosition(new THREE.Vector3());
    const color = item.kind === 'wood' ? 0x96744c : map.surface.rubble;
    if (item.stage !== oldStage) {
      if (item.tree && item.stage >= 2 && !item.fallen) {
        item.fallen = true;
        item.mesh.rotation.x = 1.42;
        // A fallen trunk is a low obstruction; its crown does not become an invisible wall.
        const at = item.mesh.getWorldPosition(new THREE.Vector3());
        item.bounds.set(
          new THREE.Vector3(at.x - item.radius, at.y, at.z),
          new THREE.Vector3(at.x + item.radius + 0.6, at.y + item.radius * 2, at.z + item.height),
        );
        groundScar(map, at, 0.7, true, false, dir);
      } else if (!item.tree && item.stage === 2) {
        item.mesh.scale.multiplyScalar(0.62);
        item.mesh.updateMatrixWorld(true);
        item.bounds.copy(new THREE.Box3().setFromObject(item.mesh));
      }
      if (item.stage === 3) {
        item.broken = true;
        item.mesh.visible = false;
        map.destroyedProps++;
        if (!item.rubble && !item.tree) worldModule.leaveStageRubble?.(map, pos, color);
      }
      item.mesh.traverse((node) => {
        if (!node.material?.color) return;
        if (!node.userData.damageMaterial) {
          node.material = node.material.clone();
          node.userData.damageMaterial = true;
        }
        node.material.color.multiplyScalar(0.88);
      });
      changed(map, item);
      stageDebris(pos, color, item.stage === 3 ? 10 : 4, item.kind, 0.8, dir);
    }
    renderModule.spawnDust(pos, 3, { color: map.surface.dust, stageEffect: true });
    map.reaction = Math.min(1, (map.reaction ?? 0) + 0.25);
  };
  function attackBuildings(f, a, impact) {
    const map = worldModule.currentMap;
    if (!(a.dmg > 0)) return;
    const direction = f.forward(),
      from = f.pos.clone().add(new THREE.Vector3(0, (f.baseScale ?? 1) * 1.05, 0)),
      width = Math.max(0.15, a.width ?? (a.shape === 'beam' ? 0.3 : 0.55)),
      point = new THREE.Vector3();
    from.y += map.groundHeight?.(from.x, from.z) ?? 0;
    let length = 0,
      ray = null;
    if (!impact) {
      const to = from.clone().addScaledVector(direction, a.range ?? 1.5);
      if (Number.isFinite(a.targetY)) to.y = a.targetY + (map.groundHeight?.(to.x, to.z) ?? 0);
      length = from.distanceTo(to);
      if (length < 1e-6) return;
      ray = new THREE.Ray(from, to.clone().sub(from).normalize());
    }
    const end = impact ?? ray.at(length, new THREE.Vector3());
    const firstCover = !impact ? segmentHit(map, from, end, width) : null;
    for (const item of querySpace(
      map,
      Math.min(from.x, end.x) - 1.5,
      Math.min(from.z, end.z) - 1.5,
      Math.max(from.x, end.x) + 1.5,
      Math.max(from.z, end.z) + 1.5,
    )) {
      if (!item.building || item.broken) continue;
      if (firstCover && firstCover.item !== item) continue;
      const box = item.bounds.clone().expandByScalar(width);
      const hit = impact
        ? box.distanceToPoint(impact) <= (a.landingImpact ? 1.35 : 0.5)
        : ray.intersectBox(box, point) && point.distanceTo(from) <= length + 0.05;
      if (hit) damageBuildingPart(map, item, a, direction);
    }
  }
  worldModule.damageStageProjectile = function damageStageProjectile(
    f,
    a,
    from,
    to,
    radius = 0.15,
  ) {
    const map = worldModule.currentMap;
    if (!map?.destructibles || !(a.dmg > 0)) return false;
    const hit = segmentHit(map, from, to, radius);
    if (!hit) return false;
    worldModule.damageStageObject(hit.item, a, to.clone().sub(from).normalize());
    return true;
  };
  worldModule.damageStage = function damageStage(f, a, impact = null) {
    const map = worldModule.currentMap;
    if (!map?.destructibles) return;
    map.damageEvents++;
    map.reaction = Math.min(1, (map.reaction ?? 0) + (a.isUlt ? 1 : a.dmg >= 10 ? 0.55 : 0.1));
    attackBuildings(f, a, impact);
    const dir = f.forward(),
      origin = f.pos.clone().setY(0),
      range = a.range ?? 0,
      heavy = a.isUlt || a.landingImpact,
      beam = a.isUlt && a.shape === 'beam' && range >= 3,
      center = impact ? impact.clone() : origin.clone().addScaledVector(dir, range * 0.6);
    center.y = map.surface.y;
    const radius = a.landingImpact
      ? 1.35
      : a.isUlt
        ? f.def.ultStyle === 'dodonpa'
          ? 0.65
          : 1.45
        : a.dmg >= 10
          ? 0.65
          : 0.28;
    for (const item of map.destructibles) {
      if (item.broken || item.building || !item.mesh.visible) continue;
      const delta = item.mesh.getWorldPosition(new THREE.Vector3()).sub(origin).setY(0),
        along = delta.dot(dir),
        side = Math.abs(delta.x * dir.z - delta.z * dir.x),
        near =
          a.isUlt && !impact
            ? along >= 0.1 && along <= range + 0.6 && side < radius
            : (item.bounds
                ? item.bounds
                    .clone()
                    .set(
                      new THREE.Vector3(item.bounds.min.x, 0, item.bounds.min.z),
                      new THREE.Vector3(item.bounds.max.x, 0, item.bounds.max.z),
                    )
                    .distanceToPoint(center.clone().setY(0))
                : item.mesh.position.clone().setY(0).distanceTo(center.clone().setY(0))) < radius;
      if (!near) continue;
      if (item.tile) {
        item.hp -= heavy ? 3 : 1;
        item.stage = item.hp <= 0 ? 3 : item.hp <= 1 ? 2 : 1;
        if (!item.damaged) {
          item.mesh.material = item.mesh.material.clone();
          item.damaged = true;
        }
        item.mesh.material.color.multiplyScalar(item.stage === 3 ? 0.7 : 0.9);
        if (item.stage === 2) item.mesh.position.y -= 0.025;
        if (item.stage === 3) {
          item.broken = true;
          map.brokenTiles++;
          item.mesh.position.y -= heavy ? 0.085 : 0.055;
          // Deterministic transforms allow independent peers to agree on ground height.
          item.mesh.rotation.x = Math.sin(item.id * 7.13) * 0.045;
          item.mesh.rotation.z = Math.cos(item.id * 4.21) * 0.06;
        }
      } else worldModule.damageStageObject(item, a, dir);
    }
    // Persistent ground scars are bounded and reset with the selected arena.
    if (beam && !impact) {
      const count = Math.min(5, Math.max(3, Math.ceil(range / 2.5)));
      for (let i = 0; i < count; i++) {
        const location = origin
          .clone()
          .addScaledVector(dir, 0.75 + ((range - 0.75) * i) / (count - 1));
        location.y = map.surface.y;
        if (!map.playArea || insideArea(map.playArea, location.x, location.z))
          groundScar(map, location, radius * 0.75, true, true, dir);
      }
    } else groundScar(map, center, radius, heavy, false, dir);
    renderModule.spawnDust(center, heavy ? 16 : 4, {
      color: map.surface.dust,
      power: heavy ? 1.35 : 0.7,
      radius: radius * 0.7,
      stageEffect: true,
    });
    if (heavy) {
      stageDebris(
        center,
        map.surface.rubble,
        a.landingImpact ? 12 : 8,
        'stone',
        1.15,
        beam ? dir : null,
      );
      impactWave(center, map.surface, radius);
    }
  };
  return function initialize() {
    if (location.search.includes('test=1'))
      Object.assign(window.__db, {
        readPlayer2Input: inputModule.readPlayer2Input,
        inputEdges2: inputModule.inputEdges2,
        flightPhysics: combatModule.flightPhysics,
        damageStage: worldModule.damageStage,
        damageStageProjectile: worldModule.damageStageProjectile,
        get audioProfiles() {
          return renderModule.ultAudioHistory;
        },
        get ultimateVisuals() {
          return renderModule.ultimateVisuals;
        },
      });
  };
}
