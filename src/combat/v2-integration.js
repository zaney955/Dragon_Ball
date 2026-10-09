import * as THREE from 'three';
export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  world: worldModule,
}) {
  let v1UpdateAttack,
    v1FighterUpdate,
    v1TakeHit,
    v1Evade,
    v1Dispose,
    v1Flight,
    v1Blast,
    v2ReleaseBase,
    v1Render;
  function kindTravel(b, dt) {
    return b.kind === 'blade' || !Number.isFinite(b.attack.range)
      ? b.speed * dt
      : Math.max(0, Math.min(b.speed * dt, b.attack.range - b.distance));
  }
  combatModule.updateV2Abilities = function updateV2Abilities(dt) {
    if (matchModule.game.over) {
      combatModule.cleanupAbilities();
      return;
    }
    for (const b of [...combatModule.v2Projectiles]) {
      if (b.delay > 0) {
        b.delay -= dt;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.visible = true;
      b.previous.copy(b.pos);
      b.life -= dt;
      if (b.kind === 'blade' && (b.distance >= 5 || b.life < 1.35) && !b.returning) {
        b.returning = true;
        b.hits.clear();
      }
      if (b.returning) {
        const target = b.owner.pos
          .clone()
          .add(new THREE.Vector3(0, combatModule.stature(b.owner), 0));
        b.direction.copy(target.sub(b.pos)).normalize();
        if (b.pos.distanceTo(target) < 0.25) {
          combatModule.removeAbility(combatModule.v2Projectiles, b);
          continue;
        }
      }
      const travel = kindTravel(b, dt);
      b.pos.addScaledVector(b.direction, travel);
      b.distance += travel;
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y += dt * (b.kind === 'blade' ? 22 : 3);
      const foe = b.owner === matchModule.player ? matchModule.enemy : matchModule.player;
      if (foe && !b.hits.has(foe) && foe.invulnerable <= 0 && foe.hp > 0) {
        const body = combatModule.sampleCombatRig(foe),
          sweep = {
            a: b.previous.clone().add(foe.pos).sub(foe.previousPos),
            b: b.pos,
            r: b.r,
          };
        if (
          body.hurt.some(
            (h) => h.enabled && combatModule.capsuleDistanceSq(sweep, h) <= (b.r + h.r) ** 2,
          )
        ) {
          b.hits.add(foe);
          foe.takeHit(b.owner, b.attack);
          b.owner.hasHit = true;
          b.owner.hitResult = foe.lastHitText === '格挡' ? 'blocked' : 'hit';
          if (b.kind !== 'blade') b.life = 0;
        }
      }
      if (
        worldModule.currentMap.destructibles.some(
          (x) => !x.tile && !x.broken && x.mesh.position.distanceTo(b.pos) < 0.6,
        )
      )
        b.life = 0;
      if (
        b.life <= 0 ||
        (b.kind !== 'blade' && Number.isFinite(b.attack.range) && b.distance >= b.attack.range) ||
        Math.abs(b.pos.x) > 16 ||
        Math.abs(b.pos.z) > 10
      )
        combatModule.removeAbility(combatModule.v2Projectiles, b);
    }
    for (const d of [...combatModule.v2Devices]) {
      d.life -= dt;
      d.fire -= dt;
      const foe = d.owner === matchModule.player ? matchModule.enemy : matchModule.player;
      const body = {
        a: d.pos.clone().add(new THREE.Vector3(0, 0.13, 0)),
        b: d.pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
        r: 0.3,
      };
      if (foe?.attack) {
        const a = foe.attack,
          r = combatModule.sampleCombatRig(foe);
        if (
          foe.stateTimer >= a.hitT &&
          foe.stateTimer < a.hitT + a.active &&
          !d.hits.has(a.serial) &&
          r.hit.some(
            (h) => h.enabled && combatModule.capsuleDistanceSq(h, body) <= (h.r + body.r) ** 2,
          )
        ) {
          d.hits.add(a.serial);
          d.hp -= a.dmg;
          combatModule.emitCombatEvent('deviceDamage', foe, null, a, {
            remaining: d.hp,
          });
        }
      }
      for (const b of [...combatModule.v2Projectiles])
        if (b.owner !== d.owner && b.pos.distanceTo(body.b) < b.r + 0.35) {
          d.hp -= b.attack.dmg;
          combatModule.removeAbility(combatModule.v2Projectiles, b);
        }
      if (d.kind === 'turret' && d.fire <= 0 && foe) {
        const distance = foe.pos.distanceTo(d.pos);
        if (distance < 5 && foe.pos.y < 2) {
          if (d.warning <= 0) {
            d.warning = 0.3;
            d.mesh.children[1].material.color.set(0xffb25f);
          } else {
            d.warning -= dt;
            if (d.warning <= 0) {
              const direction = foe.pos
                .clone()
                .add(new THREE.Vector3(0, Math.min(1.2, combatModule.stature(foe) * 0.65), 0))
                .sub(d.pos.clone().add(new THREE.Vector3(0, 0.5, 0)))
                .normalize();
              combatModule.newProjectile(d.owner, d.attack, 'bullet', {
                pos: d.pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
                direction,
                speed: 16,
                life: 0.4,
              });
              d.fire = 0.9;
              d.warning = 0;
            }
          }
        } else d.fire = 0.25;
      }
      if (
        d.kind === 'mine' &&
        foe &&
        foe.pos.y < 0.3 &&
        foe.pos.distanceTo(d.pos) < 0.75 &&
        foe.invulnerable <= 0
      ) {
        foe.takeHit(d.owner, d.attack);
        d.life = 0;
        renderModule.spawnShockRing(d.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), 0xffd579, 0.8);
      }
      // Deployables occupy a small real footprint; walking around them is possible.
      for (const f of [matchModule.player, matchModule.enemy])
        if (f && f.pos.y < 0.6) {
          const delta = f.pos.clone().sub(d.pos);
          delta.y = 0;
          const len = delta.length(),
            min = 0.3 + (f.anatomy ? f.anatomy.torsoR * 0.82 : 0.3 * f.baseScale);
          if (len < min && len > 0.01) {
            f.pos.addScaledVector(delta, (min - len) / len);
            f.clampPos();
          }
        }
      if (d.hp <= 0 || d.life <= 0) combatModule.removeAbility(combatModule.v2Devices, d);
    }
    for (const s of [...combatModule.v2Supports]) {
      s.life -= dt;
      s.fire -= dt;
      if (s.kind !== 'ghost') {
        const arm = s.mesh.getObjectByName('armR');
        if (arm) arm.rotation.x = s.fired ? -1.35 : -0.65;
        const elbow = s.mesh.getObjectByName('elbowR');
        if (elbow) elbow.rotation.x = -0.1;
        s.mesh.position.y = 0.018 * Math.sin((1.5 - s.life) * 20);
      }
      if (s.fire <= 0 && !s.fired) {
        s.fired = true;
        const hand = s.mesh.getObjectByName('handR');
        s.mesh.updateMatrixWorld(true);
        const origin = hand
          ? hand.getWorldPosition(new THREE.Vector3())
          : s.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
        combatModule.newProjectile(s.owner, s.attack, 'missile', {
          pos: origin,
          direction: s.owner.forward(),
          speed: 9,
          life: 1,
          radius: 0.13,
        });
      }
      if (s.life <= 0) combatModule.removeAbility(combatModule.v2Supports, s);
    }
    for (const f of [matchModule.player, matchModule.enemy])
      if (f?.v2.formSequence) {
        const seq = f.v2.formSequence;
        seq.time += dt;
        if (seq.time >= seq.next && seq.index < 3) {
          const form = ['bull', 'bat', 'robot'][seq.index];
          combatModule.switchForm(f, form);
          const motion = form === 'bull' ? 'pigBelly' : form === 'bat' ? 'pigSlap' : 'mechPunch';
          f.attack = combatModule.finalizeMove({
            id: 'transformUlt',
            name: '变化奇袭·' + form,
            isUlt: true,
            costCommitted: true,
            kiCost: 0,
            ki: 0,
            motion,
            anim: animationModule.ANIM[motion],
            shape: form === 'bull' ? 'ram' : undefined,
            startup: 0.1,
            active: 0.22,
            recovery: 0.16,
            dmg: form === 'bat' ? 3 : 14,
            range: form === 'bull' ? 2.2 : form === 'bat' ? 1.05 : 2.1,
            stun: 0.32,
            kb: 1,
            guardDamage: 15,
            targetY: Math.min(
              f.anatomy.hip + f.anatomy.armY + 0.25,
              combatModule.stature(seq.foe) * 0.7,
            ),
            transformPhase: seq.index,
          });
          f.attack.serial = seq.serial;
          f.state = 'ult';
          f.stateTimer = 0;
          f.attackMask = 0;
          f.hasHit = false;
          f.hitResult = null;
          f.stageFired = false;
          f.vel.copy(f.forward()).multiplyScalar(form === 'bat' ? 8 : 9);
          seq.index++;
          seq.next += 0.48;
        }
        if (seq.time > 1.6) {
          f.v2.formSequence = null;
          combatModule.switchForm(f, 'pig');
          f.v2.formTime = 0;
          f.v2.formCooldown = 2;
          f.attack = null;
          f.state = 'idle';
        }
      }
  };
  return function initialize() {
    v1UpdateAttack = combatModule.Fighter.prototype.updateAttack;
    combatModule.Fighter.prototype.updateAttack = function (dt, foe, input) {
      const a = this.attack;
      if (!a) return;
      if (
        this.anatomy &&
        a.control > 0 &&
        this.hitResult === 'hit' &&
        this.stateTimer >= a.hitT + 0.045 &&
        this.queue.some((q) => q.type === 'blast') &&
        this.ki >= 5
      ) {
        const entry = animationModule.cloneCombatPose(combatModule.combatPose(this));
        this.pull('blast');
        this.attack = null;
        this.state = 'idle';
        this.startKiBlast();
        this.poseEntry = entry;
        return;
      }
      // New ultimate fire stage uses physical equipment, not the V1 energy-beam presenter.
      if (this.anatomy && a.isUlt && this.stateTimer + 1e-9 >= a.hitT && !this.stageFired) {
        this.stageFired = true;
      }
      v1UpdateAttack.call(this, dt, foe, input);
      if (this.attack === a && !a.v2Released && this.stateTimer + 1e-9 >= a.hitT) {
        a.v2Released = true;
        combatModule.releaseV2Ability(this, a);
      }
    };
    v1FighterUpdate = combatModule.Fighter.prototype.update;
    combatModule.Fighter.prototype.update = function (dt, foe, input = combatModule.NEUTRAL_INPUT) {
      const v = this.v2 ?? (combatModule.initV2Fighter(this), this.v2);
      for (const k of [
        'cooldown',
        'formCooldown',
        'modeCooldown',
        'intuition',
        'controlTime',
        'controlGrace',
      ])
        v[k] = Math.max(0, v[k] - dt);
      if (v.controlGrace <= 0) v.controlChain = 0;
      if (v.formTime > 0) {
        v.formTime = Math.max(0, v.formTime - dt);
        if (v.formTime <= 0) {
          combatModule.switchForm(this, 'pig');
          v.formCooldown = 2.0;
          v.formSequence = null;
          this.attack = null;
          this.state = 'idle';
        }
      }
      if (v.modeTime > 0) {
        v.modeTime = Math.max(0, v.modeTime - dt);
        if (v.modeTime <= 0) v.mode = 'missile';
      }
      if (
        this.def.id === 'oolong' &&
        v.form === 'bat' &&
        !['hit', 'knockdown', 'grabbed'].includes(this.state)
      ) {
        this.jumpVel = 0;
        this.pos.y = Math.max(0.5, Math.min(1.1, this.pos.y + dt * 0.8));
      }
      v1FighterUpdate.call(this, dt, foe, input);
      if (
        this.def.id === 'korin' &&
        foe.attack &&
        Math.hypot(this.pos.x - foe.pos.x, this.pos.z - foe.pos.z) < foe.attack.range + 0.1
      )
        this.korinObservedAttack = matchModule.game.simTime;
    };
    v1TakeHit = combatModule.Fighter.prototype.takeHit;
    combatModule.Fighter.prototype.takeHit = function (attacker, a) {
      const hp = this.hp,
        old = this.attack,
        parryBefore = this.parryCooldown ?? 0;
      v1TakeHit.call(this, attacker, a);
      if (this.hp < hp && this.lastHitText !== '格挡') {
        this.v2.controlTime = 0;
        if (
          this.v2.form !== 'pig' &&
          this.def.id === 'oolong' &&
          a.dmg >= 8 &&
          this.lastHitText !== '霸体承伤'
        ) {
          combatModule.switchForm(this, 'pig');
          this.v2.formTime = 0;
          this.v2.formCooldown = 2.0;
          this.v2.formSequence = null;
        }
        if (a.control > 0) combatModule.applyControl(attacker, this, a);
        if (attacker.def.id === 'roshi' && a.isUlt && this.lastHitText !== '格挡')
          combatModule.applyControl(attacker, this, {
            ...a,
            control: 0.45,
          });
      }
      if (this.def.id === 'korin' && (this.parryCooldown ?? 0) > parryBefore)
        this.v2.intuition = 1.25;
      if (old?.ability === 'heal' && this.attack !== old && this.hp < hp)
        combatModule.emitCombatEvent('healInterrupted', this, attacker, old);
    };
    v1Evade = combatModule.Fighter.prototype.evade;
    combatModule.Fighter.prototype.evade = function (foe) {
      this.v2.controlTime = 0;
      v1Evade.call(this, foe);
    };
    v1Dispose = combatModule.Fighter.prototype.dispose;
    combatModule.Fighter.prototype.dispose = function () {
      combatModule.cleanupAbilities(this);
      v1Dispose.call(this);
    };
    v1Flight = combatModule.flightPhysics;
    combatModule.flightPhysics = function (f, dt, input) {
      if (!f.anatomy) return v1Flight(f, dt, input);
      if (f.def.id !== 'chiaotzu') return false;
      if (['hit', 'knockdown', 'guardbreak', 'grabbed', 'blockstun', 'dead'].includes(f.state)) {
        f.flightMode = false;
        return false;
      }
      if (input.flight && f.ki > 0 && !f.airLocked) {
        f.flightMode = true;
        f.airTime = (f.airTime ?? 0) + dt;
        f.ki = Math.max(0, f.ki - 10 * dt);
        f.jumpVel = 2.1;
        if (f.pull('jump')) f.jumpVel = 2.4;
        if (f.airTime >= 2.0) f.airLocked = true;
      } else if (f.flightMode) f.airLocked = true;
      if (!f.flightMode) return false;
      if (f.airLocked) f.jumpVel = -2.8;
      f.pos.y = THREE.MathUtils.clamp(f.pos.y + f.jumpVel * dt, 0, 2);
      if (f.pos.y === 0) {
        f.flightMode = false;
        f.airLocked = false;
        f.airTime = 0;
        f.jumpVel = 0;
        f.state = 'landing';
        f.stunTime = 0.12;
        f.stateTimer = 0;
        combatModule.emitCombatEvent('landing', f, null, null);
      }
      return true;
    };
    v1Blast = combatModule.Fighter.prototype.startKiBlast;
    combatModule.Fighter.prototype.startKiBlast = function (held = 0) {
      if (!this.anatomy) return v1Blast.call(this, held);
      if (this.attack || this.dashTime > 0 || this.hp <= 0) return false;
      const def = this.def,
        kind =
          def.id === 'pilaf'
            ? this.v2.mode === 'flame'
              ? 'flame'
              : 'missile'
            : def.id === 'bulma'
              ? 'bullet'
              : def.id === 'chiaotzu'
                ? 'psychic'
                : def.id === 'chichi'
                  ? 'helmet'
                  : null;
      if (!kind) {
        if (!matchModule.game.manualTest)
          matchModule.notify(
            def.id === 'gyumao'
              ? '牛魔王用巨斧控距；F 无远程攻击'
              : def.id === 'korin'
                ? '猫仙人以短杖与防反作战'
                : '乌龙依靠变化术，无气功',
            0.6,
          );
        return false;
      }
      const cost = kind === 'flame' ? 12 : kind === 'missile' ? 10 : kind === 'helmet' ? 8 : 5;
      if (this.ki < cost) return false;
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this));
      this.ki -= cost;
      this.attack = charactersModule.v2Move(
        {
          psychic: '洞洞波',
          bullet: '科技手枪',
          missile: '机甲导弹',
          flame: '火焰喷射',
          helmet: '头盔光束',
        }[kind],
        def.id === 'pilaf' ? 'mechArm' : def.id === 'chiaotzu' ? 'psychicPoke' : 'capsuleCast',
        kind === 'missile' ? 18 : 10,
        3,
        kind === 'missile' ? 32 : 24,
        kind === 'missile' ? 9 : kind === 'flame' ? 12 : kind === 'psychic' ? 6 : 4,
        kind === 'flame' ? 2.5 : 8,
        {
          id: 'equipment',
          targetY:
            (this === matchModule.player ? matchModule.enemy : matchModule.player).pos.y +
            combatModule.stature(
              this === matchModule.player ? matchModule.enemy : matchModule.player,
            ) *
              0.75,
          targetDistance: this.pos.distanceTo(
            (this === matchModule.player ? matchModule.enemy : matchModule.player).pos,
          ),
          shape: 'ability',
          ability: 'equipment',
          equipment: kind,
          ki: 0,
          kiCost: cost,
          stun: 0.2,
          kb: 1,
          cancelRules: {
            hit: [],
            block: [],
            whiff: [],
          },
        },
      );
      if (this.isAI && this.v2.shotTarget && this.brainTime - this.v2.shotTarget.time < 0.4) {
        const t = this.v2.shotTarget;
        this.facingAngle = Math.atan2(t.x - this.pos.x, t.z - this.pos.z);
      }
      this.state = 'attack';
      this.stateTimer = 0;
      this.attackMask = 0;
      this.hasHit = false;
      this.vel.set(0, 0, 0);
      combatModule.beginMoveEvent(this, entry);
      return true;
    };
    v2ReleaseBase = combatModule.releaseV2Ability;
    combatModule.releaseV2Ability = function (f, a) {
      if (a.ability === 'equipment') {
        const kind = a.equipment;
        combatModule.newProjectile(f, a, kind, {
          speed: kind === 'missile' ? 10 : kind === 'flame' ? 7 : 18,
          life: kind === 'flame' ? 0.32 : 0.75,
          radius: kind === 'flame' ? 0.3 : kind === 'missile' ? 0.13 : 0.075,
        });
        combatModule.v2Sound(f, 'release');
      } else v2ReleaseBase(f, a);
    };
    v1Render = combatModule.Fighter.prototype.render;
    combatModule.Fighter.prototype.render = function (dt = 1 / 60, alpha = 1) {
      v1Render.call(this, dt, alpha);
      if (!this.anatomy) return;
      this.root.rotation.y = this.facingAngle;
      charactersModule.applyPose(this.parts, combatModule.combatPose(this), 0, true);
      if (this.parts.axe) {
        this.parts.axe.rotation.z = Math.PI;
        this.parts.axe.visible = true;
      }
      if (this.parts.blade) this.parts.blade.visible = !this.v2.bladeOut;
      if (this.parts.wingL) {
        this.parts.wingL.rotation.z = Math.sin(matchModule.game.simTime * 18) * 0.2;
        this.parts.wingR.rotation.z = -Math.sin(matchModule.game.simTime * 18) * 0.2;
      }
      if (this.parts.damagePanel) {
        this.parts.damagePanel.material.color.set(
          this.hp / this.maxHp < 0.35 ? 0xff4e3c : 0xcfad67,
        );
      }
      this.shadow.scale.setScalar((this.anatomy.torsoR / 0.3) * (1 + this.pos.y * 0.12));
    };
    // Short psychic arms need an authored advancing touch, with a committed direction.
    // Short psychic arms need an authored advancing touch, with a committed direction.
    for (const a of charactersModule.CHARACTERS.find((c) => c.id === 'chiaotzu')?.combos.light ??
      [])
      a.drive = 4.1;
    // Cat-step paw attacks advance faster, while retaining short anatomical reach.
    // Cat-step paw attacks advance faster, while retaining short anatomical reach.
    for (const a of charactersModule.CHARACTERS.find((c) => c.id === 'korin')?.combos.light ?? [])
      a.drive = 6.5;
    /* V2 roster tactics use only V1's delayed observations. */
  };
}
