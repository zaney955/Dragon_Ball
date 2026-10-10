import * as THREE from 'three';

const CELL = 4;
const clamp = THREE.MathUtils.clamp;
export function coastPoint(a, t = 1) {
  const edge = 1 + 0.032 * Math.sin(3 * a + 0.7) + 0.018 * Math.sin(7 * a);
  const r = t * (1 + (edge - 1) * t ** 4);
  return [Math.cos(a) * 31 * r, -7 + Math.sin(a) * 27 * r];
}
export const WILD_AREA = {
  type: 'polygon',
  points: [
    [-30, 22],
    [-34, 5],
    [-33, -16],
    [-23, -31],
    [-14, -34],
    [2, -34],
    [22, -30],
    [34, -16],
    [35, 8],
    [29, 25],
    [0, 28],
  ],
};
export function areaFor(id) {
  if (id === 'budokai') return { type: 'rectangle', x: 14.5, z: 7.5 };
  if (id === 'kami') return { type: 'circle', radius: 28 };
  if (id === 'wild') return structuredClone(WILD_AREA);
  // The contour is sampled from the same shoreline generator as the terrain.
  return {
    type: 'polygon',
    points: Array.from({ length: 128 }, (_, i) => coastPoint((i * Math.PI) / 64, 0.95)),
    shoreline: true,
  };
}
function nearestEdge(points, x, z) {
  let best = { distance: Infinity },
    inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j],
      [bx, bz] = points[i],
      dx = bx - ax,
      dz = bz - az;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t,
      pz = az + dz * t,
      distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance) best = { x: px, z: pz, distance, nx: -dz, nz: dx };
  }
  // Polygon winding may be clockwise or counterclockwise.
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const n = Math.hypot(best.nx, best.nz) * (area >= 0 ? 1 : -1);
  best.nx /= n;
  best.nz /= n;
  return { ...best, inside };
}
export function constrainArea(area, p, radius = 0) {
  const cx = area.cx ?? 0,
    cz = area.cz ?? 0;
  if (area.type === 'rectangle') {
    p.x = clamp(p.x, cx - area.x + radius, cx + area.x - radius);
    p.z = clamp(p.z, cz - area.z + radius, cz + area.z - radius);
  } else if (area.type === 'circle' || area.type === 'ellipse') {
    const rx = (area.radius ?? area.x) - radius,
      rz = (area.radius ?? area.z) - radius;
    const d = Math.hypot((p.x - cx) / rx, (p.z - cz) / rz);
    if (d > 1) {
      p.x = cx + (p.x - cx) / d;
      p.z = cz + (p.z - cz) / d;
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const e = nearestEdge(area.points, p.x, p.z);
      if (e.inside && e.distance >= radius - 1e-5) break;
      p.x = e.x + e.nx * (radius + 0.0001);
      p.z = e.z + e.nz * (radius + 0.0001);
    }
  }
  return p;
}
export function insideArea(area, x, z, radius = 0) {
  const p = constrainArea(area, { x, z }, radius);
  return Math.hypot(p.x - x, p.z - z) < 0.001;
}
// Reconstructed terrain is sampled once into short per-cell triangle lists.
// Queries use barycentric interpolation on the rendered faces, never a mesh raycast.
function terrainSampler(mesh, fallback) {
  if (!mesh) return () => fallback;
  const geo = mesh.geometry,
    p = geo.attributes.position,
    ids = geo.index?.array,
    cells = new Map();
  for (let i = 0; i < (ids?.length ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((j) =>
      new THREE.Vector3().fromBufferAttribute(p, ids ? ids[i + j] : i + j),
    );
    const xs = vertices.map((v) => v.x),
      zs = vertices.map((v) => v.z);
    for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++)
      for (
        let z = Math.floor(Math.min(...zs) / CELL);
        z <= Math.floor(Math.max(...zs) / CELL);
        z++
      ) {
        const key = x + ':' + z;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(vertices);
      }
  }
  return (x, z) => {
    let height = -Infinity;
    for (const [a, b, c] of cells.get(Math.floor(x / CELL) + ':' + Math.floor(z / CELL)) ?? []) {
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-8) continue;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
      if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001)
        height = Math.max(height, u * a.y + v * b.y + (1 - u - v) * c.y);
    }
    return Number.isFinite(height) ? height : fallback;
  };
}
const spaces = new WeakMap();
export function setupSpace(map, id) {
  map.playArea = areaFor(id);
  map.bounds =
    id === 'budokai'
      ? { x: 14.5, z: 7.5 }
      : id === 'kami'
        ? { x: 28, z: 28 }
        : id === 'wild'
          ? { x: 35, z: 34 }
          : { x: 32, z: 34 };
  const ground = terrainSampler(
    map.group.getObjectByName(
      id === 'wild' ? 'wild-valley-terrain' : id === 'kame' ? 'kame-sculpted-island' : '__none',
    ),
    0,
  );
  const terrace = map.group.getObjectByName('wild-home-terrace');
  const terraceMeshes = terrace
    ? terrace.children.filter((o) => o.isMesh).map((o) => terrainSampler(o, -Infinity))
    : [];
  const tiles = map.destructibles.filter((p) => p.tile);
  const tileGrid = new Map(
    tiles.map((p) => [Math.round(p.mesh.position.x) + ':' + Math.round(p.mesh.position.z), p.id]),
  );
  const sample = (x, z) => {
    let y = ground(x, z);
    if (id === 'wild') for (const top of terraceMeshes) y = Math.max(y, top(x, z));
    if (id === 'budokai') {
      const key = Math.round((x + 1) / 2) * 2 - 1 + ':' + Math.round(z / 2) * 2;
      const tile = map.destructibles[tileGrid.get(key)];
      if (tile?.stage >= 2) y = Math.max(-0.1, tile.mesh.position.y + 0.066);
    }
    return y;
  };
  Object.defineProperty(map, 'groundHeight', { configurable: true, value: sample });
  rebuildSpace(map);
  return map;
}
export function rebuildSpace(map) {
  const cells = new Map();
  map.group.updateMatrixWorld(true);
  map.destructibles.forEach((item, index) => {
    item.id ??= index;
    item.maxHp ??= item.hp;
    if (item.tile) return;
    item.bounds ??= new THREE.Box3().setFromObject(item.mesh);
    if (item.tree && !item.broken) {
      Object.defineProperty(item, 'cameraBounds', {
        configurable: true,
        writable: true,
        value: new THREE.Box3().setFromObject(item.mesh),
      });
      if (!item.fallen) item.cameraBounds.min.y = item.mesh.position.y + item.height * 0.55;
    }
    const box = item.bounds;
    for (let x = Math.floor(box.min.x / CELL); x <= Math.floor(box.max.x / CELL); x++)
      for (let z = Math.floor(box.min.z / CELL); z <= Math.floor(box.max.z / CELL); z++) {
        const key = x + ':' + z;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
  });
  spaces.set(map, { cells });
}
export function querySpace(map, minX, minZ, maxX, maxZ) {
  const grid = spaces.get(map);
  if (!grid) return (map?.destructibles ?? []).filter((p) => !p.tile && !p.broken);
  const found = new Set();
  for (let x = Math.floor(minX / CELL); x <= Math.floor(maxX / CELL); x++)
    for (let z = Math.floor(minZ / CELL); z <= Math.floor(maxZ / CELL); z++)
      for (const item of grid.cells.get(x + ':' + z) ?? [])
        if (!item.broken && item.collidable !== false) {
          let visible = true;
          for (let node = item.mesh; node; node = node.parent)
            if (!node.visible) {
              visible = false;
              break;
            }
          if (visible) found.add(item);
        }
  return [...found];
}
export function segmentHit(map, from, to, radius = 0, camera = false) {
  const delta = to.clone().sub(from),
    length = delta.length();
  if (length < 1e-8) return null;
  const ray = new THREE.Ray(from, delta.divideScalar(length)),
    point = new THREE.Vector3();
  let hit = null;
  for (const item of querySpace(
    map,
    Math.min(from.x, to.x) - radius - (camera ? 5 : 0),
    Math.min(from.z, to.z) - radius - (camera ? 5 : 0),
    Math.max(from.x, to.x) + radius + (camera ? 5 : 0),
    Math.max(from.z, to.z) + radius + (camera ? 5 : 0),
  )) {
    item.bounds ??= new THREE.Box3().setFromObject(item.mesh);
    const box = (camera ? (item.cameraBounds ?? item.bounds) : item.bounds)
      .clone()
      .expandByScalar(radius);
    if (!box.containsPoint(from) && !ray.intersectBox(box, point)) continue;
    const distance = box.containsPoint(from) ? 0 : point.distanceTo(from);
    if (distance <= length && (!hit || distance < hit.distance))
      hit = { item, distance, point: from.clone().addScaledVector(ray.direction, distance) };
  }
  return hit;
}
function pushOut(map, p, radius, height) {
  const y = p.y + (map.groundHeight?.(p.x, p.z) ?? 0);
  const contacts = [];
  for (const item of querySpace(map, p.x - radius, p.z - radius, p.x + radius, p.z + radius)) {
    const b = item.bounds;
    if (y >= b.max.y - 0.08 || y + height <= b.min.y + 0.06) continue;
    const x = clamp(p.x, b.min.x, b.max.x),
      z = clamp(p.z, b.min.z, b.max.z);
    const dx = p.x - x,
      dz = p.z - z,
      d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    if (d > 1e-6) {
      p.x += (dx / d) * (radius - d);
      p.z += (dz / d) * (radius - d);
    } else {
      const sides = [
        [b.min.x - radius - p.x, 0],
        [b.max.x + radius - p.x, 0],
        [0, b.min.z - radius - p.z],
        [0, b.max.z + radius - p.z],
      ];
      sides.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
      p.x += sides[0][0];
      p.z += sides[0][1];
    }
    contacts.push(item);
  }
  return contacts;
}
export function moveInSpace(map, from, target, radius = 0.3, height = 2, extra = 0) {
  if (!map?.playArea) return [];
  const wanted = target.clone(),
    p = from.clone();
  const distance = Math.hypot(wanted.x - from.x, wanted.z - from.z);
  const steps = Math.min(2048, Math.max(1, Math.ceil(distance / Math.max(0.1, radius * 0.5))));
  const contacts = new Set();
  const area =
    extra && map.playArea.type === 'rectangle'
      ? { ...map.playArea, x: map.playArea.x + extra, z: map.playArea.z + extra }
      : map.playArea;
  const dx = (wanted.x - from.x) / steps,
    dz = (wanted.z - from.z) / steps;
  for (let n = 0; n < steps; n++) {
    p.x += dx;
    p.z += dz;
    p.y = THREE.MathUtils.lerp(from.y, wanted.y, (n + 1) / steps);
    constrainArea(area, p, radius);
    for (let j = 0; j < 3; j++)
      for (const item of pushOut(map, p, radius, height)) contacts.add(item);
    constrainArea(area, p, radius);
  }
  target.copy(p);
  target.y = Math.max(0, wanted.y);
  return [...contacts];
}
export function positionFree(map, x, z, radius = 0.5, margin = 0) {
  if (!insideArea(map.playArea, x, z, radius + margin)) return false;
  const p = new THREE.Vector3(x, 0, z);
  return pushOut(map, p, radius, 2).length === 0;
}
// Small cached A* grids are rebuilt only after a topology change, with bounded work.
const paths = new WeakMap();
export function routeDirection(map, from, goal, radius = 0.4) {
  const start = new THREE.Vector3(
    from.x,
    from.y + (map.groundHeight?.(from.x, from.z) ?? 0) + 0.7,
    from.z,
  );
  const end = new THREE.Vector3(goal.x, start.y, goal.z);
  if (!segmentHit(map, start, end, radius)) return { x: goal.x - from.x, z: goal.z - from.z };
  let cache = paths.get(map);
  if (!cache || cache.revision !== map.spaceRevision) {
    cache = { revision: map.spaceRevision, free: new Map() };
    paths.set(map, cache);
  }
  const cell = 1.5,
    key = (x, z) => x + ':' + z;
  const free = (x, z) => {
    const k = key(x, z);
    if (!cache.free.has(k)) cache.free.set(k, positionFree(map, x * cell, z * cell, radius));
    return cache.free.get(k);
  };
  const sx = Math.round(from.x / cell),
    sz = Math.round(from.z / cell),
    gx = Math.round(goal.x / cell),
    gz = Math.round(goal.z / cell);
  const first = { x: sx, z: sz, cost: 0 },
    open = [first],
    visited = new Map([[key(sx, sz), first]]);
  let best = first;
  for (let count = 0; open.length && count < 2400; count++) {
    open.sort(
      (a, b) => a.cost + Math.hypot(a.x - gx, a.z - gz) - (b.cost + Math.hypot(b.x - gx, b.z - gz)),
    );
    const node = open.shift();
    if (Math.hypot(node.x - gx, node.z - gz) < Math.hypot(best.x - gx, best.z - gz)) best = node;
    if (node.x === gx && node.z === gz) {
      best = node;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz,
        k = key(x, z),
        cost = node.cost + Math.hypot(dx, dz);
      if (
        visited.get(k)?.cost <= cost ||
        !free(x, z) ||
        (dx && dz && (!free(node.x + dx, node.z) || !free(node.x, node.z + dz)))
      )
        continue;
      const next = { x, z, cost, parent: node };
      visited.set(k, next);
      open.push(next);
    }
  }
  while (best.parent && best.parent !== first) best = best.parent;
  return { x: best.x * cell - from.x, z: best.z * cell - from.z };
}
export function register({ world, match, render, audio, combat }) {
  const bodyRadius = (f) => Math.max(0.3 * f.baseScale, (f.anatomy?.torsoR ?? 0) * 0.82);
  const bodyHeight = (f) => (combat.stature?.(f) ?? 2.1 * f.baseScale) + (f.anatomy?.headR ?? 0);
  world.setupSpace = setupSpace;
  world.rebuildSpace = rebuildSpace;
  world.querySpace = (...args) => querySpace(world.currentMap, ...args);
  world.stageSegmentHit = (from, to, radius = 0) => segmentHit(world.currentMap, from, to, radius);
  world.stageCameraHit = (from, to) => segmentHit(world.currentMap, from, to, 0.2, true);
  world.groundHeight = (x, z) => world.currentMap?.groundHeight?.(x, z) ?? 0;
  world.validPosition = (x, z, radius = 0.5, margin = 0) =>
    world.currentMap?.playArea ? positionFree(world.currentMap, x, z, radius, margin) : true;
  world.constrainVisual = (from, to, f) =>
    moveInSpace(
      world.currentMap,
      from,
      to,
      bodyRadius(f),
      bodyHeight(f),
      match.game.ringOut && match.game.selectedMap === 0 ? 2.5 : 0,
    );
  world.resolveStageMovement = (f) => {
    const map = world.currentMap;
    if (!map?.playArea) return;
    const from = f.spacePosition?.clone() ?? f.pos.clone();
    const wanted = f.pos.clone();
    const contacts = moveInSpace(
      map,
      from,
      f.pos,
      bodyRadius(f),
      bodyHeight(f),
      match.game.ringOut && match.game.selectedMap === 0 ? 2.5 : 0,
    );
    f.spacePosition = f.pos.clone();
    const blocked = Math.hypot(wanted.x - f.pos.x, wanted.z - f.pos.z);
    const speed = Math.hypot(f.vel.x, f.vel.z);
    if (
      blocked > 0.003 &&
      speed > 7 &&
      ['hit', 'dash', 'knockdown'].includes(f.state) &&
      (f.stageImpactAt ?? -10) + 0.25 < match.game.simTime
    ) {
      f.stageImpactAt = match.game.simTime;
      const pos = f.pos.clone();
      pos.y += world.groundHeight(pos.x, pos.z) + 0.5;
      if (contacts.length)
        world.damageStageObject?.(contacts[0], { dmg: Math.min(22, speed * 0.8) }, f.forward());
      else world.damageStage?.(f, { dmg: 12, landingImpact: true }, pos);
      render.spawnDust(pos, 8, { color: map.surface.dust, stageEffect: true });
      audio.stageSound?.(contacts[0]?.kind ?? 'stone', 1);
      f.vel.x *= 0.25;
      f.vel.z *= 0.25;
    }
    if (
      blocked > 0.005 &&
      ['kami', 'kame'].includes(map.surface.id) &&
      !insideArea(map.playArea, wanted.x, wanted.z, bodyRadius(f)) &&
      (f.edgeNoticeAt ?? -10) + 3 < match.game.simTime
    ) {
      f.edgeNoticeAt = match.game.simTime;
      map.edgePulse = 1;
      if (!match.game.manualTest)
        match.notify(
          map.surface.id === 'kami' ? '平台边缘 · 气流将你托回场内' : '前方深水 · 已回到浅滩',
          0.9,
        );
    }
  };
  return function initialize() {
    if (window.__db)
      Object.assign(window.__db, {
        insideArea,
        moveInSpace: (...args) => moveInSpace(world.currentMap, ...args),
        positionFree: (...args) => positionFree(world.currentMap, ...args),
        stageSegmentHit: world.stageSegmentHit,
        groundHeight: world.groundHeight,
      });
  };
}
