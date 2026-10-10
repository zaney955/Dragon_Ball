import * as THREE from 'three';

// Short-lived stage particles share buffers and materials. Persistent rubble
// remains in the destructible system and retains its collision and shadows.
export function createStageParticles(map, render, characters) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'),
    gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas),
    definitions = {
      dust: [
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        96,
      ],
      stone: [new THREE.DodecahedronGeometry(1, 0), characters.M(0xffffff), 64],
      wood: [new THREE.BoxGeometry(1, 1, 1), characters.M(0xffffff), 32],
      block: [new THREE.BoxGeometry(1, 1, 1), characters.M(0xffffff), 32],
    },
    groups = {},
    zero = new THREE.Matrix4().makeScale(0, 0, 0),
    matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    fade = new THREE.Vector3(),
    color = new THREE.Color();
  let sequence = 0,
    visualSeed = 73019;
  const random = () => {
    visualSeed = (Math.imul(visualSeed, 1664525) + 1013904223) >>> 0;
    return visualSeed / 4294967296;
  };
  for (const [kind, [geometry, material, count]] of Object.entries(definitions)) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = 'stage-particle-' + kind;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.userData.cameraBlocker = false;
    const slots = Array.from({ length: count }, () => ({ life: 0 }));
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, zero);
      mesh.setColorAt(i, color.setHex(0xffffff));
    }
    map.group.add(mesh);
    groups[kind] = { mesh, slots, cursor: 0 };
  }
  function activeCount() {
    return Object.values(groups).reduce((n, g) => n + g.slots.filter((p) => p.life > 0).length, 0);
  }
  function add(kind, position, velocity, scale, tint, life) {
    // Reserve the remaining budget for the fighters' hit and ability feedback.
    if (activeCount() + render.effects.length >= 160) return;
    const group = groups[kind],
      index = group.cursor++ % group.slots.length;
    group.slots[index] = {
      id: 'stage-pool-' + sequence++,
      position: position.clone(),
      velocity,
      scale,
      color: tint,
      life,
      maxLife: life,
      rotation: new THREE.Euler(random() * 3, random() * 3, random() * 3),
      floor: (map.groundHeight?.(position.x, position.z) ?? map.surface.y) + 0.04,
    };
    group.mesh.setColorAt(index, color.setHex(tint));
    const p = group.slots[index];
    quaternion.setFromEuler(p.rotation);
    matrix.compose(p.position, quaternion, p.scale);
    group.mesh.setMatrixAt(index, matrix);
    group.mesh.instanceMatrix.needsUpdate = true;
    group.mesh.instanceColor.needsUpdate = true;
  }
  function debris(pos, tint, count, kind, power, direction = new THREE.Vector3()) {
    for (let i = 0; i < count; i++) {
      const size = 0.07 + random() * 0.12,
        angle = i * 2.399 + random() * 0.6,
        speed = (1.8 + random() * 3) * power,
        wood = kind === 'wood',
        box = !wood && i % 3 === 0;
      add(
        wood ? 'wood' : box ? 'block' : 'stone',
        pos,
        new THREE.Vector3(
          Math.cos(angle) * speed,
          (2 + random() * 3.5) * power,
          Math.sin(angle) * speed,
        ).addScaledVector(direction, power * 1.5),
        wood
          ? new THREE.Vector3(size * 0.7, size * 0.4, size * 3.6)
          : box
            ? new THREE.Vector3(size * 1.8, size * 0.6, size * 1.4)
            : new THREE.Vector3(size, size, size),
        tint,
        1.4 + random() * 0.5,
      );
    }
  }
  function dust(pos, count, options) {
    const power = options.power ?? 1,
      radius = options.radius ?? 0.08;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399,
        size = (0.3 + random() * 0.35) * power;
      add(
        'dust',
        pos
          .clone()
          .add(new THREE.Vector3(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius)),
        new THREE.Vector3(
          Math.cos(angle) * (0.5 + random()) * power,
          (0.4 + random() * 0.65) * power,
          Math.sin(angle) * (0.5 + random()) * power,
        ),
        new THREE.Vector3(size, size, size),
        options.color ?? 0xcab697,
        options.life ?? 0.65 + power * 0.3 + random() * 0.2,
      );
    }
  }
  function block(pos, dimensions, tint, direction) {
    add(
      'block',
      pos,
      direction.clone().multiplyScalar(1.8).setY(0.4),
      new THREE.Vector3(
        Math.min(1.4, dimensions.x * 0.45),
        Math.min(0.65, dimensions.y * 0.25),
        Math.min(1.2, dimensions.z * 0.3),
      ),
      tint,
      2.2,
    );
  }
  function update(dt) {
    for (const [kind, { mesh, slots }] of Object.entries(groups)) {
      for (let i = 0; i < slots.length; i++) {
        const p = slots[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          mesh.setMatrixAt(i, zero);
          continue;
        }
        p.position.addScaledVector(p.velocity, dt);
        if (kind !== 'dust') {
          p.velocity.y -= 14 * dt;
          p.rotation.x += 3 * dt;
          p.rotation.z += 2 * dt;
          if (p.position.y < p.floor) {
            p.position.y = p.floor;
            p.velocity.y = Math.abs(p.velocity.y) * 0.28;
            p.velocity.x *= 0.65;
            p.velocity.z *= 0.65;
          }
          quaternion.setFromEuler(p.rotation);
        } else quaternion.copy(render.camera.quaternion);
        matrix.compose(p.position, quaternion, p.scale);
        matrix.scale(fade.setScalar(Math.min(1, p.life / 0.25)));
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function snapshot() {
    const rows = [];
    for (const [kind, { mesh, slots }] of Object.entries(groups)) {
      for (let i = 0; i < slots.length && rows.length < 24; i++) {
        const p = slots[i];
        if (!(p.life > 0)) continue;
        mesh.getMatrixAt(i, matrix);
        const scale = new THREE.Vector3(),
          position = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);
        rows.push({
          id: p.id,
          geometry: {
            type:
              kind === 'dust'
                ? 'PlaneGeometry'
                : kind === 'stone'
                  ? 'DodecahedronGeometry'
                  : 'BoxGeometry',
            args: kind === 'dust' ? [1, 1] : kind === 'stone' ? [1, 0] : [1, 1, 1],
          },
          transform: [...position.toArray(), ...quaternion.toArray(), ...scale.toArray(), 1],
          color: p.color,
          opacity: kind === 'dust' ? 0.4 : 1,
          additive: false,
        });
      }
    }
    return rows;
  }
  return { debris, dust, block, update, snapshot, activeCount };
}
