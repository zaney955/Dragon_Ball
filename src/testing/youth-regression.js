import * as THREE from 'three';
import { selectVictoryLine, RELATION_LINES, VICTORY_LINES } from '../match/victory.js';
export function register({ characters, combat, match, testing, ai, audio, render, world }) {
  const index = (id) => characters.CHARACTERS.findIndex((c) => c.id === id);
  function fixture(id = 'goku', foe = 'krillin', distance = 1) {
    Object.assign(match.game, {
      manualTest: true,
      muted: true,
      keepPair: false,
      difficulty: 'local',
      matchRule: 'competitive',
      selectedMap: 0,
      selectedChar: index(id),
      opponent: index(foe),
      ringOut: false,
      showBoxes: false,
    });
    match.startFight();
    match.game.ready = 0;
    const p = match.player,
      e = match.enemy;
    p.pos.set(0, 0, 0);
    e.pos.set(distance, 0, 0);
    p.previousPos.copy(p.pos);
    e.previousPos.copy(e.pos);
    p.facingAngle = Math.PI / 2;
    e.facingAngle = -Math.PI / 2;
    p.ki = e.ki = 100;
    return [p, e];
  }
  const ticks = (n) => {
    for (let i = 0; i < n; i++) {
      window.__db.tick();
      match.game.hitStop = 0;
    }
  };
  function report(fn) {
    const results = [],
      assert = (yes, message = '规则不成立') => {
        if (!yes) throw Error(message);
      },
      test = (name, body) => {
        try {
          body(assert);
          results.push({ name, pass: true });
        } catch (e) {
          results.push({ name, pass: false, error: e.stack });
        }
      };
    const saved = { ...match.game };
    try {
      fn(test);
    } finally {
      match.backToMenu();
      Object.assign(match.game, saved, { screen: 'menu', over: false });
    }
    return { results, failed: results.filter((r) => !r.pass).length };
  }
  testing.runYouthTests = () =>
    report((test) => {
      for (const c of characters.CHARACTERS)
        test(c.name + ' · 权威数据与形态', (assert) => {
          const [p] = fixture(c.id);
          assert(c.skills.length === 2);
          assert(c.ult.kiCost === 100);
          assert(c.combos.light.at(-1).terminal);
          assert(c.combos.heavy.at(-1).terminal);
          assert(c.combos.light.every((a) => a.authored));
          assert(c.directionMoves.length === 2);
          assert(c.throwMove.isThrow);
          assert(VICTORY_LINES[c.id]);
          assert(Object.keys(RELATION_LINES).some((k) => k.startsWith(c.id + ':')));
          const old = p.ki;
          p.startUlt();
          assert(p.ki === old - 100);
          assert(p.invulnerable === 0, '大招不得常驻无敌');
        });
      for (const c of characters.CHARACTERS)
        test(c.name + ' · 全部轻重连招段接触三种体型', (assert) => {
          for (const type of ['light', 'heavy'])
            for (let i = 0; i < c.combos[type].length; i++) {
              for (const target of ['goku', 'chiaotzu', 'gyumao']) {
                const [p, e] = fixture(
                  c.id,
                  target,
                  c.id === 'gyumao' ? (type === 'heavy' ? 2 : 0.85) : 1,
                );
                p.comboType = type;
                p.comboIdx = i - 1;
                p.comboTimer = i ? 1 : 0;
                p.hitResult = 'hit';
                assert(p.startAttack(type), c.id + '连招段无法发动');
                const name = p.attack.name;
                ticks(Math.ceil(p.attack.dur / match.STEP) + 2);
                assert(e.hp < e.maxHp, name + '没有实际击中' + target);
              }
            }
        });
      test('全方向大招只有当前时期招式', (assert) => {
        const [p] = fixture('krillin');
        for (const context of [{}, { down: true }, { up: true }]) {
          p.ki = 100;
          p.attack = null;
          p.state = 'idle';
          p.startUlt(context);
          assert(p.attack.shape === 'beam' && p.attack.motion === 'kamehameha');
        }
        assert(!combat.fireKiDisc);
      });
      test('大猩猩条件、资源和成功次数', (assert) => {
        const [p, e] = fixture();
        e.pos.x = 9;
        p.hp = p.maxHp * 0.25;
        match.game.lightPreset = 'day';
        assert(!combat.skillAvailability(p, 1).available);
        const ki = p.ki;
        assert(!p.startSpecial({ down: true }));
        assert(p.ki === ki && !p.attack);
        match.game.lightPreset = 'moon';
        p.hp = p.maxHp * 0.25001;
        assert(!combat.skillAvailability(p, 1).available);
        p.hp = p.maxHp * 0.25;
        p.ki = 49;
        assert(!p.startSpecial({ down: true }));
        p.ki = 100;
        const normal = p.root;
        assert(p.startSpecial({ down: true }));
        assert(p.ki === 50 && !p.youth.apeUsed);
        ticks(122);
        assert(p.youth.form === 'ape' && p.youth.apeUsed && p.root !== normal);
        assert(p.root.getObjectByName('ape-tail'));
        assert(!p.startKiBlast() && !p.startUlt());
        combat.endYouthForm(p);
        assert(p.root === normal && p.state === 'landing');
        p.state = 'idle';
        p.attack = null;
        p.ki = 100;
        assert(!p.startSpecial({ down: true }));
      });
      test('变身前摇被打断仍扣费且不消耗次数', (assert) => {
        const [p, e] = fixture();
        match.game.lightPreset = 'moon';
        p.hp = p.maxHp * 0.25;
        p.startSpecial({ down: true });
        p.takeHit(
          e,
          combat.finalizeMove({ id: 'l1', chainType: 'light', dmg: 4, stun: 0.2, kb: 0, ki: 0 }),
        );
        assert(p.ki < 60 && !p.youth.apeUsed && p.youth.form === null);
      });
      test('三次不同尾击解除；一次攻击不重复消耗尾部', (assert) => {
        const [p, e] = fixture();
        combat.setYouthBody(p, 'ape');
        p.youth.formTime = 10;
        for (let i = 0; i < 3; i++) {
          p.invulnerable = 0;
          p.state = 'idle';
          const a = combat.finalizeMove({
            serial: 1000 + i,
            id: 'l1',
            dmg: 1,
            stun: 0.01,
            kb: 0,
            ki: 0,
          });
          p.youth.pendingTail = a.serial;
          p.takeHit(e, a);
          if (i === 0) {
            p.invulnerable = 0;
            p.takeHit(e, a);
            assert(p.youth.tailHits === 1);
          }
        }
        assert(p.youth.form === null && !p.youth.tailIntact);
      });
      test('形态到时解除和每回合重置', (assert) => {
        const [p] = fixture();
        combat.setYouthBody(p, 'ape');
        p.youth.apeUsed = true;
        p.youth.formTime = 0.01;
        combat.tickYouthFighter(p, 0.02);
        assert(!p.youth.form && p.state === 'landing');
        match.startFight();
        assert(!match.player.youth.apeUsed && match.player.youth.tailIntact);
      });
      test('两项技能独立冷却和不足条件不扣费', (assert) => {
        const [p] = fixture('taopaipai');
        p.startSpecial();
        assert(p.youth.cooldowns[0] === 3 && p.youth.cooldowns[1] === 0 && p.ki === 70);
        p.attack = null;
        p.state = 'idle';
        p.startSpecial({ down: true });
        assert(p.ki === 40 && p.youth.cooldowns[1] === 4);
        p.attack = null;
        p.state = 'idle';
        const ki = p.ki;
        assert(!p.startSpecial());
        assert(p.ki === ki);
      });
      test('四妖拳可见四臂且不重复结算', (assert) => {
        const [p, e] = fixture('tien');
        e.pos.x = 9;
        p.startSpecial({ down: true });
        ticks(73);
        assert(p.youth.form === 'fourArms' && p.parts.extraArms.length === 2);
        p.attack = null;
        p.state = 'idle';
        p.startAttack('light');
        assert(Math.abs(p.attack.dmg - p.def.combos.light[0].dmg * 1.1) < 1e-8);
      });
      test('肌肉形态耗气及速度伤害', (assert) => {
        const [p, e] = fixture('roshi');
        e.pos.x = 9;
        p.startSpecial({ down: true });
        ticks(74);
        assert(p.youth.form === 'muscle');
        const before = p.ki;
        combat.tickYouthFighter(p, 1);
        assert(Math.abs(p.ki - before + 5) < 1e-8);
        p.attack = null;
        p.state = 'idle';
        p.startAttack('heavy');
        assert(Math.abs(p.attack.dmg - p.def.combos.heavy[0].dmg * 1.15) < 1e-8);
        p.ki = 0;
        combat.tickYouthFighter(p, 0.01);
        assert(!p.youth.form);
      });
      test('气功炮生命代价在发动时扣除', (assert) => {
        const [p] = fixture('tien');
        const hp = p.hp;
        p.startUlt();
        assert(Math.abs(p.hp - hp + p.maxHp * 0.06) < 1e-8);
        assert(p.ki === 0);
        p.attack = null;
        p.state = 'idle';
        p.ki = 100;
        p.hp = 1;
        p.startUlt();
        assert(p.hp === 1);
      });
      test('残像反掌精确窗口、投技可破', (assert) => {
        const [p, e] = fixture('roshi');
        p.startSpecial();
        p.stateTimer = 0.15;
        const hp = p.hp;
        p.takeHit(e, { ...e.def.combos.light[0], serial: 30 });
        assert(p.hp === hp && p.attack?.dmg === 16);
        p.attack = null;
        p.state = 'idle';
        p.ki = 100;
        p.youth.cooldowns[0] = 0;
        p.startSpecial();
        p.stateTimer = 0.15;
        p.takeHit(e, { ...e.def.throwMove, serial: 31 });
        assert(p.state === 'grabbed');
      });
      test('六次连续受击才击飞；落地破坏只结算一次', (assert) => {
        const [p, e] = fixture('goku', 'krillin', 1);
        for (let i = 0; i < 6; i++) {
          e.takeHit(p, combat.finalizeMove({ dmg: 1, kb: 0, stun: 0.4, ki: 0 }));
          assert(e.launchFlight === (i === 5), '保护必须恰好在第六次触发');
        }
        const start = e.pos.clone(),
          damageEvents = world.currentMap.damageEvents;
        p.attack = null;
        ticks(85);
        assert(!e.launchFlight && e.state === 'knockdown');
        const distance = e.pos.clone().setY(0).distanceTo(start.setY(0));
        assert(distance >= 4 && distance <= 6, '击飞水平距离不在4到6米之间：' + distance);
        assert(world.currentMap.damageEvents === damageEvents + 1);
        assert(world.currentMap.brokenTiles > 0);
        assert(render.effects.some((e) => e.type === 'dust'));
        ticks(60);
        assert(world.currentMap.damageEvents === damageEvents + 1 && e.state === 'idle');
      });
      test('十四人击飞姿态的可见头部与真实受击骨架一致', (assert) => {
        for (const c of characters.CHARACTERS) {
          const [p, e] = fixture('goku', c.id);
          combat.launchKnockback(e, p);
          ticks(20);
          e.render(1, 1);
          e.root.updateMatrixWorld(true);
          const head = e.parts.head.getWorldPosition(new THREE.Vector3());
          const rig = combat.sampleCombatRig(e);
          assert(
            head.distanceTo(rig.parts.head.getWorldPosition(new THREE.Vector3())) < 1e-6,
            c.id + '击飞姿态不一致',
          );
        }
      });
      test('E爆冲跟踪击飞敌人的水平和高度；不足资源不扣费', (assert) => {
        const [p, e] = fixture();
        combat.launchKnockback(e, p);
        ticks(25);
        p.ki = 11;
        const before = p.ki;
        assert(!p.pursue(e) && p.ki === before && p.state === 'idle');
        p.ki = 100;
        window.__db.tick({ actions: ['pursuit'] });
        assert(p.ki === 88 && p.dashKind === 'pursuit');
        for (let i = 0; i < 45 && p.dashTime > 0; i++) ticks(1);
        assert(p.pos.clone().setY(0).distanceTo(e.pos.clone().setY(0)) < 1.6);
        assert(Math.abs(p.pos.y - e.pos.y) < 0.65 && p.pos.y > 0);
        p.startAttack('light');
        const hp = e.hp;
        ticks(36);
        assert(e.hp < hp, '爆冲后轻击应实际接触空中目标');
      });
      test('末段命中可以E取消；打空和被防不能追击取消', (assert) => {
        const [p, e] = fixture('goku', 'krillin', 3);
        p.comboType = 'heavy';
        p.comboTimer = 1;
        p.comboIdx = p.def.combos.heavy.length - 2;
        p.startAttack('heavy');
        p.hitResult = 'hit';
        p.stateTimer = p.attack.hitT + 0.05;
        combat.launchKnockback(e, p);
        window.__db.tick({ actions: ['pursuit'] });
        assert(p.dashKind === 'pursuit' && !p.attack && p.ki === 88);
        for (const c of characters.CHARACTERS)
          for (const type of ['light', 'heavy']) {
            const a = c.combos[type].at(-1);
            assert(a.cancelRules.hit.includes('pursuit'));
            assert(
              !a.cancelRules.whiff.includes('pursuit') && !a.cancelRules.block.includes('pursuit'),
            );
          }
      });
      test('饺子R实际接触控制1.15秒；受击解除且不可控制击飞保护', (assert) => {
        const [p, e] = fixture('chiaotzu', 'goku', 3.5);
        p.startSpecial();
        ticks(31);
        assert(e.v2.controlTime > 1 && e.v2.controlTime <= 1.15);
        assert(p.v2.controlTarget === e && render.effects.some((e) => e.control));
        p.invulnerable = 0;
        p.takeHit(e, { ...e.def.combos.light[0], serial: 901 });
        assert(e.v2.controlTime === 0 && !p.v2.controlTarget);
        combat.launchKnockback(e, p);
        e.invulnerable = 0;
        assert(!combat.applyControl(p, e, p.def.skills[0]));
      });
      test('龟仙人0.36秒防反窗口：边界、近战直接击飞、过期受伤', (assert) => {
        for (const time of [0.1, 0.45, 0.46]) {
          const [p, e] = fixture('roshi');
          p.startSpecial();
          p.stateTimer = time;
          const hp = p.hp;
          p.takeHit(e, { ...e.def.combos.heavy[0], serial: 902 });
          assert(p.hp === hp && e.launchFlight && e.hp < e.maxHp);
        }
        for (const time of [0.099, 0.461]) {
          const [p, e] = fixture('roshi');
          p.startSpecial();
          p.stateTimer = time;
          const hp = p.hp;
          p.takeHit(e, { ...e.def.combos.light[0], serial: 903 });
          assert(p.hp < hp && !e.launchFlight);
        }
      });
      test('龟仙人防反召唤物扑击，不误伤施术者或崩溃', (assert) => {
        const [p, e] = fixture('roshi', 'piccolo', 3);
        combat.releaseYouthAbility(e, e.def.skills[0]);
        const minion = combat.youthEntities.find((e) => e.kind === 'demon');
        minion.pos.set(0.8, 0, 0);
        minion.attackTime = 0;
        minion.warning = 0.295;
        const hp = p.hp,
          ownerHp = e.hp;
        p.startSpecial();
        p.stateTimer = 0.2;
        combat.updateYouthEntities(0.01);
        assert(p.hp === hp && e.hp === ownerHp && minion.launchVelocity && minion.hp < 24);
      });
      test('龟仙人反弹真实投射物且回击原发射者', (assert) => {
        const [p, e] = fixture('roshi', 'goku', 3);
        p.startSpecial();
        p.stateTimer = 0.3;
        const hp = p.hp;
        const b = combat.newProjectile(
          e,
          { ...e.def.skills[0], projectile: true, range: 8, dmg: 8 },
          'ki',
          {
            pos: new THREE.Vector3(0.2, 1.25, 0),
            direction: new THREE.Vector3(-1, 0, 0),
            speed: 18,
            life: 1,
          },
        );
        combat.updateV2Abilities(match.STEP);
        assert(b.owner === p && p.hp === hp && b.direction.x > 0 && !b.hits.has(p));
        ticks(35);
        assert(e.hp < e.maxHp && p.hp === hp);
      });
      test('龟仙人反弹远程光束；防反不额外扣元气', (assert) => {
        const [p, e] = fixture('roshi', 'taopaipai', 3);
        p.startSpecial();
        p.stateTimer = 0.4;
        const hp = p.hp,
          ki = p.ki;
        p.takeHit(e, { ...e.def.skills[0], serial: 904 });
        assert(p.hp === hp && p.ki === ki && combat.v2Projectiles.length === 1);
        ticks(40);
        assert(e.hp < e.maxHp);
      });
      test('天津饭双技能可见特效及气功炮方形发射口', (assert) => {
        const [p] = fixture('tien');
        p.startSpecial();
        assert(render.effects.filter((e) => e.type === 'solarRay').length === 12);
        p.attack = null;
        p.state = 'idle';
        p.ki = 100;
        p.startSpecial({ down: true });
        assert(render.effects.some((e) => e.type === 'boundAura' && e.owner === p));
        p.attack = null;
        p.state = 'idle';
        p.ki = 100;
        p.startUlt();
        const visual = render.ultimateVisuals.find((v) => v.f === p);
        assert(visual && visual.inner.geometry.parameters.radialSegments === 4);
        assert(visual.rig.getObjectByName('kikoho-square-aperture'));
      });
      test('独立轻重模板、桃白白可见手指和牛魔王斧落地', (assert) => {
        for (const type of ['light', 'heavy']) {
          const signatures = characters.CHARACTERS.map((c) =>
            JSON.stringify(c.combos[type][0].anim),
          );
          assert(new Set(signatures).size === 14);
        }
        const [p] = fixture('taopaipai');
        p.startAttack('light');
        p.stateTimer = p.attack.hitT;
        p.render(1, 1);
        assert(p.parts.finger.visible && p.attack.effector === 'finger');
        p.root.updateMatrixWorld(true);
        const tip = p.parts.finger.localToWorld(new THREE.Vector3(0, -0.152, 0));
        const hit = combat.sampleCombatRig(p).hit[0];
        assert(tip.distanceTo(hit.b) < 0.01);
        const [ox] = fixture('gyumao');
        ox.comboType = 'heavy';
        ox.comboTimer = 1;
        ox.comboIdx = ox.def.combos.heavy.length - 2;
        ox.startAttack('heavy');
        const damage = world.currentMap.damageEvents;
        ticks(Math.ceil(ox.attack.hitT / match.STEP) + 1);
        assert(world.currentMap.damageEvents > damage && world.currentMap.scars.length > 0);
      });
      test('装甲承伤一次而投技绕过', (assert) => {
        const [p, e] = fixture('pilaf');
        p.youth.form = 'armor';
        p.youth.formTime = 3;
        const hp = p.hp;
        p.takeHit(e, { ...e.def.combos.heavy[0], serial: 31 });
        assert(p.hp < hp && p.youth.armorSpent && p.state === 'idle');
        p.invulnerable = 0;
        p.takeHit(e, { ...e.def.combos.heavy[0], serial: 32 });
        assert(p.state === 'hit');
      });
      test('仙豆中断和成功食用次数', (assert) => {
        let [p, e] = fixture('korin');
        p.hp = p.maxHp * 0.5;
        p.startSpecial({ down: true });
        p.takeHit(e, { ...e.def.combos.light[0], serial: 55 });
        assert(p.youth.heals === 1 && p.youth.form === null);
        [p, e] = fixture('korin');
        e.pos.x = 9;
        p.hp = p.maxHp * 0.5;
        const hp = p.hp;
        p.startSpecial({ down: true });
        ticks(116);
        assert(p.youth.heals === 0 && Math.abs(p.hp - hp - p.maxHp * 0.12) < 1e-7);
      });
      test('控制100/50/25及四秒保护', (assert) => {
        const [p, e] = fixture('chiaotzu');
        for (const value of [0.45, 0.225, 0.1125]) {
          e.invulnerable = 0;
          e.state = 'idle';
          assert(combat.applyControl(p, e, { ...p.def.skills[0], control: 0.45 }));
          assert(Math.abs(e.stunTime - value) < 1e-8);
        }
        e.state = 'idle';
        assert(!combat.applyControl(p, e, { control: 0.45 }));
        combat.tickYouthFighter(e, 4.1);
        assert(combat.applyControl(p, e, { control: 0.45 }));
      });
      test('掩体数量、寿命、对双方阻挡', (assert) => {
        const [p] = fixture('bulma');
        const a = p.def.skills[0];
        combat.releaseYouthAbility(p, a);
        assert(combat.youthEntities.filter((e) => e.kind === 'cover').length === 1);
        const info = combat.skillAvailability(p);
        assert(!info.available);
        const from = new THREE.Vector3(0, 1, 0),
          to = new THREE.Vector3(4, 1, 0);
        assert(combat.coverBlocks(from, to) && combat.coverBlocks(to, from));
        combat.updateYouthEntities(8.1);
        assert(combat.youthEntities.length === 0);
      });
      test('吐卵可击败且最多一名手下', (assert) => {
        const [p] = fixture('piccolo');
        combat.releaseYouthAbility(p, p.def.skills[0]);
        const demons = combat.youthEntities.filter((e) => e.kind === 'demon');
        assert(demons.length === 1 && demons[0].hp === 24);
        assert(!combat.skillAvailability(p).available);
        p.state = 'knockdown';
        combat.updateYouthEntities(0.01);
        assert(!combat.youthEntities.some((e) => e.kind === 'demon'));
      });
      test('烟幕不读取对手实时观察', (assert) => {
        const [p, e] = fixture('bulma', 'goku', 1.5);
        match.game.difficulty = 'normal';
        e.isAI = true;
        e.brainTime = 1;
        e.observations = [{ time: 0, x: 1, z: 0, y: 0, scale: 1, state: 'idle', attack: null }];
        e.observeTimer = 0;
        combat.releaseYouthAbility(p, p.def.skills[1]);
        const n = e.observations.length;
        ai.aiThink(e, p, 0.1);
        assert(e.observations.length === n);
      });
      test('乌龙两种变化、承伤解除和禁用机器人', (assert) => {
        const [p, e] = fixture('oolong');
        const hp = p.hp;
        combat.releaseYouthAbility(p, p.def.skills[0]);
        assert(p.youth.form === 'ogre' && p.hp === hp);
        p.invulnerable = 0;
        p.takeHit(e, { ...e.def.combos.light[0], serial: 63 });
        assert(!p.youth.form);
        combat.releaseYouthAbility(p, p.def.skills[1]);
        assert(p.youth.form === 'bat');
        assert(!p.startAttack('light') && !p.startThrow() && !p.startKiBlast() && !p.startUlt());
      });
      test('飞刃只存在一枚并在返回菜单清理', (assert) => {
        const [p] = fixture('chichi');
        combat.releaseYouthAbility(p, p.def.skills[0]);
        assert(combat.v2Projectiles.filter((b) => b.kind === 'blade').length === 1);
        assert(!combat.skillAvailability(p).available);
        match.backToMenu();
        assert(!combat.v2Projectiles.length && !combat.youthEntities.length);
      });
      test('合体轮廓、两枚导弹和冲撞方向', (assert) => {
        const [p] = fixture('pilaf');
        combat.releaseYouthAbility(p, p.def.ult);
        assert(p.youth.form === 'combined' && p.parts.combinedMechs.length === 2);
        assert(combat.v2Projectiles.length === 2);
        const directions = combat.v2Projectiles.map((b) => b.direction.clone());
        p.facingAngle = 0;
        assert(directions.every((d, i) => d.equals(combat.v2Projectiles[i].direction)));
      });
      test('胜利形态快照、关系和重复跳过', (assert) => {
        const [p, e] = fixture();
        match.game.wins = [1, 0];
        combat.setYouthBody(p, 'ape');
        e.hp = 0;
        match.endGame();
        const v = match.victory;
        assert(v.snapshots[0].form === 'ape' && v.line === '咦？刚才发生什么事了？');
        const wins = match.game.wins[0];
        match.skipVictory();
        match.skipVictory();
        match.endGame();
        assert(match.game.wins[0] === wins);
        assert(match.victory.time === 4.5);
      });
      test('平局不挑选胜者', (assert) => {
        const [p, e] = fixture();
        p.hp = e.hp = 0;
        match.game.wins = [0, 0];
        match.endGame();
        assert(
          match.victory.winner === 'draw' &&
            match.victory.bodies.length === 2 &&
            match.victory.line === '不分胜负',
        );
        assert(match.game.wins.every((n) => n === 0));
      });
      test('禁止本时期不适用的持续飞行', (assert) => {
        for (const id of [
          'roshi',
          'taopaipai',
          'krillin',
          'yamcha',
          'gyumao',
          'chichi',
          'bulma',
          'oolong',
          'korin',
          'pilaf',
        ]) {
          const [p] = fixture(id);
          assert(!combat.flightPhysics(p, 0.1, { flight: true }));
        }
      });
      test('姿势插值保留膝肘且待机不会累积扭转', (assert) => {
        const [p] = fixture('oolong');
        const original = combat.neutralCombatPose(p).t.slice();
        for (let n = 0; n < 500; n++) combat.neutralCombatPose(p);
        assert(combat.neutralCombatPose(p).t.every((v, i) => v === original[i]));
        for (const c of characters.CHARACTERS) {
          const [f] = fixture(c.id);
          f.startAttack('heavy');
          f.stateTimer = f.attack.hitT * 0.9;
          const r = combat.sampleCombatRig(f);
          assert(
            r.hurt.every((h) => [...h.a.toArray(), ...h.b.toArray()].every(Number.isFinite)),
            c.id + ' 的骨架含非有限坐标',
          );
        }
      });
      test('如意棒可见网格和命中轨迹一致', (assert) => {
        const [p] = fixture('goku');
        p.startSpecial();
        p.stateTimer = p.attack.hitT;
        p.render(1, 1);
        p.root.updateMatrixWorld(true);
        const r = combat.sampleCombatRig(p);
        const tip = p.parts.staff.localToWorld(new THREE.Vector3(0, -1.25, 0));
        const grip = p.parts.staff.localToWorld(new THREE.Vector3(0, 1.25, 0));
        assert(tip.distanceTo(r.hit[0].b) < 1e-6 && grip.distanceTo(r.hit[0].a) < 1e-6);
      });
      test('尾部真实碰撞可独立命中且只结算一次', (assert) => {
        const [p, e] = fixture('taopaipai', 'goku', 1);
        combat.setYouthBody(e, 'ape');
        e.youth.formTime = 10;
        e.facingAngle = Math.PI / 2;
        e.hp = e.maxHp;
        e.startAttack('heavy');
        const tail = combat.sampleCombatRig(e).hurt.at(-1);
        const center = tail.a.clone().add(tail.b).multiplyScalar(0.5);
        p.pos.copy(center).add(new THREE.Vector3(-0.8, -center.y, 0));
        p.previousPos.copy(p.pos);
        p.facingAngle = Math.PI / 2;
        p.startAttack('light');
        ticks(60);
        assert(e.youth.tailHits === 1, '尾部未真实命中');
        assert(e.hp < e.maxHp);
        assert(e.youth.tailSerials.size === 1);
      });
      test('暂停冻结形态、独立冷却和手下生命期', (assert) => {
        const [p] = fixture('piccolo');
        p.startSpecial();
        ticks(100);
        const demon = combat.youthEntities.find((e) => e.kind === 'demon');
        const life = demon.life,
          cooldown = p.youth.cooldowns[0];
        match.setPaused(true);
        combat.advanceCombat(
          0.1,
          () => ({}),
          () => ({}),
        );
        assert(demon.life === life && p.youth.cooldowns[0] === cooldown);
        match.setPaused(false);
      });
      test('音乐八首本地资源、单循环状态接口', (assert) => {
        assert(audio.bgmVolume >= 0 && audio.bgmVolume <= 1);
        assert(audio.sfxVolume >= 0 && audio.sfxVolume <= 1);
        assert(audio.bgmState.looping <= 1);
      });
    });
  testing.runYouthMatrix = (row = 0) =>
    report((test) => {
      const c = characters.CHARACTERS[row];
      for (const target of characters.CHARACTERS) {
        for (const type of ['light', 'heavy'])
          test(c.id + ' → ' + target.id + ' ' + type, (assert) => {
            const [p, e] = fixture(
              c.id,
              target.id,
              c.id === 'gyumao' ? (type === 'heavy' ? 2 : 0.85) : 1,
            );
            p.startAttack(type);
            let contacted = false;
            const count = Math.ceil(p.attack.dur / match.STEP) + 2;
            for (let i = 0; i < count; i++) {
              ticks(1);
              contacted ||= e.hp < e.maxHp;
            }
            assert(Number.isFinite(p.hp) && Number.isFinite(e.hp));
            assert(!p.attack, '必须完整收招');
            assert(e.hp >= 0);
            assert(contacted, '可见攻击在交战距离应命中');
          });
        test(c.id + ' → ' + target.id + ' 投技', (assert) => {
          const [p, e] = fixture(c.id, target.id, 0.8);
          p.startThrow();
          ticks(100);
          assert(e.hp < e.maxHp);
        });
        test(c.id + ' → ' + target.id + ' 挑空', (assert) => {
          const [p, e] = fixture(c.id, target.id, 0.7);
          p.startAttack('heavy', { up: true });
          ticks(Math.ceil(p.attack.dur / match.STEP) + 2);
          assert(e.hp < e.maxHp, '挑空须由可见关节或武器真实接触');
        });
        test(c.id + ' → ' + target.id + ' 主技能发动', (assert) => {
          const [p] = fixture(c.id, target.id, 3);
          const otherCooldown = p.youth.cooldowns[1];
          assert(p.startSpecial());
          const a = p.attack;
          assert(p.ki === 100 - c.skills[0].kiCost);
          assert(p.youth.cooldowns[1] === otherCooldown);
          ticks(Math.ceil(a.hitT / match.STEP) + 1);
          assert(a.v2Released, '前摇完成后应实际发动');
          assert(Number.isFinite(p.hp) && Number.isFinite(p.pos.y));
        });
        test(c.id + ' → ' + target.id + ' 格挡', (assert) => {
          const [p, e] = fixture(c.id, target.id, c.id === 'gyumao' ? 2 : 1);
          e.state = 'block';
          e.blockHeldTime = 1;
          p.startAttack('light');
          for (let i = 0; i < 100; i++) {
            window.__db.tick({}, { block: true, crouch: p.def.combos.light[0].level === 'low' });
            match.game.hitStop = 0;
          }
          assert(e.hp >= e.maxHp - 2, '格挡仅承受削血');
        });
        test(c.id + ' → ' + target.id + ' 资源拒绝', (assert) => {
          const [p] = fixture(c.id, target.id);
          p.ki = 0;
          assert(!p.startSpecial() && !p.startSpecial({ down: true }) && !p.startUlt());
          assert(p.ki === 0 && !p.attack);
        });
        test(c.id + ' → ' + target.id + ' 末段取消与打空', (assert) => {
          const [p] = fixture(c.id, target.id, 12);
          p.startAttack('light');
          const a = p.attack;
          assert(!a.cancelRules.whiff.length);
          assert(!c.combos.light.at(-1).cancelRules.hit.includes('heavy'));
          ticks(100);
          assert(p.hitResult !== 'hit');
        });
      }
    });
  return function initialize() {
    queueMicrotask(() =>
      Object.assign(window.__db, {
        runYouthTests: testing.runYouthTests,
        runYouthMatrix: testing.runYouthMatrix,
        fixtureYouth: fixture,
        selectVictoryLine,
      }),
    );
  };
}
