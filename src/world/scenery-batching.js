import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Indexed color buckets and repeated geometry instances; call only on static scenery.
export function batchScenery(root, name, shadows = true, blocker = true, instances = false) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map(),
    originals = new Set(),
    repeats = new Map(),
    meshes = [],
    materials = new Map();
  const shareable = (m) => m.isMeshToonMaterial && !m.map && !m.transparent;
  const colorable = (m) => shareable(m) && !m.vertexColors;
  const style = (m) =>
    [
      m.type,
      m.side,
      m.gradientMap?.uuid,
      m.depthWrite,
      m.emissive.getHex(),
      m.emissiveIntensity,
      m.fog,
    ].join(':');
  function pooled(m, vertexColors) {
    if (!shareable(m)) return m;
    vertexColors ||= m.vertexColors;
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
    if (colorable(o.material)) {
      const colors = new Float32Array(geo.attributes.position.count * 3),
        c = o.material.color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (shareable(o.material)) geo.deleteAttribute('uv');
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
