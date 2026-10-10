import { rebuildSpace } from './space.js';
import { updateDestructionWind } from './destruction-batching.js';
import * as THREE from 'three';

export function register({ world, match, render, audio, combat }) {
  let noiseBuffer,
    voices = 0;
  function tone(kind, power = 0.4) {
    const ctx = audio.actx;
    if (!ctx || ctx.state !== 'running' || match.game.muted || voices >= 3) return;
    const gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      now = ctx.currentTime;
    const bird = kind === 'bird';
    const duration = bird ? 0.24 : kind === 'wind' || kind === 'water' ? 1.2 : 0.12;
    const source =
      bird || kind === 'stone' || kind === 'wood'
        ? ctx.createOscillator()
        : ctx.createBufferSource();
    if (source.frequency) {
      source.type = bird ? 'sine' : kind === 'wood' ? 'triangle' : 'sine';
      source.frequency.setValueAtTime(bird ? 2100 : kind === 'wood' ? 190 : 380, now);
      source.frequency.exponentialRampToValueAtTime(bird ? 3300 : 70, now + duration);
    } else {
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        let seed = 35;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }
      }
      source.buffer = noiseBuffer;
    }
    filter.type = 'lowpass';
    filter.frequency.value = bird ? 5500 : kind === 'water' ? 1200 : kind === 'sand' ? 1800 : 650;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.025 * power, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.audioBus());
    voices++;
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      voices--;
    };
    source.start(now);
    source.stop(now + duration);
  }
  audio.stageSound = tone;
  world.leaveStageRubble = (map, pos, color) => {
    if (!map.rubbleSlots?.length) return;
    const item = map.rubbleSlots[map.rubbleCursor++ % map.rubbleSlots.length];
    item.mesh.visible = true;
    item.mesh.position.copy(pos);
    item.mesh.position.y = world.groundHeight(pos.x, pos.z) + 0.16;
    item.mesh.material.color.setHex(color);
    item.hp = item.maxHp;
    item.broken = false;
    item.stage = 0;
    item.mesh.updateMatrixWorld(true);
    item.bounds.copy(new THREE.Box3().setFromObject(item.mesh));
    map.spaceRevision++;
    rebuildSpace(map);
  };
  world.attachStageFeedback = (map) => {
    map.rubbleSlots = [];
    map.rubbleCursor = 0;
    const rubbleGeometry = new THREE.BoxGeometry(0.85, 0.3, 0.6);
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(rubbleGeometry, world.stageCharacters.M(map.surface.rubble));
      mesh.name = 'stage-persistent-rubble';
      mesh.position.y = -100;
      mesh.visible = false;
      mesh.receiveShadow = true;
      mesh.userData.stageObject = { runtimeRubble: true };
      map.group.add(mesh);
      const item = {
        id: map.destructibles.length,
        rubble: true,
        kind: 'stone',
        mesh,
        bounds: new THREE.Box3().setFromObject(mesh),
        hp: 9,
        maxHp: 9,
        stage: 0,
        broken: false,
      };
      map.rubbleSlots.push(item);
      map.destructibles.push(item);
    }
    rebuildSpace(map);
    const id = map.surface.id,
      trees = map.destructibles.filter((p) => p.tree),
      crowd = [];
    map.group.traverse((o) => {
      if (o.isInstancedMesh && o.name === 'budokai-spectator-detail' && o.count === 192)
        crowd.push({ mesh: o, base: o.instanceMatrix.array.slice() });
    });
    const footprints = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.13, 8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: id === 'kame' ? 0xb09c75 : 0x7f755e,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      96,
    );
    footprints.name = 'stage-footprints';
    footprints.userData.cameraBlocker = false;
    const matrix = new THREE.Matrix4(),
      zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 96; i++) footprints.setMatrixAt(i, zero);
    footprints.frustumCulled = false;
    if (id === 'wild' || id === 'kame') map.group.add(footprints);
    else {
      footprints.geometry.dispose();
      footprints.material.dispose();
    }
    let edgeFlow = null;
    if (id === 'kami') {
      edgeFlow = new THREE.Mesh(
        new THREE.RingGeometry(27.55, 28, 128),
        new THREE.MeshBasicMaterial({
          color: 0xe6f8ff,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      edgeFlow.rotation.x = -Math.PI / 2;
      edgeFlow.position.y = 0.055;
      edgeFlow.name = 'kami-edge-updraft';
      edgeFlow.userData.cameraBlocker = false;
      map.group.add(edgeFlow);
    }
    const tiles = map.destructibles.filter((p) => p.tile);
    const cracks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.018, 0.005, 0.75),
      new THREE.MeshBasicMaterial({ color: 0x655e52 }),
      tiles.length * 3,
    );
    cracks.name = 'stage-persistent-tile-cracks';
    cracks.userData.cameraBlocker = false;
    cracks.frustumCulled = false;
    for (let i = 0; i < cracks.count; i++) cracks.setMatrixAt(i, zero);
    if (tiles.length) map.group.add(cracks);
    else {
      cracks.geometry.dispose();
      cracks.material.dispose();
    }
    const stages = tiles.map(() => -1);
    const walls = map.destructibles.filter(
      (p) => p.building && p.bounds.max.y - p.bounds.min.y > 0.4,
    );
    const wallCracks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.018, 0.48, 0.018),
      new THREE.MeshBasicMaterial({ color: 0x625953 }),
      walls.length * 3,
    );
    wallCracks.name = 'stage-persistent-wall-cracks';
    wallCracks.userData.cameraBlocker = false;
    wallCracks.frustumCulled = false;
    for (let i = 0; i < wallCracks.count; i++) wallCracks.setMatrixAt(i, zero);
    map.group.add(wallCracks);
    const wallStages = walls.map(() => -1);
    const turn = new THREE.Euler();
    let cursor = 0,
      time = 0,
      ambient = 2,
      previous = new WeakMap(),
      stepAt = new WeakMap();
    const update = map.update;
    map.update = (dt) => {
      update(dt);
      time += dt;
      updateDestructionWind(map, time);
      map.edgePulse = Math.max(0, (map.edgePulse ?? 0) - dt);
      if (edgeFlow) edgeFlow.material.opacity = 0.06 + map.edgePulse * 0.4;
      map.reaction = Math.max(0, (map.reaction ?? 0) - dt * 1.4);
      for (let i = 0; i < walls.length; i++) {
        const item = map.destructibles[walls[i].id];
        if (wallStages[i] === item.stage) continue;
        wallStages[i] = item.stage;
        const box = item.bounds,
          xFace = box.max.x - box.min.x < box.max.z - box.min.z;
        for (let branch = 0; branch < 3; branch++) {
          if (!item.stage || item.broken) matrix.copy(zero);
          else {
            turn.set(0, xFace ? Math.PI / 2 : 0, (branch - 1) * 0.65, 'YXZ');
            matrix.makeRotationFromEuler(turn);
            matrix.setPosition(
              xFace ? box.max.x + 0.01 : (box.min.x + box.max.x) / 2 + (branch - 1) * 0.1,
              (box.min.y + box.max.y) / 2 + (branch - 1) * 0.14,
              xFace ? (box.min.z + box.max.z) / 2 + (branch - 1) * 0.1 : box.max.z + 0.01,
            );
          }
          wallCracks.setMatrixAt(i * 3 + branch, matrix);
        }
        wallCracks.instanceMatrix.needsUpdate = true;
      }
      for (let i = 0; i < tiles.length; i++) {
        const item = map.destructibles[tiles[i].id];
        if (stages[i] === item.stage) continue;
        stages[i] = item.stage;
        for (let branch = 0; branch < 3; branch++) {
          if (!item.stage) matrix.copy(zero);
          else {
            const angle = branch * 2.1 + i;
            matrix.makeRotationY(angle);
            matrix.setPosition(
              item.mesh.position.x + Math.sin(angle) * 0.23,
              world.groundHeight(item.mesh.position.x, item.mesh.position.z) + 0.013,
              item.mesh.position.z + Math.cos(angle) * 0.23,
            );
          }
          cracks.setMatrixAt(i * 3 + branch, matrix);
        }
        cracks.instanceMatrix.needsUpdate = true;
      }
      for (const original of trees) {
        const item = map.destructibles[original.id];
        if (item.broken || item.fallen) continue;
        item.mesh.rotation.z =
          Math.sin(time * 1.2 + item.id) * 0.008 + (item.stage === 1 ? 0.035 : 0);
      }
      for (const { mesh, base } of crowd) {
        for (let i = 0; i < mesh.count; i++) {
          matrix.fromArray(base, i * 16);
          matrix.elements[13] += Math.max(0, Math.sin(time * 9 + i * 0.6)) * map.reaction * 0.22;
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (match.game.screen !== 'fight' || match.game.paused || match.game.over) return;
      ambient -= dt;
      if (ambient <= 0) {
        ambient = 3.8;
        tone(id === 'kami' ? 'wind' : id === 'budokai' ? 'wind' : 'water', 0.16);
        if (id === 'kame' || id === 'wild') tone('bird', 0.18);
      }
      for (const f of [match.player, match.enemy]) {
        if (!f) continue;
        const old = previous.get(f) ?? f.pos.clone();
        const moved = old.distanceTo(f.pos);
        if (f.pos.y > 0.05 || moved < 0.42 || time < (stepAt.get(f) ?? 0) + 0.16) continue;
        previous.set(f, f.pos.clone());
        stepAt.set(f, time);
        const y = world.groundHeight(f.pos.x, f.pos.z),
          water = id === 'kame' && y < -0.25;
        tone(water ? 'water' : id === 'kame' ? 'sand' : id === 'wild' ? 'earth' : 'stone', 0.4);
        if (water) {
          if (render.effects.length < 140)
            render.spawnDust(f.pos.clone().setY(-0.35), 3, {
              color: 0xbdeaf0,
              power: 0.45,
              radius: 0.25,
              stageEffect: true,
            });
        } else if (id === 'wild' || id === 'kame') {
          matrix.makeRotationY(f.facingAngle);
          matrix.scale(new THREE.Vector3(0.8, 1, 1.5));
          matrix.setPosition(f.pos.x, y + 0.015, f.pos.z);
          footprints.setMatrixAt(cursor++ % 96, matrix);
          footprints.instanceMatrix.needsUpdate = true;
        }
      }
    };
    return map;
  };
  return function initialize() {
    for (const info of world.MAPS) {
      const build = info.build;
      info.build = () => world.attachStageFeedback(build());
    }
    // Collision presentation does not add HP damage or change the competitive rules.
    if (window.__db) window.__db.damageStageObject = world.damageStageObject;
  };
}
