import { rebuildSpace } from '../world/space.js';
import { syncDestruction } from '../world/destruction-batching.js';
import * as THREE from 'three';
import {
  ATTACK_FIELDS,
  FIGHTER_FIELDS,
  GEOMETRY_ARGS,
  pickFields,
  validSpectatorFrame,
} from './spectator-codec.js';

/** Spectators display host snapshots; they never advance combat or send inputs. */
export function createSpectator({ online, animation, combat, match, render, world }) {
  const objects = new Map();
  let snapshot = null,
    arrivedAt = 0,
    lastAt = 0,
    sentSequence = 0;
  const cameraTarget = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  let cameraReady = false,
    cameraYaw = 0;
  const stats = { received: 0, sequence: 0, cameraTarget };
  const quantize = (n) => Math.round(n * 10000) / 10000;
  function transform(node, worldSpace = false) {
    const position = worldSpace ? node.getWorldPosition(new THREE.Vector3()) : node.position;
    const rotation = worldSpace ? node.getWorldQuaternion(new THREE.Quaternion()) : node.quaternion;
    const scale = worldSpace ? node.getWorldScale(new THREE.Vector3()) : node.scale;
    return [
      ...position.toArray(),
      ...rotation.toArray(),
      ...scale.toArray(),
      node.visible ? 1 : 0,
    ].map(quantize);
  }
  function applyTransform(node, data) {
    node.position.fromArray(data);
    node.quaternion.fromArray(data, 3);
    node.scale.fromArray(data, 7);
    node.visible = !!data[10];
  }
  function parts(f) {
    return Object.entries(f.parts).flatMap(([name, value]) =>
      value?.isObject3D
        ? [[name, transform(value)]]
        : Array.isArray(value)
          ? value.flatMap((node, i) =>
              node?.isObject3D && i < 8 ? [[name + ':' + i, transform(node)]] : [],
            )
          : [],
    );
  }
  function actor(f) {
    return {
      pos: f.pos.toArray().map(quantize),
      velocity: [f.vel.x, f.jumpVel ?? 0, f.vel.z].map(quantize),
      root: transform(f.root),
      props: pickFields(f, FIGHTER_FIELDS),
      attack: f.attack ? pickFields(f.attack, ATTACK_FIELDS) : null,
      form: f.youth.form,
      formTime: f.youth.formTime,
      reversedTime: f.youth.reversedTime,
      cooldowns: f.youth.cooldowns,
      heals: f.youth.heals,
      regenerated: f.youth.regenerated,
      weakTime: f.youth.weakTime,
      capsule: f.youth.capsule,
      capsuleTime: f.youth.capsuleTime,
      tailIntact: f.youth.tailIntact,
      weapon: f.youth.weapon,
      parts: parts(f),
    };
  }
  function visual(node) {
    if (!node.isMesh || !node.visible || !node.material || Array.isArray(node.material))
      return null;
    for (let parent = node.parent; parent; parent = parent.parent) if (!parent.visible) return null;
    const geometry = node.geometry,
      keys = GEOMETRY_ARGS[geometry.type];
    let spec;
    if (keys) spec = { type: geometry.type, args: keys.map((k) => geometry.parameters[k]) };
    else if (geometry.type === 'BufferGeometry' && geometry.attributes.position?.count <= 24)
      spec = { type: 'BufferGeometry', args: Array.from(geometry.attributes.position.array) };
    else return null;
    return {
      id: node.uuid,
      geometry: spec,
      transform: transform(node, true),
      color: node.material.color?.getHex() ?? 0xffffff,
      opacity: Math.max(0, Math.min(1, node.material.opacity)),
      additive: node.material.blending === THREE.AdditiveBlending,
    };
  }
  function capture() {
    const map = world.currentMap;
    const visible = [];
    const roots = [
      ...combat.youthEntities.map((e) => e.mesh),
      ...combat.v2Projectiles.map((e) => e.mesh),
      ...render.ultimateVisuals.map((e) => e.rig),
      ...render.effects
        .slice(-40)
        .map((e) => e.mesh)
        .filter(Boolean),
    ];
    const seen = new Set();
    for (const root of roots) {
      root.updateMatrixWorld(true);
      root.traverse((node) => {
        if (visible.length >= 160 || seen.has(node.uuid)) return;
        const v = visual(node);
        if (v) {
          visible.push(v);
          seen.add(node.uuid);
        }
      });
    }
    const frame = {
      seq: ++sentSequence,
      timeLeft: match.game.timeLeft,
      ready: match.game.ready,
      over: match.game.over,
      simTime: match.game.simTime,
      world: {
        senzuTime: map.senzuTime,
        // Infinity means no more spawns; spectators do not run the spawn scheduler.
        senzuNextSpawn: Number.isFinite(map.senzuNextSpawn) ? map.senzuNextSpawn : 0,
        senzuSpawnCount: map.senzuSpawnCount,
        beans: (map.senzus ?? []).map((b) => ({
          active: b.active,
          x: b.x,
          z: b.z,
          expiresAt: Number.isFinite(b.expiresAt) ? b.expiresAt : 0,
        })),
        damaged: (map.destructibles ?? []).flatMap((b, i) =>
          (!b.broken && b.stage > 0) || (b.rubble && b.mesh.visible && !b.broken)
            ? [[i, b.hp, b.stage, transform(b.mesh), b.mesh.material?.color?.getHex() ?? 0xffffff]]
            : [],
        ),
        broken: (map.destructibles ?? []).flatMap((b, i) =>
          b.broken
            ? [
                [
                  i,
                  b.tile ? transform(b.mesh) : [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                  b.mesh.material?.color?.getHex() ?? 0xffffff,
                ],
              ]
            : [],
        ),
      },
      fighters: [actor(match.player), actor(match.enemy)],
      objects: visible,
    };
    // Keep the existing socket message bound, prioritizing fighters and gameplay objects.
    while (JSON.stringify(frame).length > 45000 && frame.objects.length) frame.objects.pop();
    return frame;
  }
  function publish(now) {
    if (
      !online.active ||
      !online.host ||
      online.spectating ||
      !online.room?.spectators ||
      now - lastAt < 100
    )
      return;
    lastAt = now;
    const frame = capture();
    if (validSpectatorFrame(frame))
      online.command({ type: 'spectator-frame', match: online.room.match.id, frame });
  }
  function wrapFighter(f, index) {
    f.onlineBaseRender = f.render;
    f.render = function (dt) {
      this.onlineBaseRender(dt, 1);
      const state = snapshot?.fighters[index];
      if (!state) return;
      applyTransform(this.root, state.root);
      this.root.position.add(this.pos.clone().sub(new THREE.Vector3().fromArray(state.pos)));
      for (const [key, data] of state.parts) {
        const [name, arrayIndex] = key.split(':');
        const node =
          arrayIndex === undefined ? this.parts[name] : this.parts[name]?.[Number(arrayIndex)];
        if (node?.isObject3D) applyTransform(node, data);
      }
      this.root.updateMatrixWorld(true);
    };
  }
  function start() {
    clear();
    snapshot = null;
    arrivedAt = performance.now();
    online.lastPacket = arrivedAt;
    [match.player, match.enemy].forEach(wrapFighter);
  }
  function receive(message) {
    if (
      !online.spectating ||
      !online.active ||
      message.room !== online.room?.id ||
      message.match !== online.room?.match?.id ||
      !validSpectatorFrame(message.frame)
    )
      return;
    if (message.frame.seq <= stats.sequence) return;
    snapshot = message.frame;
    arrivedAt = online.lastPacket = performance.now();
    stats.received++;
    stats.sequence = snapshot.seq;
    [match.player, match.enemy].forEach((f, i) => {
      const data = snapshot.fighters[i];
      if (f.youth.form !== data.form) {
        if (f.youth.form) combat.setYouthBody(f, null);
        if (data.form === 'armor') f.youth.form = 'armor';
        else if (data.form) combat.setYouthBody(f, data.form);
      }
      Object.assign(f, data.props);
      f.youth.formTime = data.formTime;
      f.youth.reversedTime = data.reversedTime ?? 0;
      f.youth.cooldowns = [...data.cooldowns];
      f.youth.heals = data.heals;
      f.youth.regenerated = !!data.regenerated;
      f.youth.weakTime = data.weakTime ?? 0;
      f.youth.capsule = data.capsule ?? null;
      f.youth.capsuleTime = data.capsuleTime ?? 0;
      f.youth.tailIntact = data.tailIntact;
      f.youth.weapon = data.weapon;
      f.v2.mode = data.weapon;
      f.attack = data.attack
        ? {
            ...data.attack,
            anim: animation.authorYouthMove(f.def, data.attack, data.attack.chainIndex ?? 0),
          }
        : null;
      if (stats.received === 1) f.pos.fromArray(data.pos);
      f.previousPos.copy(f.pos);
    });
    match.game.ready = snapshot.ready;
    match.game.timeLeft = snapshot.timeLeft;
    match.game.simTime = snapshot.simTime;
    const map = world.currentMap;
    for (const key of ['senzuTime', 'senzuNextSpawn', 'senzuSpawnCount'])
      map[key] = snapshot.world[key];
    snapshot.world.beans.forEach((bean, i) => {
      const item = map.senzus?.[i];
      if (!item) return;
      Object.assign(item, bean);
      item.group.position.set(bean.x, world.groundHeight(bean.x, bean.z), bean.z);
      item.group.visible = bean.active;
    });
    for (const [index, data, color] of snapshot.world.broken) {
      const item = map.destructibles?.[index];
      if (!item) continue;
      item.broken = true;
      item.hp = 0;
      item.stage = 3;
      applyTransform(item.mesh, data);
      if (item.mesh.material && !item.mesh.userData.damageMaterial) {
        item.mesh.material = item.mesh.material.clone();
        item.mesh.userData.damageMaterial = true;
      }
      item.mesh.material?.color?.setHex(color);
      if (!item.tile) item.mesh.visible = false;
    }
    for (const [index, hp, stage, data, color] of snapshot.world.damaged ?? []) {
      const item = map.destructibles?.[index];
      if (!item) continue;
      item.hp = hp;
      item.stage = stage;
      item.broken = stage === 3;
      applyTransform(item.mesh, data);
      if (item.mesh.material && !item.mesh.userData.damageMaterial) {
        item.mesh.material = item.mesh.material.clone();
        item.mesh.userData.damageMaterial = true;
      }
      item.mesh.material?.color?.setHex(color);
      item.fallen = item.tree && stage >= 2;
      if (!item.tile && !item.broken) item.bounds.copy(new THREE.Box3().setFromObject(item.mesh));
    }
    syncDestruction(map);
    rebuildSpace(map);
    // Host end-of-match state will remove the subscription and return viewers to the lobby.
    const ids = new Set();
    for (const item of snapshot.objects) {
      ids.add(item.id);
      let mesh = objects.get(item.id);
      if (!mesh) {
        let geometry;
        if (item.geometry.type === 'BufferGeometry') {
          geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(item.geometry.args, 3),
          );
          geometry.computeVertexNormals();
        } else geometry = new THREE[item.geometry.type](...item.geometry.args);
        mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: item.color,
            transparent: true,
            opacity: item.opacity,
            side: THREE.DoubleSide,
            depthWrite: !item.additive,
            blending: item.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          }),
        );
        render.scene.add(mesh);
        objects.set(item.id, mesh);
      }
      mesh.material.color.setHex(item.color);
      mesh.material.opacity = item.opacity;
      applyTransform(mesh, item.transform);
    }
    for (const [id, mesh] of objects)
      if (!ids.has(id)) {
        render.scene.remove(mesh);
        world.disposeGroup(mesh);
        objects.delete(id);
      }
  }
  function update(now, dt) {
    if (!snapshot) return;
    const elapsed = Math.min(0.1, (now - arrivedAt) / 1000);
    [match.player, match.enemy].forEach((f, i) => {
      const state = snapshot.fighters[i];
      const target = new THREE.Vector3().fromArray(state.pos);
      if (!snapshot.over)
        target.addScaledVector(new THREE.Vector3().fromArray(state.velocity), elapsed);
      if (f.pos.distanceTo(target) > 3) f.pos.copy(target);
      else f.pos.lerp(target, 1 - Math.exp(-30 * dt));
      f.previousPos.copy(f.pos);
      f.stateTimer = state.props.stateTimer + elapsed;
    });
    match.game.timeLeft = Math.max(0, snapshot.timeLeft - elapsed);
  }
  function camera(dt, snap = false) {
    if (!match.player || !match.enemy) return;
    const a = match.player,
      b = match.enemy;
    const delta = b.pos.clone().sub(a.pos);
    const target = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const boxes = [a, b].map((f) => {
      f.root.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(f.root);
    });
    const height = Math.max(...boxes.map((box) => box.getSize(new THREE.Vector3()).y));
    target.y += height * 0.5;
    const wanted = Math.hypot(delta.x, delta.z) > 1.5 ? Math.atan2(-delta.z, delta.x) : cameraYaw;
    cameraYaw +=
      render.angleDelta(wanted, cameraYaw) * (snap || !cameraReady ? 1 : 1 - Math.exp(-3 * dt));
    const direction = new THREE.Vector3(Math.sin(cameraYaw), 0.3, Math.cos(cameraYaw)).normalize();
    const cam = render.camera;
    cam.aspect = innerWidth / innerHeight;
    cam.fov = 50;
    cam.updateProjectionMatrix();
    // Fit all body/weapon corners in the camera's own horizontal and vertical axes.
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), direction)
      .normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    let distance = 5;
    for (const box of boxes)
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).sub(target);
            const front = point.dot(direction);
            const tangent = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
            distance = Math.max(
              distance,
              front + (Math.abs(point.dot(right)) * 1.2) / (tangent * cam.aspect),
              front + (Math.abs(point.dot(up)) * 1.2) / tangent,
            );
          }
    const position = target.clone().addScaledVector(direction, distance);
    if (snap || !cameraReady) {
      cameraTarget.copy(target);
      cameraPosition.copy(position);
      cameraReady = true;
    } else {
      cameraTarget.lerp(target, 1 - Math.exp(-10 * dt));
      cameraPosition.lerp(position, 1 - Math.exp(-10 * dt));
    }
    cam.position.copy(cameraPosition);
    cam.lookAt(cameraTarget);
  }
  function clear() {
    for (const mesh of objects.values()) {
      render.scene.remove(mesh);
      world.disposeGroup(mesh);
    }
    objects.clear();
    snapshot = null;
    stats.received = stats.sequence = 0;
    cameraReady = false;
    lastAt = 0;
  }
  const baseCamera = render.updateFightCamera;
  render.updateFightCamera = (dt, snap) =>
    online.spectating ? camera(dt, snap) : baseCamera(dt, snap);
  return { start, receive, update, publish, clear, stats, objects };
}
