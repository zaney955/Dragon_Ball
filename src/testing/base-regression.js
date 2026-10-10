import * as THREE from 'three';
export function register({
  ai: aiModule,
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  testing: testingModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  let COLLISION_EXPECTATIONS;
  testingModule.runCollisionMatrix = function runCollisionMatrix() {
    const db = window.__db,
      g = db.game,
      saved = {
        ...g,
        manualTest: g.manualTest,
      },
      rows = [];
    g.manualTest = true;
    g.muted = true;
    g.difficulty = 'local';
    g.keepPair = false;
    g.selectedMap = 0;
    g.showBoxes = false;
    const snapshot = (f) => {
      const o = {};
      for (const [k, v] of Object.entries(f))
        if (v?.isVector3) o[k] = v.clone();
        else if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) o[k] = v;
      return o;
    };
    const reset = (f, o) => {
      for (const k of Object.keys(f))
        if (
          !(k in o) &&
          !['def', 'root', 'parts', 'materials', 'shadow', 'nimbus', 'combatRig'].includes(k)
        )
          delete f[k];
      for (const [k, v] of Object.entries(o))
        if (v?.isVector3) f[k].copy(v);
        else f[k] = v;
      f.queue = [];
      if (f.combatRig) f.combatRig.lastAttack = null;
    };
    try {
      for (let c = 0; c < 7; c++)
        for (let target = 0; target < 7; target++) {
          g.selectedChar = c;
          g.opponent = target;
          g.keepPair = false;
          db.startFight();
          g.ready = 0;
          const p = db.player,
            e = db.enemy,
            orig = [snapshot(p), snapshot(e)];
          for (const type of ['light', 'heavy', 'special'])
            for (const pose of ['stand', 'crouch', 'air', 'highAir'])
              for (const distance of [0.55, 0.9, 1.4, 1.8, 2.4, 4]) {
                reset(p, orig[0]);
                reset(e, orig[1]);
                g.hitStop = 0;
                g.over = false;
                g.simTime = 0;
                p.pos.set(0, 0, 0);
                e.pos.set(distance, pose === 'air' ? 1.2 : pose === 'highAir' ? 8 : 0, 0);
                p.previousPos.copy(p.pos);
                e.previousPos.copy(e.pos);
                p.facingAngle = Math.PI / 2;
                e.facingAngle = -Math.PI / 2;
                if (type === 'special') p.startSpecial();
                else p.startAttack(type);
                const a = p.attack;
                // A ballistic target returns to its starting altitude at active-frame start.
                // Both rise and descent are simulated; no rig coordinates are substituted.
                if (pose === 'air' || pose === 'highAir') e.jumpVel = 11 * (a.startup + db.STEP);
                const ticks = Math.ceil(a.dur / db.STEP) + 1;
                let contacts = 0,
                  lastHP = e.hp;
                for (let i = 0; i < ticks; i++) {
                  db.tick(
                    {},
                    {
                      crouch: pose === 'crouch',
                    },
                  );
                  g.hitStop = 0;
                  if (e.hp < lastHP) contacts++;
                  lastHP = e.hp;
                }
                let expected = null,
                  reason = '边界/高度采样：记录实际接触，另用安全契约断言';
                if (distance === 4 || pose === 'highAir') {
                  expected = false;
                  reason = '射程外或远离攻击高度';
                } else if (pose === 'crouch' && a.level === 'high') {
                  expected = false;
                  reason = '高段必须被蹲姿避开';
                } else if (
                  pose === 'stand' &&
                  distance <= 0.9 &&
                  !(type === 'special' && c === 4)
                ) {
                  expected = true;
                  reason = '非反空首招的明确近身接触区';
                } else if (type === 'special' && c === 4 && pose === 'air' && distance <= 0.9) {
                  expected = true;
                  reason = '挑掌明确反空接触区';
                } else if (
                  type === 'special' &&
                  c === 4 &&
                  pose === 'stand' &&
                  [0, 5].includes(target)
                ) {
                  expected = false;
                  reason = '反空挑掌允许越过地面少年头顶';
                }
                const fixture = COLLISION_EXPECTATIONS[c * 7 + target][rows.length % 90] === '1',
                  contract = expected;
                expected = expected ?? fixture;
                if (contract === null) reason = '已审阅骨架接触边界fixture（固定预期）';
                const damage = e.maxHp - e.hp,
                  pass =
                    damage > 0 === expected &&
                    (contract === null || fixture === contract) &&
                    contacts <= (a.hits?.length ?? 1);
                rows.push({
                  attacker: p.def.id,
                  target: e.def.id,
                  type,
                  pose,
                  distance,
                  direction: 'front',
                  expected,
                  reason,
                  damage,
                  contacts,
                  pass,
                });
              }
          for (const type of ['light', 'heavy', 'special'])
            for (const direction of ['side', 'back'])
              for (const pose of ['stand', 'crouch', 'air']) {
                reset(p, orig[0]);
                reset(e, orig[1]);
                g.hitStop = 0;
                g.over = false;
                p.pos.set(0, 0, 0);
                e.pos.set(0.9, pose === 'air' ? 1.2 : 0, 0);
                p.previousPos.copy(p.pos);
                e.previousPos.copy(e.pos);
                p.facingAngle = Math.PI / 2;
                e.facingAngle = -Math.PI / 2;
                if (type === 'special') p.startSpecial();
                else p.startAttack(type);
                const a = p.attack;
                if (pose === 'air') e.jumpVel = 11 * (a.startup + db.STEP);
                let relocated = false;
                for (let i = 0; i < Math.ceil(a.dur / db.STEP) + 1; i++) {
                  if (!relocated && p.stateTimer >= a.hitT * 0.65) {
                    e.pos.x = p.pos.x + (direction === 'back' ? -1 : 0);
                    e.pos.z = p.pos.z + (direction === 'side' ? 2.4 : 0);
                    e.previousPos.copy(e.pos);
                    relocated = true;
                  }
                  db.tick(
                    {},
                    {
                      crouch: pose === 'crouch',
                    },
                  );
                  g.hitStop = 0;
                }
                rows.push({
                  attacker: p.def.id,
                  target: e.def.id,
                  type,
                  pose,
                  direction,
                  distance: direction === 'side' ? 2.4 : 1,
                  expected: false,
                  reason: '转向承诺后侧闪/绕背，应空挥',
                  damage: e.maxHp - e.hp,
                  pass: e.hp === e.maxHp,
                });
              }
        }
    } finally {
      db.backToMenu();
      Object.assign(g, saved);
      g.screen = 'menu';
      g.ready = 0;
      g.over = false;
      g.paused = false;
      db.updateSelection();
    }
    const safety = rows.filter((x) => x.expected !== null),
      near = {};
    for (const type of ['light', 'heavy', 'special']) {
      const list = rows.filter(
        (x) =>
          x.type === type && x.pose === 'stand' && x.direction === 'front' && x.distance === 0.9,
      );
      near[type] = {
        hits: list.filter((x) => x.damage > 0).length,
        total: 49,
      };
    }
    return {
      total: rows.length,
      asserted: safety.length,
      passed: rows.filter((x) => x.pass).length,
      failed: rows.filter((x) => !x.pass).length,
      near,
      rows,
    };
  };
  testingModule.runCombatTests = function runCombatTests(group = 'all') {
    const results = [],
      saved = {
        difficulty: matchModule.game.difficulty,
        selectedChar: matchModule.game.selectedChar,
        selectedMap: matchModule.game.selectedMap,
        opponent: matchModule.game.opponent,
        muted: matchModule.game.muted,
        manualTest: matchModule.game.manualTest,
        matchRule: matchModule.game.matchRule,
      };
    matchModule.game.manualTest = true;
    matchModule.game.muted = true;
    matchModule.game.matchRule = 'senzu';
    trainingModule.drillSystem.current = null;
    const assert = (b, msg = '条件不成立') => {
      if (!b) throw Error(msg);
    };
    function fresh(char = 0, foe = 0) {
      matchModule.game.keepPair = false;
      matchModule.game.difficulty = 'local';
      matchModule.game.selectedChar = char;
      matchModule.game.opponent = foe;
      matchModule.game.selectedMap = 0;
      matchModule.game.wins = [0, 0];
      matchModule.game.ringOut = false;
      matchModule.startFight();
      matchModule.game.ready = 0;
      matchModule.game.paused = false;
      matchModule.player.pos.set(0, 0, 0);
      matchModule.enemy.pos.set(0.8, 0, 0);
      matchModule.player.previousPos.copy(matchModule.player.pos);
      matchModule.enemy.previousPos.copy(matchModule.enemy.pos);
      matchModule.player.facingAngle = Math.PI / 2;
      matchModule.enemy.facingAngle = -Math.PI / 2;
      matchModule.player.vel.set(0, 0, 0);
      matchModule.enemy.vel.set(0, 0, 0);
      return [matchModule.player, matchModule.enemy];
    }
    function step(n, input = {}, other = {}) {
      for (let i = 0; i < n; i++) {
        matchModule.pendingHits = [];
        matchModule.player.update(
          matchModule.STEP,
          matchModule.enemy,
          i === 0
            ? input
            : {
                ...input,
                actions: [],
                light: false,
                heavy: false,
                special: false,
                ult: false,
                throw: false,
                evasion: false,
                pursuit: false,
                dash: false,
                jump: false,
              },
        );
        matchModule.enemy.update(
          matchModule.STEP,
          matchModule.player,
          i === 0
            ? other
            : {
                ...other,
                actions: [],
                light: false,
                heavy: false,
                throw: false,
              },
        );
        combatModule.resolveOverlap();
        combatModule.collectCombatHits();
        for (const h of matchModule.pendingHits) h.foe.takeHit(h.attacker, h.attack);
        combatModule.updateKiBlasts(matchModule.STEP);
        combatModule.updateV2Abilities(matchModule.STEP);
        matchModule.game.hitStop = 0;
        matchModule.game.simTime += matchModule.STEP;
      }
    }
    function test(stage, name, fn) {
      if (group !== 'all' && group !== 'legacy' && group !== stage) return;
      try {
        fn();
        results.push({
          stage,
          name,
          pass: true,
        });
      } catch (e) {
        results.push({
          stage,
          name,
          pass: false,
          error: String(e.message),
        });
      }
    }
    function hit(a = {}, state = 'idle', crouch = false) {
      const [p, e] = fresh();
      e.state = state;
      e.crouching = crouch;
      e.guardHeld = 0.4;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          id: 'test',
          dmg: 10,
          kb: 1,
          stun: 0.4,
          level: 'mid',
          hitT: 0.1,
          active: 0.05,
          dur: 0.5,
          guardDamage: 25,
          ...a,
        }),
      );
      return [p, e];
    }
    test('P0', '前摇、有效帧、后摇独立数据', () => {
      fresh();
      for (const c of charactersModule.CHARACTERS)
        for (const a of [...c.combos.light, ...c.combos.heavy]) {
          assert(a.startup > 0 && a.active > 0 && a.recovery > 0);
          assert(Math.abs(a.dur - a.startup - a.active - a.recovery) < 1e-8);
          for (const k of [
            'damage',
            'hitstun',
            'blockstun',
            'range',
            'hitLevel',
            'knockback',
            'cancelRules',
            'kiCost',
          ])
            assert(k in a, k);
        }
    });
    test('P0', '三代表角色首招与霸体差异', () => {
      assert(
        charactersModule.CHARACTERS[2].combos.light[0].startup <
          charactersModule.CHARACTERS[0].combos.light[0].startup,
      );
      assert(
        charactersModule.CHARACTERS[3].combos.light[0].startup >
          charactersModule.CHARACTERS[0].combos.light[0].startup,
      );
      assert(!charactersModule.CHARACTERS[3].combos.heavy[2].armor);
      assert(charactersModule.CHARACTERS[3].skills[1].limitedArmor === 'light');
    });
    test('P0', '前摇不可命中', () => {
      const [p, e] = fresh();
      p.startAttack('light');
      step(3);
      assert(e.hp === e.maxHp);
    });
    test('P0', '近身动作接触能命中且单招只命中一次', () => {
      const [p, e] = fresh();
      p.startAttack('light');
      step(18);
      const hp = e.hp;
      assert(hp < e.maxHp);
      step(30);
      assert(e.hp === hp);
    });
    test('P0', '远距离空挥', () => {
      const [p, e] = fresh();
      e.pos.x = 4;
      p.startAttack('light');
      step(45);
      assert(e.hp === e.maxHp);
    });
    test('P0', '攻击背后目标不异常命中', () => {
      const [p, e] = fresh();
      e.pos.x = -0.8;
      p.startAttack('light');
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack));
    });
    test('P0', '侧面目标不异常命中', () => {
      const [p, e] = fresh();
      e.pos.set(0, 0, 1.8);
      p.startAttack('light');
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack));
    });
    test('P0', '高度差不异常命中', () => {
      const [p, e] = fresh();
      e.pos.y = 4;
      p.startAttack('light');
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack));
    });
    test('P0', '高段被低姿态避开', () => {
      const [p, e] = fresh();
      e.crouching = true;
      p.startAttack('light');
      p.attack.level = 'high';
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack));
    });
    test('P0', '站防不能挡下段', () => {
      const [, e] = hit(
        {
          level: 'low',
        },
        'block',
        false,
      );
      assert(e.state === 'hit');
    });
    test('P0', '蹲防能挡下段', () => {
      const [, e] = hit(
        {
          level: 'low',
        },
        'block',
        true,
      );
      assert(e.state === 'blockstun');
      assert(e.hp > e.maxHp - 2);
    });
    test('P0', '蹲防不能挡空中上段', () => {
      const [, e] = hit(
        {
          level: 'overhead',
        },
        'block',
        true,
      );
      assert(e.state === 'hit');
    });
    test('P0', '中段可站防与蹲防', () => {
      assert(hit({}, 'block')[1].state === 'blockstun');
      assert(hit({}, 'block', true)[1].state === 'blockstun');
    });
    test('P0', '精准格挡75ms与反击硬直', () => {
      const [p, e] = fresh();
      e.state = 'block';
      e.guardHeld = 0.05;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 5,
          kb: 1,
          stun: 0.2,
          level: 'mid',
        }),
      );
      assert(e.hp === e.maxHp);
      assert(p.state === 'hit');
      assert(e.parryCooldown === 0.65);
    });
    test('P0', '精准格挡冷却阻止快速重复', () => {
      const [p, e] = fresh();
      e.state = 'block';
      e.guardHeld = 0.02;
      e.parryCooldown = 0.3;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 5,
          kb: 1,
          stun: 0.2,
          level: 'mid',
        }),
      );
      assert(e.state === 'blockstun');
    });
    test('P0', '护盾破防', () => {
      const [p, e] = fresh();
      e.guard = 4;
      e.state = 'block';
      e.guardHeld = 0.5;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 10,
          kb: 2,
          stun: 0.3,
          level: 'mid',
          guardDamage: 30,
        }),
      );
      assert(e.state === 'guardbreak' && e.stunTime === 0.9 && e.guard === 0 && e.guardBroken);
      step(120);
      assert(!['guardbreak', 'hit'].includes(e.state));
    });
    test('P0', '投技突破格挡', () => {
      const [p, e] = fresh();
      e.state = 'block';
      p.startThrow();
      step(55);
      assert(e.hp < e.maxHp);
      assert(!e.throwPending);
    });
    test('P0', '180ms拆投', () => {
      const [p, e] = fresh();
      p.startThrow();
      e.takeHit(p, p.attack);
      step(
        1,
        {},
        {
          throw: true,
        },
      );
      assert(!e.throwPending && e.hp === e.maxHp && p.attack === null);
    });
    test('P0', '受击、倒地禁止再次被投', () => {
      const [p, e] = fresh();
      e.state = 'hit';
      p.startThrow();
      e.takeHit(p, p.attack);
      assert(!e.throwPending);
    });
    test('P0', '命中取消进下一轻击', () => {
      const [p] = fresh();
      p.startAttack('light');
      step(16);
      assert(p.hitResult === 'hit');
      p.enqueue('light');
      step(12);
      assert(p.comboIdx === 1);
    });
    test('P0', '空挥禁止取消', () => {
      const [p, e] = fresh();
      e.pos.x = 5;
      p.startAttack('light');
      step(15);
      p.enqueue('heavy');
      step(1);
      assert(p.comboType === 'light');
    });
    test('P0', '悟空首拳被防可转重击但终段不能循环', () => {
      fresh();
      const a = matchModule.player.def.combos.light[0];
      assert(a.cancelRules.block.length === 1 && a.cancelRules.block[0] === 'heavy');
      assert(
        !combatModule.legalCancel(
          matchModule.player,
          {
            ...a,
            terminal: true,
          },
          {
            type: 'light',
            context: {},
          },
        ),
      );
    });
    test('P0', '重击不可取消回轻击，终段不循环', () => {
      const [p] = fresh();
      p.startAttack('heavy');
      assert(
        !combatModule.legalCancel(p, p.attack, {
          type: 'light',
          context: {},
        }),
      );
      assert(
        !combatModule.legalCancel(
          p,
          {
            ...p.attack,
            terminal: true,
          },
          {
            type: 'heavy',
            context: {},
          },
        ),
      );
    });
    test('P0', '命中停顿只保留一次普通攻击意图', () => {
      const [p] = fresh();
      matchModule.game.hitStop = 0.05;
      p.captureInput({
        actions: [
          {
            type: 'light',
          },
          {
            type: 'light',
          },
        ],
      });
      assert(p.queue.length === 1);
    });
    test('P0', '固定340ms缓存与过期', () => {
      const [p] = fresh();
      p.enqueue('ult');
      assert(p.queue[0].life === 0.34);
      step(45);
      assert(p.queue.length === 0);
    });
    test('P0', '连击伤害递减', () => {
      const [p, e] = hit();
      const first = e.lastDamage;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 10,
          kb: 1,
          stun: 0.4,
          level: 'mid',
        }),
      );
      assert(e.lastDamage < first && e.lastScaling === 0.88);
    });
    test('P0', '六击强制击飞并落地保护', () => {
      const [p, e] = fresh();
      e.receivedCombo = 5;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 4,
          kb: 0.1,
          stun: 0.2,
          level: 'mid',
        }),
      );
      assert(e.invulnerable >= 0.2 && e.state === 'hit' && e.launchFlight);
      const hp = e.hp;
      e.takeHit(p, {
        dmg: 100,
        kb: 0,
        stun: 1,
      });
      assert(e.hp === hp);
      step(150);
      assert(e.state === 'idle');
    });
    test('P0', '三次空中受击保护', () => {
      const [p, e] = fresh();
      e.pos.y = 1;
      e.juggle = 2;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 4,
          kb: 0.1,
          stun: 0.2,
          level: 'mid',
          launch: 5,
        }),
      );
      assert(e.state === 'hit' && e.launchFlight && e.invulnerable >= 0.2);
    });
    test('P0', '霸体仅吸收一次并扣血', () => {
      const [p, e] = fresh(0, 3);
      e.ki = 100;
      e.startSpecial({ down: true });
      const a = e.attack;
      e.stateTimer = a.hitT;
      e.takeHit(
        p,
        combatModule.finalizeMove({
          chainType: 'light',
          dmg: 4,
          kb: 1,
          stun: 0.3,
          level: 'mid',
        }),
      );
      assert(e.attack === a && e.hp < e.maxHp);
      e.takeHit(
        p,
        combatModule.finalizeMove({
          chainType: 'light',
          dmg: 4,
          kb: 1,
          stun: 0.3,
          level: 'mid',
        }),
      );
      assert(e.attack === null);
    });
    test('P0', '残像气力次数与冷却', () => {
      const [p] = fresh();
      p.ki = 30;
      p.state = 'hit';
      p.stunTime = 1;
      step(1, {
        evasion: true,
      });
      assert(p.ki === 15 && p.escapeCharges === 1 && p.escapeCooldown > 0);
      assert(p.invulnerable > 0);
    });
    test('P0', '气力不足不能残像', () => {
      const [p] = fresh();
      p.ki = 14;
      p.state = 'hit';
      p.stunTime = 1;
      step(1, {
        evasion: true,
      });
      assert(p.escapeCharges === 2 && p.state === 'hit');
    });
    test('P0', '爆气35气与冷却', () => {
      const [p] = fresh();
      p.ki = 50;
      p.state = 'hit';
      p.stunTime = 1;
      step(1, {
        block: true,
        dash: true,
      });
      assert(p.ki === 15 && p.breakerCooldown > 5);
    });
    test('P0', '闪身5气与无敌窗口', () => {
      const [p] = fresh();
      p.ki = 30;
      step(1, {
        dash: true,
      });
      assert(p.ki === 25 && p.invulnerable > 0 && p.dashCooldown > 0);
    });
    test('P0', '特殊技30气与满气必杀', () => {
      const [p] = fresh();
      p.ki = 29;
      p.startSpecial();
      assert(!p.attack);
      p.ki = 30;
      p.startSpecial();
      assert(p.ki === 0 && p.attack.id === 'special');
      p.attack = null;
      p.ki = 99;
      p.startUlt();
      assert(!p.attack);
      p.ki = 100;
      p.startUlt();
      assert(p.ki === 0 && p.attack.isUlt && p.attack.costCommitted);
      step(100);
      assert(p.ki < 5);
    });
    test('P0', '资源数值边界', () => {
      const [p] = fresh();
      p.ki = 99.9;
      p.guard = 99.9;
      step(60);
      assert(p.ki <= 100 && p.guard <= 100 && p.hp <= p.maxHp);
    });
    test('P0', '角色交叉时Pushbox有效', () => {
      const [p, e] = fresh();
      e.pos.copy(p.pos);
      combatModule.resolveOverlap();
      assert(p.pos.distanceTo(e.pos) >= 0.3 * (p.baseScale + e.baseScale) - 0.001);
    });
    test('P0', '扫腿实际胶囊接触', () => {
      const [p, e] = fresh();
      p.startAttack('heavy', {
        down: true,
      });
      step(40);
      assert(e.hp < e.maxHp, '扫腿未接触');
      assert(p.attack?.level === 'low' || !p.attack);
    });
    test('P0', '挑空能实际击中并升空', () => {
      const [p, e] = fresh();
      p.startAttack('heavy', {
        up: true,
      });
      step(28);
      assert(e.hp < e.maxHp, '挑空未接触');
      assert(e.pos.y > 0);
    });
    test('P0', '七角色近身普通攻击可命中', () => {
      for (let c = 0; c < 7; c++) {
        const [p, e] = fresh(c, c);
        e.pos.x = 0.65 * p.baseScale;
        p.startAttack('light');
        step(30);
        assert(e.hp < e.maxHp, charactersModule.CHARACTERS[c].id + ' 普攻未命中');
      }
    });
    test('P0', '30、60、144Hz渲染包含命中停顿逻辑一致', () => {
      const run = (fps) => {
        fresh();
        matchModule.player.startAttack('heavy');
        for (let i = 0; i < fps * 2; i++)
          combatModule.advanceCombat(
            1 / fps,
            () => ({}),
            () => ({}),
          );
        return [
          matchModule.player.hp,
          matchModule.enemy.hp,
          matchModule.player.pos.x,
          matchModule.enemy.pos.x,
          matchModule.game.simTime,
          matchModule.game.timeLeft,
          matchModule.game.hitStop,
        ];
      };
      const baseline = run(30);
      for (const fps of [60, 144]) {
        const values = run(fps);
        for (let i = 0; i < values.length; i++)
          assert(
            Math.abs(values[i] - baseline[i]) < 1e-6,
            'FPS ' + fps + ' index ' + i + ' ' + values[i] + ' / ' + baseline[i],
          );
      }
    });
    test('P0', '高速相对运动胶囊扫掠', () => {
      const [p, e] = fresh();
      p.startAttack('light');
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      const r = p.combatRig;
      r.lastAttack = p.attack;
      for (let i = 0; i < 2; i++) r.previous[i].copy(r.hit[i].b);
      e.previousPos.copy(e.pos);
      e.pos.x = 1.4;
      combatModule.sampleCombatRig(e);
      assert(combatModule.combatIntersects(p, e, p.attack));
    });
    test('P0', '被中断的投技正确释放', () => {
      const [p, e] = fresh();
      p.startThrow();
      e.takeHit(p, p.attack);
      p.attack = null;
      step(1);
      assert(!e.throwPending && e.state === 'idle');
    });
    test('P1', '升空消耗且强制降落', () => {
      const [p] = fresh();
      p.ki = 100;
      step(850, {
        flight: true,
      });
      assert(p.ki < 100 && p.pos.y < 4.51);
      step(300);
      assert(p.pos.y === 0 && !p.flightMode);
    });
    test('P1', '追击距离和冷却限制', () => {
      const [p, e] = fresh();
      e.pos.x = 11;
      p.ki = 50;
      step(1, {
        pursuit: true,
      });
      assert(p.ki >= 50 && p.dashKind !== 'pursuit');
      e.pos.x = 3;
      step(1, {
        pursuit: true,
      });
      assert(p.ki < 39 && p.pursuitCooldown > 0);
    });
    test('P1', '倒地及空中受击恢复', () => {
      const [p, e] = fresh();
      e.takeHit(
        p,
        combatModule.finalizeMove({
          dmg: 5,
          kb: 2,
          stun: 0.4,
          level: 'mid',
          knockdown: true,
        }),
      );
      step(220);
      assert(e.pos.y === 0 && e.state === 'idle');
    });
    test('P1', '仙豆开战25秒首刷，开局无豆且场上仅1颗', () => {
      fresh();
      for (let i = 0; i < 2999; i++) worldModule.updateSenzu(matchModule.STEP);
      assert(
        !worldModule.currentMap.senzus.some((x) => x.active) &&
          worldModule.currentMap.senzuSpawnCount === 0,
      );
      worldModule.updateSenzu(matchModule.STEP);
      assert(
        worldModule.currentMap.senzus.filter((x) => x.active).length === 1 &&
          worldModule.currentMap.senzuSpawnCount === 1,
      );
      assert(Math.abs(worldModule.currentMap.senzuEvents[0].time - 25) < 1e-6);
    });
    test('P1', '仙豆有效区域和障碍物排除', () => {
      fresh();
      assert(worldModule.currentMap.senzus.every((x) => worldModule.validSenzuPosition(x.x, x.z)));
      assert(!worldModule.validSenzuPosition(20, 0));
      assert(worldModule.validSenzuPosition(-10, -3), '整洁擂台应允许刷新');
      matchModule.game.selectedMap = 1;
      matchModule.startFight();
      assert(!worldModule.validSenzuPosition(-10, -3), '荒野岩石应排除刷新');
    });
    test('P1', '拾取回血15%，第二次固定60秒不会提前补货', () => {
      const [p] = fresh();
      worldModule.updateSenzu(25);
      const bean = worldModule.currentMap.senzus.find((x) => x.active);
      p.hp = p.maxHp * 0.3;
      p.pos.set(bean.x, 0, bean.z);
      worldModule.updateSenzu(matchModule.STEP);
      assert(p.hp === p.maxHp * 0.3 + Math.floor(p.maxHp * 0.15));
      assert(!bean.active && worldModule.currentMap.senzuSpawnCount === 1);
      p.pos.set(0, 0, 0);
      while (worldModule.currentMap.senzuTime < 60 - matchModule.STEP - 0.00001)
        worldModule.updateSenzu(matchModule.STEP);
      assert(!worldModule.currentMap.senzus.some((x) => x.active));
      worldModule.updateSenzu(matchModule.STEP);
      assert(
        worldModule.currentMap.senzuSpawnCount === 2 &&
          worldModule.currentMap.senzus.filter((x) => x.active).length === 1,
      );
      assert(
        Math.abs(
          worldModule.currentMap.senzuEvents.filter((x) => x.type === 'spawn')[1].time - 60,
        ) < 1e-6,
      );
    });
    test('P1', '未拾取仙豆12秒消失、占用本回合刷新额度', () => {
      fresh();
      worldModule.updateSenzu(25);
      const b = worldModule.currentMap.senzus.find((x) => x.active);
      for (let i = 0; i < 1439; i++) worldModule.updateSenzu(matchModule.STEP);
      assert(b.active);
      worldModule.updateSenzu(matchModule.STEP);
      assert(!b.active && worldModule.currentMap.senzuSpawnCount === 1);
      assert(worldModule.currentMap.senzuEvents.at(-1).type === 'expire');
    });
    test('P1', '180秒及更长训练仅2次刷新，无堆积与无限补货', () => {
      fresh();
      let peak = 0;
      for (let i = 0; i < 120 * 210; i++) {
        worldModule.updateSenzu(matchModule.STEP);
        peak = Math.max(peak, worldModule.currentMap.senzus.filter((x) => x.active).length);
      }
      assert(peak === 1 && worldModule.currentMap.senzuSpawnCount === 2);
      assert(
        worldModule.currentMap.senzuEvents.filter((x) => x.type === 'spawn').length === 2 &&
          !worldModule.currentMap.senzus.some((x) => x.active),
      );
      worldModule.updateSenzuHUD();
      assert(document.getElementById('senzuStatus').textContent.includes('本回合仙豆已结束'));
    });
    test('P1', '七角色每回合总治疗不超过最大生命30%', () => {
      for (let c = 0; c < 7; c++) {
        const [p] = fresh(c, 0);
        p.hp = 1;
        worldModule.updateSenzu(25);
        for (let n = 0; n < 2; n++) {
          const b = worldModule.currentMap.senzus.find((x) => x.active);
          assert(b);
          p.pos.set(b.x, 0, b.z);
          worldModule.updateSenzu(matchModule.STEP);
          p.pos.set(0, 0, 0);
          if (n === 0) worldModule.updateSenzu(60 - worldModule.currentMap.senzuTime);
        }
        const heal = worldModule.currentMap.senzuPickups.reduce((sum, x) => sum + x.heal, 0);
        assert(heal === 2 * Math.floor(p.maxHp * 0.15) && heal <= p.maxHp * 0.3);
        worldModule.updateSenzu(80);
        assert(
          worldModule.currentMap.senzuSpawnCount === 2 &&
            !worldModule.currentMap.senzus.some((x) => x.active),
        );
      }
    });
    test('P1', '刷新不会在角色脚下直接送治疗，位置有效', () => {
      const [p, e] = fresh();
      p.pos.set(-5, 0, 3);
      e.pos.set(5, 0, -3);
      p.hp = e.hp = 1;
      worldModule.updateSenzu(25);
      const b = worldModule.currentMap.senzus.find((x) => x.active);
      assert(b && worldModule.validSenzuPosition(b.x, b.z));
      assert(
        Math.hypot(b.x - p.pos.x, b.z - p.pos.z) >= 1.65 &&
          Math.hypot(b.x - e.pos.x, b.z - e.pos.z) >= 1.65,
      );
      assert(p.hp === 1 && e.hp === 1);
    });
    test('P1', '两次刷新轮换位置，避免固定点蹲守', () => {
      fresh();
      worldModule.updateSenzu(25);
      const first = {
        ...worldModule.currentMap.senzuLastSpawn,
      };
      worldModule.updateSenzu(12);
      worldModule.updateSenzu(23);
      const second = worldModule.currentMap.senzuLastSpawn;
      assert(Math.hypot(first.x - second.x, first.z - second.z) >= 2);
    });
    test('P1', '三个舞台两次刷新均可生成在有效位置', () => {
      for (let stage = 0; stage < 3; stage++) {
        fresh();
        matchModule.game.selectedMap = stage;
        matchModule.startFight();
        matchModule.game.ready = 0;
        worldModule.updateSenzu(25);
        assert(worldModule.currentMap.senzus.filter((x) => x.active).length === 1);
        worldModule.updateSenzu(12);
        worldModule.updateSenzu(23);
        assert(
          worldModule.currentMap.senzuSpawnCount === 2 &&
            worldModule.currentMap.senzus.filter((x) => x.active).length === 1,
        );
        assert(
          worldModule.currentMap.senzuEvents
            .filter((x) => x.type === 'spawn')
            .every((x) => worldModule.validSenzuPosition(x.x, x.z)),
        );
      }
    });
    test('P1', 'CPU放弃即将消失且来不及接近的仙豆', () => {
      const [p, e] = fresh();
      matchModule.game.difficulty = 'hard';
      p.pos.set(-6, 0, -2);
      e.pos.set(2, 0, 0);
      const b = worldModule.currentMap.senzus[1];
      b.active = true;
      b.expiresAt = 0.05;
      e.hp = e.maxHp * 0.2;
      for (let i = 0; i < 80; i++) aiModule.aiThink(e, p, matchModule.STEP);
      assert(!e.beanGoal);
    });
    test('P1', '重置恢复25秒首刷与完整额度，暂停保存剩余寿命', () => {
      fresh();
      worldModule.updateSenzu(25);
      const b = worldModule.currentMap.senzus.find((x) => x.active),
        time = worldModule.currentMap.senzuTime,
        expiry = b.expiresAt;
      matchModule.game.paused = true;
      worldModule.updateSenzu(20);
      assert(worldModule.currentMap.senzuTime === time && b.expiresAt === expiry && b.active);
      matchModule.game.paused = false;
      worldModule.resetSenzu();
      assert(
        worldModule.currentMap.senzuSpawnCount === 0 &&
          worldModule.currentMap.senzuNextSpawn === 25 &&
          worldModule.currentMap.senzuTime === 0 &&
          !worldModule.currentMap.senzus.some((x) => x.active),
      );
      assert(worldModule.currentMap.senzuEvents.length === 0);
    });
    test('P1', '回血上限与满血不消耗', () => {
      const [p] = fresh();
      const bean = worldModule.currentMap.senzus[0];
      bean.active = true;
      p.pos.set(bean.x, 0, bean.z);
      worldModule.updateSenzu(matchModule.STEP);
      assert(bean.active);
      p.hp = p.maxHp - 2;
      worldModule.updateSenzu(matchModule.STEP);
      assert(p.hp === p.maxHp && !bean.active);
    });
    test('P1', '死亡、回合结束、暂停、准备不拾取或计时', () => {
      const [p] = fresh();
      const bean = worldModule.currentMap.senzus[0];
      p.pos.set(bean.x, 0, bean.z);
      p.hp = 1;
      for (const state of ['pause', 'ready', 'over', 'death']) {
        bean.active = true;
        const time = worldModule.currentMap.senzuTime;
        matchModule.game.paused = state === 'pause';
        matchModule.game.ready = state === 'ready' ? 1 : 0;
        matchModule.game.over = state === 'over';
        p.hp = state === 'death' ? 0 : 1;
        worldModule.updateSenzu(0.5);
        assert(bean.active && worldModule.currentMap.senzuTime === time);
      }
    });
    test('P1', '空中与受击状态不能隔空拾取', () => {
      const [p] = fresh();
      const bean = worldModule.currentMap.senzus[0];
      bean.active = true;
      p.hp = 1;
      p.pos.set(bean.x, 1.1, bean.z);
      worldModule.updateSenzu(matchModule.STEP);
      assert(bean.active);
      p.pos.y = 0;
      p.state = 'hit';
      worldModule.updateSenzu(matchModule.STEP);
      assert(bean.active);
    });
    test('P1', 'CPU和玩家拾取遵循同规则', () => {
      const [, e] = fresh();
      const b = worldModule.currentMap.senzus[1];
      b.active = true;
      e.hp = 1;
      e.pos.set(b.x, 0, b.z);
      worldModule.updateSenzu(matchModule.STEP);
      assert(e.hp > 1 && !b.active);
    });
    test('P1', '双方等距仙豆争夺不偏向1P', () => {
      const [p, e] = fresh();
      const b = worldModule.currentMap.senzus[0];
      b.active = true;
      p.hp = e.hp = 1;
      p.pos.set(b.x - 0.5, 0, b.z);
      e.pos.set(b.x + 0.5, 0, b.z);
      worldModule.updateSenzu(matchModule.STEP);
      assert(b.active && p.hp === 1 && e.hp === 1);
    });
    test('P1', '重复仙豆重置不堆积实体', () => {
      fresh();
      const count = worldModule.currentMap.group.children.length;
      worldModule.resetSenzu();
      worldModule.resetSenzu();
      assert(
        worldModule.currentMap.group.children.length === count &&
          worldModule.currentMap.senzuPickups.length === 0,
      );
    });
    test('P1', 'CPU延迟反应且随机种子可重复', () => {
      const [p, e] = fresh();
      matchModule.game.difficulty = 'hard';
      const seq = () => {
        aiModule.setCombatSeed(123);
        e.brainTime = 0;
        e.observations = [];
        e.observeTimer = 0;
        e.aiDecision = 0.3;
        e.aiBlockTimer = 0;
        e.aiStrafe = 1;
        e.chargeUntil = 0;
        return Array.from(
          {
            length: 90,
          },
          () => JSON.stringify(aiModule.aiThink(e, p, matchModule.STEP)),
        ).join('|');
      };
      assert(seq() === seq());
      e.brainTime = 0;
      e.observations = [];
      assert(Object.keys(aiModule.aiThink(e, p, matchModule.STEP)).length === 0);
    });
    test('P1', 'CPU低血取豆、满血不蹲守', () => {
      const [p, e] = fresh();
      matchModule.game.difficulty = 'hard';
      p.pos.set(-6, 0, -2);
      e.pos.set(2, 0, 0);
      const b = worldModule.currentMap.senzus[1];
      b.active = true;
      e.hp = e.maxHp * 0.2;
      for (let i = 0; i < 80; i++) aiModule.aiThink(e, p, matchModule.STEP);
      assert(e.beanGoal === b);
      e.hp = e.maxHp;
      e.aiDecision = 0;
      aiModule.aiThink(e, p, matchModule.STEP);
      assert(!e.beanGoal);
    });
    test('P1', '训练受击后防御、随机段防与拆投', () => {
      const [p, e] = fresh();
      matchModule.game.difficulty = 'training';
      matchModule.game.trainingDummy = 'after';
      e.receivedCombo = 1;
      assert(aiModule.aiThink(e, p, matchModule.STEP).block);
      matchModule.game.trainingDummy = 'random';
      assert(aiModule.aiThink(e, p, matchModule.STEP).block);
      matchModule.game.trainingDummy = 'tech';
      e.throwPending = {
        timer: 0.07,
      };
      assert(aiModule.aiThink(e, p, matchModule.STEP).throw);
    });
    test('P0', '七必杀逐一命中七角色（49近身组合）', () => {
      for (let c = 0; c < 7; c++)
        for (let other = 0; other < 7; other++) {
          const [p, e] = fresh(c, other);
          e.pos.x = 0.9;
          p.ki = 100;
          p.startUlt();
          for (let n = 0; n < 270; n++) {
            step(1);
            combatModule.updateKiDiscs(matchModule.STEP);
          }
          assert(e.hp < e.maxHp, p.def.name + ' → ' + e.def.name + ' 无伤害');
        }
    });
    test('P0', '六远程必杀中远距离可命中（84组合）', () => {
      for (let c = 0; c < 6; c++)
        for (let other = 0; other < 7; other++)
          for (const dist of [3, 6]) {
            const [p, e] = fresh(c, other);
            e.pos.x = dist;
            p.ki = 100;
            p.startUlt();
            for (let n = 0; n < 270; n++) {
              step(1);
              combatModule.updateKiDiscs(matchModule.STEP);
            }
            assert(e.hp < e.maxHp, p.def.name + ' → ' + e.def.name + ' ' + dist + 'm 无伤害');
          }
    });
    test('P0', '狼牙四段连击与有效突进', () => {
      for (const dist of [0.9, 3]) {
        const [p, e] = fresh(6, 0);
        // Keep the target alive through every hit even when ultimate damage is rebalanced.
        e.hp = e.maxHp = 10000;
        e.pos.x = dist;
        p.ki = 100;
        p.startUlt();
        step(Math.ceil((p.attack.hitT + p.attack.active) / matchModule.STEP) + 1);
        assert(e.receivedCombo === 4, '狼牙未形成四段：' + e.receivedCombo);
        assert(e.lastDamage > 0);
      }
    });
    test('P0', '狼牙超出突进距离正确空挥', () => {
      const [p, e] = fresh(6, 0);
      e.pos.x = 12;
      p.ki = 100;
      p.startUlt();
      step(250);
      assert(e.hp === e.maxHp);
    });
    test('P0', '必杀同局连续释放仍可造成伤害', () => {
      for (let c = 0; c < 7; c++) {
        const [p, e] = fresh(c, 3);
        e.hp = e.maxHp = 10000;
        let previous = e.hp;
        for (let shot = 0; shot < 3; shot++) {
          p.pos.set(0, 0, 0);
          e.pos.set(3, 0, 0);
          p.previousPos.copy(p.pos);
          e.previousPos.copy(e.pos);
          p.facingAngle = Math.PI / 2;
          e.facingAngle = -Math.PI / 2;
          p.ki = 100;
          p.startUlt();
          for (let n = 0; n < 260; n++) {
            step(1);
            combatModule.updateKiDiscs(matchModule.STEP);
          }
          assert(e.hp < previous, p.def.name + ' 第' + (shot + 1) + '发无伤害');
          previous = e.hp;
        }
      }
    });
    test('P0', '必杀可格挡、有射程且不能命中背后', () => {
      let [p, e] = fresh();
      e.pos.x = 3;
      p.ki = 100;
      p.startUlt();
      const blockedDamage = Math.round(p.attack.dmg * p.def.power * 0.2 * 10) / 10;
      for (let n = 0; n < 180; n++)
        step(
          1,
          {},
          {
            block: true,
          },
        );
      assert(e.lastHitText === '格挡' && Math.abs(e.maxHp - e.hp - blockedDamage) < 1e-7);
      [p, e] = fresh();
      p.ki = 100;
      p.startUlt();
      e.pos.x = p.attack.range + 3;
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack), '射程外不可命中');
      step(1);
      assert(e.hp === e.maxHp);
      [p, e] = fresh();
      e.pos.x = -3;
      p.ki = 100;
      p.startUlt();
      p.stateTimer = p.attack.hitT;
      combatModule.sampleCombatRig(p);
      combatModule.sampleCombatRig(e);
      assert(!combatModule.combatIntersects(p, e, p.attack));
    });
    test('P1', '实时命中与格挡帧优势使用本次硬直', () => {
      for (const block of [false, true]) {
        const [p, e] = fresh();
        p.startAttack('heavy');
        p.stateTimer = p.attack.hitT;
        e.state = block ? 'block' : 'idle';
        e.guardHeld = 0.4;
        const a = p.attack,
          expected = Math.round(((block ? a.blockstun : a.stun) - (a.dur - p.stateTimer)) * 60);
        e.takeHit(p, a);
        assert(e.lastAdvantage === expected, '帧优势未使用本次硬直');
      }
    });
    test('P1', '七特殊技和必杀不同性能可释放', () => {
      const shapes = new Set();
      for (let c = 0; c < 7; c++) {
        const [p] = fresh(c, c);
        p.ki = 100;
        p.startSpecial();
        assert(p.attack && p.ki === 70);
        p.attack = null;
        p.ki = 100;
        p.startUlt();
        shapes.add(p.attack.motion);
        step(240);
        assert(p.state !== 'ult');
      }
      assert(shapes.size >= 5);
    });
    test('P1', '越肩镜头绕背、空中高差保持有限且渐变', () => {
      const [, e] = fresh();
      renderModule.resetShoulderCameras();
      let last = renderModule.shoulderStates[0].yaw;
      for (let i = 0; i < 120; i++) {
        e.pos.set(
          Math.sin((i / 120) * Math.PI * 2) * 1.2,
          i < 60 ? 3 : 0,
          Math.cos((i / 120) * Math.PI * 2) * 1.2,
        );
        renderModule.updateFightCamera(matchModule.STEP);
        assert(
          Math.abs(renderModule.angleDelta(renderModule.shoulderStates[0].yaw, last)) <=
            4.5 * matchModule.STEP + 0.001,
        );
        last = renderModule.shoulderStates[0].yaw;
        assert(renderModule.camera.position.toArray().every(Number.isFinite));
      }
    });
    test('P1', '镜头相对前移与侧移', () => {
      const [p, e] = fresh();
      e.pos.set(0, 0, 3);
      renderModule.resetShoulderCameras();
      const old = p.pos.clone();
      step(8, {
        up: true,
      });
      assert(p.pos.z > old.z);
    });
    test('P1', '1P、2P左右移动符合屏幕方向（旋转四象限）', () => {
      for (const who of [0, 1])
        for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
          for (const sign of [-1, 1]) {
            const [p, e] = fresh();
            const own = who ? e : p,
              foe = who ? p : e;
            own.pos.set(0, 0, 0);
            foe.pos.set(Math.sin(angle) * 4, 0, Math.cos(angle) * 4);
            own.facingAngle = angle;
            renderModule.resetShoulderCameras();
            renderModule.camera.updateMatrixWorld(true);
            renderModule.camera2.updateMatrixWorld(true);
            const cam = who ? renderModule.camera2 : renderModule.camera;
            renderModule.shoulderStates[who];
            const yaw = trainingModule.movementYaw(who),
              before = own.pos.clone();
            own.update(matchModule.STEP, foe, {
              moveYaw: yaw,
              left: sign < 0,
              right: sign > 0,
            });
            const dx = own.pos.x - before.x,
              dz = own.pos.z - before.z,
              screen = dx * cam.matrixWorld.elements[0] + dz * cam.matrixWorld.elements[2];
            assert(screen * sign > 0, '左右反向 ' + who + ' ' + angle);
          }
    });
    test('P1', '镜头左右闪身与斜向归一化', () => {
      const [p, e] = fresh();
      e.pos.set(0, 0, 4);
      renderModule.resetShoulderCameras();
      const yaw = trainingModule.movementYaw(0),
        right = p.pos.clone().set(-Math.cos(yaw), 0, Math.sin(yaw)),
        before = p.pos.clone();
      p.update(matchModule.STEP, e, {
        moveYaw: yaw,
        right: true,
        dash: true,
      });
      step(1);
      assert(p.pos.clone().sub(before).dot(right) > 0);
      fresh();
      const v = trainingModule.movementYaw(0);
      matchModule.player.update(matchModule.STEP, matchModule.enemy, {
        moveYaw: v,
        up: true,
        right: true,
      });
      assert(matchModule.player.vel.length() < 6.8 * matchModule.player.def.speed + 0.001);
    });
    test('P2', '180秒与三局两胜初始化', () => {
      fresh();
      assert(
        matchModule.game.timeLeft === 180 &&
          matchModule.game.wins[0] === 0 &&
          matchModule.game.wins[1] === 0,
      );
    });
    test('P2', '不同最大HP公平超时生命比例', () => {
      const [p, e] = fresh(0, 3);
      p.hp = p.maxHp * 0.6;
      e.hp = e.maxHp * 0.57;
      assert(matchModule.roundWinner(p, e) === 'player');
      e.hp = e.maxHp * 0.6;
      assert(matchModule.roundWinner(p, e) === 'draw');
    });
    test('P2', '双方同帧攻击与双K.O.', () => {
      const [p, e] = fresh();
      p.hp = e.hp = 1;
      p.startAttack('light');
      e.startAttack('light');
      step(18);
      assert(p.hp === 0 && e.hp === 0, '双向接触未形成同帧双KO');
      assert(matchModule.roundWinner(p, e) === 'draw');
    });
    test('P2', 'K.O.与TIME UP独立结算', () => {
      let [p, e] = fresh();
      e.hp = 0;
      matchModule.endGame();
      assert(matchModule.game.endReason === 'K.O.' && matchModule.game.wins[0] === 1);
      [p, e] = fresh();
      p.hp = p.maxHp * 0.7;
      e.hp = e.maxHp * 0.4;
      matchModule.endGame();
      assert(matchModule.game.endReason === 'TIME UP' && matchModule.game.wins[0] === 1);
    });
    test('P2', '回合累计与比赛胜利', () => {
      const [, e] = fresh();
      matchModule.game.wins = [1, 0];
      e.hp = 0;
      matchModule.endGame();
      assert(matchModule.game.matchFinished && matchModule.game.wins[0] === 2);
    });
    test('P2', '随机对手再战保持角色', () => {
      fresh(2, 3);
      matchModule.game.opponent = -1;
      matchModule.game.keepPair = true;
      const ids = matchModule.game.lastPair.slice();
      matchModule.startFight();
      assert(
        matchModule.player.def === charactersModule.CHARACTERS[ids[0]] &&
          matchModule.enemy.def === charactersModule.CHARACTERS[ids[1]],
      );
    });
    test('P2', '新回合清理状态与仙豆', () => {
      const [p] = fresh();
      p.enqueue('heavy');
      matchModule.game.hitStop = 1;
      matchModule.game.shake = 1;
      worldModule.currentMap.senzus[0].active = true;
      worldModule.currentMap.senzuPickups.push({});
      matchModule.startFight();
      assert(
        matchModule.game.hitStop === 0 &&
          matchModule.game.shake === 0 &&
          matchModule.player.queue.length === 0,
      );
      assert(
        worldModule.currentMap.senzuPickups.length === 0 &&
          worldModule.currentMap.senzus.every((x) => !x.active),
      );
    });
    test('P2', '暂停清除按键与缓存', () => {
      const [p] = fresh();
      p.enqueue('heavy');
      inputModule.keys.KeyW = true;
      matchModule.setPaused(true);
      assert(!inputModule.keys.KeyW && p.queue.length === 0);
      matchModule.setPaused(false);
      assert(!matchModule.game.paused);
    });
    test('P2', '出界判负，其他地图不触发', () => {
      const [p] = fresh();
      matchModule.game.ringOut = true;
      p.pos.x = 15;
      for (let i = 0; i < 30; i++) trainingModule.updateRoundRules(matchModule.STEP);
      assert(matchModule.game.over && matchModule.game.endReason === 'RING OUT');
      fresh();
      matchModule.game.ringOut = true;
      matchModule.game.selectedMap = 1;
      matchModule.player.pos.x = 15;
      for (let i = 0; i < 30; i++) trainingModule.updateRoundRules(matchModule.STEP);
      assert(!matchModule.game.over);
    });
    test('P2', '三舞台与七角色可加载', () => {
      for (let i = 0; i < 3; i++) {
        matchModule.game.selectedMap = i;
        matchModule.startFight();
        assert(worldModule.currentMap.bounds && worldModule.currentMap.senzus.length === 2);
      }
      for (let i = 0; i < 7; i++) {
        matchModule.game.selectedChar = i;
        matchModule.game.keepPair = false;
        matchModule.startFight();
        assert(
          matchModule.player.parts.handR &&
            matchModule.player.parts.footR &&
            matchModule.player.hp > 0,
        );
      }
    });
    test('P2', '实际下一回合按钮保持角色与胜场', () => {
      const [, e] = fresh(2, 3);
      matchModule.game.opponent = -1;
      e.hp = 0;
      matchModule.endGame();
      document.getElementById('againBtn').onclick();
      assert(matchModule.game.lastPair[0] === 2 && matchModule.game.lastPair[1] === 3);
      assert(matchModule.game.wins[0] === 1 && matchModule.game.matchRound === 2);
    });
    test('P2', '实际再战按钮重置比赛并保持随机对手', () => {
      const [, e] = fresh(2, 3);
      matchModule.game.opponent = -1;
      matchModule.game.wins = [1, 0];
      e.hp = 0;
      matchModule.endGame();
      document.getElementById('againBtn').onclick();
      assert(matchModule.game.lastPair[0] === 2 && matchModule.game.lastPair[1] === 3);
      assert(
        matchModule.game.wins[0] === 0 &&
          matchModule.game.wins[1] === 0 &&
          matchModule.game.matchRound === 1,
      );
    });
    test('P2', '双人选角实际按钮可选择2P', () => {
      fresh();
      matchModule.backToMenu();
      matchModule.game.difficulty = 'local';
      document.getElementById('pickP2').onclick();
      document.querySelectorAll('.char-card')[6].click();
      assert(matchModule.game.selectionPlayer === 2 && matchModule.game.opponent === 6);
      document.getElementById('pickP1').onclick();
    });
    test('P2', '菜单回退清理战斗引用和输入', () => {
      fresh();
      inputModule.keys.KeyJ = true;
      matchModule.backToMenu();
      assert(
        !matchModule.player &&
          !matchModule.enemy &&
          matchModule.game.screen === 'menu' &&
          !inputModule.keys.KeyJ,
      );
      assert(!worldModule.currentMap.senzus);
    });
    const legacyTotal = results.length;
    let acceptanceMatrix = null;
    if (group !== 'legacy') {
      test('P0', '比克轻击与重击对小林真实流程回归', () => {
        for (const type of ['light', 'heavy'])
          for (const distance of [0.55, 0.9]) {
            const [p, e] = fresh(3, 5);
            e.pos.x = distance;
            p.startAttack(type);
            step(130);
            assert(e.hp < e.maxHp);
          }
      });
      test('P0', '魔王震掌双掌中央对少年接触', () => {
        for (const c of [0, 5])
          for (const d of [0.55, 0.9]) {
            const [p, e] = fresh(3, c);
            e.pos.x = d;
            p.startSpecial();
            step(140);
            assert(e.hp < e.maxHp);
          }
      });
      test('P0', '如意延伸对比克近身与2.4米真实接触', () => {
        for (const d of [0.55, 0.9, 2.4]) {
          const [p, e] = fresh(0, 3);
          e.pos.x = d;
          p.startSpecial();
          step(110);
          assert(e.hp < e.maxHp);
        }
      });
      test('P0', '如意棒可见端点与逻辑端点一致', () => {
        const [p] = fresh(0, 3);
        p.startSpecial();
        step(29);
        p.render(1, 1);
        p.root.updateMatrixWorld(true);
        const r = combatModule.sampleCombatRig(p),
          a = p.parts.staff.localToWorld(new THREE.Vector3(0, -1.25, 0)),
          b = p.parts.staff.localToWorld(new THREE.Vector3(0, 1.25, 0));
        assert(a.distanceTo(r.hit[0].a) < 1e-6 && b.distanceTo(r.hit[0].b) < 1e-6);
      });
      test('P0', '高度适配锁定体型而不追踪跳跃', () => {
        const [p, e] = fresh(3, 5);
        p.startAttack('heavy');
        p.stateTimer = p.attack.hitT;
        const pose = combatModule.combatPose(p),
          scale = p.attack.targetScale;
        e.pos.y = 3;
        e.crouching = true;
        e.baseScale = 1.4;
        assert(p.attack.targetScale === scale);
        assert(JSON.stringify(combatModule.combatPose(p)) === JSON.stringify(pose));
      });
      test('P0', '天津饭挑掌在有效空中区命中七角色', () => {
        for (let c = 0; c < 7; c++) {
          const [p, e] = fresh(4, c);
          e.pos.y = 1.2;
          p.startSpecial();
          e.jumpVel = 11 * (p.attack.startup + matchModule.STEP);
          step(80);
          assert(e.hp < e.maxHp);
        }
      });
      test('P0', '天津饭挑掌不强制命中地面少年', () => {
        for (const c of [0, 5]) {
          const [p, e] = fresh(4, c);
          p.startSpecial();
          step(100);
          assert(e.hp === e.maxHp);
        }
      });
      test('P1', '七专属特殊技HUD显示真实名字与30气', () => {
        for (let c = 0; c < 7; c++) {
          const [p] = fresh(c, 0);
          p.startSpecial();
          uiModule.updateExtraHUD();
          assert(document.getElementById('actionState').textContent === p.attack.name + ' · 30 气');
          assert(!document.getElementById('actionState').textContent.includes('连招'));
        }
      });
      test('P1', '特殊技不足气与等待恢复状态真实', () => {
        const [p] = fresh();
        p.ki = 29;
        assert(uiModule.specialAvailability(p).includes('气力不足'));
        p.ki = 30;
        assert(uiModule.specialAvailability(p).includes('可发动'));
        p.state = 'blockstun';
        assert(uiModule.specialAvailability(p).includes('等待'));
        matchModule.game.paused = true;
        assert(!uiModule.specialAvailability(p).includes('可发动'));
      });
      test('P1', 'HUD格挡硬直、受击、必杀和回合结束独立', () => {
        const [p] = fresh();
        p.state = 'blockstun';
        assert(uiModule.fighterStatus(p) === '格挡硬直');
        p.state = 'hit';
        assert(uiModule.fighterStatus(p).startsWith('受击'));
        p.state = 'idle';
        p.ki = 100;
        p.startUlt();
        assert(uiModule.fighterStatus(p).includes('满气必杀'));
        matchModule.game.over = true;
        matchModule.game.endReason = 'TIME UP';
        assert(uiModule.fighterStatus(p) === 'TIME UP');
      });
      test('P1', '帧表包含全部特殊技与60帧换算', () => {
        for (let c = 0; c < 7; c++) {
          fresh(c, 0);
          trainingModule.refreshMoveTable();
          const a = combatModule.finalizeMove(
              combatModule.SPECIAL_MOVES[matchModule.player.def.id],
            ),
            row = [...trainingModule.table.querySelectorAll('tr')].at(-1);
          assert(row.cells[0].textContent.includes(a.name));
          assert(
            row.cells[1].textContent ===
              Math.round(a.startup * 60) +
                ' / ' +
                Math.round(a.active * 60) +
                ' / ' +
                Math.round(a.recovery * 60),
          );
        }
      });
      test('P1', '训练当前招式与上次接触优势明确区分', () => {
        const [p, e] = fresh(3, 5);
        matchModule.game.difficulty = 'training';
        e.pos.x = 0.9;
        p.startAttack('light');
        step(130);
        assert(e.hp < e.maxHp);
        const advantage = e.lastAdvantage;
        p.startSpecial();
        trainingModule.updateTrainingHUD();
        const text = document.getElementById('frameReadout').textContent;
        assert(
          text.includes('当前招式：魔王震掌') &&
            text.includes('上次接触：命中 · 优势 ' + advantage + ' F'),
        );
      });
      test('P1', '低空0.02到0.9米不能拾豆', () => {
        const [p] = fresh();
        const b = worldModule.currentMap.senzus[0];
        p.hp = 1;
        for (const y of [0.02, 0.2, 0.5, 0.9]) {
          b.active = true;
          p.state = 'idle';
          p.pos.set(b.x, y, b.z);
          worldModule.updateSenzu(matchModule.STEP);
          assert(b.active && p.hp === 1);
        }
      });
      test('P1', '落地恢复与格挡硬直不拾豆，恢复后可拾', () => {
        const [p] = fresh();
        const b = worldModule.currentMap.senzus[0];
        p.hp = 1;
        p.pos.set(b.x, 0, b.z);
        for (const state of ['landing', 'blockstun', 'knockdown', 'grabbed']) {
          b.active = true;
          p.state = state;
          worldModule.updateSenzu(matchModule.STEP);
          assert(b.active && p.hp === 1);
        }
        p.state = 'idle';
        worldModule.updateSenzu(matchModule.STEP);
        assert(!b.active && p.hp > 1);
      });
      test('P1', '满血CPU立即取消旧仙豆目标', () => {
        const [p, e] = fresh();
        matchModule.game.difficulty = 'hard';
        e.hp = e.maxHp;
        e.beanGoal = worldModule.currentMap.senzus[0];
        e.aiDecision = 1;
        aiModule.aiThink(e, p, matchModule.STEP);
        assert(!e.beanGoal);
      });
      test('P1', '仙豆近距竞争互换玩家仍由最近者拾取', () => {
        for (const who of [0, 1]) {
          const [p, e] = fresh();
          const b = worldModule.currentMap.senzus[0];
          b.active = true;
          p.hp = e.hp = 1;
          p.pos.set(b.x - (who ? 0.7 : 0.3), 0, b.z);
          e.pos.set(b.x + (who ? 0.3 : 0.7), 0, b.z);
          worldModule.updateSenzu(matchModule.STEP);
          assert((who ? e : p).hp > 1 && (who ? p : e).hp === 1);
        }
      });
      test('P1', '七角色四种基础姿态的渲染与骨架一致', () => {
        for (let c = 0; c < 7; c++) {
          const [p] = fresh(c, 0);
          for (const state of ['idle', 'walk', 'crouch', 'block']) {
            p.state = state;
            p.crouching = state === 'crouch';
            p.walkPhase = 0.7;
            p.visualAngle = p.facingAngle;
            p.render(1, 1);
            p.root.updateMatrixWorld(true);
            const rig = combatModule.sampleCombatRig(p);
            for (const k of ['handR', 'handL', 'elbowR', 'footR', 'footL'])
              assert(
                p.parts[k]
                  .getWorldPosition(new THREE.Vector3())
                  .distanceTo(rig.parts[k].getWorldPosition(new THREE.Vector3())) < 1e-6,
                k,
              );
          }
        }
      });
      test('P1', '暂停期间攻击可见关节不继续漂移', () => {
        const [p] = fresh();
        p.startAttack('light');
        step(6);
        p.render(0.016, 1);
        const q = p.parts.armR.rotation.toArray();
        for (let i = 0; i < 60; i++) p.render(0, 1);
        assert(JSON.stringify(q) === JSON.stringify(p.parts.armR.rotation.toArray()));
      });
      test('P1', '七体型与双镜头高差投影有限且独立', () => {
        for (let c = 0; c < 7; c++) {
          const [, e] = fresh(c, 6 - c);
          e.pos.y = 3;
          renderModule.resetShoulderCameras();
          const own = renderModule.shoulderStates[0].position.clone();
          renderModule.shoulderStates[1].position.x += 0.1;
          assert(own.equals(renderModule.shoulderStates[0].position));
          for (const cam of [renderModule.camera, renderModule.camera2])
            assert(
              cam.position.toArray().every(Number.isFinite) &&
                Math.abs(cam.aspect - innerWidth / (innerHeight / 2)) < 1e-8,
            );
        }
      });
      test('camera', '动态胶囊掩体实际阻挡镜头射线，隐藏和销毁后移出障碍', () => {
        fresh();
        matchModule.game.selectedChar = charactersModule.CHARACTERS.findIndex(
          (c) => c.id === 'bulma',
        );
        matchModule.startFight();
        matchModule.game.ready = 0;
        const p = matchModule.player;
        p.startSpecial();
        combatModule.releaseYouthAbility(p, p.attack);
        const cover = combatModule.youthEntities.find((e) => e.kind === 'cover');
        assert(cover);
        const meshes = cover.mesh.children.filter((node) => node.isMesh);
        const origin = cover.pos.clone().add(new THREE.Vector3(0, 0.6, 2));
        renderModule.cameraRay.set(origin, new THREE.Vector3(0, 0, -1));
        renderModule.cameraRay.far = 4;
        assert(
          renderModule.cameraRay
            .intersectObjects(renderModule.cameraObstacles, false)
            .some((hit) => meshes.includes(hit.object)),
        );
        cover.mesh.visible = false;
        renderModule.updateFightCamera(matchModule.STEP);
        assert(meshes.every((mesh) => !renderModule.cameraObstacles.includes(mesh)));
        cover.mesh.visible = true;
        renderModule.cameraObstacles.push(...meshes);
        cover.hp = 0;
        combatModule.updateYouthEntities(matchModule.STEP);
        renderModule.updateFightCamera(matchModule.STEP);
        assert(meshes.every((mesh) => !renderModule.cameraObstacles.includes(mesh)));
      });
      test('P1', '镜头墙边与场景障碍不会穿入摄像机阻挡体', () => {
        for (let stage = 0; stage < 3; stage++) {
          fresh();
          matchModule.game.selectedMap = stage;
          matchModule.startFight();
          matchModule.game.ready = 0;
          matchModule.player.pos.set(-13, 0, -5.8);
          matchModule.enemy.pos.set(4, 0, -4);
          renderModule.resetShoulderCameras();
          for (let i = 0; i < 100; i++) {
            renderModule.updateFightCamera(matchModule.STEP);
            renderModule.scene.updateMatrixWorld(true);
            const origin = matchModule.player.pos
                .clone()
                .add(new THREE.Vector3(0, 1.65 * matchModule.player.baseScale, 0)),
              dir = renderModule.camera.position.clone().sub(origin),
              len = dir.length();
            renderModule.cameraRay.set(origin, dir.normalize());
            renderModule.cameraRay.far = len;
            assert(
              !renderModule.cameraRay
                .intersectObjects(renderModule.cameraObstacles, false)
                .some((h) => h.distance < len - 0.1),
            );
          }
        }
      });
      test('P2', '重复判定显示释放共享几何体一次', () => {
        fresh();
        matchModule.game.showBoxes = true;
        trainingModule.drawCombatBoxes();
        const geo = trainingModule.debugBoxes[0].children[0].geometry;
        let disposed = 0;
        geo.addEventListener('dispose', () => disposed++);
        trainingModule.clearDebugBoxes();
        assert(disposed === 1 && trainingModule.debugBoxes.length === 0);
        matchModule.game.showBoxes = false;
      });
      test('P2', '重复开局无重复按键输入监听器', () => {
        fresh();
        for (let i = 0; i < 4; i++) matchModule.startFight();
        matchModule.game.ready = 0;
        matchModule.player.clearQueue();
        dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'KeyR',
            bubbles: true,
          }),
        );
        assert(combatModule.inputEdges.filter((x) => x.type === 'special').length === 1);
        inputModule.clearPresses();
        inputModule.keys.KeyR = false;
      });
      test('P2', '测试与菜单切换后模式及对手控件同步', () => {
        fresh(2, 4);
        matchModule.backToMenu();
        assert(
          document.getElementById('difficulty').value === matchModule.game.difficulty &&
            Number(document.getElementById('opponent').value) === matchModule.game.opponent,
        );
      });
      test('P2', '独立矩阵恢复首次调用前未定义的冻结标记', () => {
        const before = matchModule.game.manualTest;
        matchModule.game.manualTest = undefined;
        try {
          acceptanceMatrix = testingModule.runCollisionMatrix();
          assert(matchModule.game.manualTest === undefined);
        } finally {
          matchModule.game.manualTest = before;
        }
      });
      test('P2', '调试统计不修改战斗随机种子', () => {
        fresh();
        const seed = aiModule.tacticalSeed;
        matchModule.debugStats();
        assert(aiModule.tacticalSeed === seed);
      });
      test('P2', '诊断统计记录实际治疗与超时', () => {
        fresh();
        const before = matchModule.combatDiagnostics.rounds.length;
        const m = {
          enabled: matchModule.combatDiagnostics.enabled,
          collect: matchModule.game.collectTestStats,
        };
        matchModule.combatDiagnostics.enabled = true;
        matchModule.game.collectTestStats = true;
        matchModule.game.simTime = 180;
        worldModule.currentMap.senzuPickups = [
          {
            player: 1,
            heal: 12,
          },
          {
            player: 2,
            heal: 8,
          },
        ];
        matchModule.endGame('TIME UP');
        const r = matchModule.combatDiagnostics.rounds.at(-1);
        assert(r.duration === 180 && r.pickups === 2 && r.healed === 20 && r.reason === 'TIME UP');
        matchModule.combatDiagnostics.rounds.splice(before);
        matchModule.combatDiagnostics.enabled = m.enabled;
        matchModule.game.collectTestStats = m.collect;
      });
      if (group === 'all' || group === 'P0') {
        const matrix = acceptanceMatrix ?? testingModule.runCollisionMatrix();
        matchModule.game.lastCollisionMatrix = matrix;
        for (const r of matrix.rows)
          results.push({
            stage: 'P0',
            name:
              '跨角色 ' +
              r.attacker +
              ' → ' +
              r.target +
              ' ' +
              r.type +
              ' ' +
              r.pose +
              ' ' +
              r.direction +
              ' ' +
              r.distance +
              'm',
            pass: r.pass,
            expected: r.expected ? 'hit' : 'whiff',
            damage: r.damage,
            ...(!r.pass
              ? {
                  error: r.reason,
                }
              : {}),
          });
      }
    }
    Object.assign(matchModule.game, saved);
    matchModule.game.trainingDummy = 'idle';
    matchModule.game.keepPair = false;
    matchModule.game.manualTest = saved.manualTest;
    matchModule.game.ringOut = false;
    matchModule.backToMenu();
    const summary = {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      legacyTotal,
      newTotal: results.length - legacyTotal,
      results,
    };
    console.log('COMBAT TESTS', JSON.stringify(summary));
    return summary;
  };
  return function initialize() {
    COLLISION_EXPECTATIONS = [
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000111110111110111110000000000000000000000000',
      '110000000000110000000000110000110000110000000000110000110000110000000000000000000000000000',
      '110000000000110000000000110000110000110000000000110000111000110000000000000000000000000000',
      '110000000000110000000000110000110000110000000000110000111000110000000000000000000000000000',
      '110000000000110000000000111000110000110000000000111000111000111000000000000000000000000000',
      '110000000000110000000000110000110000110000000000111000110000110000000000000000000000000000',
      '110000000000110000000000110000110000110000000000110000110000111000000000000000000000000000',
      '110000000000110000000000110000110000110000000000110000111000110000000000000000000000000000',
      '110000000000110000000000111100111100110000000000111000111000111100000000000000000000000000',
      '111000000000110000000000111100111100110000000000111000111000111000000000000000000000000000',
      '111000000000111000000000111100111100111000000000111000111100111000000000000000000000000000',
      '111000000000111000000000111100111100111000000000111100111100111100000000000000000000000000',
      '111000000000111000000000111100111100111000000000111000111100111000000000000000000000000000',
      '110000000000110000000000111000110000110000000000111000111000111100000000000000000000000000',
      '111000000000111000000000111100111100111000000000111000111100111000000000000000000000000000',
      '110000000000111000000000110000110000111000000000111000111000111000000000000000000000000000',
      '111000000000111000000000111000111000111000000000111000111000111100000000000000000000000000',
      '111000000000111000000000111000111000111000000000111100111000111100000000000000000000000000',
      '111000000000111000000000111000111000111000000000111100111100111100000000000000000000000000',
      '111000000000111000000000111000111000111000000000111100111100111100000000000000000000000000',
      '110000000000111000000000110000110000111000000000110000000000111000000000000000000000000000',
      '111000000000111000000000111000111000111000000000111100111000111100000000000000000000000000',
      '111000000000110000000000110000110000111000000000000000000000110000000000000000000000000000',
      '111000000000111000000000110000110000111000000000110000000000110000000000000000000000000000',
      '111000000000111000000000110000110000111000000000110000110000110000000000000000000000000000',
      '111000000000111000000000110000111000110000000000111000111000111000000000000000000000000000',
      '111000000000111000000000110000111000111000000000111000110000110000000000000000000000000000',
      '110000000000111000000000110000000000111000000000000000000000110000000000000000000000000000',
      '111000000000111000000000110000110000111000000000110000110000110000000000000000000000000000',
      '110000000000100000000000111000111000110000000000110000110000000000000000000000000000000000',
      '110000000000100000000000111000111000110000000000110000110000000000000000000000000000000000',
      '110000000000100000000000110000111000110000000000110000000000000000000000000000000000000000',
      '110000000000100000000000110000110000110000000000111000000000000000000000000000000000000000',
      '110000000000100000000000110000111000110000000000110000000000000000000000000000000000000000',
      '110000000000100000000000111000111000110000000000110000110000000000000000000000000000000000',
      '110000000000100000000000110000111000110000000000110000000000000000000000000000000000000000',
      '110000000000110000000000111100111100110000000000111100111100111100000000000000000000000000',
      '110000000000110000000000111100111100111000000000111100111100111100000000000000000000000000',
      '111000000000111000000000111100111100111000000000111100111100111110000000000000000000000000',
      '111000000000111000000000111100111100111000000000111110111100111110000000000000000000000000',
      '111000000000111000000000111100111100111000000000111100111100111110000000000000000000000000',
      '110000000000110000000000111000110000110000000000111000111000111100000000000000000000000000',
      '111000000000111000000000111100111100111000000000111100111100111110000000000000000000000000',
    ];
  };
}
