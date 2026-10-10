import * as THREE from 'three';
export function register({ render: renderModule }) {
  renderModule.angleDelta = function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  };
  let dustTexture;
  renderModule.spawnDust = function spawnDust(pos, count = 5, options = {}) {
    if (options.stageEffect && renderModule.stageDust) {
      renderModule.stageDust(pos, count, options);
      return;
    }
    count = Math.min(
      count,
      Math.max(0, 180 - renderModule.effects.length - (renderModule.activeStageParticles?.() ?? 0)),
    );
    if (!count) return;
    if (!dustTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d'),
        gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      gradient.addColorStop(0, 'rgba(255,255,255,.9)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,.45)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      dustTexture = new THREE.CanvasTexture(canvas);
    }
    const power = options.power ?? 1,
      radius = options.radius ?? 0.08;
    for (let i = 0; i < count; i++) {
      const size = (0.3 + Math.random() * 0.35) * power,
        angle = i * 2.399,
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({
            color: options.color ?? 0xcab697,
            map: dustTexture,
            transparent: true,
            opacity: options.opacity ?? 0.4,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
        life = options.life ?? 0.65 + power * 0.3 + Math.random() * 0.2;
      mesh.position.set(
        pos.x + Math.cos(angle) * radius,
        Math.max(0.08, pos.y + 0.08),
        pos.z + Math.sin(angle) * radius,
      );
      if (renderModule.camera) mesh.quaternion.copy(renderModule.camera.quaternion);
      renderModule.scene.add(mesh);
      renderModule.effects.push({
        mesh,
        type: 'dust',
        kind: options.kind,
        opacity: options.opacity ?? 0.4,
        stageEffect: !!options.stageEffect,
        billboard: true,
        life,
        maxLife: life,
        vel: new THREE.Vector3(
          Math.cos(angle) * (0.5 + Math.random()) * power,
          (0.4 + Math.random() * 0.65) * power,
          Math.sin(angle) * (0.5 + Math.random()) * power,
        ),
      });
    }
  };
  renderModule.spawnTransformSmoke = function (f, previousHeight = 0) {
    const height = Math.max(
      previousHeight,
      f.anatomy ? f.anatomy.hip + f.anatomy.neck : 2.1 * f.baseScale,
    );
    for (const fraction of [0.15, 0.45, 0.75])
      renderModule.spawnDust(f.pos.clone().add(new THREE.Vector3(0, height * fraction, 0)), 9, {
        color: 0xffffff,
        power: 1.6,
        radius: 0.3,
        opacity: 1,
        life: 0.75,
        kind: 'transformSmoke',
      });
  };
  renderModule.spawnSpark = function spawnSpark(pos, color, count, power = 1) {
    count = Math.min(
      count,
      Math.max(0, 180 - renderModule.effects.length - (renderModule.activeStageParticles?.() ?? 0)),
    );
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(renderModule.sparkGeo, mat);
      m.position.copy(pos);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.75 - 0.12,
        Math.random() - 0.5,
      ).normalize();
      renderModule.effects.push({
        mesh: m,
        vel: dir.multiplyScalar((3.5 + Math.random() * 9) * power),
        life: 0.28 + Math.random() * 0.4,
        maxLife: 0.68,
        gravity: -14,
        type: 'spark',
        delay: 0,
      });
      renderModule.scene.add(m);
    }
  };
  renderModule.spawnShockRing = function spawnShockRing(pos, color, scale) {
    const ring = new THREE.Mesh(
      renderModule.ringGeo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.copy(pos);
    ring.scale.setScalar(scale);
    renderModule.scene.add(ring);
    renderModule.effects.push({
      mesh: ring,
      vel: new THREE.Vector3(),
      life: 0.19,
      maxLife: 0.19,
      type: 'ring',
      startScale: scale * 0.5,
      grow: scale * 0.75,
      delay: 0,
    });
  };
  renderModule.updateEffects = function updateEffects(dt) {
    for (let i = renderModule.effects.length - 1; i >= 0; i--) {
      const e = renderModule.effects[i];
      if (e.delay > 0) {
        e.delay -= dt;
        if (e.delay > 0) {
          if (e.mesh) e.mesh.visible = false;
          continue;
        } else {
          if (e.mesh) e.mesh.visible = true;
        }
      }
      e.life -= dt;
      if (e.life <= 0) {
        renderModule.scene.remove(e.mesh);
        if (
          e.mesh.geometry &&
          e.mesh.geometry !== renderModule.sparkGeo &&
          e.mesh.geometry !== renderModule.ringGeo
        )
          e.mesh.geometry.dispose();
        if (e.mesh.material) e.mesh.material.dispose();
        renderModule.effects.splice(i, 1);
        continue;
      }
      const t = 1 - e.life / e.maxLife;
      if (e.type === 'dust') {
        e.mesh.position.addScaledVector(e.vel, dt);
        e.vel.multiplyScalar(Math.exp(-dt * 2));
        if (e.billboard && renderModule.camera)
          e.mesh.quaternion.copy(renderModule.camera.quaternion);
        e.mesh.scale.setScalar(1 + t * 2.8);
        e.mesh.material.opacity = (1 - t) * (e.opacity ?? 0.4);
      } else if (e.type === 'boundAura') {
        e.mesh.position.copy(e.owner.pos).add(e.offset);
        e.mesh.rotation.y += dt * 3;
        e.mesh.rotation.z += dt * 1.5;
        e.mesh.scale.setScalar(1 + Math.sin(t * 24) * 0.08);
        e.mesh.material.opacity = Math.min(0.65, e.life * 3);
        if (
          e.owner.hp <= 0 ||
          (e.attack && e.owner.attack !== e.attack) ||
          (e.control && e.owner.v2.controlTime <= 0)
        )
          e.life = 0;
      } else if (e.type === 'solarRay') {
        e.mesh.position.copy(e.owner.pos).add(e.offset);
        e.mesh.rotation.z = e.angle + t * 0.2;
        const firing = e.owner.stateTimer >= e.attack.hitT;
        e.mesh.scale.setScalar(firing ? 1 + t * 3 : 0.3 + t);
        e.mesh.material.opacity = firing ? (1 - t) * 0.95 : 0.35;
        if (e.owner.attack !== e.attack || e.owner.hp <= 0) e.life = 0;
      } else if (e.type === 'debris') {
        e.vel.y -= 12 * dt;
        e.mesh.position.addScaledVector(e.vel, dt);
        if ((e.bounces ?? 0) < 3) {
          e.mesh.rotation.x += dt * (e.spin?.x ?? 5);
          e.mesh.rotation.y += dt * (e.spin?.y ?? 0);
          e.mesh.rotation.z += dt * (e.spin?.z ?? 3);
        }
        const floor = e.floor ?? 0.04;
        if (e.mesh.position.y < floor) {
          e.mesh.position.y = floor;
          e.bounces = (e.bounces ?? 0) + 1;
          e.vel.multiplyScalar(0.45);
          e.vel.y = e.bounces < 3 ? Math.abs(e.vel.y) * 0.35 : 0;
        }
        e.mesh.scale.setScalar(Math.max(0.01, Math.min(1, (1 - t) * 4)));
      } else if (e.type === 'stageShock') {
        e.mesh.scale.setScalar(e.startScale + t * e.grow);
        e.mesh.material.opacity = (1 - t) * 0.5;
      } else if (e.type === 'spark') {
        e.vel.y += e.gravity * dt;
        e.mesh.position.addScaledVector(e.vel, dt);
        e.mesh.material.opacity = Math.min(1, e.life / 0.3);
        e.mesh.scale.setScalar(Math.max(0.06, 1 - t * 0.88));
      } else if (e.type === 'ring') {
        e.mesh.scale.setScalar((e.startScale ?? 0.5) + t * e.grow);
        e.mesh.material.opacity = (1 - t) * 0.95;
      } else if (e.type === 'beam') {
        if (e.spin) e.mesh.rotation.x += e.spin * dt;
        e.mesh.material.opacity = (1 - t) * 0.8;
        const s = 1 + t * 0.35;
        e.mesh.scale.set(s, 1, s);
      } else if (e.type === 'spinRing') {
        e.mesh.rotation.z += e.spin * dt;
        e.mesh.scale.setScalar(1 + t * 1.4);
        e.mesh.material.opacity = (1 - t) * 0.9;
      } else if (e.type === 'afterimage') {
        e.mesh.material.opacity = (1 - t) * 0.3;
      } else if (e.type === 'orb') {
        e.mesh.position.addScaledVector(e.vel, dt);
        e.mesh.scale.setScalar(1 + t * (e.grow || 1));
        e.mesh.material.opacity = (1 - t) * 0.85;
      } else if (e.type === 'chargeOrb') {
        let s;
        if (t < 0.75) s = 0.15 + (t / 0.75) * 1.15;
        else s = 1.3 - ((t - 0.75) / 0.25) * 0.9;
        e.mesh.scale.setScalar(Math.max(0.1, s));
        e.mesh.material.opacity = t < 0.82 ? Math.min(1, t * 3.5) : Math.max(0, (1 - t) * 5);
        e.mesh.rotation.y += dt * 3;
        e.mesh.rotation.x += dt * 1.8;
      } else if (e.type === 'chargeCore') {
        let s;
        if (t < 0.75) s = 0.1 + (t / 0.75) * 0.95;
        else s = 1.05 - ((t - 0.75) / 0.25) * 0.8;
        e.mesh.scale.setScalar(Math.max(0.08, s));
        e.mesh.material.opacity = t < 0.8 ? Math.min(1, t * 4) : Math.max(0, (1 - t) * 5);
      } else if (e.type === 'chargePillar') {
        e.mesh.material.opacity = (1 - t) * 0.4 * Math.min(1, t * 3);
        const s = 0.8 + t * 0.5;
        e.mesh.scale.set(s, 1, s);
      } else if (e.type === 'converge') {
        e.mesh.position.addScaledVector(e.vel, dt);
        e.mesh.material.opacity = Math.min(1, e.life / 0.3) * 0.9;
        e.mesh.scale.setScalar(Math.max(0.05, 1 - t * 0.9));
      } else if (e.type === 'muzzle') {
        const s = 1 + t * 0.8;
        e.mesh.scale.setScalar(s);
        e.mesh.material.opacity = t < 0.15 ? t / 0.15 : (1 - t) * 0.9;
      }
    }
  };
  renderModule.spawnBoundAura = function (owner, color, life, attack = null, control = false) {
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.018, 6, 24),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = Math.PI / 2 + i * 0.25;
      const offset = new THREE.Vector3(0, 0.5 + i * 0.35, 0);
      mesh.position.copy(owner.pos).add(offset);
      renderModule.scene.add(mesh);
      renderModule.effects.push({
        mesh,
        type: 'boundAura',
        owner,
        offset,
        attack,
        control,
        life,
        maxLife: life,
      });
    }
  };
  renderModule.spawnSolarFlare = function (owner, attack) {
    const offset = new THREE.Vector3(0, 2 * owner.baseScale, 0.1);
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.055, 1.2),
        new THREE.MeshBasicMaterial({
          color: 0xfff5cf,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.rotation.y = owner.facingAngle;
      mesh.rotation.z = angle;
      mesh.position.copy(owner.pos).add(offset);
      renderModule.scene.add(mesh);
      const life = attack.hitT + attack.active + 0.2;
      renderModule.effects.push({
        mesh,
        type: 'solarRay',
        owner,
        attack,
        offset,
        angle,
        life,
        maxLife: life,
      });
    }
    renderModule.spawnSpark(owner.pos.clone().add(offset), 0xffffff, 12, 0.15);
  };
  return function initialize() {
    renderModule.CONTACT_PHASE = {
      jab: 0.28,
      cross: 0.3,
      hook: 0.48,
      uppercut: 0.44,
      spinKick: 0.46,
      heavyPunch: 0.5,
      heavyKick: 0.48,
      sweep: 0.5,
      palmStrike: 0.38,
      elbow: 0.4,
      knee: 0.4,
      staffSweep: 0.48,
      staffSmash: 0.48,
      doublePalm: 0.45,
      claw: 0.4,
      backClaw: 0.4,
      solarFlare: 0.45,
      magicFlash: 0.5,
      rushPalm: 0.4,
    };
    renderModule.sparkGeo = new THREE.SphereGeometry(0.075, 6, 6);
    renderModule.ringGeo = new THREE.RingGeometry(0.3, 0.55, 32);
    renderModule.effects = [];
  };
}
