import * as THREE from 'three';
export function register({
  animation: animationModule,
  audio: audioModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  // Six connected hits allow the longest authored chain, then force separation.
  combatModule.COMBO_PROTECTION_HITS = 6;
  combatModule.launchKnockback = function (f, attacker, reason = 'combo') {
    const direction = f.pos.clone().sub(attacker.pos).setY(0);
    if (direction.lengthSq() < 0.001) direction.copy(attacker.forward());
    direction.normalize();
    f.attack = null;
    f.throwPending = null;
    f.clearQueue();
    f.comboType = null;
    f.comboTimer = 0;
    f.receivedCombo = 0;
    f.juggle = 0;
    f.comboGrace = 0;
    f.flightMode = false;
    f.airLocked = true;
    f.airRecovery = true;
    f.launchFlight = true;
    f.launchElapsed = 0;
    f.launchReason = reason;
    f.pos.y = Math.max(0.04, f.pos.y);
    f.jumpVel = 7;
    f.vel.copy(direction).multiplyScalar(11.5);
    f.state = 'hit';
    f.stateTimer = 0;
    f.stunTime = 0.85;
    // Brief separation immunity ends in time for an E pursuit to connect in the air.
    f.invulnerable = Math.max(f.invulnerable, 0.2);
    f.v2.controlTime = 0;
    f.lastHitText = reason === 'combo' ? '连击保护 · 击飞' : '防反 · 击飞';
    renderModule.spawnShockRing(f.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffe5ab, 1.2);
    combatModule.emitCombatEvent('launch', attacker, f, null, { reason });
    if (!matchModule.game.manualTest) matchModule.notify(f.lastHitText, 0.65);
  };
  return function initialize() {
    combatModule.NEUTRAL_INPUT = {};
    combatModule.Fighter = class Fighter {
      constructor(def, isAI, startX, facingDir) {
        Object.assign(this, {
          def,
          isAI,
          maxHp: def.hp * 2,
          hp: def.hp * 2,
          ki: 30,
          maxKi: 100,
          guard: 100,
          guardDelay: 0,
          pos: new THREE.Vector3(startX, 0, 0),
          previousPos: new THREE.Vector3(startX, 0, 0),
          vel: new THREE.Vector3(),
          facingDir,
          facingAngle: facingDir > 0 ? Math.PI / 2 : -Math.PI / 2,
          visualAngle: facingDir > 0 ? Math.PI / 2 : -Math.PI / 2,
          state: 'idle',
          stateTimer: 0,
          stunTime: 0,
          attack: null,
          hasHit: false,
          hitResult: null,
          walkPhase: 0,
          flash: 0,
          buffered: null,
          bufferLife: 0,
          queue: [],
          comboType: null,
          comboIdx: 0,
          comboTimer: 0,
          dashTime: 0,
          dashCooldown: 0,
          pursuitWindow: 0,
          invulnerable: 0,
          jumpVel: 0,
          guardHeld: 0,
          blockPressed: false,
          crouching: false,
          escapeCharges: 2,
          escapeRegen: 0,
          escapeCooldown: 0,
          breakerCooldown: 0,
          receivedCombo: 0,
          comboGrace: 0,
          juggle: 0,
          throwPending: null,
          aiDecision: 0.3,
          aiBlockTimer: 0,
          aiAction: null,
          aiStrafe: 1,
          aiStrafeTimer: 0,
          lastHitText: '',
          lastDamage: 0,
          damageTotal: 0,
          flightMode: false,
          airRecovery: false,
          launchFlight: false,
          launchElapsed: 0,
          dashKind: 'step',
          trailTimer: 0,
        });
        const b = def.buildBody();
        this.root = b.root;
        this.parts = b.parts;
        this.baseScale = this.root.scale.x;
        this.materials = [];
        const mats = new Set();
        this.root.traverse((o) => {
          if (o.material && !Array.isArray(o.material) && o.material.isMeshToonMaterial)
            mats.add(o.material);
        });
        for (const m of mats)
          this.materials.push({
            m,
            em: m.emissive.clone(),
            intensity: m.emissiveIntensity,
          });
        this.shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(1.55 * this.baseScale, 1.0 * this.baseScale),
          new THREE.MeshBasicMaterial({
            map: combatModule.contactShadowTexture,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          }),
        );
        this.shadow.rotation.x = -Math.PI / 2;
        renderModule.scene.add(this.shadow);
        renderModule.scene.add(this.root);
        combatModule.initV2Fighter(this);
        combatModule.initYouthFighter(this);
        this.nimbus = def.id === 'goku' ? combatModule.makeFlyingNimbus() : null;
        this.render(1 / 60, 1);
      }
      dispose() {
        combatModule.stopChargeSound(this);
        renderModule.stopUltSound(this);
        if (this.nimbus) {
          renderModule.scene.remove(this.nimbus);
          worldModule.disposeGroup(this.nimbus);
        }
        renderModule.scene.remove(this.root);
        worldModule.disposeGroup(this.root);
        renderModule.scene.remove(this.shadow);
        this.shadow.geometry.dispose();
        this.shadow.material.dispose();
      }
      forward() {
        return new THREE.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
      }
      enqueue(type, input = {}) {
        if (this.queue.length >= 3) this.queue.shift();
        this.queue.push({
          type,
          context: {
            up: !!input.up,
            down: !!input.down,
          },
          life: 0.34,
        });
        this.buffered = type;
      }
      captureInput(input) {
        const list = input.actions ?? [];
        for (const a of list)
          this.enqueue(
            typeof a === 'string' ? a : a.type,
            typeof a === 'string'
              ? input
              : {
                  ...input,
                  ...a,
                },
          );
        for (const k of [
          'light',
          'heavy',
          'special',
          'ult',
          'throw',
          'evasion',
          'pursuit',
          'dash',
          'jump',
          'blast',
        ])
          if (input[k] && !list.some((a) => (typeof a === 'string' ? a : a.type) === k))
            this.enqueue(k, input);
      }
      pull(type) {
        const i = this.queue.findIndex((q) => q.type === type);
        if (i < 0) return false;
        this.queue.splice(i, 1);
        return true;
      }
      clearQueue() {
        this.queue.length = 0;
        this.buffered = null;
        this.bufferLife = 0;
      }
      update(dt, foe, input = combatModule.NEUTRAL_INPUT) {
        this.previousPos.copy(this.pos);
        this.stateTimer += dt;
        if (this.launchFlight) this.launchElapsed += dt;
        this.flash = Math.max(0, this.flash - dt * 5.5);
        for (const name of [
          'comboTimer',
          'pursuitWindow',
          'dashCooldown',
          'invulnerable',
          'escapeCooldown',
          'breakerCooldown',
          'guardDelay',
          'comboGrace',
        ])
          this[name] = Math.max(0, this[name] - dt);
        for (const q of this.queue) q.life -= dt;
        for (let i = this.queue.length - 1; i >= 0; i--)
          if (this.queue[i].life <= 0) this.queue.splice(i, 1);
        this.captureInput(input);
        this.lastInput = input;
        this.parryCooldown = Math.max(0, (this.parryCooldown ?? 0) - dt);
        this.pursuitCooldown = Math.max(0, (this.pursuitCooldown ?? 0) - dt);
        this.kiWarning = Math.max(0, (this.kiWarning ?? 0) - dt);
        if (this.state !== 'charge' || !input.charge) this.chargeHeld = 0;
        if (
          this.comboGrace <= 0 &&
          !['hit', 'knockdown', 'grabbed', 'guardbreak'].includes(this.state)
        ) {
          this.receivedCombo = 0;
          this.juggle = 0;
          this.damageTotal = 0;
        }
        if (this.escapeCharges < 2) {
          this.escapeRegen += dt;
          if (this.escapeRegen >= 6.5) {
            this.escapeCharges++;
            this.escapeRegen = 0;
          }
        }
        if (!input.block && this.guardDelay <= 0) this.guard = Math.min(100, this.guard + 17 * dt);
        this.blockPressed = !!input.block && !this.wasBlocking;
        this.guardHeld = input.block ? this.guardHeld + dt : 0;
        this.wasBlocking = !!input.block;
        this.crouching =
          !!input.crouch &&
          this.pos.y < 0.1 &&
          !this.attack &&
          !['hit', 'knockdown', 'guardbreak', 'grabbed'].includes(this.state);
        if (this.hp <= 0 && this.state !== 'dead') {
          this.state = 'dead';
          this.stateTimer = 0;
          this.attack = null;
          this.clearQueue();
          this.vel.copy(this.forward()).multiplyScalar(-5);
        }
        const flying = combatModule.flightPhysics(this, dt, input);
        if (!flying && (this.pos.y > 0 || this.jumpVel > 0)) {
          this.jumpVel -= 22 * dt;
          this.pos.y += this.jumpVel * dt;
          if (this.pos.y <= 0) {
            this.pos.y = 0;
            this.jumpVel = 0;
            this.airLocked = false;
            this.airTime = 0;
            if (this.state === 'hit' && this.airRecovery) {
              this.state = 'knockdown';
              this.stateTimer = 0;
              this.stunTime = 0.38;
              this.airRecovery = false;
            }
            if (this.launchFlight) {
              this.launchFlight = false;
              this.launchElapsed = 0;
              this.state = this.hp <= 0 ? 'dead' : 'knockdown';
              this.stateTimer = 0;
              this.stunTime = 0.42;
              this.invulnerable = Math.max(this.invulnerable, 0.42);
              this.vel.multiplyScalar(0.18);
              worldModule.damageStage(this, { dmg: 20, landingImpact: true }, this.pos);
              combatModule.emitCombatEvent('landingImpact', this, foe, null);
            } else renderModule.spawnDust(this.pos, 4);
          }
        }
        if (this.state === 'dead') {
          this.integrate(dt, 5);
          return;
        }
        if (this.throwPending) {
          if (this.throwPending.attacker.hp <= 0 || !this.throwPending.attacker.attack?.isThrow) {
            this.throwPending = null;
            this.state = 'idle';
            this.stateTimer = 0;
            return;
          }
          if (this.pull('throw')) {
            const a = this.throwPending.attacker;
            this.throwPending = null;
            this.state = 'idle';
            this.invulnerable = 0.15;
            this.vel.copy(this.forward()).multiplyScalar(-3);
            a.attack = null;
            a.state = 'idle';
            a.clearQueue();
            a.vel.copy(a.forward()).multiplyScalar(-3);
            matchModule.notify('投技拆解', 0.65);
            audioModule.combatFeedback('tech', this.pos, 0.25);
          } else {
            this.throwPending.timer -= dt;
            if (this.throwPending.timer <= 0) {
              const pending = this.throwPending;
              this.throwPending = null;
              this.takeHit(pending.attacker, {
                ...pending.attack,
                isThrow: false,
                unblockable: true,
                knockdown: true,
              });
            }
          }
          this.integrate(dt, 8);
          return;
        }
        if (['hit', 'blockstun', 'knockdown', 'guardbreak', 'landing'].includes(this.state)) {
          if (
            input.block &&
            this.pull('dash') &&
            this.ki >= 35 &&
            this.breakerCooldown <= 0 &&
            this.state === 'hit'
          ) {
            this.breaker(foe);
            return;
          }
          if (
            this.pull('evasion') &&
            this.escapeCharges > 0 &&
            this.ki >= 15 &&
            this.escapeCooldown <= 0 &&
            this.state === 'hit'
          ) {
            this.evade(foe);
            return;
          }
          this.integrate(dt, this.launchFlight ? 0.85 : 7);
          if (this.stateTimer + 1e-9 >= this.stunTime && this.pos.y < 0.15) {
            this.state = input.block ? 'block' : 'idle';
            this.stateTimer = 0;
            this.airRecovery = false;
            this.invulnerable = Math.max(this.invulnerable, 0.045);
          }
          return;
        }
        if (this.pull('evasion')) {
          if (this.escapeCharges > 0 && this.ki >= 15 && this.escapeCooldown <= 0) {
            this.evade(foe);
            return;
          }
          if (!this.isAI) matchModule.notify('脱身需要 15 气与残像次数', 0.7);
        }
        if (foe && !this.attack && this.dashTime <= 0) {
          const seen =
            combatModule.inYouthSmoke?.(this) || combatModule.inYouthSmoke?.(foe)
              ? this.isAI
                ? this.observations?.at(-1)
                : this.youth?.lastSeen
              : null;
          const obscured = combatModule.inYouthSmoke?.(this) || combatModule.inYouthSmoke?.(foe);
          const target =
            seen ??
            (obscured
              ? {
                  x: this.pos.x + Math.sin(this.facingAngle),
                  z: this.pos.z + Math.cos(this.facingAngle),
                }
              : foe.pos);
          this.facingAngle = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
          this.facingDir = Math.sign(target.x - this.pos.x) || this.facingDir;
        }
        if (this.dashTime > 0) {
          this.dashTime -= dt;
          this.trailTimer -= dt;
          if (this.trailTimer <= 0) {
            this.trailTimer = 0.045;
            combatModule.spawnAfterimage(this);
          }
          if (this.dashKind === 'pursuit' && foe) {
            const target = foe.launchFlight ? combatModule.sampleCombatRig(foe).hurt[1] : null;
            const delta = target
              ? target.a.clone().add(target.b).multiplyScalar(0.5).sub(this.pos)
              : foe.pos.clone().sub(this.pos);
            delta.y = 0;
            const distance = delta.length();
            if (distance > 1.15) {
              this.vel
                .copy(delta.normalize())
                .multiplyScalar(
                  Math.min(24 * combatModule.mobilitySpeed(this), (distance - 1.05) / dt),
                );
            } else {
              this.vel.multiplyScalar(0.2);
              this.dashTime = 0;
            }
            if (foe.pos.y > 0.2 || this.pos.y > 0.2) {
              this.jumpVel = THREE.MathUtils.clamp(
                foe.jumpVel +
                  (Math.max(0.04, foe.pos.y - (foe.launchFlight ? 0.45 : 0)) - this.pos.y) * 12,
                -9,
                12,
              );
              this.airLocked = true;
            }
          }
          this.pos.addScaledVector(this.vel, dt);
          this.clampPos();
          if (this.dashTime <= 0) {
            this.state = 'idle';
            this.vel.multiplyScalar(0.16);
          }
          return;
        }
        if (this.attack) {
          this.updateAttack(dt, foe, input);
          this.integrate(dt, 11);
          return;
        }
        if (this.pull('pursuit')) {
          if (
            this.ki >= 12 &&
            this.pursuitCooldown <= 0 &&
            foe.pos.distanceTo(this.pos) > 1.2 &&
            foe.pos.distanceTo(this.pos) <= 10
          ) {
            this.pursue(foe);
            return;
          }
        }
        let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0),
          mz = (input.down ? 1 : 0) - (input.up ? 1 : 0),
          n = Math.hypot(mx, mz);
        if (n) {
          mx /= n;
          mz /= n;
        }
        if (!this.isAI && n) {
          const yaw =
              input.moveYaw ?? trainingModule.movementYaw(this === matchModule.enemy ? 1 : 0),
            front = combatModule.moveFront.set(Math.sin(yaw), 0, Math.cos(yaw)),
            right = combatModule.moveRight.set(-front.z, 0, front.x),
            side = mx,
            toward = -mz;
          mx = right.x * side + front.x * toward;
          mz = right.z * side + front.z * toward;
        }
        if (this.dashCooldown <= 0 && this.ki >= 5 && this.pull('dash')) {
          const dashCost = this.dashPrepaid ? 8 : 5;
          this.ki -= this.dashPrepaid ? 0 : 5;
          this.dashPrepaid = false;
          if (!n) {
            const f = this.forward();
            mx = f.x;
            mz = f.z;
          }
          this.vel.set(
            mx * 16.5 * combatModule.mobilitySpeed(this),
            0,
            mz * 16.5 * combatModule.mobilitySpeed(this),
          );
          this.dashTime = 0.135;
          this.dashCooldown = 0.48;
          this.invulnerable = 0.07;
          this.state = 'dash';
          this.dashKind = 'step';
          renderModule.spawnDust(this.pos, 6);
          audioModule.sfxSwing();
          combatModule.emitCombatEvent('dash', this, foe, null, {
            cost: dashCost,
          });
          return;
        }
        if (this.pos.y <= 0.001 && this.pull('jump')) {
          this.jumpVel = 7.6;
          this.pos.y = 0.001;
          renderModule.spawnDust(this.pos, 4);
        }
        if (input.block && this.pos.y < 0.1) {
          this.state = 'block';
          this.vel.multiplyScalar(Math.exp(-30 * dt));
          this.pos.addScaledVector(this.vel, dt);
          this.clampPos();
          return;
        }
        const action = this.queue.find((q) =>
          ['light', 'heavy', 'special', 'ult', 'throw', 'blast'].includes(q.type),
        );
        if (action) {
          this.pull(action.type);
          if (action.type === 'blast') {
            this.startKiBlast();
          } else if (action.type === 'special') {
            this.startSpecial(action.context);
          } else if (action.type === 'ult') {
            if (this.ki >= 100) this.startUlt(action.context);
            else if (!this.isAI) matchModule.notify('必杀需要满气', 0.5);
          } else if (action.type === 'throw') this.startThrow();
          else this.startAttack(action.type, action.context);
          if (this.attack) return;
        }
        if (input.charge && this.pos.y < 0.1) {
          if (this.state !== 'charge') {
            this.state = 'charge';
            this.stateTimer = 0;
            this.chargeHeld = 0;
            this.chargeFull = false;
            this.clearQueue();
            if (!matchModule.game.manualTest) {
              renderModule.spawnDust(this.pos, 5);
              matchModule.game.shake = Math.max(matchModule.game.shake, 0.035);
            }
          }
          this.crouching = false;
          this.chargeHeld += dt;
          this.vel.set(0, 0, 0);
          if (this.chargeHeld > combatModule.KI_RULES.chargeStartup)
            this.ki = Math.min(this.maxKi, this.ki + combatModule.KI_RULES.chargeRate * dt);
          if (this.ki >= this.maxKi && !this.chargeFull) {
            this.chargeFull = true;
            this.chargeFullTime = matchModule.game.simTime;
            if (!matchModule.game.manualTest) {
              renderModule.spawnShockRing(
                this.pos.clone().add(new THREE.Vector3(0, 1, 0)),
                combatModule.kiColor(this),
                1.5,
              );
              audioModule.eventSound('pickup');
              matchModule.game.shake = Math.max(matchModule.game.shake, 0.06);
              if (this === matchModule.player) matchModule.notify('气力充满 · U 必杀', 0.7);
            }
          }
          return;
        }
        if (!this.youth && input.blastHeld && this.pos.y < 0.1) {
          if (this.state !== 'blastCharge') {
            if (this.ki < combatModule.KI_RULES.blastCost) {
              if (!this.blastRejected) combatModule.warnKi(this, combatModule.KI_RULES.blastCost);
              this.blastRejected = true;
              return;
            }
            this.state = 'blastCharge';
            this.stateTimer = 0;
            this.blastHeldTime = 0;
            this.crouching = false;
            this.clearQueue();
          }
          this.blastHeldTime = Math.min(
            combatModule.KI_RULES.blastMaxHold,
            (this.blastHeldTime ?? 0) + dt,
          );
          this.vel.set(0, 0, 0);
          return;
        }
        this.blastRejected = false;
        if (this.state === 'blastCharge') {
          const held = this.blastHeldTime ?? 0;
          this.blastHeldTime = 0;
          this.startKiBlast(held);
          return;
        }
        const speed = (this.crouching ? 2.7 : 6.8) * combatModule.mobilitySpeed(this),
          response = 1 - Math.exp(-(n ? 40 : 46) * dt);
        this.vel.x = THREE.MathUtils.lerp(this.vel.x, mx * speed, response);
        this.vel.z = THREE.MathUtils.lerp(this.vel.z, mz * speed, response);
        this.pos.addScaledVector(this.vel, dt);
        this.state = n ? 'walk' : this.crouching ? 'crouch' : 'idle';
        this.clampPos();
        this.walkPhase += n
          ? Math.hypot(this.pos.x - this.previousPos.x, this.pos.z - this.previousPos.z) * 2.25
          : dt * 2.6;
        this.ki = Math.min(100, this.ki + combatModule.KI_RULES.passiveRate * dt);
        this.clampPos();
      }
      integrate(dt, friction) {
        this.vel.multiplyScalar(Math.exp(-friction * dt));
        this.pos.addScaledVector(this.vel, dt);
        this.clampPos();
      }
      clampPos() {
        const b = worldModule.currentMap?.bounds ?? {
            x: 13.5,
            z: 6,
          },
          extra = matchModule.game.ringOut && matchModule.game.selectedMap === 0 ? 2.5 : 0;
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, -b.x - extra, b.x + extra);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, -b.z - extra, b.z + extra);
        this.pos.y = Math.max(0, this.pos.y);
      }
      startAttack(type, input = {}) {
        const entryPose = animationModule.cloneCombatPose(combatModule.combatPose(this));
        const chain = this.def.combos[type];
        let idx =
          this.comboType === type && this.comboTimer > 0
            ? Math.min(this.comboIdx + 1, chain.length - 1)
            : 0;
        const mixed = type === 'heavy' && this.comboType === 'light' && this.comboTimer > 0;
        if (mixed) idx = Math.min(this.comboIdx, chain.length - 1);
        let a = {
          ...chain[idx],
        };
        if (type === 'heavy' && input.up) a = charactersModule.legacyDirectionMove(this, a, input);
        else if (type === 'heavy' && input.down)
          a = charactersModule.legacyDirectionMove(this, a, input);
        if (a.id === 'launcher' || a.id === 'sweep') {
          a.cancelRules = {
            hit: ['pursuit', 'dash', 'special', 'ult'],
            block: [],
            whiff: [],
          };
          a.terminal = true;
        }
        if (this.pos.y > 0.15) {
          a.level = 'overhead';
          a.motion = 'heavyKick';
          a.anim = animationModule.ANIM.heavyKick;
          a.range += 0.08;
        }
        a = combatModule.finalizeMove({
          ...a,
          targetScale:
            (this === matchModule.player ? matchModule.enemy : matchModule.player)?.baseScale ??
            this.baseScale,
        });
        this.attack = a;
        this.attackMask = 0;
        this.armorSpent = false;
        this.comboType = type;
        this.comboIdx = idx;
        this.state = 'attack';
        this.stateTimer = 0;
        this.hasHit = false;
        this.hitResult = null;
        this.comboTimer = a.dur + 0.25;
        this.vel.copy(this.forward()).multiplyScalar(a.drive ?? (type === 'light' ? 3.0 : 4.2));
        this.buffered = null;
        combatModule.beginMoveEvent(this, entryPose);
      }
      startThrow() {
        const entryPose = animationModule.cloneCombatPose(combatModule.combatPose(this));
        this.attack = {
          id: 'throw',
          motion: 'doublePalm',
          anim: animationModule.ANIM.doublePalm,
          isThrow: true,
          unblockable: true,
          dmg: 12,
          range: 1.36,
          hitT: 0.15,
          active: 0.045,
          dur: 0.7,
          stun: 0.65,
          kb: 5.8,
          guardDamage: 0,
          ki: 8,
        };
        this.state = 'attack';
        this.stateTimer = 0;
        this.hasHit = false;
        this.hitResult = null;
        this.attackMask = 0;
        this.comboTimer = 0;
        this.vel.copy(this.forward()).multiplyScalar(2);
        this.attack = combatModule.finalizeMove(this.attack);
        combatModule.beginMoveEvent(this, entryPose);
      }
      startUlt() {
        if (this.ki < 100) return;
        const entryPose = animationModule.cloneCombatPose(combatModule.combatPose(this));
        const profiles = charactersModule.LEGACY_ULT_PROFILES;
        this.attack = combatModule.finalizeMove({
          ...charactersModule.ULT_ATK,
          kiCost: 100,
          anim: this.def.ultAnim,
          motion: this.def.ultStyle,
          level: 'mid',
          guardDamage: 42,
          ...profiles[this.def.id],
          cancelRules: {
            hit: [],
            block: [],
            whiff: [],
          },
        });
        this.state = 'ult';
        this.stateTimer = 0;
        this.hasHit = false;
        this.attackMask = 0;
        this.hitResult = null;
        this.attack.costCommitted = this.attack.shape === 'wolf';
        if (this.attack.costCommitted) this.ki = 0;
        this.comboType = null;
        this.comboTimer = 0;
        this.clearQueue();
        this.vel.copy(this.forward()).multiplyScalar(this.attack.drive ?? 0);
        this.stageFired = false;
        if (this.def.id === 'tien') this.hp = Math.max(1, this.hp - this.maxHp * 0.08);
        combatModule.beginMoveEvent(this, entryPose);
        if (this.attack.costCommitted)
          combatModule.emitCombatEvent('kiSpent', this, null, this.attack, {
            remaining: this.ki,
          });
        renderModule.castUltVisual(this, this.def);
        renderModule.sfxUlt(this);
        matchModule.notify(this.def.ultName, 1.0);
      }
      updateAttack(dt, foe, input) {
        const a = this.attack;
        if (!a) return;
        if (a.pursuitFollow && foe.launchFlight && this.stateTimer <= a.hitT + a.active) {
          const body = combatModule.sampleCombatRig(foe).hurt[1];
          const delta = body.a.clone().add(body.b).multiplyScalar(0.5).sub(this.pos).setY(0);
          const distance = delta.length();
          this.facingAngle = Math.atan2(delta.x, delta.z);
          this.vel
            .copy(delta.normalize())
            .multiplyScalar(
              Math.min(
                24 * combatModule.mobilitySpeed(this),
                Math.max(0, (distance - 0.6) * 18) + Math.hypot(foe.vel.x, foe.vel.z),
              ),
            );
          this.jumpVel = THREE.MathUtils.clamp(
            foe.jumpVel +
              (Math.max(0.04, foe.pos.y - (foe.launchFlight ? 0.45 : 0)) - this.pos.y) * 12,
            -9,
            12,
          );
          this.airLocked = true;
          if (this.stateTimer < a.hitT) {
            a.targetY = (body.a.y + body.b.y) * 0.5;
          }
        }
        if (matchModule.game.over && (a.isKiBlast || a.isUlt)) {
          this.attack = null;
          this.state = 'idle';
          this.stateTimer = 0;
          return;
        }
        if ((a.isKiBlast || a.isUlt) && !a.costCommitted && this.stateTimer + 1e-9 >= a.hitT) {
          if (this.ki + 1e-9 < a.kiCost) {
            combatModule.warnKi(this, a.kiCost);
            this.attack = null;
            this.state = 'idle';
            this.stateTimer = 0;
            this.clearQueue();
            return;
          }
          this.ki = Math.max(0, this.ki - a.kiCost);
          a.costCommitted = true;
          combatModule.emitCombatEvent('kiSpent', this, null, a, {
            remaining: this.ki,
          });
          if (a.isKiBlast) combatModule.fireKiBlast(this, a);
        }
        if (!a.swingFired && this.stateTimer >= Math.max(0, a.hitT - 0.025)) {
          a.swingFired = true;
          combatModule.emitCombatEvent('swing', this, null, a);
        }
        if (!a.activeFired && this.stateTimer + 1e-9 >= a.hitT) {
          a.activeFired = true;
          combatModule.emitCombatEvent('active', this, null, a);
        }
        if (
          !a.isKiBlast &&
          !a.whiffFired &&
          !this.hasHit &&
          this.stateTimer > a.hitT + a.active + matchModule.STEP
        ) {
          a.whiffFired = true;
          combatModule.emitCombatEvent('whiff', this, foe, a, {
            recoveryRemaining: Math.max(0, a.dur - this.stateTimer),
          });
        }
        if (a.isUlt && a.shape === 'wolf' && this.stateTimer < a.hitT + a.active) {
          const distance = Math.hypot(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
          this.vel.copy(this.forward()).multiplyScalar(distance > 0.85 ? (a.drive ?? 11) : 0);
        }
        if (a.isUlt && !this.stageFired && this.stateTimer + 1e-9 >= a.hitT) {
          this.stageFired = true;
          renderModule.sfxUlt(this, true);
          worldModule.damageStage(this, a);
        }
        if (!a.isYouth && this.stateTimer < a.hitT * 0.65) {
          const wanted = Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
          this.facingAngle += THREE.MathUtils.clamp(
            renderModule.angleDelta(wanted, this.facingAngle),
            -dt * 3,
            dt * 3,
          );
        }
        const result =
          this.hitResult === 'hit' ? 'hit' : this.hitResult === 'blocked' ? 'block' : 'whiff';
        const rules = a.cancelRules[result] ?? [],
          windowStart =
            result === 'whiff'
              ? a.hitT + a.active + a.recovery * 0.55
              : a.hitT + (result === 'block' ? a.active : 0.045);
        if (!a.isUlt && this.stateTimer + 1e-9 >= windowStart) {
          const q = this.queue.find(
            (q) => rules.includes(q.type) && combatModule.legalCancel(this, a, q),
          );
          if (q) {
            if (
              q.type === 'pursuit' &&
              this.ki >= 12 &&
              this.pursuitCooldown <= 0 &&
              foe.pos.distanceTo(this.pos) <= 10
            ) {
              this.pull(q.type);
              this.attack = null;
              this.pursue(foe);
              return;
            }
            if (q.type === 'dash' && this.ki >= 8 && this.dashCooldown <= 0) {
              this.attack = null;
              this.ki -= 8;
              this.dashPrepaid = true;
              this.state = 'idle';
              return;
            }
            if (q.type === 'ult' && this.ki >= 100) {
              this.pull(q.type);
              this.startUlt();
              return;
            }
            if (q.type === 'special' && this.ki >= 30) {
              this.pull(q.type);
              this.startSpecial(q.context);
              return;
            }
            if (q.type === 'light' || q.type === 'heavy') {
              this.pull(q.type);
              this.startAttack(q.type, q.context);
              return;
            }
          }
        }
        if (this.stateTimer + 1e-9 >= a.dur) {
          this.attack = null;
          this.state = 'idle';
          this.stateTimer = 0;
          if (a.chainType && !a.terminal && !['launcher', 'sweep'].includes(a.id)) {
            this.comboTimer = 0.4;
          } else {
            this.comboTimer = 0;
            this.comboType = null;
            this.queue = this.queue.filter((q) => !['light', 'heavy'].includes(q.type));
          }
        }
      }
      pursue(foe) {
        if (!foe || this.ki < 12 || this.pursuitCooldown > 0 || foe.pos.distanceTo(this.pos) > 10)
          return false;
        this.ki -= 12;
        this.pursuitCooldown = 0.7;
        this.pursuitWindow = 0.7;
        this.attack = null;
        const delta = foe.pos.clone().sub(this.pos);
        delta.y = 0;
        this.facingAngle = Math.atan2(delta.x, delta.z);
        this.vel.copy(delta.normalize()).multiplyScalar(18 * combatModule.mobilitySpeed(this));
        this.dashTime = foe.pos.y > 0.2 || foe.launchFlight ? 0.42 : 0.28;
        this.dashKind = 'pursuit';
        this.dashCooldown = 0.3;
        this.invulnerable = 0.025;
        this.state = 'dash';
        this.stateTimer = 0;
        if (foe.pos.y > 0.2) {
          this.jumpVel = Math.max(3, Math.min(6, foe.jumpVel));
          this.pos.y = Math.max(0.04, this.pos.y);
          this.airRecovery = true;
        }
        combatModule.spawnAfterimage(this);
        audioModule.sfxSwing();
        combatModule.emitCombatEvent('pursuit', this, foe, null, {
          cost: 12,
        });
        if (!this.isAI) matchModule.notify('爆冲追击 · 12 元气', 0.4);
        return true;
      }
      evade(foe) {
        this.launchFlight = false;
        this.escapeCharges--;
        this.ki -= 15;
        this.escapeCooldown = 1.0;
        this.escapeRegen = 0;
        this.attack = null;
        this.throwPending = null;
        this.clearQueue();
        this.facingAngle = Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
        const yaw = this.isAI
            ? this.facingAngle
            : (this.lastInput?.moveYaw ??
              trainingModule.movementYaw(this === matchModule.enemy ? 1 : 0)),
          fx = Math.sin(yaw),
          fz = Math.cos(yaw),
          side = this.lastInput?.left ? -1 : 1;
        this.vel.set(-fz * 13 * side - fx * 5, 0, fx * 13 * side - fz * 5);
        this.dashTime = 0.16;
        this.dashKind = 'evade';
        this.invulnerable = 0.22;
        this.state = 'dash';
        this.stateTimer = 0;
        this.comboGrace = 0;
        this.receivedCombo = 0;
        this.juggle = 0;
        combatModule.spawnAfterimage(this);
        audioModule.combatFeedback('evade', this.pos, 0.18);
        combatModule.emitCombatEvent('evasion', this, foe, null, {
          cost: 15,
        });
        matchModule.notify('残像脱身', 0.6);
      }
      breaker(foe) {
        this.launchFlight = false;
        this.ki -= 35;
        this.breakerCooldown = 5.5;
        this.attack = null;
        this.throwPending = null;
        this.clearQueue();
        this.state = 'idle';
        this.stateTimer = 0;
        this.comboGrace = 0;
        this.invulnerable = 0.25;
        const dir = this.pos.clone().sub(foe.pos);
        dir.y = 0;
        if (dir.lengthSq() < 0.01) dir.copy(this.forward()).negate();
        dir.normalize();
        this.vel.copy(dir).multiplyScalar(7);
        if (!foe.attack?.superArmor) {
          foe.vel.copy(dir).multiplyScalar(-7);
          foe.attack = null;
          foe.clearQueue();
          foe.state = 'hit';
          foe.stateTimer = 0;
          foe.stunTime = 0.3;
        }
        renderModule.spawnShockRing(
          this.pos.clone().add(new THREE.Vector3(0, 1, 0)),
          0x8ddff1,
          1.5,
        );
        audioModule.combatFeedback('breaker', this.pos, 0.4);
        matchModule.notify('爆气解围', 0.7);
      }
      takeHit(attacker, a) {
        if (this.hp <= 0 || this.invulnerable > 0) return;
        const launchVelocity = this.launchFlight ? this.vel.clone() : null;
        const interruptedCharge = this.state === 'charge' || this.state === 'blastCharge';
        if (interruptedCharge) {
          this.chargeHeld = 0;
          this.blastHeldTime = 0;
          combatModule.stopChargeSound(this);
          if (!matchModule.game.manualTest && this === matchModule.player)
            matchModule.notify('聚气被打断', 0.5);
        }
        if (a.isThrow && !this.attack?.superArmor) {
          if (
            this.pos.y > 0.2 ||
            ['hit', 'knockdown', 'grabbed', 'guardbreak'].includes(this.state)
          )
            return;
          this.throwPending = {
            attacker,
            attack: a,
            timer: 0.18,
          };
          this.attack = null;
          this.state = 'grabbed';
          this.stateTimer = 0;
          this.vel.set(0, 0, 0);
          attacker.hitResult = 'throw';
          if (!this.isAI) matchModule.notify('O 拆投', 0.25);
          return;
        }
        const dir = this.pos.clone().sub(attacker.pos);
        dir.y = 0;
        if (dir.lengthSq() < 0.001) dir.copy(attacker.forward());
        dir.normalize();
        const levelOk =
          a.level === 'low' ? this.crouching : a.level === 'overhead' ? !this.crouching : true;
        const blocking =
          ['block', 'blockstun'].includes(this.state) &&
          levelOk &&
          !a.unblockable &&
          this.forward().dot(dir.clone().negate()) > 0.25;
        const perfect =
          blocking &&
          this.guardHeld <= 0.075 &&
          (this.parryCooldown ?? 0) <= 0 &&
          !a.isUlt &&
          !a.projectile;
        if (perfect) this.parryCooldown = 0.65;
        if (perfect) {
          attacker.hitResult = 'parried';
          if (!attacker.attack?.superArmor) {
            attacker.attack = null;
            attacker.clearQueue();
            attacker.state = 'hit';
            attacker.stateTimer = 0;
            attacker.stunTime = this.def.id === 'roshi' ? 0.36 : 0.27;
            attacker.vel.copy(dir).multiplyScalar(-2);
          }
          this.guard = Math.min(100, this.guard + 12);
          this.ki = Math.min(100, this.ki + 7);
          this.invulnerable = 0.045;
          combatModule.commitImpactFeedback('parry');
          combatModule.emitCombatEvent('parry', attacker, this, a, {
            feedback: 'parry',
            blocked: true,
            punish: true,
            recoveryRemaining: attacker.stunTime,
          });
          this.lastHitText = '完美格挡';
          matchModule.notify('完美格挡 · 可反击', 0.7);
          return;
        }
        const recovered = !['hit', 'knockdown', 'guardbreak', 'grabbed'].includes(this.state);
        this.armorTimer = this.stateTimer;
        const oldAttack = this.attack,
          superArmored = !!oldAttack?.superArmor && !blocking,
          counter =
            (!superArmored && !!oldAttack && this.stateTimer < oldAttack.hitT) ||
            this.state === 'charge',
          punish = !!oldAttack && this.stateTimer > oldAttack.hitT + (oldAttack.active ?? 0.07);
        let guardBreak = false;
        if (blocking) {
          this.guard = Math.max(0, this.guard - (a.guardDamage ?? a.dmg * 1.5));
          this.guardDelay = 1.15;
          if (this.guard <= 0) {
            guardBreak = true;
            this.guard = 16;
          }
        }
        const scaling = Math.max(0.3, 1 - this.receivedCombo * 0.12);
        let dmg =
          a.dmg *
          attacker.def.power *
          (blocking && !guardBreak ? 0.06 : scaling) *
          (counter ? 1.14 : 1) *
          (superArmored ? 0.6 : 1);
        dmg = Math.round(dmg * 10) / 10;
        const hpBefore = this.hp;
        this.hp = Math.max(matchModule.game.difficulty === 'training' ? 1 : 0, this.hp - dmg);
        if (
          matchModule.combatDiagnostics.enabled &&
          (!matchModule.game.manualTest || matchModule.game.collectTestStats) &&
          matchModule.game.roundMetrics
        )
          matchModule.game.roundMetrics.damage[attacker === matchModule.player ? 0 : 1] +=
            hpBefore - this.hp;
        this.ki = Math.min(100, this.ki + dmg * 1.15);
        attacker.ki = Math.min(100, attacker.ki + (a.ki ?? 0) * (blocking ? 0.28 : 0.75));
        this.lastScaling = scaling;
        this.lastDamage = dmg;
        this.lastAdvantage = Math.round(
          ((guardBreak ? 0.8 : blocking ? (a.blockstun ?? 0.12) : a.stun + (counter ? 0.07 : 0)) -
            (attacker.attack ? Math.max(0, attacker.attack.dur - attacker.stateTimer) : 0)) *
            60,
        );
        this.damageTotal += dmg;
        this.lastHitText = guardBreak
          ? '破防'
          : blocking
            ? '格挡'
            : counter
              ? '截击'
              : punish
                ? '后摇惩罚'
                : '命中';
        const armored =
          superArmored ||
          (!blocking &&
            !a.isThrow &&
            !a.isUlt &&
            a.level !== 'low' &&
            !a.launch &&
            oldAttack?.armor &&
            this.stateTimer < oldAttack.hitT &&
            !(this.armorSpent ?? false));
        if (armored && !superArmored) this.armorSpent = true;
        if (!superArmored) {
          this.state = guardBreak ? 'guardbreak' : blocking ? 'blockstun' : 'hit';
          this.stateTimer = 0;
          this.stunTime = guardBreak
            ? 0.8
            : blocking
              ? (a.blockstun ?? 0.12)
              : a.stun + (counter ? 0.07 : 0);
          this.vel.copy(dir).multiplyScalar(a.kb * (blocking && !guardBreak ? 0.25 : 1));
          this.flash = blocking ? 0.15 : a.chainType === 'light' ? 0.4 : 0.65;
          this.attack = null;
          this.comboType = null;
          this.comboTimer = 0;
          if (!blocking || guardBreak) {
            this.receivedCombo++;
            this.comboGrace = this.stunTime + 0.65;
            if (this.pos.y > 0.15) this.juggle++;
            if (a.launch && !this.launchFlight) {
              this.jumpVel = a.launch;
              this.pos.y = Math.max(0.04, this.pos.y);
              this.airRecovery = true;
            }
            if (a.knockdown && !this.launchFlight) {
              this.airRecovery = true;
              this.jumpVel = 3.2;
              this.pos.y = 0.03;
            }
            if (
              !this.launchFlight &&
              !armored &&
              (this.receivedCombo >= combatModule.COMBO_PROTECTION_HITS ||
                (this.juggle >= 3 && (!a.chainType || a.terminal)))
            ) {
              combatModule.launchKnockback(this, attacker);
            }
          }
          if (launchVelocity) this.vel.copy(launchVelocity);
          if (armored && !this.launchFlight) {
            this.attack = oldAttack;
            this.state = 'attack';
            this.stateTimer = this.armorTimer;
            this.vel.set(0, 0, 0);
            this.lastHitText = '霸体承伤';
          }
        }
        if (superArmored) this.lastHitText = '霸体承伤 · 60%';
        if (!a.projectile) attacker.hitResult = blocking && !guardBreak ? 'blocked' : 'hit';
        this.hitSide = THREE.MathUtils.clamp(
          dir.x * Math.cos(this.facingAngle) - dir.z * Math.sin(this.facingAngle),
          -1,
          1,
        );
        this.hitWeight = a.chainType === 'heavy' || a.isUlt ? 1.35 : 1;
        const mid = this.pos.clone().add(new THREE.Vector3(0, this.baseScale * 1.23, 0));
        const feedback = combatModule.impactKind(a, blocking && !guardBreak, guardBreak);
        combatModule.commitImpactFeedback(feedback);
        combatModule.emitCombatEvent('contact', attacker, this, a, {
          feedback,
          blocked: blocking && !guardBreak,
          counter: !!counter,
          punish: !!punish,
          armored,
          recovered,
          damage: hpBefore - this.hp,
          recoveryRemaining: Math.max(0, (attacker.attack?.dur ?? 0) - attacker.stateTimer),
          advantage: this.lastAdvantage,
        });
        if ((!blocking || guardBreak) && a.dmg >= 10 && !a.isUlt)
          worldModule.damageStage(attacker, a, this.pos);
        if (!blocking) uiModule.popDamage(mid, dmg, a.isUlt ? '#ffe3a0' : '#f9dfa5');
        if (guardBreak) matchModule.notify('护盾破防', 0.65);
        else if (counter || punish) matchModule.notify(this.lastHitText, 0.42);
        if (attacker === matchModule.player && !blocking) {
          matchModule.game.comboCount = this.receivedCombo;
          matchModule.game.comboTimer = this.stunTime + 0.65;
          matchModule.game.comboDamage = this.damageTotal;
          if (matchModule.game.comboCount >= 2) uiModule.showCombo(matchModule.game.comboCount);
        }
      }
      render(dt = 1 / 60, alpha = 1) {
        const p = this.parts;
        this.root.position.lerpVectors(this.previousPos, this.pos, alpha);
        const delta = renderModule.angleDelta(this.facingAngle, this.visualAngle);
        this.visualAngle += delta * (1 - Math.exp(-30 * dt));
        this.root.rotation.set(0, this.visualAngle, 0);
        this.root.scale.setScalar(this.baseScale);
        let pose = this.attack
          ? combatModule.combatPose(this)
          : combatModule.neutralCombatPose(this);
        if (this.launchFlight) {
          const lean = THREE.MathUtils.clamp(this.launchElapsed / 0.16, 0, 1);
          this.root.rotation.set(-lean * 1.15, this.facingAngle, 0, 'YXZ');
          this.root.position.y += 0.35 * lean;
          pose.t = [-0.22, 0, 0];
          pose.aL = [-0.45, 0, -0.8];
          pose.aR = [-0.45, 0, 0.8];
          pose.lL = [0.45, 0, 0.12];
          pose.lR = [0.6, 0, -0.12];
          pose.kL = 0.35;
          pose.kR = 0.5;
        } else if (['dead', 'knockdown'].includes(this.state)) {
          const k = THREE.MathUtils.clamp(this.stateTimer / 0.28, 0, 1);
          this.root.rotation.z = -k * 1.3;
          this.root.position.y = Math.max(0, this.pos.y) - 0.28 * k;
        } else if (this.attack) this.root.position.y += pose.ry ?? 0;
        if (!['dead', 'knockdown', 'charge', 'blastCharge'].includes(this.state) && !this.attack) {
          const view = Math.atan2(
            renderModule.camera.position.x - this.pos.x,
            renderModule.camera.position.z - this.pos.z,
          );
          pose.h = [...pose.h];
          pose.h[1] += THREE.MathUtils.clamp(
            renderModule.angleDelta(view, this.facingAngle),
            -0.38,
            0.38,
          );
        }
        const precise = ['goku', 'taopaipai', 'piccolo'].includes(this.def.id);
        if (precise && this.attack) this.root.rotation.y = this.facingAngle;
        charactersModule.applyPose(
          p,
          pose,
          this.attack && dt > 0 ? Math.max(dt, 0.045) : dt,
          precise && dt > 0,
        );
        if (p.staff) {
          if (this.attack?.id === 'special') {
            this.root.updateMatrixWorld(true);
            const local = this.forward().applyQuaternion(
              p.handR.getWorldQuaternion(new THREE.Quaternion()).invert(),
            );
            p.staff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), local);
            p.staff.position.copy(local).multiplyScalar(1.05);
          } else {
            p.staff.rotation.set(0, 0, Math.PI / 2);
            p.staff.position.set(0, 0, 0.07);
          }
        }
        if (p.tail) p.tail.rotation.y = Math.sin(this.walkPhase * 0.7) * 0.22;
        if (p.core) {
          p.core.visible = this.ki >= 100 || this.state === 'charge';
          p.core.scale.setScalar(1 + Math.sin(renderModule.clock.elapsedTime * 7) * 0.15);
        }
        for (const { m, em, intensity } of this.materials) {
          m.emissive
            .copy(em)
            .lerp(
              new THREE.Color(this.state === 'charge' ? 0x447da0 : 0xffe7c0),
              this.state === 'charge' ? 0.09 : this.flash * 0.23,
            );
          m.emissiveIntensity = intensity + this.flash * 0.55;
        }
        if (this.nimbus) {
          this.nimbus.visible = this.flightMode && this.pos.y > 0.03;
          this.nimbus.position.set(
            this.root.position.x,
            this.root.position.y - 0.025,
            this.root.position.z,
          );
          this.nimbus.rotation.y = this.visualAngle + Math.PI / 2;
          this.nimbus.scale.setScalar(
            this.baseScale * (1 + Math.sin(renderModule.clock.elapsedTime * 4) * 0.015),
          );
        }
        this.shadow.position.set(this.pos.x, 0.018, this.pos.z);
        this.shadow.material.opacity = 0.42 / (1 + this.pos.y * 0.9);
        this.shadow.scale.setScalar(1 + this.pos.y * 0.12);
        combatModule.updateKiVisual(this, dt);
      }
    };
  };
}
