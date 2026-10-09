import * as THREE from 'three';
export function register({
  audio: audioModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  world: worldModule,
}) {
  renderModule.ultTone = function ultTone(
    f,
    frequency,
    end,
    duration,
    volume,
    type = 'sine',
    delay = 0,
  ) {
    if (!audioModule.actx || matchModule.game.muted) return;
    const t = audioModule.actx.currentTime + delay,
      o = audioModule.actx.createOscillator(),
      g = audioModule.actx.createGain(),
      filter = audioModule.actx.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + duration);
    filter.type = 'lowpass';
    filter.frequency.value = type === 'sine' ? 3000 : 1300;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(filter).connect(g).connect(audioModule.audioBus());
    o.start(t);
    o.stop(t + duration + 0.03);
    (f.ultAudioNodes ??= []).push(o);
  };
  function ultNoise(f, duration, volume, frequency) {
    if (!audioModule.actx || matchModule.game.muted) return;
    const b = audioModule.actx.createBuffer(
        1,
        Math.ceil(audioModule.actx.sampleRate * duration),
        audioModule.actx.sampleRate,
      ),
      data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = audioModule.actx.createBufferSource(),
      filter = audioModule.actx.createBiquadFilter(),
      gain = audioModule.actx.createGain(),
      t = audioModule.actx.currentTime;
    source.buffer = b;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, t);
    filter.frequency.exponentialRampToValueAtTime(frequency * 0.4, t + duration);
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(audioModule.audioBus());
    source.start(t);
    source.stop(t + duration);
    (f.ultAudioNodes ??= []).push(source);
  }
  renderModule.stopUltSound = function stopUltSound(f) {
    for (const node of f.ultAudioNodes ?? [])
      try {
        node.stop();
      } catch {}
    f.ultAudioNodes = [];
  };
  renderModule.sfxUlt = function sfxUlt(f, fire = false) {
    const style = f.def.ultStyle,
      scale = f.def.id === 'krillin' ? 1.18 : 1;
    renderModule.ultAudioHistory.push({
      character: f.def.id,
      style,
      phase: fire ? 'release' : 'charge',
    });
    if (renderModule.ultAudioHistory.length > 30) renderModule.ultAudioHistory.shift();
    if (!fire) {
      if (style === 'dodonpa') renderModule.ultTone(f, 940, 1880, 0.7, 0.028, 'sine');
      else if (style === 'mafuba') {
        renderModule.ultTone(f, 185, 390, 0.9, 0.035, 'triangle');
        renderModule.ultTone(f, 277, 520, 0.9, 0.024, 'sine');
      } else if (style === 'kikoho') renderModule.ultTone(f, 63, 105, 0.88, 0.048, 'triangle');
      else if (style === 'wolf') {
        ultNoise(f, 0.26, 0.05, 1200);
        renderModule.ultTone(f, 125, 65, 0.35, 0.026, 'sawtooth');
      } else {
        renderModule.ultTone(f, 105 * scale, 330 * scale, 0.9, 0.037, 'triangle');
        renderModule.ultTone(f, 210 * scale, 660 * scale, 0.9, 0.025, 'sine');
      }
      return;
    }
    if (style === 'dodonpa') {
      renderModule.ultTone(f, 2150, 390, 0.23, 0.055, 'sine');
      ultNoise(f, 0.13, 0.028, 2400);
    } else if (style === 'mafuba') {
      ultNoise(f, 0.58, 0.065, 820);
      for (let i = 0; i < 3; i++)
        renderModule.ultTone(f, 330 + i * 60, 170 + i * 40, 0.55, 0.026, 'triangle', i * 0.035);
    } else if (style === 'kikoho') {
      ultNoise(f, 0.42, 0.1, 380);
      renderModule.ultTone(f, 80, 24, 0.48, 0.085, 'triangle');
    } else if (style === 'bakuriki') {
      ultNoise(f, 0.45, 0.085, 570);
      renderModule.ultTone(f, 95, 30, 0.5, 0.065, 'sawtooth');
    } else if (style === 'wolf') {
      for (let i = 0; i < 4; i++) {
        renderModule.ultTone(f, 260, 80, 0.09, 0.036, 'triangle', i * 0.07);
      }
      ultNoise(f, 0.34, 0.055, 1500);
    } else {
      ultNoise(f, 0.58, 0.08, 960 * scale);
      renderModule.ultTone(f, 280 * scale, 72 * scale, 0.6, 0.052, 'sawtooth');
      renderModule.ultTone(f, 520 * scale, 165 * scale, 0.5, 0.035, 'sine');
    }
  };
  renderModule.energyMat = function energyMat(color, opacity = 0.7) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  };
  renderModule.castUltVisual = function castUltVisual(f, def) {
    const rig = new THREE.Group();
    renderModule.scene.add(rig);
    const color = def.ultStyle === 'kamehameha' ? 0x309cde : def.ultColor,
      core = charactersModule.meshTo(
        rig,
        new THREE.SphereGeometry(0.1, 24, 18),
        renderModule.energyMat(0xffffff, 0.95),
      ),
      aura = charactersModule.meshTo(
        rig,
        new THREE.SphereGeometry(0.25, 24, 18),
        renderModule.energyMat(color, 0.55),
      );
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = charactersModule.meshTo(
        rig,
        new THREE.TorusGeometry(0.28 + i * 0.075, 0.012, 6, 40),
        renderModule.energyMat(color, 0.55),
      );
      ring.rotation.x = (i * Math.PI) / 3;
      ring.rotation.y = i * 0.8;
      rings.push(ring);
    }
    const beamGroup = new THREE.Group();
    rig.add(beamGroup);
    beamGroup.visible = false;
    const r = f.attack.width ?? (def.ultStyle === 'wolf' ? 0.25 : 0.3),
      length = f.attack.range;
    const inner = charactersModule.meshTo(
      beamGroup,
      new THREE.CylinderGeometry(r * 0.44, r * 0.4, length, 24, 1, true),
      renderModule.energyMat(0xfaffff, 0.9),
      0,
      length / 2,
      0,
    );
    const outer = charactersModule.meshTo(
      beamGroup,
      new THREE.CylinderGeometry(r, r * 0.86, length, 24, 1, true),
      renderModule.energyMat(color, 0.43),
      0,
      length / 2,
      0,
    );
    outer.material.blending = THREE.NormalBlending;
    outer.material.side = THREE.FrontSide;
    inner.material.side = THREE.FrontSide;
    inner.material.opacity = 0.65;
    const tip = charactersModule.ball(
      beamGroup,
      renderModule.energyMat(color, 0.6),
      0,
      length,
      0,
      r * 1.75,
      [1, 1.7, 1],
    );
    const flow = [];
    for (let i = 0; i < 9; i++) {
      const ring = charactersModule.meshTo(
        beamGroup,
        new THREE.TorusGeometry(r * 1.25, 0.012, 5, 20),
        renderModule.energyMat(color, 0.5),
        0,
        (i * length) / 9,
        0,
      );
      ring.rotation.x = Math.PI / 2;
      flow.push(ring);
    }
    let sealJar = null,
      spiral = null,
      wolf = null;
    if (def.ultStyle === 'mafuba') {
      sealJar = new THREE.Group();
      sealJar.name = 'mafuba-seal-container';
      rig.add(sealJar);
      charactersModule.meshTo(
        sealJar,
        new THREE.CylinderGeometry(0.24, 0.21, 0.62, 16),
        charactersModule.M(0x5c9a82),
        0,
        0.31,
        0,
      );
      charactersModule.meshTo(
        sealJar,
        new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16),
        charactersModule.M(0xd8dfcb),
        0,
        0.65,
        0,
      );
      charactersModule.box(
        sealJar,
        charactersModule.M(0xf6e7b5),
        0,
        0.34,
        0.235,
        0.17,
        0.32,
        0.015,
      );
      charactersModule.badge(sealJar, '封', 0, 0.35, 0.247, 0.09, false, '#f6e7b5');
      const pts = [];
      for (let i = 0; i <= 170; i++) {
        const t = i / 170,
          angle = t * Math.PI * 13;
        pts.push([
          Math.cos(angle) * (0.2 + t * 0.6),
          t * length,
          Math.sin(angle) * (0.2 + t * 0.6),
        ]);
      }
      spiral = charactersModule.tube(beamGroup, renderModule.energyMat(0x98ffb0, 0.65), pts, 0.045);
      outer.material.opacity = 0.16;
    }
    if (def.ultStyle === 'kikoho') {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.85, 0.035, 3),
        renderModule.energyMat(0xffe6a2, 0.55),
      );
      tri.position.y = 0.5;
      beamGroup.add(tri);
      rings.push(tri);
    }
    if (def.ultStyle === 'wolf') {
      inner.visible = outer.visible = tip.visible = false;
      flow.forEach((x) => (x.visible = false));
      wolf = new THREE.Group();
      const spirit = renderModule.energyMat(0xffd6a0, 0.5);
      charactersModule.ball(wolf, spirit, 0, 0.05, 0, 0.24, [1.2, 1, 0.8]);
      charactersModule.ball(wolf, spirit, 0, -0.07, 0.2, 0.14, [0.8, 0.7, 1.5]);
      for (const sign of [-1, 1]) {
        const ear = charactersModule.meshTo(
          wolf,
          new THREE.ConeGeometry(0.1, 0.25, 3),
          spirit,
          sign * 0.16,
          0.28,
          0,
        );
        ear.rotation.z = sign * 0.18;
        charactersModule.ball(
          wolf,
          renderModule.energyMat(0xffffff, 0.95),
          sign * 0.1,
          0.08,
          0.2,
          0.028,
        );
      }
      wolf.position.y = 0.7;
      beamGroup.add(wolf);
      for (let i = 0; i < 5; i++) {
        const claw = charactersModule.meshTo(
          beamGroup,
          new THREE.TorusGeometry(0.65 + i * 0.035, 0.017, 5, 24, Math.PI * 0.75),
          renderModule.energyMat(0xffcf94, 0.75),
          0,
          0.7 + i * 0.17,
          0,
        );
        claw.rotation.set(0.6, 0, i * 0.35);
        flow.push(claw);
      }
    }
    rig.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    renderModule.ultimateVisuals.push({
      f,
      attack: f.attack,
      rig,
      core,
      aura,
      rings,
      beamGroup,
      inner,
      outer,
      flow,
      spiral,
      sealJar,
      wolf,
      length,
      elapsed: 0,
    });
  };
  renderModule.updateUltimateVisuals = function updateUltimateVisuals(dt) {
    for (let i = renderModule.ultimateVisuals.length - 1; i >= 0; i--) {
      const v = renderModule.ultimateVisuals[i],
        f = v.f;
      if (f.attack !== v.attack || f.hp <= 0) {
        renderModule.scene.remove(v.rig);
        worldModule.disposeGroup(v.rig);
        renderModule.stopUltSound(f);
        renderModule.ultimateVisuals.splice(i, 1);
        continue;
      }
      if (v.isDisc) {
        combatModule.updateDiscCharge(v);
        continue;
      }
      const t = f.stateTimer,
        charge = Math.min(1, t / v.attack.hitT);
      v.elapsed += dt;
      const forward = f.forward(),
        origin = new THREE.Vector3();
      f.parts.handR.getWorldPosition(origin);
      if (f.def.ultStyle === 'kamehameha') {
        const other = new THREE.Vector3();
        f.parts.handL.getWorldPosition(other);
        origin.add(other).multiplyScalar(0.5);
      }
      origin.addScaledVector(forward, 0.1);
      if (v.attack.shape === 'beam') {
        origin.copy(f.pos);
        origin.y += v.attack.beamHeight ?? 1.45 * f.baseScale;
        if (v.attack.isYouth) {
          const r = combatModule.sampleCombatRig(f);
          origin.copy(r.hit[0].a);
          forward.copy(r.hit[0].b).sub(r.hit[0].a).normalize();
        }
      }
      v.rig.position.copy(origin);
      if (v.sealJar) {
        v.sealJar.position.copy(f.pos).addScaledVector(f.forward(), 0.9).sub(origin);
        v.sealJar.rotation.y = f.facingAngle;
      }
      v.beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      const firing = t >= v.attack.hitT,
        fade = firing
          ? t < v.attack.hitT + v.attack.active
            ? 1
            : Math.max(0, 1 - (t - v.attack.hitT - v.attack.active) / 0.12)
          : 1;
      v.core.scale.setScalar((0.2 + charge * 1.25) * fade);
      v.aura.scale.setScalar((0.25 + charge * 1.1) * (1 + Math.sin(t * 38) * 0.045) * fade);
      for (let j = 0; j < 3; j++) {
        const ring = v.rings[j];
        ring.rotation.z = t * (3 + j);
        ring.scale.setScalar(0.45 + charge * 0.7);
        ring.material.opacity = (0.25 + charge * 0.45) * fade;
      }
      v.beamGroup.visible = firing;
      v.beamGroup.scale.set(Math.max(0.1, fade), 1, Math.max(0.1, fade));
      v.inner.material.opacity = fade * 0.65;
      v.outer.material.opacity = fade * (v.spiral ? 0.16 : 0.45);
      for (let j = 0; j < v.flow.length; j++) {
        const ring = v.flow[j];
        if (v.wolf) {
          ring.rotation.z += dt * (6 + j);
          ring.material.opacity = fade * 0.7;
        } else {
          ring.position.y = ((t - v.attack.hitT) * 17 + (j * v.length) / 9) % v.length;
          ring.scale.setScalar(1 + Math.sin(t * 28 + j) * 0.15);
          ring.material.opacity = fade * 0.6;
        }
      }
      if (v.spiral) v.spiral.rotation.y = t * 9;
      if (v.wolf) {
        v.wolf.position.y = 0.7 + (t - v.attack.hitT) * 2.2;
        v.wolf.rotation.y = t * 5;
      }
    }
  };
  renderModule.clearUltimateVisuals = function clearUltimateVisuals() {
    for (const v of renderModule.ultimateVisuals) {
      renderModule.scene.remove(v.rig);
      worldModule.disposeGroup(v.rig);
      renderModule.stopUltSound(v.f);
    }
    renderModule.ultimateVisuals.length = 0;
  };
  return function initialize() {
    renderModule.ultimateVisuals = [];
    renderModule.ultAudioHistory = [];
  };
}
