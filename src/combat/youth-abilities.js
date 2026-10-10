import * as THREE from 'three';
import { reverseDirectionalInput, staffReach, superArmorActive } from './attack-rules.js';
export function register({ ai, combat, characters, animation, match, render, world, ui, audio }) {
  const foeOf = (f) => (f === match.player ? match.enemy : match.player);
  const blockedStates = [
    'dead',
    'hit',
    'knockdown',
    'grabbed',
    'guardbreak',
    'blockstun',
    'block',
    'landing',
  ];
  function apeMove(variant, ultimate = false) {
    const a = combat.finalizeMove({
      id: ultimate ? 'ult' : 'special',
      name: ultimate ? '巨猿震地' : variant ? '巨猿踩踏' : '巨猿重压',
      motion: 'doublePalm',
      dmg: ultimate ? 180 : variant ? 38 : 32,
      range: ultimate ? 4 : 3,
      shape: 'ground',
      startup: ultimate ? 1.1 : 0.7,
      active: 0.2,
      recovery: 0.8,
      kiCost: ultimate ? 100 : 40,
      cooldown: 5,
      isUlt: ultimate,
      superArmor: true,
      groundImpact: true,
      authored: true,
      effector: 'both',
      stun: 0.65,
      kb: 5,
      variant,
    });
    a.anim = animation.authorYouthMove(
      characters.CHARACTERS.find((c) => c.id === 'goku'),
      a,
    );
    return a;
  }
  function regenerate(f, kiBefore, attacker = null, attack = null) {
    if (f.hp > 0 || f.def.id !== 'piccolo' || f.youth.regenerated || kiBefore < 50) return false;
    f.ki = kiBefore - 50;
    f.hp = f.maxHp * 0.1;
    f.youth.regenerated = true;
    f.attack = null;
    f.clearQueue();
    f.state = 'landing';
    f.stateTimer = 0;
    f.stunTime = 0.6;
    f.launchFlight = false;
    f.jumpVel = 0;
    f.vel.set(0, 0, 0);
    f.v2.controlTime = 0;
    for (const owner of [match.player, match.enemy]) {
      if (owner?.v2.controlTarget === f) owner.v2.controlTarget = null;
    }
    f.invulnerable = 0.6;
    f.lastHitText = '肢体再生 · 必杀封印';
    combat.emitCombatEvent('regeneration', f, attacker, attack);
    render.spawnBoundAura(f, 0x84ff98, 0.6, null, true);
    return true;
  }
  function spawnFire(f, a) {
    const pos = f.pos.clone().addScaledVector(f.forward(), Math.min(1.2, a.range)).setY(0);
    const mesh = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.65, 7),
        render.energyMat(i % 2 ? 0xffb52e : 0xff5729, 0.65),
      );
      flame.position.set(Math.cos(i) * 0.8, 0.3, Math.sin(i) * 0.8);
      mesh.add(flame);
    }
    const existing = combat.youthEntities.find(
      (e) => e.kind === 'fire' && e.owner === f && e.pos.distanceTo(pos) < 1,
    );
    if (existing) {
      existing.life = 5;
      world.disposeGroup(mesh);
      return;
    }
    entity(f, 'fire', 5, 0, mesh, pos);
  }
  function releaseCapsule(f, a) {
    const pool = ['mech', 'tranquilizer', 'bomb', 'hoverboard', 'rpg'];
    const kind = pool[Math.floor(ai.combatRandom() * pool.length)];
    const v = f.youth;
    if (v.form === 'capsuleMech') combat.setYouthBody(f, null);
    v.capsule = kind;
    v.capsuleTime = ['mech', 'hoverboard'].includes(kind) ? 8 : 0;
    if (kind === 'mech') {
      combat.setYouthBody(f, 'capsuleMech');
      v.formTime = 8;
    } else if (kind === 'hoverboard') {
      const board = new THREE.Group();
      characters.box(board, characters.M(0x5ac9d6), 0, 0.12, 0, 1, 0.12, 0.6);
      entity(f, 'hoverboard', 8, 0, board, f.pos);
    } else {
      shoot(
        f,
        {
          ...a,
          range: 9,
          dmg: kind === 'bomb' ? 30 : kind === 'rpg' ? 38 : 5,
          stun: kind === 'tranquilizer' ? 0.8 : 0.3,
          control: 0,
          equipment: kind,
        },
        kind === 'tranquilizer' ? 'bullet' : kind === 'bomb' ? 'grenade' : 'missile',
      );
    }
    f.lastHitText =
      '胶囊·' +
      {
        mech: '机甲',
        tranquilizer: '麻醉枪',
        bomb: '炸弹',
        hoverboard: '浮空滑板',
        rpg: 'RPG火箭筒',
      }[kind];
    combat.emitCombatEvent('capsule', f, foeOf(f), a, { effect: kind });
  }
  combat.perfectGuardCounter = function (f, attacker) {
    const a = {
      ...f.def.combos.light[0],
      name: '完美防御·自动反击',
      dmg: 8,
      startup: 0.05,
      active: 0.12,
      recovery: 0.25,
      counterResponse: true,
      ki: 0,
    };
    a.anim = animation.authorYouthMove(f.def, a);
    f.facingAngle = Math.atan2(attacker.pos.x - f.pos.x, attacker.pos.z - f.pos.z);
    launch(f, a);
  };
  combat.initYouthFighter = function (f) {
    f.youth = {
      cooldowns: [0, 0],
      normalHeight: new THREE.Box3().setFromObject(f.root).getSize(new THREE.Vector3()).y,
      form: null,
      formTime: 0,
      tailHits: 0,
      tailSerials: new Set(),
      tailIntact: true,
      apeUsed: false,
      heals: 1,
      regenerated: false,
      weakTime: 0,
      capsuleTime: 0,
      capsule: null,
      controlGrace: 0,
      reversedTime: 0,
      controlCount: 0,
      controlBaseRemaining: 0,
      wolfUntil: 0,
      catUntil: 0,
      armorSpent: false,
      weapon: 'missile',
      burn: null,
      normalBody: null,
    };
  };
  combat.skillAvailability = function (f, variant = 0, { cancel = false } = {}) {
    const s = f.youth.form === 'ape' ? apeMove(variant) : f.def.skills[variant],
      v = f.youth;
    let reason = '';
    const reverting =
      f.def.id === 'oolong' &&
      v.form &&
      (s.ability === v.form || (s.ability === 'ogre' && v.form === 'ogre'));
    if (f.hp <= 0 || blockedStates.includes(f.state) || (!cancel && f.attack))
      reason = '等待行动恢复';
    else if (f.def.id === 'yamcha' && variant === 0 && v.wolfUntil > match.game.simTime)
      return { available: true, reason: '可发动', cost: 0, skill: s, followup: true };
    else if (
      v.form?.startsWith('mimic:') ||
      v.form === 'combined' ||
      (v.form === 'bat' && !reverting)
    )
      reason = '当前形态不可发动';
    else if (reverting)
      return { available: true, reason: '恢复本体', cost: 0, skill: s, reverting: true };
    else if (v.cooldowns[variant] > 0) reason = '冷却 ' + v.cooldowns[variant].toFixed(1) + 's';
    else if (f.ki < s.kiCost) reason = '资源不足';
    else if (['ape', 'muscle', 'fourArms', 'ogre', 'bat', 'armor'].includes(s.ability) && v.form)
      reason = '已有形态';
    else if (
      ['ape', 'muscle', 'fourArms', 'ogre', 'bat', 'cover', 'heal'].includes(s.ability) &&
      f.pos.y > 0.1
    )
      reason = '需要站在地面';
    else if (s.ability === 'heal' && (v.heals <= 0 || f.hp >= f.maxHp))
      reason = v.heals <= 0 ? '仙豆已用完' : '生命已满';
    else if (s.ability === 'blade' && f.v2.bladeOut) reason = '飞刃回收中';
    else if (
      s.ability === 'demon' &&
      combat.youthEntities.some((e) => e.owner === f && e.kind === 'demon')
    )
      reason = '手下已在场';
    else if (
      s.ability === 'cover' &&
      combat.youthEntities.some((e) => e.owner === f && e.kind === 'cover')
    )
      reason = '掩体已在场';
    return { available: !reason, reason: reason || '可发动', cost: s.kiCost, skill: s };
  };
  combat.ultimateAvailability = function (f, { cancel = false } = {}) {
    let reason = '';
    if (f.hp <= 0 || blockedStates.includes(f.state) || (!cancel && f.attack))
      reason = '等待行动恢复';
    else if (['bat', 'combined'].includes(f.youth.form) || f.youth.form?.startsWith('mimic:'))
      reason = '当前形态不可用';
    else if (f.def.id === 'piccolo' && f.youth.regenerated) reason = '再生后无法使用';
    else if (f.ki < 100) reason = '资源不足';
    return { available: !reason, reason: reason || '可发动', cost: 100 };
  };
  combat.setYouthBody = function (f, form) {
    const v = f.youth;
    const smokeHeight = f.def.id === 'oolong' && (form || v.form) ? combat.stature(f) : 0;
    if (!form) {
      if (v.normalBody) {
        render.scene.remove(f.root);
        world.disposeGroup(f.root);
        Object.assign(f, v.normalBody);
        v.normalBody = null;
        render.scene.add(f.root);
      }
      v.form = null;
      v.formTime = 0;
      f.combatRig = null;
      f.kiVisual = null;
      if (smokeHeight) render.spawnTransformSmoke(f, smokeHeight);
      return;
    }
    if (v.normalBody) combat.setYouthBody(f, null);
    v.normalBody = {
      root: f.root,
      parts: f.parts,
      anatomy: f.anatomy,
      baseScale: f.baseScale,
      materials: f.materials,
    };
    render.scene.remove(f.root);
    combat.stopChargeSound(f);
    render.stopUltSound(f);
    const body =
      form === 'ape'
        ? characters.buildGreatApe()
        : form === 'ogre'
          ? characters.buildOgre()
          : form === 'bat'
            ? characters.buildOolong('bat')
            : form === 'capsuleMech'
              ? characters.CHARACTERS.find((c) => c.id === 'pilaf').buildBody()
              : form.startsWith('mimic:')
                ? characters.CHARACTERS.find((c) => c.id === form.slice(6)).buildBody()
                : characters.addYouthForm(f.def.buildBody(), form);
    if (form === 'ape') {
      v.normalBody.root.updateMatrixWorld(true);
      body.root.updateMatrixWorld(true);
      const humanHeight = v.normalHeight;
      const factor =
        (humanHeight * 2.2) /
        new THREE.Box3().setFromObject(body.root).getSize(new THREE.Vector3()).y;
      body.root.traverse((o) => {
        o.position.multiplyScalar(factor);
        if (o.isMesh) o.geometry.scale(factor, factor, factor);
      });
      for (const key of Object.keys(body.parts.anatomy))
        if (typeof body.parts.anatomy[key] === 'number') body.parts.anatomy[key] *= factor;
      body.parts.restTorsoY = body.parts.anatomy.hip;
      v.apeScale = factor;
    }
    f.root = body.root;
    f.parts = body.parts;
    f.anatomy = body.parts.anatomy ?? null;
    f.baseScale = body.root.scale.x;
    f.combatRig = null;
    f.kiVisual = null;
    f.materials = [];
    const mats = new Set();
    f.root.traverse((o) => {
      if (o.material?.isMeshToonMaterial) mats.add(o.material);
    });
    for (const m of mats)
      f.materials.push({ m, em: m.emissive.clone(), intensity: m.emissiveIntensity });
    f.root.position.copy(f.pos);
    f.root.rotation.y = f.facingAngle;
    render.scene.add(f.root);
    v.form = form;
    f.flightMode = false;
    f.jumpVel = 0;
    if (smokeHeight) render.spawnTransformSmoke(f, smokeHeight);
  };
  combat.endYouthForm = function (f, recovery = true) {
    const v = f.youth,
      old = v.form;
    if (!old) return;
    combat.setYouthBody(f, null);
    if (['ogre', 'bat'].includes(old)) {
      v.cooldowns[0] = v.cooldowns[1] = 3;
    }
    f.attack = null;
    f.comboType = null;
    f.comboTimer = 0;
    f.clearQueue();
    if (old === 'muscle') v.weakTime = 2;
    if (recovery && f.hp > 0) {
      f.state = 'landing';
      f.stunTime = old === 'muscle' ? 2 : old === 'ape' ? 0.5 : 0.12;
      f.stateTimer = 0;
    }
  };
  function launch(f, a, type = 'attack') {
    const actualFoe = foeOf(f),
      hidden = combat.inYouthSmoke(f) || combat.inYouthSmoke(actualFoe),
      seen = hidden ? (f.isAI ? f.observations?.at(-1) : f.youth.lastSeen) : null,
      foe = seen
        ? {
            pos: new THREE.Vector3(seen.x, seen.y, seen.z),
            baseScale: actualFoe.baseScale,
            anatomy: actualFoe.anatomy,
          }
        : hidden
          ? null
          : actualFoe,
      entry = animation.cloneCombatPose(combat.combatPose(f));
    if (seen) f.facingAngle = Math.atan2(seen.x - f.pos.x, seen.z - f.pos.z);
    let tailAim = null;
    if (!hidden && actualFoe?.youth.form === 'ape' && !a.isThrow) {
      const rear = f.pos.clone().sub(actualFoe.pos);
      if (rear.dot(actualFoe.forward()) < -0.3) {
        const tails = combat
          .sampleCombatRig(actualFoe)
          .hurt.filter((h) => h.tag === 'tail' && h.enabled);
        const center = tails
          .map((h) => h.a.clone().add(h.b).multiplyScalar(0.5))
          .sort((a, b) => a.distanceToSquared(f.pos) - b.distanceToSquared(f.pos))[0];
        if (f.pos.distanceTo(center) < 2.8) {
          tailAim = center;
          f.facingAngle = Math.atan2(center.x - f.pos.x, center.z - f.pos.z);
        }
      }
    }
    a = { ...a };
    a.anim ??= animation.authorYouthMove(f.def, a);
    if (f.youth.form === 'muscle' && !a.chainType) a.dmg *= 1.3;
    if (f.youth.form === 'fourArms') {
      for (const key of ['startup', 'active', 'recovery']) a[key] /= 1.3;
      if (a.hits) a.hits = a.hits.map((time) => time / 1.3);
    }
    f.attack = combat.finalizeMove({
      ...a,
      pursuitFollow: !!a.chainType && f.pursuitWindow > 0 && !!actualFoe?.launchFlight,
      targetDistance: tailAim
        ? Math.hypot(tailAim.x - f.pos.x, tailAim.z - f.pos.z)
        : foe?.pos.distanceTo(f.pos),
      targetScale: foe?.baseScale ?? f.baseScale,
      targetY:
        tailAim?.y ??
        (foe
          ? Math.min(
              foe.pos.y + combat.stature(foe) * 0.7,
              f.pos.y + (f.anatomy ? f.anatomy.hip + f.anatomy.armY : 1.71 * f.baseScale) + 0.35,
            )
          : 1),
      isYouth: true,
    });
    if (a.chainType && f.anatomy && f.anatomy.upper + f.anatomy.fore < 0.7)
      f.attack.drive = (a.drive ?? 2.5) + 2;
    if (a.chainType && !f.anatomy && foe && combat.stature(foe) < combat.stature(f) * 0.75)
      f.attack.drive = (a.drive ?? 2.5) + 0.65;
    if (a.chainType && a.effector === 'elbowR') f.attack.drive = 10;
    if (a.chainType && a.effector === 'torso') f.attack.drive = (a.drive ?? 3) + 2;
    if (a.chainType && f.def.id === 'krillin' && a.chainType === 'light')
      f.attack.drive = (a.drive ?? 2.5) + 1.5;
    if (a.chainType && a.effector === 'axe' && a.motion !== 'axeJab') f.attack.drive = 0;
    f.attackMask = 0;
    f.hasHit = false;
    f.hitResult = null;
    f.armorSpent = false;
    f.state = type;
    f.stateTimer = 0;
    f.stageFired = false;
    f.vel.copy(f.forward()).multiplyScalar(f.attack.drive ?? 0);
    combat.beginMoveEvent(f, entry);
    if (a.ability === 'solar') render.spawnSolarFlare(f, f.attack);
    if (a.ability === 'fourArms') render.spawnBoundAura(f, 0xffd76d, f.attack.dur, f.attack);
    if (a.ability === 'counter') render.spawnBoundAura(f, 0x8eeaff, f.attack.dur, f.attack);
    return true;
  }
  combat.startYouthAttack = function (f, type, input = {}) {
    if (f.youth.form === 'bat') return false;
    let list = f.def.combos[type];
    if (f.youth.form === 'ape')
      list = (
        type === 'light'
          ? [
              ['横拍', 'claw', 8, 0.25],
              ['反手扫', 'backClaw', 9, 0.3],
              ['进步横拍', 'claw', 10, 0.28],
              ['低身推掌', 'doublePalm', 10, 0.32],
              ['巨猿踢击', 'heavyKick', 14, 0.35],
            ]
          : [
              ['重掌', 'doublePalm', 12, 0.4],
              ['巨爪横扫', 'claw', 13, 0.4],
              ['反身重拍', 'backClaw', 14, 0.45],
              ['踩踏', 'heavyKick', 15, 0.45],
              ['双掌砸地', 'doublePalm', 24, 0.55],
            ]
      ).map(([name, motion, dmg, startup], i, chain) => {
        const a = combat.finalizeMove({
          id: type[0] + (i + 1),
          name,
          motion,
          dmg,
          startup,
          active: 0.12,
          recovery: type === 'light' ? 0.35 : 0.7,
          range: type === 'light' ? 2.6 : 3.2,
          stun: 0.4,
          kb: i === chain.length - 1 ? 5 : 0.35,
          guardDamage: 22,
          chainType: type,
          chainIndex: i,
          terminal: i === chain.length - 1,
          authored: true,
          superArmor: type === 'heavy',
          effector: animation.youthEffector(motion, i, 'goku'),
          cancelRules: {
            hit: i < chain.length - 1 ? [type] : [],
            block: [],
            whiff: i < chain.length - 1 ? [type] : [],
          },
        });
        a.anim = animation.authorYouthMove(f.def, a, i);
        return a;
      });
    const idx =
      f.comboType === type && f.comboTimer > 0 ? Math.min(f.comboIdx + 1, list.length - 1) : 0;
    let a = { ...list[idx] };
    if (type === 'heavy' && (input.up || input.down) && f.youth.form !== 'ape')
      a = { ...f.def.directionMoves[input.up ? 0 : 1] };
    if (f.pos.y > 0.15) a.level = 'overhead';
    if (f.youth.form === 'muscle') a.dmg *= 1.3;
    if (f.youth.form === 'fourArms') a.dmg *= 1.1;
    if (f.youth.catUntil > match.game.simTime && type === 'light') {
      a = { ...a, name: '短杖反敲', motion: 'caneTap', dmg: 8, effector: 'cane' };
      a.anim = animation.authorYouthMove(f.def, a, 0);
      f.youth.catUntil = 0;
    }
    f.comboType = type;
    f.comboIdx = idx;
    f.comboTimer = a.dur + 0.4;
    return launch(f, a);
  };
  combat.startYouthSpecial = function (f, context = {}) {
    const variant = context.down || context.variant === 1 ? 1 : 0;
    const info = combat.skillAvailability(f, variant, { cancel: !!f.attack });
    if (info.followup) {
      f.youth.wolfUntil = 0;
      const a = {
        ...f.def.skills[0],
        name: '狼牙终掌',
        dmg: 6,
        hits: undefined,
        ability: undefined,
        motion: 'doublePalm',
        effector: 'both',
        active: 0.1,
        startup: 0.12,
        kiCost: 0,
      };
      a.anim = animation.authorYouthMove(f.def, a);
      return launch(f, a);
    }
    if (!info.available) {
      if (!f.isAI && !match.game.manualTest)
        match.notify(
          info.skill.name +
            ' · ' +
            (info.reason === '资源不足'
              ? '能量不足，还差' + Math.ceil(info.cost - f.ki) + ' · 按住聚气补充'
              : info.reason.replace(/s$/, '秒')),
          1.2,
        );
      return false;
    }
    if (info.reverting) {
      combat.endYouthForm(f);
      return true;
    }
    const a = { ...info.skill };
    if (a.ability === 'rps') {
      const choices = [
        ['剪刀', 'fingerStab'],
        ['石头', 'heavyPunch'],
        ['布', 'palmStrike'],
      ];
      const [name, motion] = choices[Math.floor(ai.combatRandom() * choices.length)];
      Object.assign(a, {
        name: '猜拳·' + name,
        motion,
        effector: animation.youthEffector(motion, 0, 'goku'),
      });
      a.anim = animation.authorYouthMove(f.def, a);
    }
    if (f.def.id === 'goku' && variant === 0 && context.up) {
      a.name = '如意挑空';
      a.launch = 5.7;
      a.stun = 0.55;
    }
    f.ki -= a.kiCost;
    f.youth.cooldowns[variant] = a.cooldown;
    f.comboType = null;
    f.comboTimer = 0;
    launch(f, a);
    combat.emitCombatEvent('kiSpent', f, null, f.attack, { remaining: f.ki });
    if (!match.game.manualTest) match.notify(a.name + ' · ' + a.kiCost + ' ' + f.def.resource, 0.7);
    return true;
  };
  combat.startYouthUlt = function (f) {
    if (!combat.ultimateAvailability(f, { cancel: !!f.attack }).available) return false;
    f.ki -= 100;
    const a = { ...(f.youth.form === 'ape' ? apeMove(0, true) : f.def.ult), costCommitted: true };
    if (a.lifeCost) f.hp = Math.max(0, f.hp - f.maxHp * a.lifeCost);
    f.comboType = null;
    f.comboTimer = 0;
    f.clearQueue();
    launch(f, a, 'ult');
    combat.emitCombatEvent('kiSpent', f, null, f.attack, { remaining: f.ki });
    if (!f.anatomy) render.castUltVisual(f, f.def);
    render.sfxUlt(f);
    if (!match.game.manualTest) match.notify(f.def.ultName, 1);
    return true;
  };
  function moveBy(f, delta) {
    const before = f.pos.clone();
    f.pos.add(delta);
    f.clampPos();
    for (const e of combat.youthEntities.filter((e) => e.kind === 'cover')) {
      if (f.pos.distanceTo(e.pos) < 0.7) f.pos.copy(before);
    }
    combat.resolveOverlap();
  }
  function shoot(f, a, kind = 'psychic', damage = a.dmg, delay = 0) {
    combat.newProjectile(
      f,
      { ...a, dmg: damage, control: 0, shape: undefined, ability: undefined },
      kind,
      {
        speed: kind === 'missile' ? 10 : 18,
        life: Math.max(0.6, a.range / (kind === 'missile' ? 10 : 18) + 0.02),
        radius: kind === 'missile' ? 0.13 : 0.09,
        delay,
      },
    );
  }
  function entity(f, kind, life, hp, mesh, pos) {
    render.scene.add(mesh);
    mesh.position.copy(pos);
    const e = {
      owner: f,
      kind,
      life,
      hp,
      mesh,
      pos: pos.clone(),
      hits: new Set(),
      attackTime: 1.2,
      warning: 0,
    };
    combat.youthEntities.push(e);
    return e;
  }
  // Called only after a genuine hit has reached the fighter (or an aimed control skill).
  function dodgeCounter(f, attacker, incoming) {
    const dodge = f.attack;
    if (
      f.def.id !== 'yamcha' ||
      f.hp <= 0 ||
      incoming.isThrow ||
      incoming.counterResponse ||
      attacker !== foeOf(f) ||
      attacker.hp <= 0 ||
      dodge?.ability !== 'sidestep' ||
      f.stateTimer + 1e-9 < dodge.hitT ||
      f.stateTimer > dodge.hitT + dodge.active + 1e-9
    )
      return false;
    combat.spawnAfterimage(f);
    const behind = attacker.pos.clone().addScaledVector(attacker.forward(), -1);
    behind.y = f.pos.y;
    moveBy(f, behind.sub(f.pos));
    f.facingAngle = Math.atan2(attacker.pos.x - f.pos.x, attacker.pos.z - f.pos.z);
    f.clearQueue();
    f.invulnerable = Math.max(f.invulnerable, 0.08);
    const counter = {
      ...dodge,
      ability: undefined,
      shape: undefined,
      name: '狼牙闪身·背袭',
      motion: 'doublePalm',
      effector: 'both',
      dmg: 22,
      range: 1.7,
      startup: 0.08,
      active: 0.14,
      recovery: 0.4,
      kb: 6,
      stun: 0.55,
      launch: 7,
      counterResponse: true,
      youthDodgeCounter: true,
      drive: 3,
    };
    counter.anim = animation.authorYouthMove(f.def, counter);
    launch(f, counter);
    attacker.hitResult = 'dodged';
    f.lastHitText = '闪避成功 · 背后击飞';
    combat.spawnAfterimage(f);
    combat.emitCombatEvent('dodgeCounter', f, attacker, incoming);
    return true;
  }
  combat.releaseYouthAbility = function (f, a) {
    const v = f.youth,
      foe = foeOf(f),
      kind = a.ability;
    if (a.shape === 'beam' && !a.isUlt) {
      const hit = combat.sampleCombatRig(f).hit[0],
        length = hit.a.distanceTo(hit.b),
        dir = hit.b.clone().sub(hit.a).normalize();
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(a.width ?? 0.12, a.width ?? 0.12, length, 12),
        render.energyMat(combat.kiColor(f), 0.8),
      );
      mesh.position.copy(hit.a).add(hit.b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      render.scene.add(mesh);
      render.effects.push({ mesh, life: a.active, maxLife: a.active, type: 'beam' });
    }
    if (a.groundImpact) {
      const hit = combat.sampleCombatRig(f).hit[0];
      const impact = hit.a.clone().add(hit.b).multiplyScalar(0.5).setY(0);
      world.damageStage(f, { ...a, landingImpact: true }, impact);
      if (a.motion === 'axeCataclysm') {
        render.spawnShockRing(f.pos.clone().setY(0.08), 0xffb35e, a.range);
        render.spawnSpark(impact.clone().setY(0.15), 0xffcf83, 24, 0.7);
      }
    }
    if (f.def.id === 'gyumao' && a.chainType === 'heavy') spawnFire(f, a);
    if (!kind) return;
    if (kind === 'equipment') {
      const k = a.equipment;
      if (k === 'flame') {
        const mesh = new THREE.Group();
        // The stream follows its owner independently of the current attack animation.
        for (let i = 0; i < 24; i++) {
          const particle = new THREE.Mesh(
            new THREE.SphereGeometry(1, 6, 4),
            render.energyMat(i % 3 ? 0xff8426 : 0xffe49b, 0.8),
          );
          particle.material.depthWrite = false;
          mesh.add(particle);
        }
        const stream = entity(f, 'flameStream', 2, 0, mesh, f.pos);
        stream.attack = combat.finalizeMove({ ...a, projectile: true, fireDamage: true });
        stream.elapsed = 0;
      } else
        combat.newProjectile(f, a, k, {
          speed: k === 'missile' ? 10 : k === 'flame' ? 7 : 18,
          life: k === 'flame' ? 0.36 : Math.max(0.6, a.range / (k === 'missile' ? 10 : 18) + 0.02),
          radius: k === 'flame' ? 0.3 : k === 'missile' ? 0.13 : 0.075,
        });
    }
    if (kind === 'capsule') releaseCapsule(f, a);
    if (kind === 'ape') {
      v.apeUsed = true;
      combat.setYouthBody(f, 'ape');
      v.formTime = 10;
    }
    if (kind === 'muscle' || kind === 'fourArms') {
      combat.setYouthBody(f, kind);
      v.formTime = kind === 'fourArms' ? 10 : 8;
      if (kind === 'fourArms') {
        render.spawnShockRing(f.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffd76d, 1.5);
        render.spawnSpark(f.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffefaf, 14, 0.4);
      }
    }
    if (kind === 'ogre' || kind === 'bat') {
      combat.setYouthBody(f, kind);
      v.formTime = kind === 'ogre' ? 5 : 3;
      if (kind === 'ogre' && foe) {
        const delta = foe.pos.clone().sub(f.pos).setY(0);
        const facing = delta.length() > 0 && f.forward().dot(delta.clone().normalize()) > 0.5;
        const repelled =
          facing &&
          delta.length() <= 2.4 &&
          foe.hp > 0 &&
          foe.pos.y < 0.2 &&
          foe.invulnerable <= 0 &&
          !superArmorActive(foe) &&
          ['idle', 'walk', 'crouch', 'charge'].includes(foe.state) &&
          !combat.coverBlocks(f.pos, foe.pos);
        if (repelled) {
          const before = foe.pos.clone();
          moveBy(foe, delta.normalize().multiplyScalar(1.2));
          // This is spacing, not damage or a stun. The defender can act immediately.
          combat.emitCombatEvent('feintRepelled', f, foe, a, {
            distance: before.distanceTo(foe.pos),
          });
          foe.lastHitText = '巨鬼惊吓 · 可立即行动';
          render.spawnShockRing(f.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffdf9c, 1.6);
        } else combat.emitCombatEvent('feintResisted', f, foe, a);
      }
    }
    if (kind === 'heal') {
      const healed = Math.min(f.maxHp - f.hp, f.maxHp * world.SENZU_RULES.healRatio * 1.3);
      f.hp += healed;
      v.heals--;
      f.v2.heals = v.heals;
      f.v2.healTotal += healed;
      combat.emitCombatEvent('selfHeal', f, null, a, { healed });
      ui.popDamage(
        f.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
        Math.round(healed),
        '#c6ff9f',
        true,
      );
    }
    if (kind === 'weapon') {
      v.weapon = v.weapon === 'missile' ? 'flame' : 'missile';
      f.v2.mode = v.weapon;
    }
    if (kind === 'armor') {
      v.form = 'armor';
      v.formTime = 3;
      v.armorSpent = false;
    }
    if (kind === 'retreat') f.youth.retreat = { time: 0.2, remaining: 1.2 };
    if (kind === 'catStep') {
      const side = f.lastInput?.left ? -1 : 1;
      moveBy(
        f,
        new THREE.Vector3(Math.cos(f.facingAngle), 0, -Math.sin(f.facingAngle)).multiplyScalar(
          1.2 * side,
        ),
      );
      f.invulnerable = Math.max(f.invulnerable, 0.075);
      v.catUntil = match.game.simTime + 0.35;
      combat.spawnAfterimage(f);
    }
    if (kind === 'sidestep') combat.spawnAfterimage(f);
    if (kind === 'floatRetreat') {
      v.floatTime = 0.5;
      v.floatRemaining = 1.2;
    }
    if (kind === 'blade') {
      f.v2.bladeOut = true;
      combat.newProjectile(f, { ...a, control: 0 }, 'blade', {
        speed: 10,
        life: 2.1,
        radius: 0.14,
      });
    }
    if (kind === 'solar' && foe) {
      const delta = foe.pos.clone().sub(f.pos),
        dist = delta.length();
      delta.normalize();
      if (
        dist <= 3 &&
        f.forward().dot(delta) > 0.5 &&
        foe.forward().dot(delta.clone().negate()) > 0.25 &&
        !combat.coverBlocks(f.pos, foe.pos)
      ) {
        if (foe.hp > 0 && foe.invulnerable <= 0 && !['block', 'blockstun'].includes(foe.state)) {
          if (dodgeCounter(foe, f, a)) return;
          if (!combat.applyControl(f, foe, a)) return;
          foe.youth.reversedTime = a.reverseDuration ?? 3;
          foe.lastHitText = '太阳拳 · 前后左右及方向招式反向 · 格挡正常';
          if (!match.game.manualTest) match.notify(foe.lastHitText, 1.5);
          combat.emitCombatEvent('reverseDirections', f, foe, a, {
            duration: foe.youth.reversedTime,
          });
        }
        render.spawnShockRing(f.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xfff5bd, 1.8);
      }
    }
    if (kind === 'demon') {
      const pos = f.pos.clone().addScaledVector(f.forward(), 0.9);
      const b = characters.buildDemon();
      entity(f, 'demon', 6, 24, b.root, pos);
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), characters.M(0xe3dcc6));
      entity(f, 'egg', 0.4, 0, egg, pos.clone().add(new THREE.Vector3(0, 1.1, 0)));
    }
    if (kind === 'cover') {
      const mesh = new THREE.Group();
      characters.box(mesh, characters.M(0x6c8c85), 0, 0.6, 0, 1.1, 1.2, 0.35);
      characters.box(mesh, characters.M(0xe5cba1), 0, 1.23, 0, 1.2, 0.08, 0.45);
      entity(f, 'cover', 8, 30, mesh, f.pos.clone().addScaledVector(f.forward(), 1.2));
      mesh.traverse((node) => {
        if (!node.isMesh) return;
        node.userData.cameraBlocker = true;
        render.cameraObstacles.push(node);
      });
      mesh.updateMatrixWorld(true);
    }
    if (kind === 'smoke') {
      const mesh = new THREE.Group();
      for (let i = 0; i < 7; i++)
        characters.ball(
          mesh,
          characters.M(0xbbb8bd, { transparent: true, opacity: 0.27 }),
          Math.cos(i) * 0.8,
          0.6 + (i % 3) * 0.4,
          Math.sin(i) * 0.8,
          0.75,
        );
      entity(f, 'smoke', 3, 0, mesh, f.pos.clone().addScaledVector(f.forward(), 1.2));
    }
    if (kind === 'helmetCombo') shoot(f, { ...a, range: 8 }, 'helmet', a.projectileDamage, 0.12);
    if (kind === 'barrage') {
      for (let i = 0; i < 4; i++) shoot(f, a, 'bullet', a.dmg, i * 0.12);
    }
    if (kind === 'psychicVolley') {
      for (let i = 0; i < 3; i++)
        shoot(f, { ...a, range: 8 }, 'psychic', a.projectileDamage, 0.12 + i * 0.12);
    }
    if (kind === 'trial') {
      combat.spawnAfterimage(f);
      if (!f.parts.trialWater) {
        const water = new THREE.Group();
        characters.ball(water, characters.M(0xb89065), 0, 0, 0, 0.12, [1, 1.2, 1]);
        f.parts.handL.add(water);
        f.parts.trialWater = water;
      }
    }
    if (kind === 'mimicUlt') {
      const pool = characters.CHARACTERS.filter((c) => c.id !== 'oolong');
      const target = pool[Math.floor(ai.combatRandom() * pool.length)];
      combat.setYouthBody(f, 'mimic:' + target.id);
      v.formTime = target.ult.dur + 0.5;
      const copied = { ...target.ult, damagePower: target.power, mimic: true, costCommitted: true };
      if (copied.lifeCost) f.hp = Math.max(0, f.hp - f.maxHp * copied.lifeCost);
      launch(f, copied, 'ult');
      render.castUltVisual(f, target);
      render.sfxUlt(f);
      combat.emitCombatEvent('mimic', f, foe, f.attack, { character: target.id });
    }
    if (kind === 'combine') {
      if (!v.form?.startsWith('mimic:')) combat.setYouthBody(f, 'combined');
      v.formTime = 3;
      shoot(f, { ...a, range: 8 }, 'missile', a.projectileDamage, 0);
      shoot(f, { ...a, range: 8 }, 'missile', a.projectileDamage, 0.12);
    }
  };
  combat.coverBlocks = function (from, to) {
    const segment = to.clone().sub(from),
      len = segment.lengthSq();
    if (world.stageSegmentHit?.(from, to, 0.08)) return true;
    return combat.youthEntities.some((e) => {
      if (e.kind !== 'cover' || e.hp <= 0) return false;
      const k = Math.max(
        0,
        Math.min(1, e.pos.clone().sub(from).dot(segment) / Math.max(0.001, len)),
      );
      const at = from.clone().addScaledVector(segment, k);
      return at.y < 1.3 && Math.hypot(at.x - e.pos.x, at.z - e.pos.z) < 0.65;
    });
  };
  combat.projectileHitsCover = function (b) {
    for (const e of combat.youthEntities) {
      if (e.kind !== 'cover' || e.hp <= 0) continue;
      const h = {
        a: e.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
        b: e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        r: 0.4,
      };
      if (combat.capsuleDistanceSq({ a: b.previous, b: b.pos, r: b.r }, h) < (b.r + h.r) ** 2) {
        if (!e.hits.has(b)) {
          e.hp -= b.attack.dmg;
          e.hits.add(b);
        }
        return true;
      }
    }
    return false;
  };
  combat.inYouthSmoke = function (f) {
    return combat.youthEntities.some(
      (e) => e.kind === 'smoke' && Math.hypot(f.pos.x - e.pos.x, f.pos.z - e.pos.z) < 1.8,
    );
  };
  combat.counterActive = (f) =>
    f.hp > 0 &&
    f.attack?.ability === 'counter' &&
    f.stateTimer + 1e-9 >= f.attack.hitT &&
    f.stateTimer <= f.attack.hitT + f.attack.active + 1e-9;
  combat.reflectProjectile = function (f, b) {
    if (dodgeCounter(f, b.owner, b.attack)) {
      b.hits?.add(f);
      return true;
    }
    if (!combat.counterActive(f)) return false;
    const attacker = b.owner;
    if (b.kind === 'blade') attacker.v2.bladeOut = false;
    b.owner = f;
    b.direction
      .copy(attacker.pos)
      .add(new THREE.Vector3(0, combat.stature(attacker) * 0.65, 0))
      .sub(b.pos)
      .normalize();
    b.attack = { ...b.attack, control: 0, counterResponse: true };
    b.distance = 0;
    b.life = Math.max(b.life, (b.attack.range ?? 8) / (b.speed ?? b.velocity));
    b.returning = false;
    b.hits?.clear();
    b.previous.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.direction);
    attacker.hitResult = 'reflected';
    f.lastHitText = '远程反弹';
    combat.spawnAfterimage(f);
    render.spawnShockRing(b.pos, 0xb6efff, 0.8);
    combat.emitCombatEvent('reflection', f, attacker, b.attack);
    return true;
  };
  combat.tickYouthFighter = function (f, dt) {
    const v = f.youth;
    if (!v) return;
    if (v.burn) {
      const burn = v.burn;
      const elapsed = Math.min(dt, burn.remaining);
      burn.remaining = Math.max(0, burn.remaining - elapsed);
      burn.tick += elapsed;
      while (burn.tick >= 1 - 1e-9 && f.hp > 0) {
        burn.tick = Math.max(0, burn.tick - 1);
        const hp = f.hp;
        f.hp = Math.max(match.game.difficulty === 'training' ? 1 : 0, f.hp - 5);
        regenerate(f, f.ki, burn.owner);
        combat.emitCombatEvent('burn', burn.owner, f, burn.attack, {
          damage: Math.max(0, hp - f.hp),
        });
      }
      if (burn.remaining <= 1e-9 || f.hp <= 0) v.burn = null;
      else {
        burn.visualTime = (burn.visualTime ?? 0) - dt;
        if (burn.visualTime <= 0) {
          burn.visualTime = 0.12;
          render.spawnDust(f.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 3, {
            color: 0xff8528,
            opacity: 0.8,
            life: 0.35,
            power: 0.65,
            radius: 0.3,
          });
        }
      }
    }
    const reversing = v.reversedTime > 0;
    v.reversedTime = Math.max(0, v.reversedTime - dt);
    v.controlBaseRemaining = Math.max(0, v.controlBaseRemaining - dt);
    if (reversing && v.reversedTime === 0) {
      combat.emitCombatEvent('directionsRestored', f, null, null);
      f.lastHitText = '方向恢复';
    }
    if (
      f.attack?.ability === 'sidestep' &&
      !f.attack.sidestepMoved &&
      f.stateTimer >= f.attack.hitT + f.attack.active
    ) {
      f.attack.sidestepMoved = true;
      const side = f.lastInput?.left ? -1 : 1;
      moveBy(
        f,
        new THREE.Vector3(Math.cos(f.facingAngle), 0, -Math.sin(f.facingAngle)).multiplyScalar(
          1.2 * side,
        ),
      );
      combat.spawnAfterimage(f);
    }
    v.weakTime = Math.max(0, v.weakTime - dt);
    if (f.hp > 0 && f.def.id === 'pilaf') f.ki = Math.min(100, f.ki + 3 * dt);
    if (f.def.id === 'chiaotzu' && f.v2.controlTarget?.v2.controlTime > 0 && f.hp > 0) {
      const target = f.v2.controlTarget;
      const amount = Math.min(target.ki, dt * 12);
      target.ki -= amount;
      f.ki = Math.min(100, f.ki + amount);
    }
    if (v.capsuleTime > 0) {
      v.capsuleTime = Math.max(0, v.capsuleTime - dt);
      if (!v.capsuleTime) {
        v.capsule = null;
        if (v.form === 'capsuleMech') combat.endYouthForm(f, false);
      }
    }
    if (v.form?.startsWith('mimic:') && !f.attack) combat.endYouthForm(f, false);
    if (f.v2.controlTarget?.v2.controlTime <= 0) f.v2.controlTarget = null;
    if (v.form === 'combined' && !f.attack) combat.endYouthForm(f, false);
    v.cooldowns = v.cooldowns.map((t) => Math.max(0, t - dt));
    if (v.controlGrace > 0) {
      v.controlGrace = Math.max(0, v.controlGrace - dt);
      if (v.controlGrace === 0) v.controlCount = 0;
    }
    if (v.formTime > 0) {
      v.formTime -= dt;
      if (v.form === 'muscle') f.ki = Math.max(0, f.ki - dt * 5);
      if (v.formTime <= 0 || (v.form === 'muscle' && f.ki <= 0)) combat.endYouthForm(f);
    }
    if (v.form === 'bat' && !blockedStates.includes(f.state)) {
      f.pos.y = 0.8;
      f.jumpVel = 0;
    }
    if (v.floatTime > 0) {
      const d = Math.min(dt, v.floatTime);
      f.pos.y = Math.min(0.8, f.pos.y + d * 1.6);
      f.jumpVel = 0;
      moveBy(f, f.forward().multiplyScalar((-v.floatRemaining * d) / v.floatTime));
      v.floatRemaining *= 1 - d / v.floatTime;
      v.floatTime -= d;
    }
    if (v.retreat) {
      const d = Math.min(dt, v.retreat.time);
      moveBy(f, f.forward().multiplyScalar((-v.retreat.remaining * d) / v.retreat.time));
      v.retreat.remaining *= 1 - d / v.retreat.time;
      v.retreat.time -= d;
      if (v.retreat.time <= 0) v.retreat = null;
    }
    if (
      v.form === 'combined' &&
      f.attack?.isUlt &&
      f.stateTimer >= f.attack.hitT + 1.25 &&
      f.stateTimer < f.attack.hitT + 1.55
    )
      f.vel.copy(f.forward()).multiplyScalar(8);
    if (v.rushTime != null && f.attack?.ability === 'shapeRush') {
      v.rushTime += dt;
      const form = v.rushTime < 0.35 ? 'ogre' : v.rushTime < 0.7 ? 'bat' : null;
      if (v.form !== form) {
        const time = v.formTime;
        combat.setYouthBody(f, form);
        v.formTime = time;
      }
      if (v.rushTime >= 0.7) {
        v.rushTime = null;
      }
    }
  };
  combat.cleanupYouthEntities = function (owner = null) {
    for (const e of [...combat.youthEntities])
      if (!owner || e.owner === owner) {
        render.scene.remove(e.mesh);
        world.disposeGroup(e.mesh);
        combat.youthEntities.splice(combat.youthEntities.indexOf(e), 1);
      }
  };
  combat.updateYouthEntities = function (dt) {
    for (const e of [...combat.youthEntities]) {
      const activeDt = Math.min(dt, Math.max(0, e.life));
      e.life -= dt;
      const foe = foeOf(e.owner);
      if (e.kind === 'flameStream') {
        e.elapsed += activeDt;
        e.pos.copy(e.owner.pos);
        const height = e.owner.anatomy
          ? e.owner.anatomy.hip + e.owner.anatomy.armY
          : 1.3 * e.owner.baseScale;
        e.mesh.position.copy(e.pos).y += height + (world.groundHeight?.(e.pos.x, e.pos.z) ?? 0);
        e.mesh.rotation.y = e.owner.facingAngle;
        e.mesh.children.forEach((particle, i) => {
          const t = (e.elapsed * 2.8 + i / 24) % 1;
          const angle = i * 2.399;
          const radius = 0.06 + t * 0.3;
          particle.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0.35 + t * 2.15,
          );
          particle.scale.setScalar(0.07 + t * 0.2);
          particle.material.opacity = (1 - t) * 0.9;
        });
        if (e.owner.hp <= 0) e.life = 0;
        if (activeDt > 0 && e.owner.hp > 0 && foe?.hp > 0 && foe.def.id !== 'gyumao') {
          const origin = e.pos
            .clone()
            .setY(e.pos.y + height + (world.groundHeight?.(e.pos.x, e.pos.z) ?? 0));
          const tip = origin.clone().addScaledVector(e.owner.forward(), e.attack.range);
          const stream = { a: origin, b: tip, r: 0.3 };
          if ((e.stageDamageAt ?? -10) + 0.25 <= match.game.simTime) {
            e.stageDamageAt = match.game.simTime;
            world.damageStageProjectile?.(e.owner, { dmg: 4 }, origin, tip, 0.2);
          }
          const contact =
            !combat.coverBlocks(origin, tip) &&
            combat
              .sampleCombatRig(foe)
              .hurt.some(
                (h) => h.enabled && combat.capsuleDistanceSq(stream, h) <= (stream.r + h.r) ** 2,
              );
          if (contact && foe.invulnerable <= 0) {
            if (!e.hits.has(foe)) {
              const hp = foe.hp;
              foe.takeHit(e.owner, e.attack);
              if (foe.hp < hp || foe.lastHitText === '完美格挡') e.hits.add(foe);
              if (foe.hp < hp && !['格挡', '完美格挡'].includes(foe.lastHitText)) {
                foe.youth.burn = { owner: e.owner, attack: e.attack, remaining: 3, tick: 0 };
              }
            } else if (foe.youth.burn && !['block', 'blockstun'].includes(foe.state))
              foe.youth.burn.remaining = 3;
          }
        }
      }
      if (e.launchVelocity) {
        e.launchVelocity.multiplyScalar(Math.exp(-dt * 0.85));
        e.pos.addScaledVector(e.launchVelocity, dt);
        e.jumpVel -= dt * 22;
        e.pos.y += e.jumpVel * dt;
        if (e.pos.y <= 0) {
          e.pos.y = 0;
          e.launchVelocity = null;
          world.damageStage(e.owner, { dmg: 20, landingImpact: true }, e.pos);
        }
        e.mesh.position.copy(e.pos);
      }
      if (e.kind === 'hoverboard') {
        e.pos.copy(e.owner.pos);
        e.mesh.position.copy(e.pos);
        e.mesh.position.y += 0.12 + Math.sin(match.game.simTime * 3) * 0.05;
      }
      if (e.kind === 'fire') {
        e.mesh.children.forEach(
          (flame, i) => (flame.scale.y = 0.8 + Math.sin(match.game.simTime * 12 + i) * 0.2),
        );
        for (const target of [match.player, match.enemy]) {
          if (
            !target ||
            target.hp <= 0 ||
            target.def.id === 'gyumao' ||
            target.pos.y > 0.3 ||
            Math.hypot(target.pos.x - e.pos.x, target.pos.z - e.pos.z) > 1.2
          )
            continue;
          // Environmental damage bypasses guard and combo scaling; overlap never stacks.
          if (target.youth.fireTick === match.game.simTime) continue;
          target.youth.fireTick = match.game.simTime;
          const hp = target.hp;
          target.hp = Math.max(match.game.difficulty === 'training' ? 1 : 0, target.hp - 2 * dt);
          regenerate(target, target.ki, e.owner);
          combat.emitCombatEvent('burn', e.owner, target, null, {
            damage: Math.max(0, hp - target.hp),
          });
        }
      }
      if (e.kind === 'demon' && foe && !e.launchVelocity) {
        e.attackTime -= dt;
        const delta = foe.pos.clone().sub(e.pos);
        delta.y = 0;
        const dist = delta.length();
        e.mesh.rotation.y = Math.atan2(delta.x, delta.z);
        if (dist > 1.2) e.pos.addScaledVector(delta.normalize(), Math.min(dist - 1.2, dt * 2));
        e.mesh.position.copy(e.pos);
        if (dist < 3 && e.attackTime <= 0) {
          e.warning += dt;
          e.mesh.scale.setScalar(1 + Math.sin(e.warning * 20) * 0.08);
          if (e.warning >= 0.3) {
            const attacker = {
              ...e.owner,
              pos: e.pos,
              forward: () => delta.clone().normalize(),
              attack: null,
            };
            if (dist < 1.8)
              foe.takeHit(
                attacker,
                combat.finalizeMove({
                  id: 'demonPounce',
                  dmg: 6,
                  stun: 0.25,
                  kb: 1,
                  guardDamage: 8,
                  ki: 0,
                  serial: ++combat.combatEvents.serial,
                  level: 'mid',
                }),
              );
            e.attackTime = 1.5;
            e.warning = 0;
            e.mesh.scale.setScalar(1);
          }
        }
      }
      if (e.kind === 'cover' || e.kind === 'demon') {
        for (const f of [match.player, match.enemy]) {
          const a = f?.attack;
          if (
            !a ||
            e.hits.has(a.serial) ||
            f.stateTimer < a.hitT ||
            f.stateTimer > a.hitT + a.active ||
            (e.kind === 'demon' && f === e.owner)
          )
            continue;
          const r = combat.sampleCombatRig(f),
            body = {
              a: e.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
              b: e.pos.clone().add(new THREE.Vector3(0, e.kind === 'cover' ? 1.2 : 1.5, 0)),
              r: 0.4,
            };
          if (
            r.hit.some((h) => h.enabled && combat.capsuleDistanceSq(h, body) < (h.r + body.r) ** 2)
          ) {
            e.hits.add(a.serial);
            e.hp -= a.dmg;
          }
        }
        for (const b of [...combat.v2Projectiles])
          if (e.kind === 'demon' && b.owner !== e.owner) {
            const body = {
              a: e.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
              b: e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
              r: 0.4,
            };
            if (
              combat.capsuleDistanceSq({ a: b.previous, b: b.pos, r: b.r }, body) <
              (b.r + 0.4) ** 2
            ) {
              e.hp -= b.attack.dmg;
              combat.removeAbility(combat.v2Projectiles, b);
            }
          }
      }
      if (e.kind === 'cover')
        for (const f of [match.player, match.enemy])
          if (f && f.pos.y < 1.2) {
            const d = f.pos.clone().sub(e.pos);
            d.y = 0;
            const len = d.length(),
              min = 0.65 + (f.anatomy ? f.anatomy.torsoR * 0.4 : 0.12);
            if (len < min) {
              if (len < 0.001) d.copy(f.forward());
              else d.divideScalar(len);
              f.pos.addScaledVector(d, min - len);
              f.clampPos();
            }
          }
      if (
        e.life <= 0 ||
        Math.abs(e.pos.x) > (world.currentMap?.bounds.x ?? 14) + 0.5 ||
        Math.abs(e.pos.z) > (world.currentMap?.bounds.z ?? 9) + 0.5 ||
        (e.hp <= 0 && ['cover', 'demon'].includes(e.kind)) ||
        e.owner.hp <= 0 ||
        (e.kind === 'demon' && e.owner.state === 'knockdown')
      ) {
        render.scene.remove(e.mesh);
        world.disposeGroup(e.mesh);
        combat.youthEntities.splice(combat.youthEntities.indexOf(e), 1);
      }
    }
  };
  return function initialize() {
    combat.youthEntities = [];
    const proto = combat.Fighter.prototype;
    proto.startAttack = function (type, context = {}) {
      return combat.startYouthAttack(this, type, context);
    };
    proto.startSpecial = function (context = {}) {
      return combat.startYouthSpecial(this, context);
    };
    proto.startUlt = function () {
      return combat.startYouthUlt(this);
    };
    proto.startThrow = function () {
      if (['ape', 'bat', 'combined'].includes(this.youth.form)) return false;
      return launch(this, this.def.throwMove);
    };
    combat.releaseV2Ability = combat.releaseYouthAbility;
    const capture = proto.captureInput;
    proto.captureInput = function (input) {
      capture.call(this, this.youth.reversedTime > 0 ? reverseDirectionalInput(input) : input);
    };
    const update = proto.update;
    proto.update = function (dt, foe, input = {}) {
      if (match.game.over) return;
      if (foe && !combat.inYouthSmoke(this) && !combat.inYouthSmoke(foe))
        this.youth.lastSeen = { x: foe.pos.x, y: foe.pos.y, z: foe.pos.z };
      if (
        this.hp > 0 &&
        this.hp / this.maxHp < 0.5 &&
        this.def.id === 'goku' &&
        match.game.lightPreset === 'moon' &&
        !this.youth.apeUsed &&
        this.youth.tailIntact &&
        !this.youth.form &&
        !this.attack?.autoApe
      ) {
        this.youth.apeUsed = true;
        this.launchFlight = false;
        this.v2.controlTime = 0;
        this.pos.y = 0;
        this.invulnerable = Math.max(this.invulnerable, 1.05);
        this.clearQueue();
        launch(
          this,
          combat.finalizeMove({
            name: '满月·巨猿觉醒',
            motion: 'transform',
            ability: 'ape',
            shape: 'ability',
            autoApe: true,
            startup: 1,
            active: 0.01,
            recovery: 0.1,
            dmg: 0,
            range: 0,
            kiCost: 0,
            authored: true,
          }),
          'attack',
        );
        render.spawnBoundAura(this, 0xffcf78, 1, this.attack);
        audio.combatFeedback('breaker', this.pos, 0.4);
      }
      combat.tickYouthFighter(this, dt);
      update.call(
        this,
        dt,
        foe,
        this.youth.reversedTime > 0 ? reverseDirectionalInput(input) : input,
      );
    };
    // These authored follow-ups must consume input during their short windows,
    // before the source skill finishes recovery and clears its input buffer.
    const updateAttack = proto.updateAttack;
    proto.updateAttack = function (dt, foe, input) {
      if (
        this.attack?.ability === 'catStep' &&
        this.youth.catUntil > match.game.simTime &&
        this.pull('light')
      ) {
        this.startAttack('light', input);
        return;
      }
      const followup = this.queue.find((q) => q.type === 'special' && !q.context.down);
      if (
        this.attack?.ability === 'wolf' &&
        this.youth.wolfUntil > match.game.simTime &&
        followup
      ) {
        this.pull('special');
        this.startSpecial(followup.context);
        return;
      }
      updateAttack.call(this, dt, foe, input);
    };
    proto.startKiBlast = function () {
      if (
        this.attack ||
        blockedStates.includes(this.state) ||
        ['ape', 'bat'].includes(this.youth.form)
      )
        return false;
      const id = this.def.id;
      if (['gyumao', 'oolong', 'korin'].includes(id)) {
        if (!match.game.manualTest) match.notify(this.def.name + '没有远程攻击', 0.7);
        return false;
      }
      const kind =
        id === 'pilaf'
          ? this.youth.weapon
          : id === 'bulma'
            ? 'bullet'
            : id === 'chichi'
              ? 'helmet'
              : ['taopaipai', 'tien', 'chiaotzu'].includes(id)
                ? 'psychic'
                : 'ki';
      const cost = kind === 'flame' ? 12 : kind === 'missile' ? 10 : kind === 'helmet' ? 8 : 5;
      if (
        kind === 'flame' &&
        combat.youthEntities.some((e) => e.kind === 'flameStream' && e.owner === this)
      )
        return false;
      if (this.ki < cost) {
        combat.warnKi(this, cost);
        return false;
      }
      this.ki -= cost;
      const a = combat.finalizeMove({
        id: 'equipment',
        name: {
          ki: '气弹',
          psychic: '洞洞波',
          bullet: '手枪',
          helmet: '头盔光束',
          missile: '导弹',
          flame: '喷火',
        }[kind],
        motion: kind === 'ki' ? 'kamehameha' : 'capsuleCast',
        startup: 0.17,
        active: kind === 'flame' ? 0.01 : 0.08,
        recovery: kind === 'flame' ? 0 : 0.25,
        dmg: kind === 'missile' ? 9 : kind === 'flame' ? 12 : kind === 'psychic' ? 6 : 4,
        range: kind === 'flame' ? 2.5 : 8,
        ki: 0,
        kiCost: cost,
        stun: 0.2,
        kb: 1,
        shape: 'ability',
        ability: 'equipment',
        equipment: kind,
        authored: true,
      });
      a.anim = animation.authorYouthMove(this.def, a);
      return launch(this, a);
    };

    const draw = proto.render;
    proto.render = function (...args) {
      draw.apply(this, args);
      if (this.parts.tail && this.def.id === 'goku') {
        this.parts.tail.visible = this.youth.tailIntact;
        if (this.youth.form === 'ape') this.parts.tail.rotation.set(0, 0, 0);
      }
      if (this.parts.finger) this.parts.finger.visible = this.attack?.effector === 'finger';
      if (this.parts.bag) {
        const swinging = this.attack?.motion === 'bagSwing';
        this.parts.bag.visible = swinging;
        this.parts.gun.visible = !swinging;
      }
      if (this.attack?.authored) {
        this.root.rotation.set(0, this.facingAngle, 0);
        characters.applyPose(this.parts, combat.combatPose(this), 0, true);
        if (this.parts.staff && this.attack.effector === 'staff') {
          const length = staffReach(this.attack, this.stateTimer) / this.baseScale;
          this.parts.staff.rotation.set(0, 0, 0);
          this.parts.staff.scale.set(1, length / 2.5, 1);
          this.parts.staff.position.set(0, -length / 2, 0);
          this.parts.staff.visible = true;
        }
      }
      if (this.parts.extraArms) {
        const pose = combat.combatPose(this);
        for (const [i, arm] of this.parts.extraArms.entries()) {
          const side = i ? 'R' : 'L';
          arm.rotation.set(...pose['a' + side]);
          arm.rotation.x += 0.2 * Math.sin(this.stateTimer * 24 + i * Math.PI);
          arm.children
            .find((o) => o.name === 'elbow' + side)
            ?.rotation.set(pose['e' + side] ?? -0.7, 0, 0);
        }
      }
    };
    const mobility = combat.mobilitySpeed;
    combat.mobilitySpeed = (f) =>
      mobility(f) *
      (f.youth?.form === 'ape'
        ? 0.6
        : f.youth?.form === 'muscle'
          ? 1.3
          : f.youth?.form === 'armor'
            ? 0.7
            : f.youth?.form === 'bat'
              ? 1.3
              : f.youth?.capsule === 'hoverboard'
                ? 1.3
                : f.youth?.weakTime > 0
                  ? 0.7
                  : 1);
    const oldRig = combat.sampleCombatRig;
    combat.sampleCombatRig = function (f) {
      const r = oldRig(f),
        a = f.attack;
      if (a?.shape === 'ability') for (const hit of r.hit) hit.enabled = false;
      if (
        a?.authored &&
        a.shape !== 'beam' &&
        a.shape !== 'ground' &&
        a.shape !== 'ability' &&
        !a.isThrow
      ) {
        const p = r.parts;
        for (const h of r.hit) h.enabled = false;
        const effect = a.effector;
        const segment = (i, n1, n2, radius) => {
          p[n1].getWorldPosition(r.hit[i].a);
          p[n2].getWorldPosition(r.hit[i].b);
          r.hit[i].r = radius;
          r.hit[i].enabled = true;
        };
        const radius = f.anatomy?.handR ?? 0.1 * f.baseScale;
        if (effect === 'handR' || effect === 'handL') {
          const side = effect.endsWith('R') ? 'R' : 'L';
          segment(0, 'elbow' + side, 'hand' + side, radius + 0.035);
          if (a.motion === 'bagSwing') {
            p.handR.localToWorld(r.hit[0].a.set(-0.12, -0.27, 0.04));
            p.handR.localToWorld(r.hit[0].b.set(0.12, -0.27, 0.04));
            r.hit[0].r = 0.14;
          }
        }
        if (effect === 'elbowR') segment(0, 'armR', 'elbowR', radius + 0.045);
        if (effect === 'finger') {
          p.handR.localToWorld(r.hit[0].a.set(0, 0, 0));
          p.handR.localToWorld(r.hit[0].b.set(0, -0.35, 0));
          r.hit[0].r = 0.04 * f.baseScale;
          r.hit[0].enabled = true;
        }
        if (effect === 'both') {
          segment(0, 'elbowR', 'handR', radius + 0.035);
          segment(1, 'elbowL', 'handL', radius + 0.035);
        }
        if (effect === 'footR')
          segment(0, 'kneeR', 'footR', (f.anatomy?.legR ?? 0.13 * f.baseScale) + 0.04);
        if (effect === 'kneeR')
          segment(0, 'legR', 'kneeR', (f.anatomy?.legR ?? 0.14 * f.baseScale) + 0.04);
        if (effect === 'head') segment(0, 'head', 'head', f.anatomy?.headR ?? 0.3 * f.baseScale);
        if (effect === 'torso') {
          r.hit[0].a.copy(r.hurt[1].a);
          r.hit[0].b.copy(r.hurt[1].b);
          r.hit[0].r = r.hurt[1].r;
          r.hit[0].enabled = true;
        }
        if (effect === 'staff') {
          p.handR.localToWorld(r.hit[0].a.set(0, 0, 0));
          p.handR.localToWorld(r.hit[0].b.set(0, -staffReach(a, f.stateTimer) / f.baseScale, 0));
          r.hit[0].r = 0.09 * f.baseScale;
          r.hit[0].enabled = true;
        }
        if (effect === 'axe' || effect === 'cane') {
          const h = r.hit[0];
          h.enabled = true;
          if (effect === 'axe') {
            const weapon = f.parts.axe;
            weapon.rotation.z = Math.PI;
            weapon.updateMatrix();
            const handle = a.motion === 'axeJab';
            p.handR.localToWorld(
              h.a.set(handle ? 0 : -0.56, handle ? 0.05 : 1.1, 0).applyMatrix4(weapon.matrix),
            );
            p.handR.localToWorld(
              h.b.set(handle ? 0 : 0.56, handle ? -0.9 : 1.1, 0).applyMatrix4(weapon.matrix),
            );
            h.r = handle ? 0.16 : 0.13;
            if (!handle) {
              // The visible haft also strikes at close range, inside the blade's arc.
              const haft = r.hit[1];
              p.handR.localToWorld(haft.a.set(0, -0.695, 0).applyMatrix4(weapon.matrix));
              p.handR.localToWorld(haft.b.set(0, 2.055, 0).applyMatrix4(weapon.matrix));
              haft.r = 0.055 + 0.035;
              haft.enabled = true;
            }
          } else {
            p.handR.localToWorld(h.a.set(0, -0.7, 0.08));
            p.handR.localToWorld(h.b.set(0, 0.5, 0.08));
            h.r = 0.075;
          }
        }
      }
      if (a?.authored && a.shape === 'beam') {
        const hit = r.hit[0];
        r.parts.handR.getWorldPosition(hit.a);
        if (a.motion !== 'dodonpa') {
          const other = r.parts.handL.getWorldPosition(new THREE.Vector3());
          hit.a.add(other).multiplyScalar(0.5);
        }
        const direction = f.forward();
        direction.y =
          (a.targetY +
            (world.groundHeight?.(
              f.pos.x + direction.x * (a.targetDistance ?? a.range),
              f.pos.z + direction.z * (a.targetDistance ?? a.range),
            ) ?? 0) -
            hit.a.y) /
          Math.max(0.5, a.targetDistance ?? a.range);
        direction.normalize();
        hit.b.copy(hit.a).addScaledVector(direction, a.range);
        hit.r = a.width ?? 0.18;
        hit.enabled = true;
      }
      if (f.youth.form === 'ape') {
        const curve = f.parts.tail.geometry.parameters.path;
        for (let i = 0; i < 6; i++) {
          const tail = r.hurt[6 + i] ?? {
            a: new THREE.Vector3(),
            b: new THREE.Vector3(),
            r: 0.15,
            tag: 'tail',
          };
          r.root.localToWorld(
            tail.a.copy(curve.getPoint(i / 6)).multiplyScalar(f.youth.apeScale ?? 1),
          );
          r.root.localToWorld(
            tail.b.copy(curve.getPoint((i + 1) / 6)).multiplyScalar(f.youth.apeScale ?? 1),
          );
          tail.r = 0.15 * (f.youth.apeScale ?? 1);
          tail.enabled = true;
          r.hurt[6 + i] = tail;
        }
      } else for (const h of r.hurt) if (h.tag === 'tail') h.enabled = false;
      return r;
    };
    const intersects = combat.combatIntersects;
    combat.combatIntersects = function (f, foe, a) {
      if (a.contactDelay && f.stateTimer < a.hitT + a.contactDelay) return false;
      if (a.ability === 'counter') return false;
      if (a.shape === 'ground' && (f.pos.y > 0.3 || foe.pos.y > 0.35)) return false;
      if (
        a.shape === 'beam' &&
        combat.coverBlocks(
          f.pos.clone().add(new THREE.Vector3(0, 1, 0)),
          foe.pos.clone().add(new THREE.Vector3(0, 1, 0)),
        )
      )
        return false;
      const hit = intersects(f, foe, a);
      let tailHit = false;
      if (
        foe.youth.form === 'ape' &&
        foe.hp > 0 &&
        foe.invulnerable <= 0 &&
        a.shape !== 'ability' &&
        !a.isThrow
      ) {
        if (
          foe.combatRig.hurt.some(
            (tail) =>
              tail.tag === 'tail' &&
              tail.enabled &&
              f.combatRig.hit.some(
                (h) => h.enabled && combat.capsuleDistanceSq(h, tail) < (h.r + tail.r) ** 2,
              ),
          )
        ) {
          foe.youth.pendingTail = a.serial;
          tailHit = true;
        }
      }
      return hit || tailHit;
    };
    const take = proto.takeHit;
    proto.takeHit = function (attacker, a) {
      const v = this.youth,
        old = this.attack,
        oldTimer = this.stateTimer,
        hp = this.hp;
      if (this.hp <= 0 || this.invulnerable > 0) return;
      if (this.def.id === 'gyumao' && (a.fireDamage || a.equipment === 'flame')) return;
      if (
        this.def.id === 'tien' &&
        !a.throwResolved &&
        !a.counterResponse &&
        ai.combatRandom() < 0.03
      ) {
        this.evade(attacker, { free: true });
        this.lastHitText = '第三只眼 · 自动残像';
        attacker.hitResult = 'dodged';
        return;
      }
      if (
        attacker.def.id === 'taopaipai' &&
        attacker.pos.clone().sub(this.pos).dot(this.forward()) < -0.1
      )
        a = { ...a, dmg: a.dmg * 1.5 };
      if (
        this.def.id === 'chichi' &&
        a.equipment &&
        !a.isUlt &&
        ['ki', 'psychic'].includes(a.equipment)
      )
        a = { ...a, dmg: a.dmg * 0.5 };
      if (this.youth.capsule === 'mech') a = { ...a, dmg: a.dmg * 0.7 };
      const regenKi = this.ki;
      if (dodgeCounter(this, attacker, a)) return;
      if (combat.counterActive(this) && !a.isThrow && !a.counterResponse) {
        attacker.hitResult = 'countered';
        this.lastHitText = a.projectile || a.shape === 'beam' ? '远程反弹' : '防反';
        const palm = {
          ...this.def.skills[0],
          ability: undefined,
          name: '残像反掌·反击',
          dmg: 16,
          shape: undefined,
          startup: 0.05,
          active: 0.1,
          recovery: 0.4,
          effector: 'both',
        };
        palm.anim = animation.authorYouthMove(this.def, palm);
        launch(this, palm);
        combat.spawnAfterimage(this);
        if (a.projectile || a.shape === 'beam') {
          const origin = this.pos.clone().add(new THREE.Vector3(0, combat.stature(this) * 0.7, 0));
          const direction = attacker.pos
            .clone()
            .add(new THREE.Vector3(0, combat.stature(attacker) * 0.65, 0))
            .sub(origin)
            .normalize();
          combat.newProjectile(
            this,
            {
              ...a,
              ability: undefined,
              shape: undefined,
              control: 0,
              counterResponse: true,
              range: Math.max(8, a.range ?? 8),
            },
            'psychic',
            { pos: origin, direction, speed: 20, life: 0.8, radius: a.width ?? 0.12 },
          );
          combat.emitCombatEvent('reflection', this, attacker, a);
        } else {
          const protectedAttack = superArmorActive(attacker);
          if (!protectedAttack) attacker.attack = null;
          if (typeof attacker.takeHit === 'function') {
            attacker.takeHit(
              this,
              combat.finalizeMove({
                ...palm,
                counterResponse: true,
                serial: ++combat.combatEvents.serial,
                ki: 0,
                chainType: 'heavy',
                knockdown: false,
                launch: undefined,
                kb: 0,
              }),
            );
            if (attacker.hp > 0 && !protectedAttack)
              combat.launchKnockback(attacker, this, 'counter');
          } else {
            // Summon pounces use a source proxy rather than a Fighter instance.
            const minion = combat.youthEntities.find((e) => e.pos === attacker.pos);
            if (minion) {
              minion.hp -= palm.dmg * this.def.power;
              minion.launchVelocity = minion.pos
                .clone()
                .sub(this.pos)
                .setY(0)
                .normalize()
                .multiplyScalar(11.5);
              minion.jumpVel = 7;
              minion.pos.y = Math.max(0.04, minion.pos.y);
              minion.warning = 0;
              minion.attackTime = 1.5;
            }
          }
          combat.emitCombatEvent('counter', this, attacker, a);
        }
        return;
      }
      const armored =
        !a.isThrow &&
        !a.isUlt &&
        !a.projectile &&
        ((v.form === 'armor' && !v.armorSpent) ||
          (old?.limitedArmor &&
            !this.armorSpent &&
            this.stateTimer >= old.hitT * (old.limitedArmor === 'ordinary' ? 0.5 : 1) &&
            this.stateTimer < old.hitT + old.active &&
            (old.limitedArmor === 'ordinary' || a.chainType === 'light')));
      take.call(this, attacker, { ...a, armor: false });
      regenerate(this, regenKi, attacker, a);
      if (this.hp < hp && this.lastHitText !== '格挡' && this.lastHitText !== '完美格挡') {
        for (const e of combat.youthEntities)
          if (e.owner !== this && e.owner.v2.controlTarget === this)
            e.owner.v2.controlTarget = null;
        this.v2.controlTime = 0;
        v.retreat = null;
        v.floatTime = 0;
        if (this.v2.controlTarget) {
          const target = this.v2.controlTarget;
          target.v2.controlTime = 0;
          target.stunTime = target.youth.controlBaseRemaining;
          target.stateTimer = 0;
          this.v2.controlTarget = null;
        }
        if (armored && this.hp > 0 && !this.launchFlight) {
          this.attack = old;
          this.state = old?.isUlt ? 'ult' : old ? 'attack' : 'idle';
          this.stateTimer = oldTimer;
          this.armorSpent = true;
          v.armorSpent = true;
          this.lastHitText = '霸体承伤';
        }
        if (
          ['ogre', 'bat'].includes(v.form) ||
          (v.form?.startsWith('mimic:') &&
            !superArmorActive({ attack: old, hp: this.hp, stateTimer: oldTimer }))
        )
          combat.endYouthForm(this, false);
        if (v.pendingTail === a.serial && !v.tailSerials.has(a.serial)) {
          v.tailSerials.add(a.serial);
          v.tailHits++;
          if (v.tailHits >= 3) {
            v.tailIntact = false;
            combat.endYouthForm(this);
          }
        }
        if (attacker.youth && a.ability === 'wolf')
          attacker.youth.wolfUntil = match.game.simTime + 0.25;
        if (
          a.youthDodgeCounter &&
          !superArmorActive({ attack: old, hp: this.hp, stateTimer: oldTimer }) &&
          this.hp > 0 &&
          !['block', 'blockstun'].includes(this.state)
        )
          combat.launchKnockback(this, attacker, 'counter');
        if (
          a.control > 0 &&
          !this.launchFlight &&
          !superArmorActive({ attack: old, hp: this.hp, stateTimer: oldTimer })
        )
          combat.applyControl(attacker, this, { ...a, preserveHitstun: true });
      }
    };
    combat.applyControl = function (owner, foe, a) {
      if (
        foe.hp <= 0 ||
        superArmorActive(foe) ||
        foe.launchFlight ||
        foe.invulnerable > 0 ||
        ['block', 'blockstun'].includes(foe.state)
      )
        return false;
      const v = foe.youth;
      if (v.controlGrace > 0 && v.controlCount >= 3) return false;
      const duration = a.control * [1, 0.5, 0.25][Math.min(2, v.controlCount)];
      v.controlCount++;
      if (v.controlGrace <= 0) v.controlGrace = 4;
      const ordinaryHitstun =
        a.preserveHitstun && foe.state === 'hit' ? Math.max(0, foe.stunTime - foe.stateTimer) : 0;
      v.controlBaseRemaining = ordinaryHitstun;
      foe.v2.controlTime = duration;
      owner.v2.controlTarget = foe;
      foe.attack = null;
      foe.clearQueue();
      foe.state = 'hit';
      foe.stateTimer = 0;
      foe.stunTime = Math.max(duration, ordinaryHitstun);
      foe.vel.set(0, 0, 0);
      render.spawnBoundAura(foe, 0xd6a1ff, duration, null, true);
      combat.emitCombatEvent('control', owner, foe, a, { duration });
      return true;
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          skillAvailability: combat.skillAvailability,
          ultimateAvailability: combat.ultimateAvailability,
          applyControl: combat.applyControl,
          youthEntities: combat.youthEntities,
          setYouthBody: combat.setYouthBody,
          endYouthForm: combat.endYouthForm,
          releaseYouthAbility: combat.releaseYouthAbility,
          tickYouthFighter: combat.tickYouthFighter,
          inYouthSmoke: combat.inYouthSmoke,
          cleanupYouthEntities: combat.cleanupYouthEntities,
          getVictory: () => match.victory,
          skipVictory: () => match.skipVictory(),
          updateVictory: (dt) => match.updateVictory(dt),
          bgmState: () => audio?.bgmState,
          musicDiagnostics: () => audio.musicDiagnostics?.(),
          updateBGM: audio.updateBGM,
          playBGM: audio.playBGM,
        });
    });
    const dispose = proto.dispose;
    proto.dispose = function () {
      combat.cleanupYouthEntities(this);
      combat.setYouthBody(this, null);
      dispose.call(this);
    };
  };
}
