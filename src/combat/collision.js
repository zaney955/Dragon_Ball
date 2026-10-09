import * as THREE from 'three';
export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
}) {
  let collisionScratch;
  function capsule() {
    return {
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      r: 0.1,
      enabled: true,
    };
  }
  combatModule.ensureCombatRig = function ensureCombatRig(f) {
    if (f.combatRig) return f.combatRig;
    const root = new THREE.Group(),
      parts = {};
    const copy = (name, parent, original) => {
      const g = new THREE.Group();
      g.position.copy(original.position);
      parent.add(g);
      parts[name] = g;
      return g;
    };
    const t = copy('torsoGroup', root, f.parts.torsoGroup);
    copy('head', t, f.parts.head);
    for (const side of ['L', 'R']) {
      const arm = copy('arm' + side, t, f.parts['arm' + side]),
        elbow = copy('elbow' + side, arm, f.parts['elbow' + side]);
      copy('hand' + side, elbow, f.parts['hand' + side]);
      const leg = copy('leg' + side, root, f.parts['leg' + side]),
        knee = copy('knee' + side, leg, f.parts['knee' + side]);
      copy('foot' + side, knee, f.parts['foot' + side]);
    }
    const rig = {
      root,
      parts,
      hurt: Array.from(
        {
          length: 6,
        },
        capsule,
      ),
      hit: Array.from(
        {
          length: 2,
        },
        capsule,
      ),
      push: capsule(),
      previous: [new THREE.Vector3(), new THREE.Vector3()],
      lastAttack: null,
    };
    f.combatRig = rig;
    return rig;
  };
  combatModule.neutralCombatPose = function neutralCombatPose(f, recovering = false) {
    let pose = animationModule.pz({
      aR: [-0.42, 0, 0.24],
      aL: [-0.5, 0, -0.24],
      t: [0.04, 0, 0],
      lL: [0.08, 0, 0.045],
      lR: [-0.1, 0, -0.045],
    });
    pose.eR = -1.15;
    pose.eL = -1.05;
    if (f.state === 'dead' || f.state === 'knockdown') {
      THREE.MathUtils.clamp(f.stateTimer / 0.28, 0, 1);
      pose = animationModule.pz({
        aR: [-0.5, 0, 0.5],
        aL: [-0.5, 0, -0.5],
        t: [0.3, 0, 0],
        lL: [0.3, 0, 0],
        lR: [-0.3, 0, 0],
      });
      pose.eR = pose.eL = -0.3;
    } else if (['hit', 'guardbreak', 'grabbed'].includes(f.state)) {
      const k = Math.sin(Math.min(1, f.stateTimer / 0.2) * Math.PI * 0.65);
      pose = animationModule.pz({
        aR: [-0.4, 0, 0.65],
        aL: [-0.4, 0, -0.65],
        t: [-0.24 * k, 0, 0.05],
        h: [-0.12, 0, 0],
        lL: [0.18, 0, 0.03],
        lR: [-0.25, 0, -0.03],
      });
      pose.eL = pose.eR = -0.7;
      pose.kR = 0.35;
    } else if (['block', 'blockstun'].includes(f.state)) {
      pose = animationModule.pz({
        aR: [-0.66, 0, 0.28],
        aL: [-0.72, 0, -0.28],
        t: [0.18, 0, 0],
        h: [0.12, 0, 0],
        lL: [0.24, 0, 0.03],
        lR: [-0.15, 0, -0.03],
        y: f.crouching ? -0.25 : 0,
      });
      pose.eR = -1.45;
      pose.eL = -1.42;
      pose.kL = f.crouching ? 0.7 : 0.18;
      pose.kR = f.crouching ? 0.6 : 0.2;
    } else if (f.state === 'landing') {
      const settle =
        1 - animationModule.smoothstep(THREE.MathUtils.clamp(f.stateTimer / 0.12, 0, 1));
      pose.y = -0.07 * settle;
      pose.t[0] = 0.1 * settle;
      pose.lL = [0.28 * settle, 0, 0.045];
      pose.lR = [0.22 * settle, 0, -0.045];
      pose.kL = 0.12 + 0.43 * settle;
      pose.kR = 0.12 + 0.4 * settle;
    } else if (f.state === 'dash') {
      pose = animationModule.pz({
        aR: [-0.3, 0, 0.48],
        aL: [-0.3, 0, -0.48],
        t: [0.42, 0, 0],
        lL: [-0.3, 0, 0],
        lR: [0.28, 0, 0],
        y: -0.12,
      });
      pose.eL = pose.eR = -0.95;
      pose.kL = 0.65;
      pose.kR = 0.42;
    } else if (f.state === 'charge') {
      const u = animationModule.smoothstep(
          Math.min(1, (f.chargeHeld ?? 0) / combatModule.KI_RULES.chargeStartup),
        ),
        breath = Math.sin(matchModule.game.simTime * 7) * 0.014;
      const charged = animationModule.pz({
        aR: [-0.3, 0, 0.42],
        aL: [-0.3, 0, -0.42],
        t: [0.16 + breath, 0, 0],
        h: [0.06, 0, 0],
        lL: [0.24, 0, 0.16],
        lR: [0.18, 0, -0.16],
        y: -0.13 + breath,
      });
      charged.eL = charged.eR = -1.35;
      charged.kL = charged.kR = 0.4;
      pose = animationModule.mixCombatPose(pose, charged, u);
    } else if (f.state === 'blastCharge') {
      pose = combatModule.kiBlastPose(f, 0);
    } else if (f.crouching) {
      pose.y = -0.23;
      pose.lL = [0.48, 0, 0.04];
      pose.lR = [0.4, 0, -0.04];
      pose.kL = pose.kR = 0.7;
    } else if (f.state === 'walk') {
      const w = Math.sin(f.walkPhase);
      pose.lL = [w * 0.56, 0, 0.04];
      pose.lR = [-w * 0.56, 0, -0.04];
      pose.kL = Math.max(0, -w) * 0.7 + 0.1;
      pose.kR = Math.max(0, w) * 0.7 + 0.1;
      pose.aR = [-0.4 - w * 0.18, 0, 0.25];
      pose.aL = [-0.5 + w * 0.18, 0, -0.25];
      pose.y = Math.abs(w) * 0.027;
    } else {
      pose.y = Math.sin(matchModule.game.simTime * 2.5) * 0.008;
    }
    if (f.state === 'walk' && ['goku', 'taopaipai', 'piccolo'].includes(f.def.id)) {
      const speed = 6.8 * f.def.speed,
        front = THREE.MathUtils.clamp(
          (f.vel.x * Math.sin(f.facingAngle) + f.vel.z * Math.cos(f.facingAngle)) / speed,
          -1,
          1,
        ),
        side = THREE.MathUtils.clamp(
          (f.vel.x * Math.cos(f.facingAngle) - f.vel.z * Math.sin(f.facingAngle)) / speed,
          -1,
          1,
        ),
        wave = Math.sin(f.walkPhase);
      pose.lL[0] *= front;
      pose.lR[0] *= front;
      pose.lL[2] += wave * side * 0.22;
      pose.lR[2] -= wave * side * 0.22;
      pose.t[0] += front * 0.035;
      pose.t[2] -= side * 0.035;
    }
    if (f.pos.y > 0.001 && (!f.attack || recovering) && f.state !== 'hit') {
      const air = animationModule.cloneCombatPose(pose);
      if (f.flightMode && f.def.id === 'goku') {
        air.lL = [0.02, 0, 0.05];
        air.lR = [-0.04, 0, -0.05];
        air.kL = 0.09;
        air.kR = 0.1;
      } else {
        air.lL = [-0.35, 0, 0.04];
        air.lR = [-0.12, 0, -0.04];
        air.kL = 0.95;
        air.kR = 0.75;
      }
      pose = animationModule.mixCombatPose(
        pose,
        air,
        animationModule.smoothstep(Math.min(1, f.pos.y / 0.16)),
      );
    }
    if (['hit', 'guardbreak'].includes(f.state)) {
      pose.t[0] *= f.hitWeight ?? 1;
      pose.t[2] += (f.hitSide ?? 0) * 0.14 * Math.exp(-f.stateTimer * 9);
      pose.h[2] = (f.hitSide ?? 0) * 0.1 * Math.exp(-f.stateTimer * 9);
    }
    return pose;
  };
  combatModule.combatPose = function combatPose(f) {
    if (!f.attack) return combatModule.neutralCombatPose(f);
    if (f.attack.isKiBlast) return combatModule.kiBlastPose(f);
    const a = f.attack,
      contact = a.isUlt ? 0.66 : (renderModule.CONTACT_PHASE[a.motion] ?? 0.45),
      ratio = f.stateTimer / a.hitT;
    const phase =
      f.stateTimer < a.hitT
        ? a.isUlt
          ? ratio <= 0.78
            ? (ratio / 0.78) * 0.44
            : 0.44 + ((ratio - 0.78) / 0.22) * (contact - 0.44)
          : ratio * contact
        : f.stateTimer < a.hitT + a.active
          ? contact + Math.min(0.12, ((f.stateTimer - a.hitT) / a.active) * 0.12)
          : contact +
            0.12 +
            (1 - contact - 0.12) * Math.min(1, (f.stateTimer - a.hitT - a.active) / a.recovery);
    const pose = {
        ...animationModule.samplePose(a.anim, phase),
      },
      reach = Math.exp(-Math.pow((f.stateTimer - a.hitT) / Math.max(0.085, a.active), 2));
    pose.eR = -1.1 + reach * 1.05;
    pose.eL =
      -1.05 + reach * (a.motion === 'cross' || a.motion === 'doublePalm' || a.isUlt ? 1.02 : 0.25);
    pose.kR = a.motion.toLowerCase().includes('kick') ? 0.55 * (1 - reach) : 0.17;
    pose.kL = 0.12;
    if (/^(jab|cross|palmStrike|heavyPunch|rushPalm)$/.test(a.motion)) {
      pose.aR = [...pose.aR];
      pose.aL = [...pose.aL];
      const k = Math.min(1, Math.max(0, ratio));
      if (a.motion === 'cross') pose.aL[2] = THREE.MathUtils.lerp(pose.aL[2], 0.64, k);
      else pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, k);
    }
    if (a.id === 'special' && /staff/i.test(a.motion)) {
      pose.aR = [
        THREE.MathUtils.lerp(pose.aR[0], -1.48, reach),
        0,
        THREE.MathUtils.lerp(pose.aR[2], -0.64, reach),
      ];
      pose.t = [
        THREE.MathUtils.lerp(pose.t[0], 0.08, reach),
        THREE.MathUtils.lerp(pose.t[1], 0, reach),
        0,
      ];
      pose.ry = 0;
    }
    if (a.motion === 'uppercut') {
      const rise = THREE.MathUtils.clamp((f.stateTimer - a.hitT) / a.active, 0, 1),
        fit =
          a.id === 'launcher'
            ? THREE.MathUtils.clamp(
                Math.atan2(
                  (f.baseScale - (a.targetScale ?? f.baseScale)) * 1.71,
                  0.66 * f.baseScale,
                ),
                0,
                0.85,
              )
            : 0;
      pose.aR = [-1.8 + fit - rise * 0.35, 0, -0.6];
      pose.t = [-0.08, pose.t[1] * 0.35, 0];
      pose.eR = -0.3;
      if (a.id === 'launcher') {
        pose.ry = (pose.ry ?? 0) * rise;
        pose.y -= fit * 0.14 * (1 - rise);
      }
    }
    // Shorter fighters remain visible targets for tall punchers: incline the authored arm.
    const foe = f === matchModule.player ? matchModule.enemy : matchModule.player;
    if (a.isUlt && a.shape === 'wolf') {
      const local = Math.max(0, f.stateTimer - a.hitT),
        hitIndex = Math.min(3, Math.floor(local / 0.14)),
        t = local - hitIndex * 0.14,
        k =
          f.stateTimer < a.hitT ? Math.min(1, f.stateTimer / a.hitT) : Math.max(0.2, 1 - t / 0.14),
        tilt = THREE.MathUtils.clamp(
          (f.baseScale - (foe?.baseScale ?? f.baseScale)) * 0.9,
          -0.45,
          0.6,
        );
      pose.aR = [-1.3 + tilt, 0, -0.62];
      pose.aL = [-1.3 + tilt, 0, 0.62];
      pose.eR = hitIndex % 2 ? -0.7 : -0.05;
      pose.eL = hitIndex % 2 ? -0.05 : -0.7;
      pose.t = [0.12, (hitIndex % 2 ? -0.12 : 0.12) * k, 0];
      pose.y = -0.06;
      pose.ry = 0;
      if (f.stateTimer < a.hitT) {
        pose.aR[0] = THREE.MathUtils.lerp(-0.5, pose.aR[0], k);
        pose.aL[0] = THREE.MathUtils.lerp(-0.5, pose.aL[0], k);
      }
    }
    if (!a.isUlt && !/kick|sweep|staff|uppercut/i.test(a.motion)) {
      // Fix contact direction before fitting height. Snapshot stature when the move
      // starts: no tracking of jumps, crouches or movement during its active frames.
      const fit = reach,
        scale = a.targetScale ?? f.baseScale;
      const tilt =
        THREE.MathUtils.clamp(
          Math.atan2((f.baseScale - scale) * 1.71, 0.66 * f.baseScale),
          -0.4,
          0.85,
        ) * fit;
      pose.aR = [pose.aR[0] + tilt, pose.aR[1], pose.aR[2]];
      pose.aL = [pose.aL[0] + tilt, pose.aL[1], pose.aL[2]];
      if (a.motion === 'doublePalm') {
        pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, fit);
        pose.aL[2] = THREE.MathUtils.lerp(pose.aL[2], 0.64, fit);
      } else if (a.motion === 'claw') {
        pose.aR[2] = THREE.MathUtils.lerp(pose.aR[2], -0.64, fit);
        pose.t = [pose.t[0], THREE.MathUtils.lerp(pose.t[1], 0.16, fit), pose.t[2]];
      }
    }
    return animationModule.polishCombatPose(f, pose);
  };
  combatModule.setCapsule = function setCapsule(c, a, b, r) {
    c.a.copy(a);
    c.b.copy(b);
    c.r = r;
    c.enabled = true;
  };
  combatModule.sampleCombatRig = function sampleCombatRig(f) {
    const r = combatModule.ensureCombatRig(f),
      p = r.parts,
      pose = combatModule.combatPose(f);
    r.root.position.copy(f.pos);
    r.root.position.y += f.attack ? (pose.ry ?? 0) : 0;
    r.root.rotation.set(0, f.facingAngle, 0);
    r.root.scale.setScalar(f.baseScale);
    charactersModule.applyPose(p, pose, 0, true);
    // The logical rig snaps to one simulation pose.
    for (const [key, value] of [
      ['armR', pose.aR],
      ['armL', pose.aL],
      ['torsoGroup', pose.t],
      ['head', pose.h],
      ['legR', pose.lR],
      ['legL', pose.lL],
    ])
      p[key].rotation.set(...value);
    p.torsoGroup.position.y = (p.restTorsoY ?? 1.28) + pose.y;
    p.elbowR.rotation.x = pose.eR ?? -0.75;
    p.elbowL.rotation.x = pose.eL ?? -0.75;
    p.kneeR.rotation.x = pose.kR ?? 0.12;
    p.kneeL.rotation.x = pose.kL ?? 0.12;
    r.root.updateMatrixWorld(true);
    const world = (node, out) => node.getWorldPosition(out),
      s = f.baseScale;
    world(p.head, r.hurt[0].a);
    r.hurt[0].b.copy(r.hurt[0].a);
    r.hurt[0].r = 0.3 * s;
    r.hurt[1].a.set(f.pos.x, f.pos.y + 0.86 * s, f.pos.z);
    world(p.torsoGroup, r.hurt[1].b);
    r.hurt[1].b.y += 0.42 * s;
    r.hurt[1].r = 0.28 * s;
    for (let i = 0; i < 2; i++) {
      world(p['leg' + (i ? 'R' : 'L')], r.hurt[2 + i].a);
      world(p['foot' + (i ? 'R' : 'L')], r.hurt[2 + i].b);
      r.hurt[2 + i].r = 0.14 * s;
    }
    for (let i = 0; i < 2; i++) {
      world(p['elbow' + (i ? 'R' : 'L')], r.hurt[4 + i].a);
      world(p['hand' + (i ? 'R' : 'L')], r.hurt[4 + i].b);
      r.hurt[4 + i].r = 0.12 * s;
    }
    for (const c of r.hurt) c.enabled = true;
    if (f.state === 'knockdown' || f.state === 'dead') {
      for (const h of r.hurt) h.enabled = false;
      r.hurt[1].enabled = true;
      r.hurt[1].a.set(f.pos.x, f.pos.y + 0.2, f.pos.z);
      r.hurt[1].b
        .copy(r.hurt[1].a)
        .addScaledVector(
          combatModule.moveFront.set(Math.sin(f.facingAngle), 0, Math.cos(f.facingAngle)),
          0.9 * s,
        );
      r.hurt[1].r = 0.23 * s;
    }
    r.push.a.copy(f.pos);
    r.push.b.copy(f.pos);
    r.push.b.y += 2.35 * s;
    r.push.r = 0.3 * s;
    for (const c of r.hit) c.enabled = false;
    const a = f.attack;
    if (!a || a.isKiBlast) return r;
    const motion = a.motion ?? 'doublePalm',
      c = r.hit[0];
    c.enabled = true;
    if (a.shape === 'beam') {
      c.a.copy(f.pos);
      c.a.y += a.beamHeight ?? 1.45 * s;
      c.b
        .copy(c.a)
        .addScaledVector(
          combatModule.moveFront.set(Math.sin(f.facingAngle), 0, Math.cos(f.facingAngle)),
          a.range,
        );
      c.r = a.width ?? 0.3;
    } else if (a.shape === 'burst') {
      c.a.copy(f.pos);
      c.a.y += 1.2 * s;
      c.b.copy(c.a);
      c.r = a.range;
    } else if (a.isThrow) {
      c.a.copy(f.pos);
      c.a.y += 1.0 * s;
      c.b
        .copy(c.a)
        .addScaledVector(
          combatModule.moveFront.set(Math.sin(f.facingAngle), 0, Math.cos(f.facingAngle)),
          0.75,
        );
      c.r = 0.32;
    } else if (/staff/i.test(motion) && a.id === 'special') {
      world(p.handR, c.a);
      combatModule.moveFront.set(Math.sin(f.facingAngle), 0, Math.cos(f.facingAngle));
      c.b.copy(c.a).addScaledVector(combatModule.moveFront, 2.3 * s);
      c.a.addScaledVector(combatModule.moveFront, -0.2 * s);
      c.r = 0.1 * s;
    } else if (/staff/i.test(motion)) {
      p.handR.localToWorld(c.a.set(-1.25, 0, 0.07));
      p.handR.localToWorld(c.b.set(1.25, 0, 0.07));
      c.r = 0.1 * s;
    } else if (/kick|sweep/i.test(motion) || a.level === 'overhead') {
      world(p.kneeR, c.a);
      world(p.footR, c.b);
      c.r = 0.19 * s;
    } else if (motion === 'knee') {
      world(p.legR, c.a);
      world(p.kneeR, c.b);
      c.r = 0.22 * s;
    } else {
      const left = motion === 'cross' || motion === 'backClaw';
      world(p[left ? 'elbowL' : 'elbowR'], c.a);
      world(p[left ? 'handL' : 'handR'], c.b);
      c.r = 0.18 * s;
      if (motion === 'doublePalm' || a.shape === 'wolf') {
        const c2 = r.hit[1];
        world(p.handL, c2.b);
        world(p.elbowL, c2.a);
        c2.r = 0.18 * s;
        c2.enabled = true;
      }
    }
    return r;
  };
  combatModule.capsuleDistanceSq = function capsuleDistanceSq(a, b) {
    // Closest points of two finite line segments (Ericson), handles zero-length spheres.
    const { u, v, w } = collisionScratch;
    u.subVectors(a.b, a.a);
    v.subVectors(b.b, b.a);
    w.subVectors(a.a, b.a);
    const A = u.dot(u),
      B = u.dot(v),
      C = v.dot(v),
      D = u.dot(w),
      E = v.dot(w),
      den = A * C - B * B;
    let s = 0,
      t = 0;
    if (A < 1e-10) t = C > 1e-10 ? THREE.MathUtils.clamp(E / C, 0, 1) : 0;
    else if (C < 1e-10) s = THREE.MathUtils.clamp(-D / A, 0, 1);
    else {
      s = den > 1e-10 ? THREE.MathUtils.clamp((B * E - C * D) / den, 0, 1) : 0;
      t = (B * s + E) / C;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-D / A, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((B - D) / A, 0, 1);
      }
    }
    w.addScaledVector(u, s).addScaledVector(v, -t);
    return w.lengthSq();
  };
  combatModule.combatIntersects = function combatIntersects(f, foe, a) {
    if (foe.hp <= 0 || foe.invulnerable > 0 || a.shape === 'disc' || a.isKiBlast) return false;
    if (
      a.isThrow &&
      (foe.pos.y > 0.2 ||
        f.pos.y > 0.2 ||
        ['hit', 'knockdown', 'grabbed', 'guardbreak'].includes(foe.state))
    )
      return false;
    if (a.level === 'high' && foe.crouching) return false;
    const dx = foe.pos.x - f.pos.x,
      dz = foe.pos.z - f.pos.z,
      along = dx * Math.sin(f.facingAngle) + dz * Math.cos(f.facingAngle);
    if (a.shape !== 'burst' && (along < -0.05 || Math.hypot(dx, dz) > a.range + 0.35)) return false;
    const r = f.combatRig,
      t = foe.combatRig;
    for (let i = 0; i < r.hit.length; i++) {
      const h = r.hit[i];
      if (!h.enabled) continue;
      for (const hurt of t.hurt) {
        if (!hurt.enabled) continue;
        if (combatModule.capsuleDistanceSq(h, hurt) <= (h.r + hurt.r) ** 2) return true;
        // Swept relative limb motion between adjacent 120 Hz ticks prevents tunnelling.
        if (r.lastAttack === a) {
          combatModule.sweptCapsule.a.copy(r.previous[i]).add(foe.pos).sub(foe.previousPos);
          combatModule.sweptCapsule.b.copy(h.b);
          combatModule.sweptCapsule.r = h.r;
          if (
            combatModule.capsuleDistanceSq(combatModule.sweptCapsule, hurt) <=
            (h.r + hurt.r) ** 2
          )
            return true;
        }
      }
    }
    return false;
  };
  combatModule.collectCombatHits = function collectCombatHits() {
    if (!matchModule.player || !matchModule.enemy) return;
    for (const f of [matchModule.player, matchModule.enemy]) combatModule.sampleCombatRig(f);
    for (const [f, foe] of [
      [matchModule.player, matchModule.enemy],
      [matchModule.enemy, matchModule.player],
    ]) {
      const a = f.attack,
        r = f.combatRig;
      if (a) {
        const times = a.hits ?? [0];
        for (let i = 0; i < times.length; i++) {
          const start = a.hitT + times[i],
            duration = a.hits ? 0.095 : a.active;
          if (
            !(f.attackMask & (1 << i)) &&
            f.stateTimer + 1e-9 >= start &&
            f.stateTimer <= start + duration + 1e-9 &&
            combatModule.combatIntersects(f, foe, a)
          ) {
            f.attackMask |= 1 << i;
            f.hasHit = true;
            f.hitResult = 'pending';
            matchModule.pendingHits.push({
              foe,
              attacker: f,
              attack: a.hits
                ? {
                    ...a,
                    kb: i === times.length - 1 ? 5 : a.kb,
                  }
                : a,
            });
          }
        }
      }
      for (let i = 0; i < r.hit.length; i++) r.previous[i].copy(r.hit[i].b);
      r.lastAttack = a;
    }
  };
  combatModule.legalCancel = function legalCancel(f, a, q) {
    if (q.type === 'light' && f.comboType === 'heavy') return false;
    if (q.type === 'light' && a.terminal) return false;
    if (q.type === 'heavy' && (q.context.up || q.context.down))
      return a.id !== 'launcher' && a.id !== 'sweep' && f.receivedCombo < 6;
    if (q.type === 'heavy' && f.comboType === 'heavy' && a.terminal) return false;
    return true;
  };
  return function initialize() {
    combatModule.moveFront = new THREE.Vector3();
    combatModule.moveRight = new THREE.Vector3();
    collisionScratch = {
      u: new THREE.Vector3(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      pa: new THREE.Vector3(),
      pb: new THREE.Vector3(),
    };
    combatModule.sweptCapsule = capsule();
    combatModule.SPECIAL_MOVES = {
      goku: {
        name: '如意延伸',
        motion: 'staffSmash',
        range: 2.8,
        startup: 0.24,
        active: 0.1,
        recovery: 0.37,
        dmg: 14,
        kb: 4,
        stun: 0.38,
      },
      roshi: {
        name: '龟仙反掌',
        motion: 'doublePalm',
        range: 1.8,
        startup: 0.15,
        active: 0.1,
        recovery: 0.36,
        dmg: 11,
        kb: 3,
        stun: 0.44,
        armor: true,
      },
      taopaipai: {
        name: '杀手突掌',
        motion: 'rushPalm',
        range: 1.8,
        startup: 0.12,
        active: 0.08,
        recovery: 0.4,
        dmg: 13,
        kb: 2,
        stun: 0.31,
        drive: 10,
      },
      piccolo: {
        name: '魔王震掌',
        motion: 'doublePalm',
        range: 2.2,
        startup: 0.38,
        active: 0.15,
        recovery: 0.53,
        dmg: 18,
        kb: 6,
        stun: 0.45,
        armor: true,
        guardDamage: 40,
      },
      tien: {
        name: '鹤流挑掌',
        antiAir: true,
        motion: 'uppercut',
        range: 1.9,
        startup: 0.18,
        active: 0.13,
        recovery: 0.42,
        dmg: 12,
        kb: 1.4,
        stun: 0.6,
        launch: 6.6,
      },
      krillin: {
        name: '低身疾踢',
        motion: 'sweep',
        range: 1.45,
        startup: 0.12,
        active: 0.1,
        recovery: 0.32,
        dmg: 10,
        kb: 2.5,
        stun: 0.4,
        level: 'low',
        drive: 8,
      },
      yamcha: {
        name: '狼牙突爪',
        motion: 'claw',
        range: 1.65,
        startup: 0.15,
        active: 0.27,
        recovery: 0.4,
        dmg: 5,
        kb: 0.2,
        stun: 0.21,
        hits: [0, 0.13],
        shape: 'wolf',
        drive: 8,
      },
    };
    combatModule.Fighter.prototype.startSpecial = function () {
      if (this.ki < 30) return;
      const entryPose = animationModule.cloneCombatPose(combatModule.combatPose(this));
      this.ki -= 30;
      const data = combatModule.SPECIAL_MOVES[this.def.id];
      this.attack = combatModule.finalizeMove({
        targetScale:
          (this === matchModule.player ? matchModule.enemy : matchModule.player)?.baseScale ??
          this.baseScale,
        id: 'special',
        level: 'mid',
        guardDamage: 22,
        ki: 0,
        kiCost: 30,
        ...data,
        anim: animationModule.ANIM[data.motion],
        cancelRules: {
          hit: ['ult'],
          block: [],
          whiff: [],
        },
      });
      this.attackMask = 0;
      this.state = 'attack';
      this.stateTimer = 0;
      this.hasHit = false;
      this.hitResult = null;
      this.comboTimer = 0;
      this.armorSpent = false;
      this.vel.copy(this.forward()).multiplyScalar(data.drive ?? 3);
      combatModule.beginMoveEvent(this, entryPose);
      matchModule.notify(data.name + ' · 30 气', 0.6);
    };
  };
}
