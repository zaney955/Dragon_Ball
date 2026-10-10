import * as THREE from 'three';
export function register({
  animation: animationModule,
  audio: audioModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  world: worldModule,
}) {
  let kiBlasts;
  combatModule.kiColor = function kiColor(f) {
    return f.def.id === 'piccolo'
      ? 0xb0f18a
      : f.def.id === 'taopaipai'
        ? 0xff95c5
        : f.def.id === 'tien'
          ? 0xffedaa
          : 0x8eeaff;
  };
  combatModule.warnKi = function warnKi(f, cost) {
    f.kiWarning = 0.65;
    if (!matchModule.game.manualTest && f === matchModule.player)
      matchModule.notify('气力不足 · 需要 ' + cost + ' 气', 0.65);
  };
  combatModule.kiBlastPower = function kiBlastPower(held, available = 100) {
    const charged = held >= combatModule.KI_RULES.blastThreshold && available >= 12;
    const level = charged
      ? Math.min(
          1,
          Math.max(
            0,
            (held - combatModule.KI_RULES.blastThreshold) /
              (combatModule.KI_RULES.blastMaxHold - combatModule.KI_RULES.blastThreshold),
          ),
          Math.max(0, (Math.floor(available) - 12) / 8),
        )
      : 0;
    return {
      charged,
      level,
      cost: charged ? 12 + Math.round(level * 8) : 5,
    };
  };
  combatModule.kiBlastPose = function kiBlastPose(f) {
    const firing = f.attack?.isKiBlast && f.stateTimer >= f.attack.hitT,
      power = f.attack?.chargeLevel ?? combatModule.kiBlastPower(f.blastHeldTime ?? 0, f.ki).level;
    const pose = animationModule.pz({
      aR: [firing ? -1.48 : -0.62, 0, firing ? -0.55 : 0.32],
      aL: [-0.6, 0, -0.28],
      t: [firing ? -0.09 : 0.12, -0.08, 0],
      h: [0.02, 0, 0],
      lL: [0.18, 0, 0.07],
      lR: [-0.12, 0, -0.07],
      y: -0.06,
    });
    pose.eR = firing ? -0.05 : -1.55;
    pose.eL = -1.25;
    pose.kL = 0.25;
    pose.kR = 0.2;
    if (f.state === 'blastCharge') {
      pose.y -= power * 0.045;
      pose.t[0] += Math.sin(matchModule.game.simTime * 9) * 0.008;
    }
    if (f.attack?.isKiBlast && f.stateTimer > f.attack.hitT + f.attack.active) {
      const t = (f.stateTimer - f.attack.hitT - f.attack.active) / f.attack.recovery;
      return animationModule.mixCombatPose(
        pose,
        combatModule.neutralCombatPose(f, true),
        animationModule.smoothstep(Math.min(1, t)),
      );
    }
    return pose;
  };
  combatModule.fireKiBlast = function fireKiBlast(f, a) {
    const r = combatModule.sampleCombatRig(f),
      forward = f.forward(),
      pos = r.parts.handR.getWorldPosition(new THREE.Vector3()).addScaledVector(forward, 0.13),
      foe = f === matchModule.player ? matchModule.enemy : matchModule.player;
    const distance = Math.max(0.25, foe ? Math.hypot(foe.pos.x - f.pos.x, foe.pos.z - f.pos.z) : 5),
      target = f.pos.clone().addScaledVector(forward, distance);
    target.y = a.targetHeight;
    const direction = target.sub(pos).normalize();
    const mesh = new THREE.Group(),
      color = combatModule.kiColor(f),
      radius = a.width;
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 10, 8),
        renderModule.energyMat(0xfff9db, 0.95),
      ),
      halo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.65, 12, 10),
        renderModule.energyMat(color, 0.32),
      );
    mesh.add(core, halo);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.7, 0.7, 8),
      renderModule.energyMat(color, 0.35),
    );
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.4;
    mesh.add(tail);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    mesh.position.copy(pos);
    renderModule.scene.add(mesh);
    kiBlasts.push({
      owner: f,
      attack: {
        ...a,
        projectile: true,
      },
      source: a,
      mesh,
      halo,
      pos,
      previous: pos.clone(),
      direction,
      distance: 0,
      life: combatModule.KI_RULES.blastRange / combatModule.KI_RULES.blastSpeed,
      velocity: combatModule.KI_RULES.blastSpeed,
    });
    if (!matchModule.game.manualTest) {
      renderModule.spawnSpark(pos, color, 4, 0.18);
      audioModule.eventSound('swing');
    }
  };
  combatModule.updateKiBlasts = function updateKiBlasts(dt) {
    for (let i = kiBlasts.length - 1; i >= 0; i--) {
      const b = kiBlasts[i],
        foe = b.owner === matchModule.player ? matchModule.enemy : matchModule.player;
      b.previous.copy(b.pos);
      const travel = Math.min(b.velocity * dt, combatModule.KI_RULES.blastRange - b.distance);
      b.pos.addScaledVector(b.direction, travel);
      b.distance += travel;
      b.life -= dt;
      b.mesh.position.copy(b.pos);
      b.halo.scale.setScalar(1 + Math.sin(b.distance * 8) * 0.07);
      if (foe && foe.hp > 0 && foe.invulnerable <= 0 && !matchModule.game.over) {
        const rig = combatModule.sampleCombatRig(foe),
          sweep = {
            a: b.previous.clone().add(foe.pos).sub(foe.previousPos),
            b: b.pos,
            r: b.attack.width,
          };
        if (
          rig.hurt.some(
            (h) => h.enabled && combatModule.capsuleDistanceSq(sweep, h) <= (h.r + sweep.r) ** 2,
          )
        ) {
          if (combatModule.reflectProjectile?.(foe, b)) continue;
          b.hit = true;
          foe.takeHit(b.owner, b.attack);
          if (b.owner.attack === b.source) {
            b.owner.hasHit = true;
            b.owner.hitResult = foe.lastHitText === '格挡' ? 'blocked' : 'hit';
          }
          if (!matchModule.game.manualTest)
            renderModule.spawnSpark(
              b.pos,
              combatModule.kiColor(b.owner),
              b.attack.charged ? 9 : 5,
              0.4,
            );
          b.life = 0;
        }
      }
      if (b.life <= 0 || b.distance >= combatModule.KI_RULES.blastRange || matchModule.game.over) {
        if (!b.hit && !matchModule.game.over && !b.source.whiffFired) {
          b.source.whiffFired = true;
          combatModule.emitCombatEvent('whiff', b.owner, foe, b.source, {
            recoveryRemaining: 0,
          });
        }
        renderModule.scene.remove(b.mesh);
        worldModule.disposeGroup(b.mesh);
        kiBlasts.splice(i, 1);
      }
    }
  };
  combatModule.clearKiBlasts = function clearKiBlasts() {
    for (const b of kiBlasts) {
      renderModule.scene.remove(b.mesh);
      worldModule.disposeGroup(b.mesh);
    }
    kiBlasts.length = 0;
  };
  combatModule.cancelKiHolds = function cancelKiHolds() {
    for (const f of [matchModule.player, matchModule.enemy])
      if (f) {
        combatModule.stopChargeSound(f);
        f.chargeHeld = 0;
        f.blastHeldTime = 0;
        f.blastRejected = false;
        if (['charge', 'blastCharge'].includes(f.state)) {
          f.state = 'idle';
          f.stateTimer = 0;
        }
        if (f.kiVisual) {
          f.kiVisual.aura.visible = false;
          f.kiVisual.hand.visible = false;
          f.kiVisual.intensity = 0;
        }
      }
  };
  combatModule.stopChargeSound = function stopChargeSound(f) {
    const v = f.chargeVoice;
    if (!v) return;
    f.chargeVoice = null;
    const t = audioModule.actx?.currentTime ?? 0;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.025);
      v.osc.stop(t + 0.12);
      v.osc.onended = () => {
        v.osc.disconnect();
        v.gain.disconnect();
      };
    } catch {
      v.osc.disconnect();
      v.gain.disconnect();
    }
  };
  function chargeSound(f, strength) {
    if (
      matchModule.game.muted ||
      matchModule.game.paused ||
      matchModule.game.over ||
      matchModule.game.manualTest ||
      !audioModule.actx ||
      audioModule.actx.state !== 'running'
    ) {
      combatModule.stopChargeSound(f);
      return;
    }
    if (!f.chargeVoice) {
      const osc = audioModule.actx.createOscillator(),
        gain = audioModule.actx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 75;
      gain.gain.value = 0;
      osc.connect(gain).connect(audioModule.audioBus());
      osc.start();
      f.chargeVoice = {
        osc,
        gain,
      };
    }
    const t = audioModule.actx.currentTime;
    f.chargeVoice.osc.frequency.setTargetAtTime(75 + strength * 65, t, 0.12);
    f.chargeVoice.gain.gain.setTargetAtTime(0.012 + strength * 0.014, t, 0.08);
  }
  function ensureKiVisual(f) {
    if (f.kiVisual) return f.kiVisual;
    const aura = new THREE.Group(),
      color = new THREE.Color(combatModule.kiColor(f));
    aura.visible = false;
    f.root.add(aura);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 18),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          time: {
            value: 0,
          },
          strength: {
            value: 0,
          },
          color: {
            value: color,
          },
        },
        vertexShader: `uniform float time;varying vec3 n;varying vec3 v;varying float height;void main(){vec3 p=position;float h=(p.y+1.)*.5;float wave=sin(uv.x*37.+time*8.-h*9.)*.045+sin(uv.x*71.-time*6.+h*16.)*.024;p.xz*=1.+wave*h;p.y+=sin(uv.x*49.+time*11.)*.08*h*h;vec4 mv=modelViewMatrix*vec4(p,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);height=h;gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `uniform float time;uniform float strength;uniform vec3 color;varying vec3 n;varying vec3 v;varying float height;void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(v))),1.7);float flow=.75+.25*sin(height*26.-time*9.);gl_FragColor=vec4(color,(.035+edge*.32)*flow*strength);}`,
      }),
    );
    shell.position.y = 1.25;
    shell.scale.set(0.83, 1.55, 0.74);
    aura.add(shell);
    const rings = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.016, 4, 40),
        renderModule.energyMat(combatModule.kiColor(f), 0.4),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      ring.material.toneMapped = false;
      aura.add(ring);
      rings.push(ring);
    }
    const flames = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 2.3, 3, 1, true),
          renderModule.energyMat(combatModule.kiColor(f), 0.12),
        );
      flame.material.side = THREE.DoubleSide;
      flame.material.toneMapped = false;
      flame.position.set(Math.sin(angle) * 0.63, 1.25, Math.cos(angle) * 0.58);
      flame.rotation.set(Math.cos(angle) * 0.09, angle, -Math.sin(angle) * 0.09);
      aura.add(flame);
      flames.push(flame);
    }
    const particleGeo = new THREE.BufferGeometry(),
      positions = new Float32Array(28 * 3);
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: combatModule.kiColor(f),
        size: 0.04,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    aura.add(particles);
    const hand = new THREE.Group();
    hand.visible = false;
    f.parts.handR.add(hand);
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        renderModule.energyMat(0xfff9da, 0.92),
      ),
      glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        renderModule.energyMat(combatModule.kiColor(f), 0.35),
      );
    hand.add(core, glow);
    f.kiVisual = {
      aura,
      shell,
      rings,
      flames,
      particles,
      positions,
      hand,
      glow,
      intensity: 0,
    };
    return f.kiVisual;
  }
  combatModule.updateKiVisual = function updateKiVisual(f, dt) {
    const active = f.state === 'charge' && f.hp > 0 && !matchModule.game.over,
      handActive = !!(
        f.hp > 0 &&
        !matchModule.game.over &&
        (f.state === 'blastCharge' || (f.attack?.isKiBlast && !f.attack.costCommitted))
      );
    if (!active && !handActive && !f.kiVisual) {
      combatModule.stopChargeSound(f);
      return;
    }
    const v = ensureKiVisual(f),
      time = matchModule.game.simTime,
      ramp = Math.min(1, (f.chargeHeld ?? 0) / 0.8),
      target = active ? 0.4 + ramp * 0.55 : 0;
    v.intensity = THREE.MathUtils.lerp(v.intensity, target, 1 - Math.exp(-dt * (active ? 12 : 22)));
    if (f.hp <= 0 || ['hit', 'grabbed', 'dead', 'guardbreak', 'knockdown'].includes(f.state))
      v.intensity = 0;
    v.aura.visible = v.intensity > 0.015;
    v.shell.material.uniforms.time.value = time;
    v.shell.material.uniforms.strength.value = v.intensity;
    const full =
      active && f.chargeFull ? Math.max(0, 1 - (time - (f.chargeFullTime ?? time)) / 0.35) : 0;
    v.aura.scale.setScalar(1 + Math.sin(time * 13) * 0.025 + full * 0.18);
    for (let i = 0; i < v.rings.length; i++) {
      const phase = (time * 1.3 + i * 0.5) % 1;
      v.rings[i].scale.setScalar(0.7 + phase * 0.9);
      v.rings[i].material.opacity = (1 - phase) * v.intensity * 0.48;
    }
    for (let i = 0; i < v.flames.length; i++) {
      const flame = v.flames[i];
      flame.scale.set(1, 0.85 + Math.sin(time * 11 + i * 2) * 0.16, 1);
      flame.material.opacity = v.intensity * (0.09 + Math.sin(time * 8 + i) * 0.035);
    }
    for (let i = 0; i < 28; i++) {
      const h = (time * (0.65 + (i % 4) * 0.13) + i / 28) % 1,
        angle = i * 2.4 + time * 0.4,
        r = 0.65 + Math.sin(i * 3.1) * 0.13;
      v.positions[i * 3] = Math.sin(angle) * r;
      v.positions[i * 3 + 1] = 0.1 + h * 2.8;
      v.positions[i * 3 + 2] = Math.cos(angle) * r;
    }
    v.particles.geometry.attributes.position.needsUpdate = true;
    v.particles.material.opacity = v.intensity * 0.8;
    v.hand.visible = handActive;
    if (handActive) {
      const power =
        f.attack?.chargeLevel ?? combatModule.kiBlastPower(f.blastHeldTime ?? 0, f.ki).level;
      v.hand.scale.setScalar(
        (f.state === 'blastCharge' ? 0.5 + Math.min(1, (f.blastHeldTime ?? 0) / 0.35) : 1.5) +
          power * 1.5,
      );
      v.glow.scale.setScalar(1 + Math.sin(time * 25) * 0.08);
    }
    if (active) chargeSound(f, ramp);
    else combatModule.stopChargeSound(f);
  };
  return function initialize() {
    combatModule.KI_RULES = Object.freeze({
      chargeStartup: 0.25,
      chargeRate: 15,
      passiveRate: 0.35,
      blastCost: 5,
      blastThreshold: 0.35,
      blastMaxHold: 0.9,
      blastRange: 10,
      blastSpeed: 18,
    });
    kiBlasts = [];
    combatModule.Fighter.prototype.startKiBlast = function (held = 0) {
      if (
        this.hp <= 0 ||
        this.attack ||
        this.dashTime > 0 ||
        [
          'hit',
          'block',
          'blockstun',
          'guardbreak',
          'knockdown',
          'grabbed',
          'dead',
          'landing',
        ].includes(this.state)
      )
        return false;
      const q = combatModule.kiBlastPower(held, this.ki);
      if (this.ki < q.cost) {
        combatModule.warnKi(this, q.cost);
        this.state = 'idle';
        return false;
      }
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this)),
        foe = this === matchModule.player ? matchModule.enemy : matchModule.player;
      this.attack = combatModule.finalizeMove({
        targetHeight: foe ? foe.pos.y + 1.25 * foe.baseScale : 1.25 * this.baseScale,
        id: 'kiBlast',
        name: q.charged ? '蓄力气弹' : '气弹',
        motion: 'kiBlast',
        anim: animationModule.ANIM.palmStrike,
        isKiBlast: true,
        projectile: true,
        shape: 'kiBall',
        kiCost: q.cost,
        costCommitted: false,
        charged: q.charged,
        chargeLevel: q.level,
        level: 'mid',
        startup: q.charged ? 0.16 : 0.1,
        active: 0.025,
        recovery: q.charged ? 0.42 : 0.25,
        dmg: q.charged ? 10 + q.level * 6 : 4,
        range: combatModule.KI_RULES.blastRange,
        width: q.charged ? 0.26 + q.level * 0.08 : 0.15,
        stun: q.charged ? 0.3 : 0.12,
        blockstun: 0.09,
        kb: q.charged ? 3 + q.level * 2 : 0.55,
        guardDamage: q.charged ? 15 + q.level * 5 : 5,
        ki: 0,
        cancelRules: {
          hit: [],
          block: [],
          whiff: [],
        },
      });
      this.state = 'attack';
      this.stateTimer = 0;
      this.attackMask = 0;
      this.hasHit = false;
      this.hitResult = null;
      this.comboType = null;
      this.comboTimer = 0;
      this.clearQueue();
      this.vel.set(0, 0, 0);
      combatModule.beginMoveEvent(this, entry);
      return true;
    };
    queueMicrotask(() => {
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          KI_RULES: combatModule.KI_RULES,
          kiBlasts,
          kiBlastPower: combatModule.kiBlastPower,
          updateKiBlasts: combatModule.updateKiBlasts,
          clearKiBlasts: combatModule.clearKiBlasts,
          updateKiVisual: combatModule.updateKiVisual,
          cancelKiHolds: combatModule.cancelKiHolds,
        });
    });

    /* V1 events describe committed simulation results. Presentation never writes HP, boxes or time. */
  };
}
