import * as THREE from 'three';

// Damage proxies keep their own health and transforms. Their visible geometry is
// drawn in a few material buckets, and changed ranges are uploaded only on damage.
const batches = new WeakMap();
export function batchDestruction(map, characters) {
  map.group.updateMatrixWorld(true);
  const buckets = new Map(),
    seen = new Set(),
    windTime = { value: 0 };
  for (const item of map.destructibles) {
    if (item.tile || item.animated) continue;
    const nodes = [];
    item.mesh.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && !seen.has(o)) {
        nodes.push(o);
        seen.add(o);
      }
    });
    for (const node of nodes) {
      const mat = node.material;
      const key = [mat.side, mat.transparent, mat.depthWrite, mat.map?.uuid ?? ''].join(':');
      if (!buckets.has(key)) buckets.set(key, { mat, pieces: [] });
      buckets.get(key).pieces.push({ item, node });
      node.layers.set(31);
    }
  }
  const records = [];
  for (const { mat, pieces } of buckets.values()) {
    const count = pieces.reduce((n, p) => n + p.node.geometry.attributes.position.count, 0);
    const positions = new Float32Array(count * 3),
      normals = new Float32Array(count * 3),
      colors = new Float32Array(count * 3),
      uv = new Float32Array(count * 2),
      wind = new Float32Array(count),
      indices = [];
    let offset = 0;
    for (const piece of pieces) {
      const geo = piece.node.geometry,
        n = geo.attributes.position.count;
      for (const i of geo.index?.array ?? Array.from({ length: n }, (_, i) => i))
        indices.push(i + offset);
      piece.offset = offset;
      piece.count = n;
      const c = geo.attributes.color;
      piece.baseColors = c ? new Float32Array(c.array) : null;
      const coords = geo.attributes.uv;
      if (coords) uv.set(coords.array, offset * 2);
      records.push({ ...piece, positions, normals, colors, wind });
      offset += n;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute(
      'normal',
      new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute('stageWind', new THREE.BufferAttribute(wind, 1));
    if (mat.map) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(indices);
    const material = characters.M(0xffffff);
    material.vertexColors = true;
    material.side = mat.side;
    material.map = mat.map;
    material.transparent = mat.transparent;
    material.opacity = mat.opacity;
    material.depthWrite = mat.depthWrite;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.stageTime = windTime;
      shader.vertexShader =
        'uniform float stageTime; attribute float stageWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.x += sin(stageTime * 1.2 + position.z * 0.2) * stageWind;',
      );
    };
    material.customProgramCacheKey = () => 'stage-wind-1';
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'stage-destruction-batch';
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.cameraBlocker = false;
    mesh.frustumCulled = false;
    map.group.add(mesh);
    for (const record of records.filter((r) => r.positions === positions)) record.output = geo;
  }
  records.windTime = windTime;
  batches.set(map, records);
  syncDestruction(map);
}
export function syncDestruction(map, only = null) {
  map.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(),
    n = new THREE.Vector3(),
    normalMatrix = new THREE.Matrix3();
  for (const r of batches.get(map) ?? []) {
    r.item = map.destructibles[r.item.id] ?? r.item;
    if (only && r.item !== only) {
      let related = false;
      for (let node = r.node; node; node = node.parent)
        if (node === only.mesh) {
          related = true;
          break;
        }
      if (!related) continue;
    }
    const { item, node, output, offset, count } = r;
    normalMatrix.getNormalMatrix(node.matrixWorld);
    const multiplier = node.material.color;
    const parentTint =
      item.building && node !== item.mesh ? item.mesh.material.color : { r: 1, g: 1, b: 1 };
    const tint = [
      multiplier.r * parentTint.r,
      multiplier.g * parentTint.g,
      multiplier.b * parentTint.b,
    ];
    let visible = true;
    for (let parent = node; parent; parent = parent.parent)
      if (!parent.visible) {
        visible = false;
        break;
      }
    for (let i = 0; i < count; i++) {
      const k = (offset + i) * 3;
      if (!visible || item.broken) {
        r.positions[k] = r.positions[k + 2] = 0;
        r.positions[k + 1] = -1000;
        r.wind[offset + i] = 0;
        continue;
      }
      p.fromBufferAttribute(node.geometry.attributes.position, i).applyMatrix4(node.matrixWorld);
      n.fromBufferAttribute(node.geometry.attributes.normal, i)
        .applyMatrix3(normalMatrix)
        .normalize();
      r.wind[offset + i] =
        item.tree && !item.fallen && !item.broken
          ? Math.max(0, Math.min(0.08, (p.y - item.mesh.position.y - 1) * 0.012))
          : 0;
      r.positions[k] = p.x;
      r.positions[k + 1] = p.y;
      r.positions[k + 2] = p.z;
      r.normals[k] = n.x;
      r.normals[k + 1] = n.y;
      r.normals[k + 2] = n.z;
      for (let j = 0; j < 3; j++) r.colors[k + j] = (r.baseColors?.[i * 3 + j] ?? 1) * tint[j];
    }
    for (const attribute of [
      output.attributes.position,
      output.attributes.normal,
      output.attributes.color,
    ]) {
      attribute.addUpdateRange(offset * 3, count * 3);
      attribute.needsUpdate = true;
    }
    output.attributes.stageWind.needsUpdate = true;
  }
}
export function updateDestructionWind(map, time) {
  const records = batches.get(map);
  if (records) records.windTime.value = time;
}
