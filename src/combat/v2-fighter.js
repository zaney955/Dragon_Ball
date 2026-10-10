import * as THREE from 'three';
export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
}) {
  let v1SampleRig,
    v1NeutralPose,
    v1CombatPose,
    v1ResolveOverlap,
    v1StartAttack,
    v1StartThrow,
    v1Special,
    v1Ult;
  combatModule.stature = function stature(f) {
    return f.anatomy ? f.anatomy.hip + f.anatomy.neck : 2.1 * f.baseScale;
  };
  combatModule.v2DirectionalMove = function v2DirectionalMove(f, a, input = {}) {
    if (input.up)
      a = combatModule.finalizeMove({
        ...a,
        id: 'launcher',
        name:
          f.def.type === 'technology'
            ? '自卫反空踢'
            : f.def.type === 'giant'
              ? '斧柄挑空'
              : f.def.type === 'mech'
                ? '机械挑拳'
                : '反空上击',
        motion: f.def.type === 'giant' ? 'axeJab' : 'psychicPoke',
        anim: animationModule.ANIM[f.def.type === 'giant' ? 'axeJab' : 'psychicPoke'],
        startup: 0.22,
        active: 0.1,
        recovery: 0.4,
        dmg: 9,
        range: f.def.type === 'giant' ? 2.2 : 1.6,
        launch: 5.2,
        kb: 0.7,
        stun: 0.58,
        level: 'mid',
        terminal: true,
        cancelRules: {
          hit: ['pursuit', 'special', 'ult', 'dash'],
          block: [],
          whiff: [],
        },
      });
    if (input.down)
      a = combatModule.finalizeMove({
        ...a,
        id: 'sweep',
        name: f.def.type === 'giant' ? '低斧横扫' : f.def.type === 'mech' ? '机甲低撞' : '下段派生',
        motion:
          f.def.type === 'giant' ? 'axeSweep' : f.def.type === 'mech' ? 'mechRam' : 'girlKick',
        anim: animationModule.ANIM[
          f.def.type === 'giant' ? 'axeSweep' : f.def.type === 'mech' ? 'mechRam' : 'girlKick'
        ],
        startup: 0.25,
        active: 0.11,
        recovery: 0.43,
        dmg: 10,
        range: f.def.type === 'giant' ? 2.8 : 1.6,
        kb: 2,
        stun: 0.5,
        level: 'low',
        knockdown: true,
        terminal: true,
        cancelRules: {
          hit: ['special', 'ult', 'dash'],
          block: [],
          whiff: [],
        },
      });
    return a;
  };
  combatModule.v2ThrowMove = function v2ThrowMove(f) {
    return combatModule.finalizeMove({
      id: 'throw',
      name: {
        gyumao: '重斧柄抛投',
        chichi: '头盔绊投',
        bulma: '自卫绊倒',
        chiaotzu: '念力推投',
        oolong: '猪扑绊投',
        korin: '猫步杖绊',
        pilaf: '机械钳投',
      }[f.def.id],
      motion:
        f.def.id === 'gyumao'
          ? 'axeJab'
          : f.def.id === 'pilaf'
            ? 'mechRam'
            : f.def.id === 'korin'
              ? 'caneTap'
              : 'selfDefense',
      anim: animationModule.ANIM[
        {
          gyumao: 'axeJab',
          chichi: 'girlPalm',
          bulma: 'selfDefense',
          chiaotzu: 'psychicPush',
          oolong: 'pigBelly',
          korin: 'caneTap',
          pilaf: 'mechRam',
        }[f.def.id]
      ],
      isThrow: true,
      unblockable: true,
      dmg: f.def.id === 'gyumao' ? 16 : f.def.id === 'bulma' ? 7 : 10,
      startup: f.def.id === 'gyumao' ? 0.24 : 0.16,
      active: 0.055,
      recovery: 0.5,
      stun: 0.65,
      kb: 5,
      range: f.def.id === 'gyumao' || f.def.id === 'pilaf' ? 1.8 : 1.2,
      ki: 6,
    });
  };
  return function initialize() {
    v1SampleRig = combatModule.sampleCombatRig;
    combatModule.sampleCombatRig = function (f) {
      if (!f.anatomy) return v1SampleRig(f);
      const d = f.anatomy,
        r = combatModule.ensureCombatRig(f),
        p = r.parts,
        pose = combatModule.combatPose(f);
      p.restTorsoY = d.hip;
      r.root.position.copy(f.pos);
      r.root.position.y += f.attack ? (pose.ry ?? 0) : 0;
      r.root.rotation.set(0, f.facingAngle, 0);
      combatModule.applyBackflipTransform(f, r.root);
      if (f.launchFlight) {
        const lean = THREE.MathUtils.clamp(f.launchElapsed / 0.16, 0, 1);
        r.root.rotation.set(-lean * 1.15, f.facingAngle, 0, 'YXZ');
        r.root.position.y += 0.35 * lean;
      }
      r.root.scale.setScalar(1);
      charactersModule.applyPose(p, pose, 0, true);
      r.root.updateMatrixWorld(true);
      const world = (node, out) => node.getWorldPosition(out);
      world(p.head, r.hurt[0].a);
      r.hurt[0].b.copy(r.hurt[0].a);
      r.hurt[0].r = d.headR;
      p.torsoGroup.localToWorld(r.hurt[1].a.set(0, -0.04, 0));
      p.torsoGroup.localToWorld(r.hurt[1].b.set(0, d.armY + 0.15, 0));
      r.hurt[1].r = d.torsoR;
      for (let i = 0; i < 2; i++) {
        const s = i ? 'R' : 'L';
        world(p['leg' + s], r.hurt[i + 2].a);
        world(p['foot' + s], r.hurt[i + 2].b);
        r.hurt[i + 2].r = d.legR;
        world(p['arm' + s], r.hurt[i + 4].a);
        world(p['hand' + s], r.hurt[i + 4].b);
        r.hurt[i + 4].r = d.armR;
      }
      for (const h of r.hurt) h.enabled = true;
      if (d.kind === 'quadruped') {
        p.torsoGroup.localToWorld(r.hurt[1].a.set(0, 0.12, -0.65));
        p.torsoGroup.localToWorld(r.hurt[1].b.set(0, 0.12, 0.4));
        r.hurt[1].r = 0.4;
      }
      if (['dead', 'knockdown'].includes(f.state)) {
        for (const h of r.hurt) h.enabled = false;
        combatModule.setCapsule(
          r.hurt[1],
          f.pos.clone().add(new THREE.Vector3(0, 0.25, 0)),
          f.pos.clone().addScaledVector(f.forward(), 0.9),
          d.torsoR,
        );
      }
      combatModule.setCapsule(
        r.push,
        f.pos,
        f.pos.clone().add(new THREE.Vector3(0, d.hip + d.neck + d.headR, 0)),
        d.torsoR * 0.82,
      );
      for (const h of r.hit) h.enabled = false;
      const a = f.attack;
      if (!a || a.isKiBlast || a.shape === 'ability') return r;
      const c = r.hit[0];
      c.enabled = true;
      if (a.shape === 'beam') {
        c.a.copy(f.pos);
        c.a.y += d.hip + d.armY;
        c.b.copy(c.a).addScaledVector(f.forward(), a.range);
        c.r = a.width ?? 0.18;
      } else if (a.shape === 'ground') {
        c.a.copy(f.pos);
        c.a.y += 0.16;
        c.b.copy(c.a);
        c.r = a.range;
      } else if (a.isThrow) {
        c.a.copy(f.pos);
        c.a.y += Math.min(d.hip, 1.1);
        c.b.copy(c.a).addScaledVector(f.forward(), a.range * 0.7);
        c.r = 0.26;
      } else if (a.motion.startsWith('axe')) {
        // The haft and cutting edge are the actual mesh transform; no enlarged global box.
        const weapon = f.parts.axe;
        weapon.rotation.z = Math.PI;
        const weaponLocal = (q) =>
          q.applyMatrix4(weapon.matrix.compose(weapon.position, weapon.quaternion, weapon.scale));
        const handle = a.motion === 'axeJab';
        p.handR.localToWorld(
          c.a.copy(weaponLocal(new THREE.Vector3(handle ? 0 : -0.56, handle ? 0.05 : 1.1, 0))),
        );
        p.handR.localToWorld(
          c.b.copy(weaponLocal(new THREE.Vector3(handle ? 0 : 0.56, handle ? -0.9 : 1.1, 0))),
        );
        c.r = handle ? 0.16 : 0.13;
      } else if (a.motion === 'caneTap') {
        p.handR.localToWorld(c.a.set(0, -0.7, 0.08));
        p.handR.localToWorld(c.b.set(0, 0.5, 0.08));
        c.r = 0.075;
      } else if (a.shape === 'ram' || a.motion === 'pigBelly' || a.motion === 'mechRam') {
        c.a.copy(r.hurt[1].a);
        c.b.copy(r.hurt[1].b).addScaledVector(f.forward(), 0.15);
        c.r = d.torsoR * 0.85;
      } else if (a.motion === 'girlKick' || a.level === 'overhead' || a.id === 'sweep') {
        world(p.kneeR, c.a);
        world(p.footR, c.b);
        c.r = d.legR + 0.045;
      } else {
        world(p.elbowR, c.a);
        world(p.handR, c.b);
        c.r = d.handR + 0.035;
        if (a.motion === 'psychicPush') {
          world(p.elbowL, r.hit[1].a);
          world(p.handL, r.hit[1].b);
          r.hit[1].r = c.r;
          r.hit[1].enabled = true;
        }
      }
      return r;
    };
    v1NeutralPose = combatModule.neutralCombatPose;
    v1CombatPose = combatModule.combatPose;
    combatModule.neutralCombatPose = function (f, recovering = false) {
      if (!f.anatomy) return v1NeutralPose(f, recovering);
      const d = f.anatomy,
        w = Math.sin(f.walkPhase),
        q = animationModule.pz({
          aR: [-0.28, 0, 0.15],
          aL: [-0.32, 0, -0.15],
          t: [0.035, 0, 0],
          lL: [0.03, 0, 0.04],
          lR: [-0.04, 0, -0.04],
        });
      q.eR = q.eL = -0.85;
      q.kL = q.kR = 0.13;
      if (f.state === 'walk') {
        const front = THREE.MathUtils.clamp(
            f.vel.dot(f.forward()) / (6.8 * combatModule.mobilitySpeed(f)),
            -1,
            1,
          ),
          amp =
            d.kind === 'giant' ? 0.32 : d.kind === 'mech' ? 0.28 : d.kind === 'cat' ? 0.75 : 0.56;
        q.lL[0] = w * amp * front;
        q.lR[0] = -w * amp * front;
        q.kL = 0.12 + Math.max(0, -w) * amp;
        q.kR = 0.12 + Math.max(0, w) * amp;
        q.aR[0] -= w * 0.15;
        q.aL[0] += w * 0.15;
        q.y = Math.abs(w) * (d.kind === 'mech' ? 0.025 : 0.02);
        q.t[0] += 0.08 * front;
      }
      if (d.kind === 'giant') {
        q.aR = [-0.68, 0, -0.1];
        q.aL = [-0.95, 0, 0.25];
        q.eR = -0.6;
        q.eL = -1.2;
        q.t[0] = 0.09;
      }
      if (d.kind === 'technology') {
        q.aR = [-0.45, 0, 0.18];
        q.eR = -1.4;
        q.aL = [-0.22, 0, -0.2];
      }
      if (d.kind === 'psychic') {
        q.aR = [-0.32, 0, 0.35];
        q.aL = [-0.32, 0, -0.35];
        q.y += Math.sin(matchModule.game.simTime * 3) * 0.015;
      }
      if (d.kind === 'cat') {
        q.t[0] = 0.16;
        q.h[0] = -0.08;
        q.eL = -0.7;
        q.eR = -0.55;
      }
      if (d.kind === 'quadruped') {
        q.aR = [0, 0, 0];
        q.aL = [0, 0, 0];
        q.eR = q.eL = 0.15;
        q.t = [0, 0, 0];
        if (f.state === 'walk') {
          q.aR[0] = w * 0.5;
          q.aL[0] = -w * 0.5;
          q.lL[0] = w * 0.5;
          q.lR[0] = -w * 0.5;
        }
      }
      if (d.kind === 'winged') {
        q.aR = [0, 0, 1.2];
        q.aL = [0, 0, -1.2];
        q.eR = q.eL = 0;
        q.lL[0] = q.lR[0] = 0.35;
      }
      if (['block', 'blockstun'].includes(f.state)) {
        q.aR = [-0.72, 0, -0.2];
        q.aL = [-0.72, 0, 0.2];
        q.eR = q.eL = -1.55;
        q.t[0] = 0.22;
        q.y = f.crouching ? -0.14 : 0;
      }
      if (f.crouching && !['block', 'blockstun'].includes(f.state)) {
        q.y = -d.hip * 0.18;
        q.kL = q.kR = 0.75;
        q.t[0] = 0.24;
      }
      if (['hit', 'guardbreak', 'grabbed'].includes(f.state)) {
        q.t[0] = -0.26 * Math.sin(Math.min(1, f.stateTimer / 0.22) * Math.PI * 0.7);
        q.t[2] = (f.hitSide ?? 0) * 0.12;
        q.aR = [-0.3, 0, 0.55];
        q.aL = [-0.3, 0, -0.55];
        q.eR = q.eL = -0.35;
      }
      if (['dead', 'knockdown'].includes(f.state)) {
        q.t = [0.3, 0, 0];
        q.aR = [-0.2, 0, 0.6];
        q.aL = [-0.2, 0, -0.6];
        q.eL = q.eR = -0.15;
        q.lL[0] = 0.2;
        q.lR[0] = -0.15;
      }
      if (f.state === 'dash') {
        const side =
          f.dashKind === 'evade'
            ? f.vel.dot(new THREE.Vector3(-Math.cos(f.facingAngle), 0, Math.sin(f.facingAngle)))
            : 0;
        q.t = [d.kind === 'mech' ? 0.2 : 0.4, 0, Math.sign(side) * -0.18];
        q.y = -0.07;
        q.lL[0] = -0.5;
        q.lR[0] = 0.45;
        q.kL = 0.55;
      }
      if (f.state === 'landing') {
        const k = 1 - Math.min(1, f.stateTimer / 0.12);
        q.y = -0.09 * k;
        q.kL = q.kR = 0.15 + 0.5 * k;
      }
      if (f.pos.y > 0.1) {
        q.lL[0] = -0.18;
        q.lR[0] = -0.12;
        q.kL = 0.7;
        q.kR = 0.55;
      }
      if (f.state === 'charge' || f.state === 'blastCharge') {
        q.aR = [-0.45, 0, 0.3];
        q.aL = [-0.45, 0, -0.3];
        q.eR = q.eL = -1.1;
        q.t[0] = 0.14;
        q.y = -0.06;
      }
      if (matchModule.game.over && f.hp > 0) {
        const winner =
          matchModule.game.lastWinner === (f === matchModule.player ? 'player' : 'enemy');
        q.aR = winner ? [-2.3, 0, 0.4] : [-0.1, 0, 0.05];
        q.aL = winner ? [-0.5, 0, -0.4] : [-0.1, 0, -0.05];
        q.h[0] = winner ? -0.1 : 0.28;
        q.t[0] = winner ? -0.04 : 0.16;
      }
      return q;
    };
    combatModule.combatPose = function (f) {
      if (!f.anatomy) return v1CombatPose(f);
      if (!f.attack) return combatModule.neutralCombatPose(f);
      const a = f.attack;
      const contact = renderModule.CONTACT_PHASE[a.motion] ?? 0.48,
        phase =
          f.stateTimer < a.hitT
            ? (f.stateTimer / a.hitT) * contact
            : f.stateTimer < a.hitT + a.active
              ? contact + ((f.stateTimer - a.hitT) / a.active) * 0.1
              : contact +
                0.1 +
                (1 - contact - 0.1) * Math.min(1, (f.stateTimer - a.hitT - a.active) / a.recovery);
      let q = animationModule.cloneCombatPose(
        animationModule.samplePose(a.anim ?? animationModule.ANIM.selfDefense, phase),
      );
      q.eR = -0.8;
      q.eL = -1.05;
      q.kR = 0.16;
      q.kL = 0.15;
      const reach = Math.exp(-(((f.stateTimer - a.hitT) / Math.max(0.1, a.active)) ** 2));
      if (
        /Palm|Slap|Claw|Poke|Punch|Defense|Push|axeJab/.test(a.motion) &&
        !a.shape?.includes('ability')
      ) {
        const height = a.targetY ?? f.anatomy.hip,
          shoulder = f.anatomy.hip + f.anatomy.armY,
          forward = 0.6;
        q.aR = [-Math.atan2(forward, shoulder - height), 0, -0.55];
        q.eR = -0.05;
        q.t[1] *= 0.35;
        if (a.motion === 'psychicPush') {
          q.aL = [q.aR[0], 0, 0.55];
          q.eL = -0.05;
        }
      }
      if (a.motion === 'girlKick') {
        q.lR = [-1.55, 0, -0.05];
        q.kR = 0.03;
        q.t[0] = -0.1;
      }
      if (a.motion === 'axeSweep') {
        q.aR[0] = -1.0;
        q.eR = -0.05;
        q.aL = [-1.3, 0, 0.4];
        q.eL = -0.1;
        q.t[0] = 0.25;
      }
      if (a.motion === 'axeChop') {
        q.aR[0] = f.stateTimer < a.hitT ? -2.8 + Math.min(1, f.stateTimer / a.hitT) * 2.1 : -0.7;
        q.eR = -0.05;
        q.t[0] = 0.4;
        q.aR[2] = -0.5;
        q.aL = [q.aR[0], 0, 0.5];
        q.eL = -0.05;
      }
      if (a.id === 'launcher') {
        q.aR = [-1.5, 0, -0.5];
        q.eR = -0.1;
        q.t[0] = -0.1;
        q.ry = (q.ry ?? 0) * reach;
      }
      if (a.id === 'sweep') {
        q.y = -0.14;
        q.lR = [-1.35, 0, -0.2];
        q.kR = 0.05;
        q.t[0] = 0.4;
      }
      if (f.v2.form === 'bull') {
        q.aR = [0, 0, 0];
        q.aL = [0, 0, 0];
        q.eR = q.eL = 0.1;
        q.t = [0.06, 0, 0];
        q.h[0] = 0.15;
      }
      if (f.v2.form === 'bat') {
        q.aR = [-1.6, 0, -0.55];
        q.aL = [-1.6, 0, 0.55];
        q.eR = q.eL = -0.05;
        q.t[0] = 0.1;
      }
      if (f.stateTimer > a.dur - 0.08)
        q = animationModule.mixCombatPose(
          q,
          combatModule.neutralCombatPose(f, true),
          animationModule.smoothstep(Math.min(1, (f.stateTimer - a.dur + 0.08) / 0.08)),
        );
      const blend = Math.min(0.04, a.startup * 0.45);
      if (f.poseEntry && f.stateTimer < blend)
        q = animationModule.mixCombatPose(
          f.poseEntry,
          q,
          animationModule.smoothstep(f.stateTimer / blend),
        );
      return q;
    };
    v1ResolveOverlap = combatModule.resolveOverlap;
    combatModule.resolveOverlap = function () {
      if (!matchModule.player?.anatomy && !matchModule.enemy?.anatomy) return v1ResolveOverlap();
      if (
        !matchModule.player ||
        !matchModule.enemy ||
        matchModule.player.hp <= 0 ||
        matchModule.enemy.hp <= 0
      )
        return;
      const p = matchModule.player,
        e = matchModule.enemy,
        ph = combatModule.stature(p) + 0.28,
        eh = combatModule.stature(e) + 0.28;
      if (p.pos.y > e.pos.y + eh || e.pos.y > p.pos.y + ph) return;
      const min =
          (p.anatomy ? p.anatomy.torsoR * 0.82 : 0.3 * p.baseScale) +
          (e.anatomy ? e.anatomy.torsoR * 0.82 : 0.3 * e.baseScale),
        delta = p.pos.clone().sub(e.pos);
      delta.y = 0;
      const len = delta.length();
      if (len < min) {
        if (len < 0.001) delta.copy(p.forward());
        else delta.divideScalar(len);
        p.pos.addScaledVector(delta, (min - len) / 2);
        e.pos.addScaledVector(delta, -(min - len) / 2);
        p.clampPos();
        e.clampPos();
      }
    };
    v1StartAttack = combatModule.Fighter.prototype.startAttack;
    combatModule.Fighter.prototype.startAttack = function (type, input = {}) {
      if (!this.anatomy) {
        v1StartAttack.call(this, type, input);
        return;
      }
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this)),
        list = this.def.combos[type],
        idx =
          this.comboType === type && this.comboTimer > 0
            ? Math.min(this.comboIdx + 1, list.length - 1)
            : 0;
      let a = {
        ...list[idx],
      };

      if (type === 'heavy') a = combatModule.v2DirectionalMove(this, a, input);
      if (this.pos.y > 0.15) {
        a.level = 'overhead';
        if (this.def.id !== 'gyumao' && this.v2.form !== 'bull' && this.v2.form !== 'bat') {
          a.motion = 'girlKick';
          a.anim = animationModule.ANIM.girlKick;
        }
      }
      if (this.v2.intuition > 0) {
        a.recovery *= 0.88;
        a.dur = a.startup + a.active + a.recovery;
      }
      const foe = this === matchModule.player ? matchModule.enemy : matchModule.player;
      a.targetY = Math.min(
        this.anatomy.hip + this.anatomy.armY + (this.def.id === 'korin' ? 0.55 : 0.25),
        combatModule.stature(foe) * 0.7,
      );
      this.attack = a;
      this.attackMask = 0;
      this.armorSpent = false;
      this.comboType = type;
      this.comboIdx = idx;
      this.comboTimer = a.dur + 0.25;
      this.state = 'attack';
      this.stateTimer = 0;
      this.hasHit = false;
      this.hitResult = null;
      this.vel.copy(this.forward()).multiplyScalar(a.drive ?? 2.5);
      combatModule.beginMoveEvent(this, entry);
    };
    v1StartThrow = combatModule.Fighter.prototype.startThrow;
    combatModule.Fighter.prototype.startThrow = function () {
      if (!this.anatomy) return v1StartThrow.call(this);
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this));
      this.attack = combatModule.v2ThrowMove(this);
      this.state = 'attack';
      this.stateTimer = 0;
      this.hasHit = false;
      this.attackMask = 0;
      this.hitResult = null;
      this.comboTimer = 0;
      this.vel.copy(this.forward()).multiplyScalar(2);
      combatModule.beginMoveEvent(this, entry);
    };
    v1Special = combatModule.Fighter.prototype.startSpecial;
    combatModule.Fighter.prototype.startSpecial = function (context = {}) {
      if (!this.anatomy) return v1Special.call(this);
      if (
        this.ki < 30 ||
        this.v2.cooldown > 0 ||
        (this.v2.formCooldown > 0 && this.def.id === 'oolong') ||
        (this.v2.bladeOut && this.def.id === 'chichi')
      )
        return false;
      if (
        this.def.id === 'bulma' &&
        combatModule.v2Devices.filter((x) => x.owner === this).length >= 2
      )
        return false;
      const heal = this.def.id === 'korin' && (context.down || this.lastInput?.crouch);
      if (heal && (this.v2.heals <= 0 || this.hp >= this.maxHp)) return false;
      const data = heal
        ? {
            name: '仙豆储备',
            motion: 'beanEat',
            startup: 0.95,
            active: 0.025,
            recovery: 0.4,
            dmg: 0,
            range: 0,
            ability: 'heal',
            shape: 'ability',
            cooldown: 2,
          }
        : combatModule.SPECIAL_MOVES[this.def.id];
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this));
      this.ki -= 30;
      this.v2.cooldown = data.cooldown ?? 0;
      this.attack = combatModule.finalizeMove({
        id: 'special',
        kiCost: 30,
        ki: 0,
        level: 'mid',
        guardDamage: 18,
        kb: 0,
        stun: 0.2,
        ...data,
        anim: animationModule.ANIM[data.motion],
        targetY:
          combatModule.stature(
            this === matchModule.player ? matchModule.enemy : matchModule.player,
          ) * 0.7,
        cancelRules: {
          hit: data.control ? ['blast', 'ult'] : ['ult'],
          block: [],
          whiff: [],
        },
        choice: 'pig',
        deviceKind: context.down ? 'mine' : 'turret',
      });
      this.attackMask = 0;
      this.state = 'attack';
      this.stateTimer = 0;
      this.hasHit = false;
      this.hitResult = null;
      this.armorSpent = false;
      this.comboTimer = 0;
      this.vel.copy(this.forward()).multiplyScalar(data.drive ?? 0);
      combatModule.beginMoveEvent(this, entry);
      matchModule.notify(data.name + ' · 30 ' + this.def.resource, 0.65);
      return true;
    };
    v1Ult = combatModule.Fighter.prototype.startUlt;
    combatModule.Fighter.prototype.startUlt = function () {
      if (!this.anatomy) {
        return v1Ult.call(this);
      }
      if (this.ki < 100) return false;
      const entry = animationModule.cloneCombatPose(combatModule.combatPose(this)),
        u = this.def.ult;
      this.attack = combatModule.finalizeMove({
        id: 'ult',
        name: this.def.ultName,
        isUlt: true,
        kiCost: 100,
        ki: 0,
        costCommitted: false,
        guardDamage: 36,
        level: 'mid',
        kb: 3,
        stun: 0.4,
        ...u,
        anim: animationModule.ANIM[u.motion],
        targetY:
          combatModule.stature(
            this === matchModule.player ? matchModule.enemy : matchModule.player,
          ) * 0.7,
        cancelRules: {
          hit: [],
          block: [],
          whiff: [],
        },
      });
      this.state = 'ult';
      this.stateTimer = 0;
      this.hasHit = false;
      this.hitResult = null;
      this.attackMask = 0;
      this.comboTimer = 0;
      this.comboType = null;
      this.clearQueue();
      this.stageFired = false;
      this.vel.copy(this.forward()).multiplyScalar(u.drive ?? 0);
      combatModule.beginMoveEvent(this, entry);
      combatModule.v2Sound(this, 'ult');
      matchModule.notify(this.def.ultName, 1);
      return true;
    };
  };
}
